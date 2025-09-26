import Link from "next/link";
import { productGroups } from "@/lib/products";

const secondaryLinks = [
  { label: "Gallery", href: "/gallery" },
  { label: "Pricing & lead times", href: "/pricing" },
  { label: "Process", href: "/process" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export function Header() {
  return (
    <header className="bg-white/95 backdrop-blur border-b border-neutral-200 sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 lg:px-8">
        <Link
          href="/"
          className="text-lg font-semibold tracking-tight text-neutral-900"
        >
          Sanctuary Pergolas
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-700 md:flex">
          <details className="relative group">
            <summary className="list-none cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-1">
                Products
                <span aria-hidden>▾</span>
              </span>
            </summary>
            <div className="absolute left-1/2 z-50 mt-3 hidden w-[720px] -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl group-open:block">
              <div className="grid grid-cols-3 gap-6 text-sm">
                {productGroups.map((group) => (
                  <div key={group.slug} className="space-y-3">
                    <div>
                      <Link
                        href={group.href}
                        className="font-semibold text-neutral-900 hover:text-neutral-700"
                      >
                        {group.name}
                      </Link>
                      <p className="mt-1 text-xs text-neutral-500">
                        {group.featuredLine}
                      </p>
                    </div>
                    <ul className="space-y-2 text-neutral-600">
                      {group.items.slice(0, 4).map((item) => (
                        <li key={item.slug}>
                          <Link
                            href={item.href}
                            className="transition hover:text-neutral-900"
                          >
                            {item.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </details>
          {secondaryLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-full px-3 py-1.5 transition hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button className="md:hidden rounded-full border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700">
          Menu
        </button>
      </div>
    </header>
  );
}
