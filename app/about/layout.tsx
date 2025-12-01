import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { absolute: 'About Sanctuary Pergolas | Custom Aluminium Pergolas Auckland' },
  description:
    'Family‑run pergola specialists crafting engineered aluminium pergolas across Auckland and the Upper North Island. Built on site in 1–5 days. Lead time ~6 weeks. 10‑year warranty.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>; // Wrap children only; inherits root layout chrome
}

