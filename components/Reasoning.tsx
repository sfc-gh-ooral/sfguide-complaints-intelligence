'use client';

// Staged progress for AI calls ("reasoning ledger"). Screens pass steps with real counts from the data;
// the defaults mirror what the live path does. Steps advance on a timer and the last one holds until
// the live (or sample) answer arrives.
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';

export type ReasoningKind = 'redact' | 'draft' | 'insight' | 'ask';

const DEFAULT_STEPS: Record<ReasoningKind, string[]> = {
  redact: ['Reading the complaint text', 'Finding names, phone numbers, emails and account numbers with AI_REDACT', 'Replacing them with placeholders'],
  draft: ['Masking PII with AI_REDACT', 'Reading the AI category and the due date', 'Drafting the response with AI_COMPLETE', 'Saving the draft for review'],
  insight: ['Counting complaints in the peak week', 'Summarizing the root cause with AI_AGG', 'Masking example quotes with AI_REDACT', 'Caching the theme insight'],
  ask: ['Sending the question to the Cortex Agent', 'Planning which tool to call', 'Writing SQL with Cortex Analyst on COMPLAINTS_SV', 'Running the SQL and writing the answer'],
};
const TITLE: Record<ReasoningKind, string> = { redact: 'Masking PII', draft: 'Drafting a response', insight: 'Reading the theme', ask: 'Answering' };

export function Reasoning({ kind, steps: custom }: { kind: ReasoningKind; steps?: string[] }) {
  const steps = custom ?? DEFAULT_STEPS[kind];
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const per = SAMPLE_DELAY_MS[kind] / steps.length;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      setStep(Math.min(steps.length - 1, Math.floor(ms / per)));
    }, 100);
    return () => window.clearInterval(id);
  }, [kind, steps.length]);

  return (
    <div className="ai-panel" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--signal)' }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />{TITLE[kind]}
        </div>
        <span className="text-[11px] muted tabular">{(elapsed / 1000).toFixed(1)} s</span>
      </div>
      <ol className="ledger-steps">
        {steps.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className={state}>
              {state === 'done' ? <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ok)' }} aria-hidden />
                : <span className="w-3.5 h-3.5 shrink-0 grid place-items-center text-[9px] font-bold rounded-full border tabular" style={{ borderColor: state === 'active' ? 'var(--signal)' : 'var(--rule)', color: state === 'active' ? 'var(--signal)' : 'var(--muted)' }} aria-hidden>{i + 1}</span>}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="progress mt-3" aria-hidden><span style={{ width: `${Math.min(96, (elapsed / SAMPLE_DELAY_MS[kind]) * 100)}%` }} /></div>
    </div>
  );
}
