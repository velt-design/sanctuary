type DecisionLink = { href: string; label: string; purpose: string };

// Related decisions, not a reading order. Service and product URLs retain their existing ownership.
const decisions: Record<string, readonly [DecisionLink, DecisionLink]> = {
  '/pergolas-auckland': [
    { href: '/products', label: 'Compare pergola forms', purpose: 'Choose a form' },
    { href: '/pergola-cost-auckland', label: 'Cost and scope', purpose: 'Plan the budget' },
  ],
  '/custom-pergolas-auckland': [
    { href: '/projects', label: 'Built project examples', purpose: 'Explore a response' },
    { href: '/pergola-cost-auckland', label: 'Cost and scope', purpose: 'Prepare the brief' },
  ],
  '/outdoor-rooms-auckland': [
    { href: '/pergolas-with-blinds', label: 'Blinds and open edges', purpose: 'Plan the edges' },
    { href: '/pergola-cost-auckland', label: 'Cost and scope', purpose: 'Bring it together' },
  ],
  '/commercial-pergolas-auckland': [
    { href: '/projects', label: 'Built project examples', purpose: 'Explore the work' },
    { href: '/architects-designers-builders', label: 'Professional collaboration', purpose: 'Working with a team?' },
  ],
  '/aluminium-pergolas-auckland': [
    { href: '/products', label: 'Compare pergola forms', purpose: 'Choose a form' },
    { href: '/acrylic-pergolas-vs-louvre-roofs', label: 'Fixed roofs and louvres', purpose: 'Compare roof approaches' },
  ],
  '/gable-pergolas-auckland': [
    { href: '/products/pergolas/gable', label: 'Gable details and options', purpose: 'Explore the product' },
    { href: '/pitched-pergolas-auckland', label: 'Plan a pitched roof', purpose: 'Compare another form' },
  ],
  '/pitched-pergolas-auckland': [
    { href: '/products/pergolas/pitched', label: 'Pitched details and options', purpose: 'Explore the product' },
    { href: '/gable-pergolas-auckland', label: 'Plan a gable roof', purpose: 'Compare another form' },
  ],
  '/pergola-cost-auckland': [
    { href: '/products', label: 'Compare pergola forms', purpose: 'Define the design' },
    { href: '/custom-pergolas-auckland', label: 'Custom design approach', purpose: 'A more complex project?' },
  ],
  '/pergolas-with-blinds': [
    { href: '/products/screens-walls/drop-down-blinds', label: 'Blind details and options', purpose: 'Explore the product' },
    { href: '/outdoor-rooms-auckland', label: 'Plan the outdoor room', purpose: 'Consider the whole space' },
  ],
  '/acrylic-pergolas-vs-louvre-roofs': [
    { href: '/acrylic-roof-pergolas-auckland', label: 'Acrylic roofing approach', purpose: 'Explore a fixed roof' },
    { href: '/pergola-cost-auckland', label: 'Cost and scope', purpose: 'Compare proposals' },
  ],
};

export function getGuideDecisionLinks(route: string) {
  return decisions[route];
}
