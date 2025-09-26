import Link from "next/link";

const footerLinks = [
  { label: "Gallery", href: "/gallery" },
  { label: "Pricing & lead times", href: "/pricing" },
  { label: "Process", href: "/process" },
  { label: "Testimonials", href: "/testimonials" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm text-neutral-600 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="text-base font-semibold text-neutral-900">
            Sanctuary Pergolas
          </p>
          <p className="mt-2 max-w-md">
            Crafted pergolas, screens, and outdoor comfort systems measured and installed across Auckland and Waikato.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-neutral-900">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
