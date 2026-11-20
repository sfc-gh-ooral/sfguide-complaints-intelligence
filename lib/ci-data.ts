// One interface for every screen. lib/mock-data.ts serves the bundled sample; lib/live-data.ts
// queries Snowflake. The API route (and the hosted /try/ build) choose between them.
import type { ActivityLog, Answer, CaseAction, ComplaintDetail, Draft, Overview, Queue, Redaction, Regulatory, ThemeInsight, Themes, View } from './types';

export interface CiData {
  overview(): Promise<Overview>;
  queue(view: View, product: string): Promise<Queue>;
  complaint(id: string): Promise<ComplaintDetail>;
  redact(id: string): Promise<Redaction>;
  draft(id: string): Promise<Draft>;
  updateCase(id: string, action: CaseAction, note: string, aiAssisted: boolean): Promise<{ ok: true }>;
  themes(): Promise<Themes>;
  themeInsight(themeId: string): Promise<ThemeInsight>;
  openIssue(themeId: string, owner: string, note: string): Promise<{ issueId: string }>;
  regulatory(): Promise<Regulatory>;
  activity(): Promise<ActivityLog>;
  ask(question: string): Promise<Answer>;
}

export const SUGGESTED_QUESTIONS = [
  'Which complaint subcategories grew the most from week 2 to week 3?',
  'How many open complaints are flagged for fair-lending review, by product?',
  'What share of resolved complaints were closed on time, by channel?',
  'How many open mortgage escrow complaints are due in the next 3 days?',
];
