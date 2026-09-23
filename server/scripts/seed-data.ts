import { LEAD_STATUSES, type LeadStatus } from '../src/leads/lead.types.js';

const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Ananya', 'Arjun', 'Diya', 'Ishaan', 'Kabir', 'Kavya', 'Meera', 'Neha',
  'Nikhil', 'Pooja', 'Priya', 'Rahul', 'Riya', 'Rohan', 'Sana', 'Siddharth', 'Tanvi', 'Vikram',
] as const;

const LAST_NAMES = [
  'Agarwal', 'Bose', 'Chopra', 'Das', 'Gupta', 'Iyer', 'Joshi', 'Kapoor', 'Khan', 'Mehta',
  'Menon', 'Nair', 'Patel', 'Rao', 'Reddy', 'Shah', 'Sharma', 'Singh', 'Verma', 'Yadav',
] as const;

// Reserved for examples (RFC 2606), so seeded emails can never reach a real inbox.
const EMAIL_DOMAINS = ['example.com', 'example.org', 'example.net'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_DAYS = 90;

export interface SeedLead {
  name: string;
  email: string;
  phone: string;
  status: LeadStatus;
  createdAt: Date;
  updatedAt: Date;
}

export function generateLeads(count: number, now = new Date(), random: () => number = Math.random): SeedLead[] {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const digits = (length: number) => Array.from({ length }, () => Math.floor(random() * 10)).join('');

  const leads: SeedLead[] = [];
  const emails = new Set<string>();

  while (leads.length < count) {
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const email = `${first}.${last}${digits(4)}@${pick(EMAIL_DOMAINS)}`.toLowerCase();
    if (emails.has(email)) continue;
    emails.add(email);

    const status = pick(LEAD_STATUSES);
    const createdAt = new Date(now.getTime() - random() * MAX_AGE_DAYS * DAY_MS);
    // A lead still marked "new" has never been updated.
    const updatedAt =
      status === 'new' ? createdAt : new Date(createdAt.getTime() + random() * (now.getTime() - createdAt.getTime()));

    leads.push({
      name: `${first} ${last}`,
      email,
      phone: `+91 9${digits(4)} ${digits(5)}`,
      status,
      createdAt,
      updatedAt,
    });
  }
  return leads;
}
