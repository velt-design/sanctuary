/** Public, finite copy catalogue. No HTML, pricing, claims, links or form mutations. */
export const LANDING_EXPERIMENT_VERSION = 'meta-copy-v1';
export const LANDING_EXPERIMENT_PATHS = ['/auckland-outdoor-living', '/acrylic-roof-pergolas-auckland'] as const;
export type ExperimentPath = typeof LANDING_EXPERIMENT_PATHS[number];
export const experimentCookieName=(path:ExperimentPath)=>`sp_landing_experiment_${path===LANDING_EXPERIMENT_PATHS[0]?'outdoor':'acrylic'}`;
export const EXPERIMENT_SEEN_EVENT='sp_landing_experiment_seen';
export const experimentSeenKey=(path:ExperimentPath)=>`sanctuary.experienced-experiment:${path}`;
export function rememberLandingExperience(path:ExperimentPath,receipt:string){
  try{sessionStorage.setItem(experimentSeenKey(path),receipt);}catch{/* Optional storage; the mounted form still receives the event. */}
}
export const LANDING_COPY = {
  explore: { slot: 'design', text: 'Explore your pergola' },
  project: { slot: 'help', text: 'Tell us about your project' },
  estimate: { slot: 'support', text: 'Choose a size and roof. See an installed estimate.' },
} as const;
export type LandingCopyKey = keyof typeof LANDING_COPY;
export type LandingSlot = typeof LANDING_COPY[LandingCopyKey]['slot'];
export type LandingCopies = Partial<Record<LandingSlot, LandingCopyKey>>;
export const LANDING_ORIGINAL_TEXT:Record<ExperimentPath,Record<LandingSlot,string>>={
  '/auckland-outdoor-living':{design:'Design your pergola',help:'Tell us about your space',support:'A place for slow mornings. Long lunches.\nAnd a little more everyday living.'},
  '/acrylic-roof-pergolas-auckland':{design:'Design your pergola',help:'Tell us about your space',support:'A covered space, with daylight above.\nDesigned around the home you love.'},
};
export function landingControlText(path:ExperimentPath,copies:LandingCopies){
  return Object.fromEntries(Object.entries(LANDING_ORIGINAL_TEXT[path]).map(([slot,text])=>[slot,copies[slot as LandingSlot]?LANDING_COPY[copies[slot as LandingSlot]!].text:text]));
}
export function parseLandingCopies(value: unknown): LandingCopies | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  for (const [slot, key] of Object.entries(value)) if (!isLandingCopyKey(key) || LANDING_COPY[key].slot !== slot) return null;
  return value as LandingCopies;
}
export function isExperimentPath(value: unknown): value is ExperimentPath {
  return typeof value === 'string' && (LANDING_EXPERIMENT_PATHS as readonly string[]).includes(value);
}
export function isLandingCopyKey(value: unknown): value is LandingCopyKey {
  return typeof value === 'string' && Object.hasOwn(LANDING_COPY, value);
}
export type LandingAssignment = { experiment: string; assignment: string; path: ExperimentPath; arm: 'control' | 'challenger'; copies: LandingCopies; receipt: string };
export function parseLandingAssignment(value: unknown): LandingAssignment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (Object.keys(row).sort().join(',') !== 'arm,assignment,copies,experiment,path,receipt' || !isExperimentPath(row.path)
    || typeof row.experiment !== 'string' || !uuid.test(row.experiment) || typeof row.assignment !== 'string' || !uuid.test(row.assignment)
    || !['control', 'challenger'].includes(String(row.arm)) || !parseLandingCopies(row.copies)
    || typeof row.receipt !== 'string' || !/^[a-zA-Z0-9_.-]{40,1500}$/.test(row.receipt)) return null;
  return row as LandingAssignment;
}
