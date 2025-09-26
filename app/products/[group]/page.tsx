import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  getGroupBySlug,
  productGroups,
  productsMetaTitles,
} from "@/lib/products";

const siteUrl = "https://sanctuarypergolas.co.nz";

type GroupPageProps = {
  params: { group: string };
};

export function generateStaticParams() {
  return productGroups.map((group) => ({ group: group.slug }));
}

export function generateMetadata({ params }: GroupPageProps): Metadata {
  const group = getGroupBySlug(params.group);

  if (!group) {
    return {};
  }

  const path = `/products/${group.slug}`;

  return {
    title: productsMetaTitles[path] ?? `${group.name} | Sanctuary Pergolas`,
    description: group.featuredLine,
  };
}

export default function ProductGroupPage({ params }: GroupPageProps) {
  const group = getGroupBySlug(params.group);

  if (!group) {
    notFound();
  }

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: group.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: `${siteUrl}${item.href}`,
    })),
  };

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-8">
        <Breadcrumbs
          items={[
            { label: "Products", href: "/products" },
            { label: group.name, href: `/products/${group.slug}` },
          ]}
        />
        <div className="mt-6 grid gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
              {group.name}
            </h1>
            <p className="text-neutral-600">{group.featuredLine}</p>
            <p className="text-neutral-600">
              Sanctuary engineers each {group.name.toLowerCase()} solution to suit your spans, wind exposure, and outdoor layout. Pair core structures with the comfort options that make your deck work year-round.
            </p>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-8 text-sm text-neutral-600">
            <h2 className="text-lg font-semibold text-neutral-900">Included services</h2>
            <ul className="mt-4 space-y-2">
              <li>Site measure and design coordination.</li>
              <li>Engineering sign-off for wind and spans.</li>
              <li>Installation, finishing, and electrical connections.</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {group.items.map((item) => (
            <article
              key={item.slug}
              className="flex h-full flex-col rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm"
            >
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold text-neutral-900">{item.name}</h2>
                <p className="text-neutral-600">{item.summary}</p>
              </div>
              <Link
                href={item.href}
                className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 transition hover:text-neutral-600"
              >
                Explore {item.name.toLowerCase()}
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
