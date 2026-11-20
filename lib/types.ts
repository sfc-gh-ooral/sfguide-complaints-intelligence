// Shared types for both data sources (bundled sample and live Snowflake).
export interface Provenance { source: 'mock' | 'snowflake'; role?: string; latencyMs?: number }

export const PRODUCTS = ['Deposits', 'Credit card', 'Mortgage', 'Auto loan'] as const;
export const CHANNELS = ['Call', 'Email', 'Branch', 'Social', 'Regulator portal'] as const;
export const FLAGS = ['UDAAP', 'Fair lending', 'Servicing'] as const;
export type Flag = (typeof FLAGS)[number];

/** Saved views in the complaint queue. */
export const VIEWS = {
  open: 'All open',
  'fair-lending': 'Fair-lending review',
  'due-soon': 'Due in 3 days',
  overdue: 'Overdue',
  duplicates: 'Likely duplicates',
  udaap: 'UDAAP flagged',
} as const;
export type View = keyof typeof VIEWS;

export interface ComplaintRow {
  complaint_id: string; customer_id: string; received_date: string; due_date: string; channel: string; product: string;
  status: string; subcategory: string; category: string; flags: Flag[]; sentiment: string; days_to_due: number;
  duplicate_of: string | null; routed_to: string | null;
}

export interface Overview extends Provenance {
  asOf: string;
  kpis: { total: number; open: number; highRisk: number; onTimeRate: number; resolved: number; overdue: number; dueSoon: number; fairLending: number; duplicates: number };
  weekly: { week: number; start: string; Deposits: number; 'Credit card': number; Mortgage: number; 'Auto loan': number }[];
  channels: { channel: string; complaints: number; highRisk: number }[];
  flags: { flag: Flag; complaints: number; open: number }[];
  aging: { bucket: string; open: number }[];
  dueSoon: ComplaintRow[];
  /** Where the next three days' deadlines sit, and what share of that theme's open complaints is due. */
  dueSoonBy: { subcategory: string; product: string; open: number; shareOfOpen: number }[];
}

export interface Queue extends Provenance { view: View; product: string; total: number; rows: ComplaintRow[] }

export interface Complaint extends ComplaintRow {
  regulator_product: string; regulator_issue: string; resolution: string | null; resolved_date: string | null; age_days: number;
  duplicate_similarity: number | null;
  related: { complaint_id: string; received_date: string; channel: string; subcategory: string; status: string; similarity: number | null }[];
  history: { status: string; routed_to: string | null; note: string | null; updated_by: string; updated_ts: string }[];
}
export interface ComplaintDetail extends Provenance { complaint: Complaint | null }
export interface Redaction extends Provenance { complaintId: string; text: string; cached: boolean }
export interface Draft extends Provenance { complaintId: string; draft: string; model: string; cached: boolean }

export interface Theme {
  theme_id: string; subcategory: string; product: string; category: string;
  weekly: number[]; total: number; highRisk: number;
  peakWeek: number; peakGrowth: number; latestGrowth: number; issues: number;
}
export interface Themes extends Provenance { weeks: { week: number; start: string }[]; themes: Theme[] }
export interface ThemeInsight extends Provenance { themeId: string; week: number; summary: string; quotes: string[]; model: string; cached: boolean }

export interface RegulatoryRow { regulator_product: string; regulator_issue: string; subcategory: string; complaints: number; open: number; high_risk: number; on_time_rate: number | null }
export interface Regulatory extends Provenance { rows: RegulatoryRow[] }

export interface Activity { action: string; object_type: string; object_id: string; detail: string; ai_assisted: boolean; actor: string; ts: string }
export interface ActivityLog extends Provenance { items: Activity[] }

export interface Answer extends Provenance { question: string; text: string; sql: string | null; tools: string[] }

export type CaseAction = 'Start work' | 'Route to fair-lending review' | 'Resolve' | 'Link as duplicate';
