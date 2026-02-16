import Image from 'next/image';
import Container from '@/components/ui/Container';
import { cn } from '@/lib/cn';

type Characteristic = { label: string; text: string };

type MaterialSectionProps = {
  headingId: string;
  eyebrow: string;
  title: string;
  intro: string;
  image: { src: string; alt: string };
  characteristics: Characteristic[];
  showTopBorder?: boolean;
  showBottomBorder?: boolean;
  className?: string;
};

export default function MaterialSection({
  headingId,
  eyebrow,
  title,
  intro,
  image,
  characteristics,
  showTopBorder = true,
  showBottomBorder = true,
  className,
}: MaterialSectionProps) {
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        'relative bg-page py-0 border-page',
        showTopBorder && 'border-t [border-top-width:var(--bw)]',
        showBottomBorder && 'border-b [border-bottom-width:var(--bw)]',
        className
      )}
    >
      <div
        aria-hidden
        className="absolute left-1/2 top-0 hidden h-full w-[var(--bw)] -translate-x-1/2 bg-page md:block"
      />

      <Container>
        <div className="grid items-start gap-gutter py-[var(--g)] [--material-buffer:var(--g)] md:grid-cols-2 md:gap-[calc(var(--material-buffer)*2)]">
          <div>
            <div className="relative aspect-square w-full overflow-hidden border border-page [border-width:var(--bw)] bg-panel">
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 960px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
              />
            </div>
          </div>

          <div className="md:max-w-[62ch]">
            <p className="text-[12px] text-[#7A7A7A]">{eyebrow}</p>
            <h2
              id={headingId}
              className="mt-2 text-[clamp(28.6px,3.64vw,41.6px)] leading-[1.15] uppercase text-ink"
            >
              {title}
            </h2>
            <p className="mt-4 text-[1.1rem] leading-[1.6] text-[#555]">{intro}</p>

            <div className="mt-6 hidden md:block">
              <p className="text-[17.6px] font-medium text-ink">Key characteristics</p>
              <ul className="mt-3 list-inside list-disc space-y-3 text-[1.1rem] leading-[1.6] text-[#333]">
                {characteristics.map((characteristic) => (
                  <li key={characteristic.label}>
                    <span className="font-medium">{characteristic.label}:</span> {characteristic.text}
                  </li>
                ))}
              </ul>
            </div>

            <details className="mt-4 md:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2 text-[1.1rem] [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-ink">Key characteristics</span>
                <span className="accordion__icon" aria-hidden />
              </summary>
              <div className="pt-3">
                <ul className="list-inside list-disc space-y-3 text-[1.1rem] leading-[1.6] text-[#333]">
                  {characteristics.map((characteristic) => (
                    <li key={characteristic.label}>
                      <span className="font-medium">{characteristic.label}:</span> {characteristic.text}
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>
        </div>
      </Container>
    </section>
  );
}
