'use client';

// App frame: top bar with the Tallowmark brand, section tabs, environment badge, Live/Sample switch and
// user chip; the hosted-example notice; and the footer disclaimer. No sidebar (see docs/DESIGN.md).
import { Gauge, Inbox, Landmark, MessagesSquare, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LogoMark } from '@/components/Brand';
import { ModeChip } from '@/components/ModeChip';
import { HOSTED_EXAMPLE } from '@/lib/hosted';

const NAV = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/queue', label: 'Queue', icon: Inbox },
  { href: '/themes', label: 'Emerging themes', icon: TrendingUp },
  { href: '/regulatory', label: 'Regulatory', icon: Landmark },
  { href: '/ask', label: 'Ask', icon: MessagesSquare },
];
const REPO = 'https://github.com/sfc-gh-ooral/sfguide-complaints-intelligence';

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href) || (href === '/queue' && pathname.startsWith('/complaint')));

  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-[70] focus:m-2 btn">Skip to content</a>
      {HOSTED_EXAMPLE && (
        <div role="note" className="px-4 md:px-8 py-1.5 text-xs text-center" style={{ background: 'var(--brand)', color: 'var(--on-brand)' }}>
          <strong>Sample data mode.</strong> Runs in your browser on synthetic data, no Snowflake account needed. AI answers were recorded from a live run.{' '}
          <a href={REPO} className="underline underline-offset-2 font-semibold">Run it in your own account</a>
        </div>
      )}
      <header className="topbar sticky top-0 z-40">
        <div className="max-w-[1360px] mx-auto px-4 md:px-8 flex items-center gap-4 md:gap-8 min-h-[56px]">
          <Link href="/" className="flex items-center gap-2.5 no-underline shrink-0" aria-label="Tallowmark Complaints Desk, overview">
            <LogoMark />
            <span className="leading-tight hidden sm:block"><span className="serif font-semibold text-[15px] block">Tallowmark</span><span className="text-[10.5px] muted block">Complaints Desk · Northwind Bank</span></span>
          </Link>
          <nav className="hidden lg:flex items-center gap-6 self-stretch" aria-label="Sections">
            {NAV.map(({ href, label }) => <Link key={href} href={href} className="tab flex items-center" aria-current={active(href) ? 'page' : undefined}>{label}</Link>)}
          </nav>
          <div className="ml-auto flex items-center gap-2"><ModeChip /></div>
          <div className="chip hidden md:inline-flex" title="Synthetic user">
            <span className="avatar" aria-hidden>RC</span>
            <span className="leading-tight"><span className="text-xs font-semibold block">Rina Castellano</span><span className="text-[10.5px] muted block">Complaints analyst</span></span>
          </div>
        </div>
        <nav className="lg:hidden flex gap-5 overflow-x-auto no-scrollbar px-4 md:px-8 border-t" style={{ borderColor: 'var(--rule)' }} aria-label="Sections">
          {NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="tab flex items-center gap-1.5 !py-2.5" aria-current={active(href) ? 'page' : undefined}><Icon className="w-3.5 h-3.5" aria-hidden />{label}</Link>)}
        </nav>
      </header>
      <main id="main" key={pathname} className="fade-up flex-1 w-full max-w-[1360px] mx-auto px-4 md:px-8 py-6">{children}</main>
      <footer className="border-t text-[11px] muted" style={{ borderColor: 'var(--rule)' }}>
        <div className="max-w-[1360px] mx-auto px-4 md:px-8 py-4 flex flex-wrap gap-x-6 gap-y-1">
          <span>Tallowmark and Northwind Bank are fictional. Synthetic data only.</span>
          <span>The taxonomy, flags and response windows are illustrative, not an official regulator list. Not legal, regulatory or compliance advice. AI output needs a person&apos;s review.</span>
        </div>
      </footer>
    </div>
  );
}
