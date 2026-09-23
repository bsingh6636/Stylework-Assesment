import { DatabaseError } from 'pg';
import { pool } from '../db.js';
import type { CreateLeadInput, Lead, LeadStatus } from './lead.types.js';

interface LeadRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  created_at: Date;
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
  };
}

// Escape LIKE wildcards so that searching for "50%" or "a_b" matches literally.
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export async function listLeads(search?: string): Promise<Lead[]> {
  const term = search?.trim();
  const pattern = term ? `%${escapeLikePattern(term)}%` : null;

  const { rows } = await pool.query<LeadRow>(
    `SELECT id, name, email, phone, status, created_at
       FROM leads
      WHERE $1::text IS NULL
         OR name ILIKE $1
         OR email ILIKE $1
         OR phone ILIKE $1
      ORDER BY created_at DESC, id DESC`,
    [pattern],
  );
  return rows.map(toLead);
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  try {
    const { rows } = await pool.query<LeadRow>(
      `INSERT INTO leads (name, email, phone)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, phone, status, created_at`,
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
      RETURNING id, name, email, phone, status, created_at`,
    [id, status],
  );
  const row = rows[0];
  return row ? toLead(row) : null;
}
