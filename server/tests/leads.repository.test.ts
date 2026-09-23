import { readFile } from 'node:fs/promises';
import { escapeIdentifier } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pool } from '../src/db.js';
import type { LeadFilters } from '../src/leads/lead.types.js';
import {
  createLead,
  deleteLead,
  DuplicateEmailError,
  listLeads,
  updateLeadStatus,
} from '../src/leads/leads.repository.js';

// Runs in a temporary schema that is dropped afterwards, so TEST_DATABASE_URL
// can safely point at the development database.
const { schema } = vi.hoisted(() => ({
  schema: `"test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}"`,
}));

// The pool waits for onConnect, so every connection is bound to the temporary
// schema before the repository gets it.
vi.mock('../src/db.js', async () => {
  const { Pool } = await import('pg');
  return {
    pool: new Pool({
      connectionString: process.env.TEST_DATABASE_URL,
      onConnect: async (client) => {
        await client.query(`SET search_path TO ${schema}`);
      },
    }),
  };
});

const allOnOnePage = { page: 1, limit: 100 };

describe.skipIf(!process.env.TEST_DATABASE_URL)('leads repository (PostgreSQL)', () => {
  beforeAll(async () => {
    await pool.query(`CREATE SCHEMA ${schema}`);
    const { rows } = await pool.query<{ schema: string }>('SELECT current_schema() AS schema');
    if (escapeIdentifier(rows[0]?.schema ?? '') !== schema) {
      throw new Error('Temporary schema is not active; refusing to run database tests');
    }

    const schemaSql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await pool.query(schemaSql);
  });

  beforeEach(async () => {
    // Schema-qualified so this can never empty the real table.
    await pool.query(`TRUNCATE ${schema}.leads RESTART IDENTITY`);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it('creates a lead with status "new" and matching creation and update times', async () => {
    const lead = await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });

    expect(lead).toEqual({
      id: 1,
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '9876543210',
      status: 'new',
      createdAt: expect.any(Date),
      updatedAt: lead.createdAt,
    });
  });

  it('rejects a duplicate email regardless of case', async () => {
    await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });

    await expect(
      createLead({ name: 'Someone Else', email: 'ASHA@Example.com', phone: '9123456789' }),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  describe('listLeads', () => {
    beforeEach(async () => {
      await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '+91 98765 43210' });
      await createLead({ name: 'Ravi 50% Off', email: 'ravi@shop.in', phone: '(022) 555 0000' });
      await createLead({ name: 'Meera_Iyer', email: 'meera@mail.com', phone: '9123456789' });
    });

    const namesFor = async (filters: LeadFilters = {}) =>
      (await listLeads({ ...allOnOnePage, ...filters })).leads.map((lead) => lead.name);

    it('returns leads newest first', async () => {
      expect(await namesFor()).toEqual(['Meera_Iyer', 'Ravi 50% Off', 'Asha Rao']);
    });

    it('searches name, email and phone, ignoring case', async () => {
      expect(await namesFor({ search: 'ASHA' })).toEqual(['Asha Rao']);
      expect(await namesFor({ search: 'shop.in' })).toEqual(['Ravi 50% Off']);
      expect(await namesFor({ search: '555 0000' })).toEqual(['Ravi 50% Off']);
    });

    it('matches every word of the search term, in any order and any field', async () => {
      expect(await namesFor({ search: 'rao asha' })).toEqual(['Asha Rao']);
      expect(await namesFor({ search: 'ravi shop.in' })).toEqual(['Ravi 50% Off']);
      expect(await namesFor({ search: 'asha shop.in' })).toEqual([]);
    });

    it('finds a phone number typed without its spaces or punctuation', async () => {
      expect(await namesFor({ search: '9876543210' })).toEqual(['Asha Rao']);
      expect(await namesFor({ search: '+91-98765-43210' })).toEqual(['Asha Rao']);
      expect(await namesFor({ search: '0225550000' })).toEqual(['Ravi 50% Off']);
    });

    it('does not match phones on the digits of a term that is not a phone number', async () => {
      expect(await namesFor({ search: 'asha9' })).toEqual([]);
    });

    it('treats LIKE wildcards in the search term literally', async () => {
      expect(await namesFor({ search: '%' })).toEqual(['Ravi 50% Off']);
      expect(await namesFor({ search: '_' })).toEqual(['Meera_Iyer']);
    });

    it('returns an empty list when nothing matches', async () => {
      expect(await namesFor({ search: 'nobody' })).toEqual([]);
      expect(await namesFor({ search: "' OR 1=1 --" })).toEqual([]);
    });

    it('filters by status, alone or combined with a search term', async () => {
      const [meera, ravi] = (await listLeads(allOnOnePage)).leads;
      await updateLeadStatus(meera!.id, 'qualified');
      await updateLeadStatus(ravi!.id, 'qualified');

      expect(await namesFor({ status: 'qualified' })).toEqual(['Meera_Iyer', 'Ravi 50% Off']);
      expect(await namesFor({ status: 'new' })).toEqual(['Asha Rao']);
      expect(await namesFor({ status: 'qualified', search: 'ravi' })).toEqual(['Ravi 50% Off']);
      expect(await namesFor({ status: 'lost' })).toEqual([]);
    });

    it('pages through the leads newest first and reports the total', async () => {
      expect(await listLeads({ page: 1, limit: 2 })).toMatchObject({
        total: 3,
        leads: [{ name: 'Meera_Iyer' }, { name: 'Ravi 50% Off' }],
      });
      expect(await listLeads({ page: 2, limit: 2 })).toMatchObject({
        total: 3,
        leads: [{ name: 'Asha Rao' }],
      });
    });

    it('counts only the filtered leads, even past the last page', async () => {
      expect(await listLeads({ search: 'ravi', page: 1, limit: 2 })).toMatchObject({ total: 1 });
      expect(await listLeads({ search: 'ravi', page: 5, limit: 2 })).toEqual({ leads: [], total: 1 });
    });
  });

  describe('updateLeadStatus', () => {
    it('updates and returns the lead', async () => {
      const { id } = await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });

      const updated = await updateLeadStatus(id, 'qualified');

      expect(updated).toMatchObject({ id, status: 'qualified' });
      expect((await listLeads(allOnOnePage)).leads[0]?.status).toBe('qualified');
    });

    const longAgo = new Date('2020-01-01T00:00:00.000Z');

    async function insertOldLead(): Promise<number> {
      const { rows } = await pool.query<{ id: number }>(
        `INSERT INTO leads (name, email, phone, created_at, updated_at)
         VALUES ('Asha Rao', 'asha@example.com', '9876543210', $1, $1)
         RETURNING id`,
        [longAgo],
      );
      return rows[0]!.id;
    }

    it('bumps updated_at but not created_at', async () => {
      const id = await insertOldLead();

      const updated = await updateLeadStatus(id, 'contacted');

      expect(updated?.createdAt).toEqual(longAgo);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(longAgo.getTime());
    });

    it('leaves updated_at alone when the status does not change', async () => {
      const id = await insertOldLead();

      const updated = await updateLeadStatus(id, 'new');

      expect(updated?.updatedAt).toEqual(longAgo);
    });

    it('returns null for an unknown id', async () => {
      expect(await updateLeadStatus(999, 'lost')).toBeNull();
    });
  });

  describe('deleteLead', () => {
    it('deletes only the given lead', async () => {
      const asha = await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });
      await createLead({ name: 'Ravi Kumar', email: 'ravi@example.com', phone: '9123456789' });

      expect(await deleteLead(asha.id)).toBe(true);

      const { leads, total } = await listLeads(allOnOnePage);
      expect(leads.map((lead) => lead.name)).toEqual(['Ravi Kumar']);
      expect(total).toBe(1);
    });

    it('returns false for an unknown or already deleted id', async () => {
      const { id } = await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });
      await deleteLead(id);

      expect(await deleteLead(id)).toBe(false);
      expect(await deleteLead(999)).toBe(false);
    });

    it('frees the email for a new lead', async () => {
      const { id } = await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });
      await deleteLead(id);

      await expect(
        createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' }),
      ).resolves.toMatchObject({ email: 'asha@example.com' });
    });
  });
});
