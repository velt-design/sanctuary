import Link from "next/link";
import { productGroups } from "@/lib/products";

const pricingLeadCopy =
  "Add screens, blinds, lighting, or heaters to tailor shade, wind protection, and night use.";

export default function Home() {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-neutral-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_55%)]" aria-hidden />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-24 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="max-w-2xl space-y-6">
            <p className="inline-flex rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
              Outdoor living, engineered
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
              Pergolas and outdoor comfort systems for New Zealand weather
            </h1>
            <p className="text-lg text-white/80">
              Sanctuary designs, engineers, and installs pergolas, screens, lighting, and heating so your deck works in every season.
              Each project is measured on site and tailored to wind zones, spans, and council requirements.
            </p>
            <div className="flex flex-wrap gap-3 text-sm font-medium">
              <Link
                href="/products"
                className="rounded-full bg-white px-5 py-2 text-neutral-900 transition hover:bg-neutral-100"
              >
                Explore products
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-white/40 px-5 py-2 text-white transition hover:bg-white/10"
              >
                Pricing &amp; lead times
              </Link>
            </div>
          </div>
          <div className="max-w-sm space-y-3 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/80">
            <p className="font-semibold text-white">Why Sanctuary</p>
            <ul className="space-y-2">
              <li>Custom spans engineered for your site and wind zone.</li>
              <li>Integrated screens, blinds, lighting, and heating options.</li>
              <li>Licensed installers and electricians manage compliance.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <header className="max-w-2xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Products</p>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
            Pergolas, screens, lighting, and heating designed as one system
          </h2>
          <p className="text-neutral-600">
            Choose a pergola structure and add the screens or comfort options you need. Every solution is measured to your home and delivered by Sanctuary specialists.
          </p>
        </header>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {productGroups.map((group) => (
            <div
              key={group.slug}
              className="flex h-full flex-col justify-between rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm"
            >
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-neutral-900">{group.name}</h3>
                <p className="text-neutral-600">{group.featuredLine}</p>
                <ul className="space-y-2 text-sm text-neutral-500">
                  {group.items.map((item) => (
                    <li key={item.slug}>{item.name}</li>
                  ))}
                </ul>
              </div>
              <Link
                href={group.href}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 transition hover:text-neutral-600"
              >
                {group.ctaLabel}
                <span aria-hidden>→</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-neutral-950">
        <div className="mx-auto max-w-6xl px-4 py-20 text-white lg:px-8">
          <div className="max-w-3xl space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Detail options to finish your pergola
            </h2>
            <p className="text-neutral-300">
              Every project starts with the core pergola structure. Choose the screens, lighting, and heating that make the space work day and night.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {productGroups.flatMap((group) => group.items).map((item) => (
              <div key={item.slug} className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/60">{item.name}</p>
                <p className="mt-3 text-lg font-semibold text-white">{item.summary}</p>
                <Link
                  href={item.href}
                  className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-neutral-200"
                >
                  View {item.name.toLowerCase()}
                  <span aria-hidden>→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Pricing &amp; lead times
            </h2>
            <p className="text-neutral-600">
              {pricingLeadCopy}
            </p>
            <p className="text-neutral-600">
              We scope each project on site and provide fixed proposals covering structure, finishes, electrical work, and installation. Typical lead times range from six to ten weeks depending on custom fabrication and consent requirements.
            </p>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 transition hover:text-neutral-600"
            >
              View pricing guidance
              <span aria-hidden>→</span>
            </Link>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-8">
            <h3 className="text-lg font-semibold text-neutral-900">Project timeline</h3>
            <ol className="mt-4 space-y-4 text-sm text-neutral-600">
              <li>
                <span className="font-semibold text-neutral-900">1. Consultation.</span> Share site photos and goals for shade, shelter, or evening use.
              </li>
              <li>
                <span className="font-semibold text-neutral-900">2. Design &amp; proposal.</span> We confirm spans, finishes, and comfort options with a fixed price.
              </li>
              <li>
                <span className="font-semibold text-neutral-900">3. Fabrication.</span> Frames and screens are manufactured while we schedule electricians and installers.
              </li>
              <li>
                <span className="font-semibold text-neutral-900">4. Installation.</span> Licensed teams complete the build, wiring, and commissioning.
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="bg-neutral-100">
        <div className="mx-auto max-w-6xl px-4 py-16 text-neutral-900 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Process</p>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                A guided process from first sketch to final inspection
              </h2>
              <p className="text-neutral-600">
                We coordinate engineering, council liaison, and licensed trades so your pergola integrates cleanly with your existing home. Clients work with a single project lead from concept through completion.
              </p>
            </div>
            <div className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-8">
              <blockquote className="text-lg font-medium text-neutral-900">
                “The Sanctuary team handled design, council paperwork, and installation without disrupting our family routine. We now use the deck in the evenings and through shoulder seasons.”
              </blockquote>
              <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
                Homeowner, Hobsonville Point
              </p>
              <Link
                href="/testimonials"
                className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 transition hover:text-neutral-600"
              >
                Read testimonials
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 sm:text-4xl">
              Ready to plan your outdoor room?
            </h2>
            <p className="text-neutral-600">
              Share your ideas, and we’ll recommend pergola styles, screens, and comfort upgrades that suit your home. Site visits across Auckland and Waikato are complimentary.
            </p>
          </div>
          <div className="flex flex-col gap-3 text-sm font-medium sm:flex-row sm:justify-end">
            <Link
              href="/contact"
              className="rounded-full bg-neutral-900 px-6 py-3 text-center text-white transition hover:bg-neutral-700"
            >
              Book a consultation
            </Link>
            <Link
              href="/gallery"
              className="rounded-full border border-neutral-900 px-6 py-3 text-center text-neutral-900 transition hover:bg-neutral-100"
            >
              View the gallery
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
