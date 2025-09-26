import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  getProductBySlugs,
  productGroups,
} from "@/lib/products";

const siteUrl = "https://sanctuarypergolas.co.nz";

type ProductPageProps = {
  params: { group: string; product: string };
};

export function generateStaticParams() {
  return productGroups.flatMap((group) =>
    group.items.map((item) => ({ group: group.slug, product: item.slug })),
  );
}

export function generateMetadata({ params }: ProductPageProps): Metadata {
  const result = getProductBySlugs(params.group, params.product);

  if (!result || !result.product) {
    return {};
  }

  const { product, group } = result;

  return {
    title: `${product.name} | ${group.name} | Sanctuary Pergolas`,
    description: product.summary,
  };
}

export default function ProductDetailPage({ params }: ProductPageProps) {
  const result = getProductBySlugs(params.group, params.product);

  if (!result || !result.product) {
    notFound();
  }

  const { product, group } = result;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    brand: {
      "@type": "Brand",
      name: "Sanctuary Pergolas",
    },
    category: product.productCategory,
    material: product.material,
    url: `${siteUrl}${product.href}`,
    additionalProperty: product.specs.map((spec) => ({
      "@type": "PropertyValue",
      name: spec.name,
      value: spec.value,
    })),
  };

  const faqSchema =
    product.faqs && product.faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: product.faqs.map((faq) => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: faq.answer,
            },
          })),
        }
      : null;

  return (
    <div className="bg-white">
      <section className="mx-auto max-w-6xl px-4 py-12 lg:px-8">
        <Breadcrumbs items={product.breadcrumbs} />
        <div className="mt-6 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
              {product.name}
            </h1>
            <p className="text-lg text-neutral-700">{product.summary}</p>
            <p className="text-neutral-600">{product.description}</p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 transition hover:text-neutral-600"
            >
              Book a site consultation
              <span aria-hidden>→</span>
            </Link>
          </div>
          <aside className="rounded-3xl border border-neutral-200 bg-neutral-50 p-8">
            <h2 className="text-lg font-semibold text-neutral-900">Key details</h2>
            <dl className="mt-4 space-y-4 text-sm text-neutral-600">
              <div>
                <dt className="font-semibold text-neutral-900">Product group</dt>
                <dd>{group.name}</dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-900">Material</dt>
                <dd>{product.material}</dd>
              </div>
              {product.specs.map((spec) => (
                <div key={spec.name}>
                  <dt className="font-semibold text-neutral-900">{spec.name}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>
      {product.faqs && product.faqs.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12 lg:px-8">
          <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-8">
            <h2 className="text-lg font-semibold text-neutral-900">Frequently asked questions</h2>
            <div className="mt-4 space-y-6 text-sm text-neutral-600">
              {product.faqs.map((faq) => (
                <div key={faq.question}>
                  <p className="font-semibold text-neutral-900">{faq.question}</p>
                  <p className="mt-1">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      {faqSchema && (
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
    </div>
  );
}
