export const BLINDS_ROUTE = '/pergolas-with-blinds';
export const blindsDescription = 'Plan an Auckland pergola with integrated outdoor blinds. Explore mesh, clear PVC, privacy, outlook and the details to consider before building.';
export const blindsHero = {
  image: '/images/blind-coastal-mesh.webp',
  alt: 'A lowered dark mesh blind with its roller, side guide and bottom rail visible beside an open coastal outlook',
};

/** Separate original installation photographs. They do not simulate fabric choices. */
export const blindExamples = [
  { material: 'Mesh', image: '/images/blind-pale-mesh.webp', width: 1800, height: 1200,
    alt: 'Pale mesh blinds lowered across a timber-lined pergola, with the coastal outlook visible through the fabric',
    caption: 'Pale mesh beneath a timber-lined roof. A completed installation.',
    heading: 'A softer screen across the view.',
    text: 'Mesh filters the outlook rather than making an opaque wall. The fabric’s openness, colour and the light on each side affect view-through and privacy.' },
  { material: 'Clear PVC', image: '/images/blind-clear-pvc.webp', width: 1800, height: 1350,
    alt: 'A clear PVC blind lowered across a deck opening, showing its headbox, side guides, bottom rail and reflections',
    caption: 'Clear PVC across a deck opening. A separate completed installation.',
    heading: 'A clear view through a lowered blind.',
    text: 'Clear PVC keeps the view visible, with the reflections and surface movement you can see here. It is a flexible blind, not glass. We check the opening and operating requirements before recommending it.' },
] as const;

export const blindStates = [
  { label: 'Raised', image: '/images/blind-opening-raised.webp', alt: 'The right-hand opening with its mesh blind rolled up above the sill, leaving the trees in full view' },
  { label: 'Lowered', image: '/images/blind-opening-lowered.webp', alt: 'The same right-hand opening with its mesh blind lowered to the sill, filtering the view of the trees' },
] as const;

export const blindsFaqs = [
  { question: 'Should every side of my pergola have a blind?', answer: 'Not necessarily. Start with the side where low sun, privacy or exposure affects how you use the space. Keep views, doors and everyday paths in mind. A blind changes the view and air movement when lowered; rolled away, the roller or headbox remains visible.' },
  { question: 'How do I choose between mesh and clear PVC?', answer: 'Think about the condition you want to change and the outlook you want to keep. Mesh openness and lighting affect view-through and privacy. Clear PVC provides a clear panel, but its behaviour and operating limits differ from mesh. We discuss the exact fabric and system for your opening.', href: '/products/screens-walls/drop-down-blinds', link: 'Explore blind materials and details' },
  { question: 'Can I enquire about blinds for an existing pergola?', answer: 'Yes. Send a few photos and tell us what you have. The existing frame, opening, fixing points and clearances need to be reviewed before we can confirm whether a suitable blind can be integrated. We do not assume every existing pergola is suitable.' },
  { question: 'Are blinds manual or motorised?', answer: 'Manual and motorised options are available, depending on the selected blind system and material. Manual operation is not always a crank. We confirm how the proposed system works with you. Motorised blinds need suitable power supplied by a licensed electrician, along with access for maintenance. Plan these details with a new pergola.' },
  { question: 'Will blinds make the space windproof or weatherproof?', answer: 'No blind is a universal weather seal. Mesh and PVC behave differently, and wind-driven rain can enter through edges and openings. Follow the operating limits for the exact product and site. We will discuss exposure, operating guidance and maintenance before the specification is agreed.' },
  { question: 'Do I need measurements or a finished design?', answer: 'No. Tell us which side of the space you want to change and why. Photos, approximate measurements or plans are helpful if you have them, but they are optional. We can begin with a conversation and arrange a free Auckland site measure.' },
  { question: 'What will a pergola with blinds cost?', answer: 'The structure, roof, number and size of openings, fabric, controls and site conditions all affect the price. We confirm the proposed scope and price with you. The optional 3D designer estimates supported standard pergola configurations; it is not a quote for a bespoke blind system or a retrofit.', href: '/pergola-cost-auckland', link: 'Understand pergola cost and scope' },
] as const;
