import { describe, expect, it } from 'vitest';
import { HttpError } from '../src/errors.js';
import {
  parseCreateLeadInput,
  parseLeadId,
  parseLimit,
  parsePage,
  parseSearch,
  parseStatusFilter,
} from '../src/leads/leads.validation.js';

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

  it('collapses runs of whitespace and line breaks to single spaces', () => {
    expect(
      parseCreateLeadInput({ name: 'Asha \n  Rao', email: valid.email, phone: '+91   98765\t43210' }),
    ).toEqual(valid);
    expect(parseCreateLeadInput({ ...valid, phone: `98765${' '.repeat(5000)}43210` }).phone).toBe(
      '98765 43210',
    );
  });

  it('normalizes Unicode so the same name is always stored the same way', () => {
    // 'e' followed by a combining accent becomes the single character 'é'.
    expect(parseCreateLeadInput({ ...valid, name: 'Jose\u0301' }).name).toBe('Jos\u00e9');
  });

  it('treats a name made only of invisible characters as missing', () => {
    // Zero-width spaces and a byte order mark around a normal space.
    expect(fieldErrors({ ...valid, name: '\u200b \ufeff\u200b' })).toEqual({ name: 'Name is required' });
  });

  it('rejects control characters such as NUL', () => {
    expect(fieldErrors({ ...valid, name: 'Asha\u0000Rao' })).toEqual({ name: 'Name contains invalid characters' });
    expect(fieldErrors({ ...valid, email: 'asha\u0000@example.com' })).toEqual({
      email: 'Email must be a valid email address',
    });
  });

  it('ignores unknown fields such as status', () => {
    expect(parseCreateLeadInput({ ...valid, status: 'converted', id: 7 })).toEqual(valid);
  });

  it.each(['asha@example.com', 'first.last+tag@sub.example.co.in'])('accepts email %s', (email) => {
    expect(parseCreateLeadInput({ ...valid, email }).email).toBe(email);
  });

  it.each([
    'asha',
    'asha@',
    '@example.com',
    'asha@example',
    'as ha@example.com',
    'asha@.example.com',
    'asha@example..com',
    'asha@example.com.',
  ])(
    'rejects email %s',
    (email) => {
      expect(fieldErrors({ ...valid, email })).toEqual({ email: 'Email must be a valid email address' });
    },
  );

  it.each(['9876543210', '+91 98765 43210', '(022) 555-0000', '022.555.0000'])('accepts phone %s', (phone) => {
    expect(parseCreateLeadInput({ ...valid, phone }).phone).toBe(phone);
  });

  it.each([
    'abc',
    '12345',
    '+91 98765 43210 12345',
    '98765x43210',
    '++919876543210',
    '9 - 8 - 7 - 6 - 5 - 4 - 3 - 2 - 1',
  ])(
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

  it('trims the search term and collapses inner whitespace', () => {
    expect(parseSearch('  asha ')).toBe('asha');
    expect(parseSearch(' asha \t  rao ')).toBe('asha rao');
  });

  it('rejects arrays, overly long terms and control characters', () => {
    expect(() => parseSearch(['a', 'b'])).toThrow(HttpError);
    expect(() => parseSearch('x'.repeat(101))).toThrow(HttpError);
    expect(() => parseSearch('asha\u0000')).toThrow(HttpError);
  });
});

describe('parseStatusFilter', () => {
  it('returns undefined when no status is given', () => {
    expect(parseStatusFilter(undefined)).toBeUndefined();
    expect(parseStatusFilter('')).toBeUndefined();
  });

  it('accepts a known status', () => {
    expect(parseStatusFilter('converted')).toBe('converted');
  });

  it.each(['archived', 'New', ['new', 'lost'], 1])('rejects %j', (value) => {
    expect(() => parseStatusFilter(value)).toThrow(HttpError);
  });
});

describe('parsePage', () => {
  it('defaults to the first page', () => {
    expect(parsePage(undefined)).toBe(1);
    expect(parsePage('')).toBe(1);
  });

  it('parses a positive integer', () => {
    expect(parsePage('7')).toBe(7);
  });

  it.each(['0', '-1', '1.5', '1e3', 'abc', '2147483648', ['1', '2']])('rejects %j', (value) => {
    expect(() => parsePage(value)).toThrow(HttpError);
  });
});

describe('parseLimit', () => {
  it('defaults to 20 per page', () => {
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit('')).toBe(20);
  });

  it('accepts 1 to 100', () => {
    expect(parseLimit('1')).toBe(1);
    expect(parseLimit('100')).toBe(100);
  });

  it.each(['0', '101', '-5', '2.5', 'all', ['10', '20']])('rejects %j', (value) => {
    expect(() => parseLimit(value)).toThrow(HttpError);
  });
});
