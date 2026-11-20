import type { Metadata } from 'next';
import './globals.css';
import Shell from '@/components/Shell';

export const metadata: Metadata = {
  title: 'Complaints Intelligence: Snowflake example',
  description: 'Classify every complaint, spot emerging conduct-risk themes, and evidence timely resolution. Synthetic data.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
