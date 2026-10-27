import { z } from 'zod/v4';

/**
 * Kitsune Finance — Zod Schemas
 * Rigorous typing for Open Finance (Pluggy SDK) data models.
 * All financial values use number (cents-safe operations handled upstream).
 */

// ── Currency Code (ISO 4217) ──
const CurrencyCode = z.string().length(3).default('BRL');

// ── Transaction Schema ──
export const TransactionSchema = z.object({
  id: z.string().min(1),
  amount: z.number(),
  currency: CurrencyCode,
  description: z.string(),
  category: z.string().nullable(),
  subcategory: z.string().nullable().optional(),
  type: z.enum(['INFLOW', 'OUTFLOW']),
  status: z.enum(['PENDING', 'PROCESSED', 'FAILED']),
  value_date: z.iso.datetime(),
  accounting_date: z.iso.datetime().optional(),
  merchant: z
    .object({
      name: z.string().optional(),
      website: z.url().optional(),
      logo: z.url().optional(),
    })
    .optional(),
  reference: z.string().optional(),
});

// ── Account Schema ──
export const AccountSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum([
    'CHECKING',
    'SAVINGS',
    'CREDIT_CARD',
    'INVESTMENT',
    'LOAN',
  ]),
  number: z.string().optional(),
  balance: z.object({
    current: z.number(),
    available: z.number(),
  }),
  institution: z.object({
    name: z.string(),
    type: z.string(),
    logo: z.url().optional(),
  }),
  currency: CurrencyCode,
  last_accessed_at: z.iso.datetime().optional(),
});

// ── Investment Schema (Pluggy-compatible) ──
export const InvestmentSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum([
    'FIXED_INCOME',
    'MUTUAL_FUND',
    'EQUITY',
    'ETF',
    'CRYPTO',
    'OTHER',
  ]),
  balance: z.number(),
  profitability: z.number().optional(),
  annual_rate: z.number().optional(),
  institution: z.object({
    name: z.string(),
    type: z.string(),
  }),
  currency: CurrencyCode,
  open_date: z.iso.date().optional(),
  due_date: z.iso.date().optional(),
});

// ── Portfolio Aggregation ──
export const PortfolioSchema = z.object({
  total_balance: z.number(),
  total_invested: z.number(),
  total_debt: z.number(),
  net_worth: z.number(),
  accounts: z.array(AccountSchema),
  investments: z.array(InvestmentSchema),
  last_sync: z.iso.datetime(),
});

// ── AI Insight (Kitsune Core) ──
export const AIInsightSchema = z.object({
  id: z.string(),
  type: z.enum(['ALERT', 'RECOMMENDATION', 'ANALYSIS', 'FORECAST']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  title: z.string(),
  body: z.string(),
  action_label: z.string().optional(),
  action_url: z.string().optional(),
  created_at: z.iso.datetime(),
  read: z.boolean().default(false),
});

// ── Inferred TypeScript Types ──
export type Transaction = z.infer<typeof TransactionSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type Investment = z.infer<typeof InvestmentSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type AIInsight = z.infer<typeof AIInsightSchema>;


// ── Family Member Schema ──
export const FamilyMemberSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1),
  role: z.string().default('Membro'),
  avatar_url: z.string().url().optional().nullable(),
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
});

// ── Bank Account Schema (Family Relational Model) ──
export const BankAccountSchema = z.object({
  id: z.string().uuid(),
  family_member_id: z.string().uuid(),
  user_id: z.string().uuid(),
  item_id: z.string(),
  pluggy_account_id: z.string().optional().nullable(),
  bank_name: z.string(),
  type: z.string(),
  balance: z.number(),
  currency: CurrencyCode,
  created_at: z.iso.datetime().optional(),
  updated_at: z.iso.datetime().optional(),
});

export type FamilyMember = z.infer<typeof FamilyMemberSchema>;
export type BankAccount = z.infer<typeof BankAccountSchema>;
