import { HttpError } from '../errors.js';
import { LEAD_STATUSES, type CreateLeadInput, type LeadStatus } from './lead.types.js';

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_SEARCH_LENGTH = 100;
const MAX_POSTGRES_INTEGER = 2_147_483_647;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

const INVALID_STATUS_MESSAGE = `Status must be one of: ${LEAD_STATUSES.join(', ')}`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s\-().]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLeadStatus(value: unknown): value is LeadStatus {
  return typeof value === 'string' && (LEAD_STATUSES as readonly string[]).includes(value);
}

function trimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toPositiveInteger(value: unknown, max: number): number | null {
  const number = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isInteger(number) && number >= 1 && number <= max ? number : null;
}

export function parseCreateLeadInput(body: unknown): CreateLeadInput {
  if (!isRecord(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }

  const name = trimmedString(body.name);
  const email = trimmedString(body.email);
  const phone = trimmedString(body.phone);
  const errors: Record<string, string> = {};

  if (!name) {
    errors.name = 'Name is required';
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.name = `Name must be at most ${MAX_NAME_LENGTH} characters`;
  }

  if (!email) {
    errors.email = 'Email is required';
  } else if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Email must be a valid email address';
  }

  // E.164 allows at most 15 digits; fewer than 7 is not a real phone number.
  const digitCount = phone.replace(/\D/g, '').length;
  if (!phone) {
    errors.phone = 'Phone is required';
  } else if (!PHONE_PATTERN.test(phone) || digitCount < 7 || digitCount > 15) {
    errors.phone = 'Phone must be a valid phone number';
  }

  if (Object.keys(errors).length > 0) {
    throw new HttpError(400, 'Validation failed', errors);
  }
  return { name, email, phone };
}

export function parseLeadStatus(body: unknown): LeadStatus {
  if (!isRecord(body)) {
    throw new HttpError(400, 'Request body must be a JSON object');
  }
  if (!isLeadStatus(body.status)) {
    throw new HttpError(400, 'Validation failed', { status: INVALID_STATUS_MESSAGE });
  }
  return body.status;
}

export function parseStatusFilter(value: unknown): LeadStatus | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (!isLeadStatus(value)) {
    throw new HttpError(400, INVALID_STATUS_MESSAGE);
  }
  return value;
}

export function parseLeadId(value: string): number {
  const id = toPositiveInteger(value, MAX_POSTGRES_INTEGER);
  if (id === null) {
    throw new HttpError(400, 'Lead id must be a positive integer');
  }
  return id;
}

// Capped so that the offset, (page - 1) * limit, stays a safe integer.
export function parsePage(value: unknown): number {
  if (value === undefined || value === '') {
    return 1;
  }
  const page = toPositiveInteger(value, MAX_POSTGRES_INTEGER);
  if (page === null) {
    throw new HttpError(400, 'page must be a positive integer');
  }
  return page;
}

export function parseLimit(value: unknown): number {
  if (value === undefined || value === '') {
    return DEFAULT_PAGE_SIZE;
  }
  const limit = toPositiveInteger(value, MAX_PAGE_SIZE);
  if (limit === null) {
    throw new HttpError(400, `limit must be an integer from 1 to ${MAX_PAGE_SIZE}`);
  }
  return limit;
}

export function parseSearch(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, 'search must be a single string');
  }
  const term = value.trim();
  if (term.length > MAX_SEARCH_LENGTH) {
    throw new HttpError(400, `search must be at most ${MAX_SEARCH_LENGTH} characters`);
  }
  return term || undefined;
}
