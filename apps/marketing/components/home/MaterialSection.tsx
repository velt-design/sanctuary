import Image from 'next/image';
import { cn } from '@/lib/cn';

type Characteristic = { label: string; text: string };

type MaterialSectionProps = {
  headingId: string;
  eyebrow: string;
  title: string;
  intro: string;
  image: { src: string; alt: string; quality?: number };
  characteristics: Characteristic[];
  bestFor?: string;
  className?: string;
};

export default function MaterialSection({
  headingId,
  eyebrow,
  title,
  intro,
  image,
  characteristics,
  bestFor,
  className,
}: MaterialSectionProps) {
  return (
    <article
      aria-labelledby={headingId}
      className={cn('rounded-[2px] border border-page bg-card p-5 sm:p-6 md:p-8', className)}
    >
      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] md:gap-10">
        <div className="overflow-hidden rounded-[2px] border border-page bg-page">
          <div className="relative aspect-[4/3] w-full">
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes="(max-width: 960px) 100vw, (max-width: 1400px) 52vw, 640px"
              quality={image.quality ?? 50}
              className="object-cover"
            />
          </div>
        </div>

        <div className="md:max-w-[58ch]">
          <p className="text-[11px] uppercase tracking-[0.12em] text-muted">{eyebrow}</p>
          <h3
            id={headingId}
            className="mt-2 text-[clamp(26px,3.1vw,38px)] font-semibold leading-[1.12] tracking-[-0.015em] text-ink"
          >
            {title}
          </h3>
          <p className="mt-3 text-[16px] leading-[1.62] text-muted">{intro}</p>

          <p className="mt-5 text-[14px] font-semibold uppercase tracking-[0.08em] text-ink/84">Key characteristics</p>
          <ul className="mt-3 space-y-2 text-[15px] leading-[1.62] text-muted">
            {characteristics.map((characteristic) => (
              <li key={characteristic.label} className="ml-5 list-disc">
                <span className="font-semibold text-ink">{characteristic.label}:</span> {characteristic.text}
              </li>
            ))}
          </ul>

          {bestFor ? (
            <span className="mt-5 inline-flex border border-page px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
              Best for: {bestFor}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
