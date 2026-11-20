// Sample-mode response time per AI step, in ms. Live calls measured on this data are listed in the
// README; these sit in the 4–8 s range so the staged progress reads like a real interaction.
export const SAMPLE_DELAY_MS = { redact: 4200, draft: 6000, insight: 6800, ask: 7200 } as const;
