import { readFile } from 'node:fs/promises';
import { escapeIdentifier } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pool } from '../src/db.js';
import {
  createLead,
  DuplicateEmailError,
  listLeads,
  updateLeadStatus,
} from '../src/leads/leads.repository.js';

// Runs the real SQL against PostgreSQL. Skipped unless TEST_DATABASE_URL is set.
//
// Everything happens in a temporary schema that is dropped afterwards, so
// TEST_DATABASE_URL may point at the same database as DATABASE_URL without
// touching its data.
const schema = escapeIdentifier(`test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

describe.skipIf(!process.env.TEST_DATABASE_URL)('leads repository (PostgreSQL)', () => {
  beforeAll(async () => {
    // Every pooled connection uses the temporary schema. Queries on a client
    // run in order, so this SET always runs before the test's own query.
    pool.on('connect', (client) => {
      void client.query(`SET search_path TO ${schema}`);
    });

    await pool.query(`CREATE SCHEMA ${schema}`);
    const { rows } = await pool.query<{ schema: string }>('SELECT current_schema() AS schema');
    if (escapeIdentifier(rows[0]?.schema ?? '') !== schema) {
      throw new Error('Temporary schema is not active; refusing to run database tests');
    }

    const schemaSql = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await pool.query(schemaSql);
  });

  beforeEach(async () => {
    // Schema-qualified on purpose: this can only ever empty the temporary table.
    await pool.query(`TRUNCATE ${schema}.leads RESTART IDENTITY`);
  });

  afterAll(async () => {
    await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.end();
  });

  it('creates a lead with status "new" and a creation time', async () => {
    const lead = await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });

    expect(lead).toEqual({
      id: 1,
      name: 'Asha Rao',
      email: 'asha@example.com',
      phone: '9876543210',
      status: 'new',
      createdAt: expect.any(Date),
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

    const namesFor = async (search?: string) => (await listLeads(search)).map((lead) => lead.name);

    it('returns leads newest first', async () => {
      expect(await namesFor()).toEqual(['Meera_Iyer', 'Ravi 50% Off', 'Asha Rao']);
    });

    it('searches name, email and phone, ignoring case', async () => {
      expect(await namesFor('ASHA')).toEqual(['Asha Rao']);
      expect(await namesFor('shop.in')).toEqual(['Ravi 50% Off']);
      expect(await namesFor('555 0000')).toEqual(['Ravi 50% Off']);
    });

    it('treats LIKE wildcards in the search term literally', async () => {
      expect(await namesFor('%')).toEqual(['Ravi 50% Off']);
      expect(await namesFor('_')).toEqual(['Meera_Iyer']);
    });

    it('returns an empty list when nothing matches', async () => {
      expect(await namesFor('nobody')).toEqual([]);
      expect(await namesFor("' OR 1=1 --")).toEqual([]);
    });
  });

  describe('updateLeadStatus', () => {
    it('updates and returns the lead', async () => {
      const { id } = await createLead({ name: 'Asha Rao', email: 'asha@example.com', phone: '9876543210' });

      const updated = await updateLeadStatus(id, 'qualified');

      expect(updated).toMatchObject({ id, status: 'qualified' });
      expect((await listLeads())[0]?.status).toBe('qualified');
    });

    it('returns null for an unknown id', async () => {
      expect(await updateLeadStatus(999, 'lost')).toBeNull();
    });
  });
});
