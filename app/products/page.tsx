import type { Metadata } from "next";
import Link from "next/link";
import { productGroups, productsMetaTitles } from "@/lib/products";

const siteUrl = "https://sanctuarypergolas.co.nz";

export const metadata: Metadata = {
  title: productsMetaTitles["/products"],
  description:
    "Explore pergolas, screens, walls, lighting, and heating solutions from Sanctuary Pergolas.",
};

export default function ProductsPage() {
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: productGroups.map((group, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: group.name,
      url: `${siteUrl}${group.href}`,
    })),
  };

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-8">
        <div className="max-w-3xl space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-neutral-500">
            Products
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            Pergolas, screens, lighting, and heating
          </h1>
          <p className="text-neutral-600">
            Start with the pergola structure that suits your roofline, then add screens, blinds, lighting, and heating for year-round comfort. Every system is measured and installed by Sanctuary specialists.
          </p>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {productGroups.map((group) => (
            <article
              key={group.slug}
              className="flex h-full flex-col justify-between rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm"
            >
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold text-neutral-900">{group.name}</h2>
                <p className="text-neutral-600">{group.featuredLine}</p>
                <ul className="space-y-2 text-sm text-neutral-500">
                  {group.items.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={item.href}
                        className="font-medium text-neutral-700 transition hover:text-neutral-900"
                      >
                        {item.name}
                      </Link>
                    </li>
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
            </article>
          ))}
        </div>
      </section>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
    </div>
  );
}
