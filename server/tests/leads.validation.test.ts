import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/errors.js';
import { parseCreateLeadInput, parseLeadId, parseSearch } from '../src/leads/leads.validation.js';

const valid = { name: 'Asha Rao', email: 'asha@example.com', phone: '+91 98765 43210' };

function fieldErrors(body: unknown): Record<string, string> | undefined {
  try {
    parseCreateLeadInput(body);
  } catch (err) {
    if (err instanceof HttpError) return err.details;
    throw err;
  }
  throw new Error('expected validation to fail');
}

describe('parseCreateLeadInput', () => {
  it('accepts and trims valid input', () => {
    expect(parseCreateLeadInput({ ...valid, name: '  Asha Rao  ' })).toEqual(valid);
  });

  it('ignores unknown fields such as status', () => {
    expect(parseCreateLeadInput({ ...valid, status: 'converted', id: 7 })).toEqual(valid);
  });

  it.each(['asha@example.com', 'first.last+tag@sub.example.co.in'])('accepts email %s', (email) => {
    expect(parseCreateLeadInput({ ...valid, email }).email).toBe(email);
  });

  it.each(['asha', 'asha@', '@example.com', 'asha@example', 'as ha@example.com'])(
    'rejects email %s',
    (email) => {
      expect(fieldErrors({ ...valid, email })).toEqual({ email: 'Email must be a valid email address' });
    },
  );

  it.each(['9876543210', '+91 98765 43210', '(022) 555-0000', '022.555.0000'])('accepts phone %s', (phone) => {
    expect(parseCreateLeadInput({ ...valid, phone }).phone).toBe(phone);
  });

  it.each(['abc', '12345', '+91 98765 43210 12345', '98765x43210', '++919876543210'])(
    'rejects phone %s',
    (phone) => {
      expect(fieldErrors({ ...valid, phone })).toEqual({ phone: 'Phone must be a valid phone number' });
    },
  );

  it('rejects a name longer than 100 characters', () => {
    expect(fieldErrors({ ...valid, name: 'a'.repeat(101) })).toEqual({
      name: 'Name must be at most 100 characters',
    });
  });

  it('treats non-string values as missing', () => {
    expect(fieldErrors({ name: 123, email: null, phone: ['9876543210'] })).toEqual({
      name: 'Name is required',
      email: 'Email is required',
      phone: 'Phone is required',
    });
  });
});

describe('parseLeadId', () => {
  it('parses a positive integer', () => {
    expect(parseLeadId('42')).toBe(42);
  });

  it('accepts the largest PostgreSQL INTEGER', () => {
    expect(parseLeadId('2147483647')).toBe(2147483647);
  });

  it.each(['0', '-1', '1.5', '1e3', 'abc', '', '2147483648'])('rejects %s', (id) => {
    expect(() => parseLeadId(id)).toThrow(HttpError);
  });
});

describe('parseSearch', () => {
  it('returns undefined when there is nothing to search for', () => {
    expect(parseSearch(undefined)).toBeUndefined();
    expect(parseSearch('   ')).toBeUndefined();
  });

  it('trims the search term', () => {
    expect(parseSearch('  asha ')).toBe('asha');
  });

  it('rejects arrays and overly long terms', () => {
    expect(() => parseSearch(['a', 'b'])).toThrow(HttpError);
    expect(() => parseSearch('x'.repeat(101))).toThrow(HttpError);
  });
});
