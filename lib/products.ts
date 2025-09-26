export type ProductCategory = "Pergolas" | "Screens & walls" | "Lighting & heating";

export interface ProductSpec {
  name: string;
  value: string;
}

export interface ProductItem {
  name: string;
  slug: string;
  href: string;
  summary: string;
  description: string;
  material: string;
  productCategory: string;
  specs: ProductSpec[];
  breadcrumbs: { label: string; href: string }[];
  faqs?: { question: string; answer: string }[];
}

export interface ProductGroup {
  name: ProductCategory;
  slug: "pergolas" | "screens-walls" | "lighting-heating";
  blurb: string;
  ctaLabel: string;
  href: string;
  items: ProductItem[];
  featuredLine: string;
}

export const productGroups: ProductGroup[] = [
  {
    name: "Pergolas",
    slug: "pergolas",
    blurb:
      "Custom-measured, engineered for your spans and wind zone. View pergolas",
    ctaLabel: "View pergolas",
    href: "/products/pergolas",
    featuredLine:
      "Custom-measured, engineered for your spans and wind zone.",
    items: [
      {
        name: "Pitched pergola",
        slug: "pitched",
        href: "/products/pergolas/pitched",
        summary:
          "Clean lines for narrow eaves and cosy decks. Efficient spans with a strong aluminium frame.",
        description:
          "A pitched pergola keeps sightlines simple while delivering reliable weathering. Each system is custom measured, so rafters align with your home and spans are engineered for your location. Optional integrated gutters handle rain without cluttering the profile.",
        material: "Powder-coated aluminium",
        productCategory: "Outdoor Pergola",
        specs: [
          { name: "Typical spans", value: "Up to 6.0m between supports" },
          { name: "Colour options", value: "Durable powder-coat palette matched to your home" },
          { name: "Wind rating", value: "Engineered to NZS 3604 High wind zones" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Pergolas", href: "/products/pergolas" },
          { label: "Pitched", href: "/products/pergolas/pitched" },
        ],
      },
      {
        name: "Gable pergola",
        slug: "gable",
        href: "/products/pergolas/gable",
        summary:
          "Extra headroom, airflow, and daylight. Ideal for larger decks, sliders, and connected indoor living.",
        description:
          "Gable pergolas lift the roofline to deliver generous head height and circulation. The centre ridge brings in additional daylight while moving heat out of covered areas. We tailor the frame to your cladding lines and can include skylights or integrated lighting.",
        material: "Powder-coated aluminium with engineered rafters",
        productCategory: "Outdoor Pergola",
        specs: [
          { name: "Typical spans", value: "Up to 7.2m depending on site conditions" },
          { name: "Colour options", value: "Dual-tone powder-coat or single colour match" },
          { name: "Wind rating", value: "Engineered for Very High wind zones" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Pergolas", href: "/products/pergolas" },
          { label: "Gable", href: "/products/pergolas/gable" },
        ],
      },
      {
        name: "Hip pergola",
        slug: "hip",
        href: "/products/pergolas/hip",
        summary:
          "Three-sided cover that integrates with complex rooflines and corner decks for seamless shelter.",
        description:
          "Hip pergolas wrap your outdoor zone with balanced pitches on three sides, making them ideal beside complex roofs. We coordinate flashing details with your builder so the transition between structures feels intentional. Choose infills or lighting to complete the space.",
        material: "Powder-coated aluminium with engineered hip rafters",
        productCategory: "Outdoor Pergola",
        specs: [
          { name: "Typical spans", value: "Hip rafters engineered for custom footprints" },
          { name: "Colour options", value: "Full Dulux and Resene powder-coat selections" },
          { name: "Wind rating", value: "Designed for Very High and Extra High zones" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Pergolas", href: "/products/pergolas" },
          { label: "Hip", href: "/products/pergolas/hip" },
        ],
      },
    ],
  },
  {
    name: "Screens & walls",
    slug: "screens-walls",
    blurb:
      "Timber or aluminium slats, acrylic panels, or drop-down blinds for wind, shade, and privacy. View screens & walls",
    ctaLabel: "View screens & walls",
    href: "/products/screens-walls",
    featuredLine:
      "Timber or aluminium slats, acrylic panels, or drop-down blinds for wind, shade, and privacy.",
    items: [
      {
        name: "Timber slat screens",
        slug: "timber-slat-screens",
        href: "/products/screens-walls/timber-slat-screens",
        summary:
          "Warm timber look with privacy. Configure vertical or horizontal layouts for filtered light.",
        description:
          "Timber slat screens deliver warmth and texture while softening prevailing winds. We finish each screen in durable exterior stains and can align slat spacing to match your joinery. Combine with clear panels or blinds for layered protection.",
        material: "H3.2 timber with exterior stain",
        productCategory: "Outdoor Screen",
        specs: [
          { name: "Typical spans", value: "Modular bays up to 2.4m wide" },
          { name: "Colour options", value: "Natural oils or solid exterior stains" },
          { name: "Wind rating", value: "Suitable for Medium to High wind zones" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Screens & walls", href: "/products/screens-walls" },
          { label: "Timber slat screens", href: "/products/screens-walls/timber-slat-screens" },
        ],
      },
      {
        name: "Aluminium slat screens",
        slug: "aluminium-slat-screens",
        href: "/products/screens-walls/aluminium-slat-screens",
        summary:
          "Low maintenance privacy with crisp lines and colour-matched powder coat for long-term durability.",
        description:
          "Aluminium slat screens provide enduring privacy with precise sightlines. Panels are fabricated to size with hidden fixings, ensuring a clean finish around your pergola or spa. Powder-coat finishes resist coastal conditions and pair with your pergola frame.",
        material: "Powder-coated aluminium",
        productCategory: "Outdoor Screen",
        specs: [
          { name: "Typical spans", value: "Custom fabricated up to 3.0m wide" },
          { name: "Colour options", value: "Full powder-coat palette including woodgrain effects" },
          { name: "Wind rating", value: "Engineered for High and Very High zones" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Screens & walls", href: "/products/screens-walls" },
          { label: "Aluminium slat screens", href: "/products/screens-walls/aluminium-slat-screens" },
        ],
      },
      {
        name: "Acrylic infill panels",
        slug: "acrylic-infill-panels",
        href: "/products/screens-walls/acrylic-infill-panels",
        summary:
          "Clear or tinted panels block wind and rain while keeping natural light across the pergola.",
        description:
          "Acrylic infill panels seal the sides of your pergola without sacrificing daylight. We glaze panels into powder-coated frames and can tint to manage glare. Pair with blinds for flexible wind protection throughout the seasons.",
        material: "Powder-coated aluminium frames with acrylic glazing",
        productCategory: "Weather Protection Panel",
        specs: [
          { name: "Typical spans", value: "Panel bays up to 2.7m wide" },
          { name: "Colour options", value: "Clear, grey-tint, or bronze-tint acrylic" },
          { name: "Wind rating", value: "Designed for Very High wind exposure" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Screens & walls", href: "/products/screens-walls" },
          { label: "Acrylic infill panels", href: "/products/screens-walls/acrylic-infill-panels" },
        ],
      },
      {
        name: "Drop-down blinds",
        slug: "drop-down-blinds",
        href: "/products/screens-walls/drop-down-blinds",
        summary:
          "Block wind, glare, and low sun with manual crank or motorised control for adaptable comfort.",
        description:
          "Drop-down blinds seal off breezes and late sun when you need it and retract out of view when you don't. Choose manual crank or integrated motor control, and specify fabric openness to balance airflow with privacy.",
        material: "Marine-grade PVC or mesh fabric with aluminium headbox",
        productCategory: "Outdoor Blind",
        specs: [
          { name: "Typical spans", value: "Up to 5.5m widths with side tracks" },
          { name: "Colour options", value: "Fabric colours plus powder-coated hardware" },
          { name: "Wind rating", value: "Guide systems rated for winds up to 85km/h" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Screens & walls", href: "/products/screens-walls" },
          { label: "Drop-down blinds", href: "/products/screens-walls/drop-down-blinds" },
        ],
        faqs: [
          {
            question: "What wind rating do the blinds handle?",
            answer:
              "Guide systems are rated for winds up to 85km/h when lowered. We recommend retracting blinds during stronger gusts to protect the fabric and hardware.",
          },
          {
            question: "Can I automate the blinds?",
            answer:
              "Choose Somfy or Alpha motors with wall switches or remote controls. Weather sensors can retract blinds automatically when wind thresholds are reached.",
          },
        ],
      },
    ],
  },
  {
    name: "Lighting & heating",
    slug: "lighting-heating",
    blurb:
      "Downlights, LED strips, and patio heaters for evening comfort. View lighting & heating",
    ctaLabel: "View lighting & heating",
    href: "/products/lighting-heating",
    featuredLine:
      "Downlights, LED strips, and patio heaters for evening comfort.",
    items: [
      {
        name: "Downlights",
        slug: "downlights",
        href: "/products/lighting-heating/downlights",
        summary:
          "Even lighting for dining, prep, and reading. Installed by licensed electricians to meet compliance.",
        description:
          "Recessed LED downlights give you consistent illumination across outdoor kitchens and dining settings. We recess fittings into the pergola structure and run cabling discreetly back to your switchboard for code-compliant installation.",
        material: "Powder-coated aluminium trims with LED fittings",
        productCategory: "Outdoor Lighting",
        specs: [
          { name: "Output", value: "9-13W LED modules" },
          { name: "Colour options", value: "Warm white or neutral white colour temperatures" },
          { name: "Installation", value: "Wired by licensed electricians to AS/NZS 3000" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Lighting & heating", href: "/products/lighting-heating" },
          { label: "Downlights", href: "/products/lighting-heating/downlights" },
        ],
      },
      {
        name: "LED strip lighting",
        slug: "led-strip-lighting",
        href: "/products/lighting-heating/led-strip-lighting",
        summary:
          "Perimeter glow adds ambience and guides safe movement along steps, thresholds, and outdoor kitchens.",
        description:
          "LED strip lighting tucks into pelmets or beams to deliver soft, indirect illumination. Dimmable drivers let you balance ambience with functional light, while aluminium channels protect the strips from the elements.",
        material: "IP65 LED strip within aluminium channel",
        productCategory: "Outdoor Lighting",
        specs: [
          { name: "Output", value: "Dimmable 4.8-14.4W per metre" },
          { name: "Colour options", value: "Warm white, neutral white, or RGBW" },
          { name: "Installation", value: "Low-voltage wiring concealed within the pergola" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Lighting & heating", href: "/products/lighting-heating" },
          { label: "LED strip lighting", href: "/products/lighting-heating/led-strip-lighting" },
        ],
      },
      {
        name: "Patio heaters",
        slug: "patio-heaters",
        href: "/products/lighting-heating/patio-heaters",
        summary:
          "Targeted warmth extends evening use with efficient electric units and clearances planned for safety.",
        description:
          "Mounted electric patio heaters keep the space comfortable without open flames. We position units for coverage while maintaining clearances to beams and blinds. Integrated timers help manage energy use on cool nights.",
        material: "Powder-coated aluminium housing with quartz elements",
        productCategory: "Outdoor Heater",
        specs: [
          { name: "Output", value: "2.0-3.2kW radiant heat" },
          { name: "Colour options", value: "Matte black, white, or stainless steel" },
          { name: "Installation", value: "Clearances set to AS/NZS 5601 and manufacturer guidance" },
        ],
        breadcrumbs: [
          { label: "Products", href: "/products" },
          { label: "Lighting & heating", href: "/products/lighting-heating" },
          { label: "Patio heaters", href: "/products/lighting-heating/patio-heaters" },
        ],
        faqs: [
          {
            question: "What clearances are required around patio heaters?",
            answer:
              "Allow at least 500mm overhead and 300mm side clearances from combustible materials. Our installers confirm spacing for each unit to maintain safe operation.",
          },
          {
            question: "How are heaters controlled?",
            answer:
              "Select wall switches, remote dimmers, or timer controls to suit your routine. We can integrate heaters with lighting scenes for simple evening warm-up.",
          },
        ],
      },
    ],
  },
];

export const productsMetaTitles: Record<string, string> = {
  "/products": "Products | Pergolas, Screens & Walls, Lighting & Heating | Sanctuary Pergolas",
  "/products/pergolas": "Pergolas | Pitched, Gable, Hip | Sanctuary Pergolas",
  "/products/screens-walls": "Screens & Walls | Slats, Acrylic Panels, Blinds | Sanctuary Pergolas",
  "/products/lighting-heating": "Lighting & Heating | Downlights, LED Strips, Heaters | Sanctuary Pergolas",
};

export function getGroupBySlug(slug: string) {
  return productGroups.find((group) => group.slug === slug);
}

export function getProductBySlugs(groupSlug: string, productSlug: string) {
  const group = getGroupBySlug(groupSlug);
  if (!group) {
    return undefined;
  }
  return {
    group,
    product: group.items.find((item) => item.slug === productSlug),
  };
}
