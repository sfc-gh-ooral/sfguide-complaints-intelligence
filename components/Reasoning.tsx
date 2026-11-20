'use client';

// Staged progress for AI calls. The steps mirror what the live path does. Steps advance on a timer;
// the last one holds until the real (or sample) answer arrives.
import { Check, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SAMPLE_DELAY_MS } from '@/lib/sample-timing';

export type ReasoningKind = 'redact' | 'draft' | 'insight' | 'ask';

const STEPS: Record<ReasoningKind, string[]> = {
  redact: ['Reading the complaint text', 'Detecting names, phone numbers, emails, and account numbers with AI_REDACT', 'Replacing them with placeholders'],
  draft: ['Masking PII with AI_REDACT', 'Reading the AI category and due date', 'Drafting the response with AI_COMPLETE', 'Saving the draft for review'],
  insight: ['Counting complaints in the peak week', 'Summarizing the root cause with AI_AGG', 'Masking example quotes with AI_REDACT', 'Caching the theme insight'],
  ask: ['Sending the question to the Cortex Agent', 'Planning the answer', 'Generating SQL with Cortex Analyst on the semantic view', 'Writing the answer'],
};

export function Reasoning({ kind }: { kind: ReasoningKind }) {
  const steps = STEPS[kind];
  const [step, setStep] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const per = SAMPLE_DELAY_MS[kind] / steps.length;
    const t0 = Date.now();
    const id = window.setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      setStep(Math.min(steps.length - 1, Math.floor(ms / per)));
    }, 120);
    return () => window.clearInterval(id);
  }, [kind, steps.length]);

  return (
    <div className="reasoning" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--accent)' }}>
          <span className="reasoning-orb" aria-hidden />Working
        </div>
        <span className="text-[11px] muted tabular">{(elapsed / 1000).toFixed(1)}s</span>
      </div>
      <ol className="space-y-1.5">
        {steps.map((s, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'todo';
          return (
            <li key={s} className={`reasoning-step ${state} flex items-center gap-2 text-xs`}>
              {state === 'done' ? <Check className="w-3.5 h-3.5" style={{ color: 'var(--positive)' }} aria-hidden />
                : state === 'active' ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--accent)' }} aria-hidden />
                : <span className="w-3.5 h-3.5 rounded-full border" style={{ borderColor: 'var(--border)' }} aria-hidden />}
              <span>{s}</span>
            </li>
          );
        })}
      </ol>
      <div className="reasoning-bar mt-3" aria-hidden><span style={{ width: `${Math.min(96, (elapsed / SAMPLE_DELAY_MS[kind]) * 100)}%` }} /></div>
    </div>
  );
}
