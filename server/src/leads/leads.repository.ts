import { DatabaseError } from 'pg';
import { pool } from '../db.js';
import type { CreateLeadInput, Lead, LeadListQuery, LeadStatus } from './lead.types.js';

const LEAD_COLUMNS = 'id, name, email, phone, status, created_at, updated_at';

interface LeadRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  created_at: Date;
  updated_at: Date;
}

export class DuplicateEmailError extends Error {
  constructor(email: string) {
    super(`A lead with email ${email} already exists`);
    this.name = 'DuplicateEmailError';
  }
}

function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Escape LIKE wildcards so that searching for "50%" or "a_b" matches literally.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

const LIST_FILTER = `($1::text IS NULL OR name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1)
    AND ($2::text IS NULL OR status = $2)`;

export async function listLeads({
  search,
  status,
  page,
  limit,
}: LeadListQuery): Promise<{ leads: Lead[]; total: number }> {
  const term = search?.trim();
  const pattern = term ? `%${escapeLikePattern(term)}%` : null;
  const filterParams = [pattern, status ?? null];

  // Separate queries so the total is still known when the page is past the end.
  const [pageResult, countResult] = await Promise.all([
    pool.query<LeadRow>(
      `SELECT ${LEAD_COLUMNS}
         FROM leads
        WHERE ${LIST_FILTER}
        ORDER BY created_at DESC, id DESC
        LIMIT $3 OFFSET $4`,
      [...filterParams, limit, (page - 1) * limit],
    ),
    pool.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM leads WHERE ${LIST_FILTER}`,
      filterParams,
    ),
  ]);
  return { leads: pageResult.rows.map(toLead), total: countResult.rows[0]!.total };
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  try {
    const { rows } = await pool.query<LeadRow>(
      `INSERT INTO leads (name, email, phone)
       VALUES ($1, $2, $3)
       RETURNING ${LEAD_COLUMNS}`,
      [input.name, input.email, input.phone],
    );
    return toLead(rows[0]!);
  } catch (err) {
    if (err instanceof DatabaseError && err.constraint === 'leads_email_lower_key') {
      throw new DuplicateEmailError(input.email);
    }
    throw err;
  }
}

export async function updateLeadStatus(id: number, status: LeadStatus): Promise<Lead | null> {
  const { rows } = await pool.query<LeadRow>(
    `UPDATE leads
        SET status = $2
      WHERE id = $1
      RETURNING ${LEAD_COLUMNS}`,
    [id, status],
  );
  const row = rows[0];
  return row ? toLead(row) : null;
}
