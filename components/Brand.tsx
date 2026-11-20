// Tallowmark logo mark: a tally of five (four strokes crossed by a fifth). Fictional brand.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Tallowmark">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--brand)" />
      <g stroke="var(--on-brand)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M9 9v14M13.5 9v14M18 9v14M22.5 9v14" />
        <path d="M6.5 20.5 25 11" />
      </g>
    </svg>
  );
}
