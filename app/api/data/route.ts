import { NextResponse } from 'next/server';
import type { CiData } from '@/lib/ci-data';
import { mockData } from '@/lib/mock-data';
import { isSnowflakeConfigured } from '@/lib/snowflake';

// One entry point for every screen. Uses Snowflake when .env.local is configured and the user hasn't
// switched to Sample (x-ci-mode: sample); otherwise the bundled synthetic data. Live failures are
// returned as errors, never silently replaced with sample data.
const OPS = new Set<keyof CiData>(['overview', 'queue', 'complaint', 'redact', 'draft', 'updateCase', 'themes', 'themeInsight', 'openIssue', 'regulatory', 'activity', 'ask']);

export async function POST(request: Request) {
  const { op, args } = await request.json();
  if (!OPS.has(op) || !Array.isArray(args) || args.length > 4 || !args.every((a) => ['string', 'boolean'].includes(typeof a))) return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  const wantSample = request.headers.get('x-ci-mode') === 'sample';
  const impl: CiData = isSnowflakeConfigured() && !wantSample ? (await import('@/lib/live-data')).liveData : mockData;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (impl[op as keyof CiData] as (...a: any[]) => Promise<unknown>)(...args);
    return NextResponse.json(result ?? { notFound: true });
  } catch (error) {
    console.error(`${op} failed:`, error);
    return NextResponse.json({ error: String(error instanceof Error ? error.message : error) }, { status: 502 });
  }
}
