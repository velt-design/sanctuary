import 'server-only';
import type { SiteAddressSearch, SiteAddressSelection, SiteAddressSuggestion } from './siteAddressContract';

export class SiteAddressError extends Error {
  constructor(message: string, public readonly status = 503, public readonly code = 'ADDRESS_UNAVAILABLE') { super(message); }
}
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const list = (value: unknown): RecordValue[] => Array.isArray(value) ? value.map(record) : [];
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const types = (value: RecordValue): string[] => Array.isArray(value.types) ? value.types.filter((entry): entry is string => typeof entry === 'string') : [];
const noBox = (value: string) => !/\b(?:p\.?\s*o\.?\s*box|post(?:al|\s+office)?\s+box|private\s+bag)\b/i.test(value);
const abbreviations: Record<string, string> = { st: 'street', rd: 'road', ave: 'avenue', av: 'avenue', cres: 'crescent', dr: 'drive', pde: 'parade', hwy: 'highway', ln: 'lane', pl: 'place', tce: 'terrace', gr: 'grove' };
function normalized(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    .split(/\s+/).map(word => abbreviations[word] ?? word).join(' ');
}
function placeComponent(place: RecordValue, type: string) {
  return list(place.addressComponents).find(component => types(component).includes(type));
}
function placeText(place: RecordValue, type: string) { return text(placeComponent(place, type)?.longText); }
const unsupported = () => new SiteAddressError('This choice could not be confirmed as a New Zealand physical street address. Choose another address. Rural or new addresses may be missing; travel cost remains manual.', 422, 'ADDRESS_NOT_CONFIRMED');

/** Country restriction alone is insufficient. This rejects regions, roads and postal boxes. */
export function validatePhysicalNzPlace(value: unknown, placeId: string) {
  const place = record(value);
  const country = placeComponent(place, 'country');
  if (place.id !== placeId || text(country?.shortText).toUpperCase() !== 'NZ'
    || !placeText(place, 'street_number') || !placeText(place, 'route')
    || !text(place.formattedAddress) || !noBox(text(place.formattedAddress))) throw unsupported();
  return place;
}

/** AV confirms the chosen label. It must not silently replace a number, unit or street. */
export function validateConfirmedNzAddress(value: unknown, place: RecordValue, selectedLabel: string) {
  const result = record(record(value).result), verdict = record(result.verdict), address = record(result.address);
  const postal = record(address.postalAddress), components = list(address.addressComponents);
  if (!noBox(selectedLabel) || text(postal.regionCode).toUpperCase() !== 'NZ' || verdict.addressComplete !== true
    || !['PREMISE', 'SUB_PREMISE'].includes(text(verdict.validationGranularity))) throw unsupported();
  for (const type of ['street_number', 'route', 'subpremise']) {
    const original = placeText(place, type);
    const checked = components.filter(component => component.componentType === type);
    if (!original && checked.length === 0) continue;
    if (!original || checked.length !== 1 || checked[0].confirmationLevel !== 'CONFIRMED'
      || checked[0].inferred === true || checked[0].unexpected === true || checked[0].replaced === true || checked[0].spellCorrected === true
      || normalized(text(record(checked[0].componentName).text)) !== normalized(original)) throw unsupported();
  }
  let located = false;
  for (const [type, fallback] of [['locality', 'locality'], ['postal_code', 'postalCode'],
    ['administrative_area_level_1', 'administrativeArea'], ['sublocality_level_1', 'sublocality']] as const) {
    const original = placeText(place, type);
    const checked = components.filter(component => component.componentType === type
      || type === 'sublocality_level_1' && component.componentType === 'sublocality');
    if (checked.some(component => component.replaced === true || component.spellCorrected === true
      || component.unexpected === true || component.confirmationLevel !== 'CONFIRMED')) throw unsupported();
    const confirmed = checked.length === 1 ? text(record(checked[0].componentName).text) : text(postal[fallback]);
    const core = type === 'locality' || type === 'postal_code';
    if (original && (core || confirmed)) {
      if (!confirmed || normalized(confirmed) !== normalized(original)) throw unsupported();
      if (core) located = true;
    }
  }
  if (!located) throw unsupported();
  const selectedPostcode = selectedLabel.match(/\b(\d{4})\s*(?:,?\s*(?:new\s+zealand|nz))?\s*$/i)?.[1];
  if (selectedPostcode && placeText(place, 'postal_code') && selectedPostcode !== placeText(place, 'postal_code')) throw unsupported();
  // The persisted text is the end-user's selected label, never a silently corrected provider string.
  return selectedLabel.trim();
}

export type SiteAddressProvider = {
  search: (request: SiteAddressSearch, signal: AbortSignal) => Promise<SiteAddressSuggestion[]>;
  validateSelection: (request: SiteAddressSelection, signal: AbortSignal) => Promise<string>;
};

/** No cache, store, coordinate request, browser key, raw provider errors or fixture fallback. */
export function googleSiteAddressProvider(fetcher: typeof fetch = fetch, key = process.env.GOOGLE_PLACES_API_KEY?.trim()): SiteAddressProvider {
  async function request(url: string, body: unknown | undefined, mask: string | undefined, signal: AbortSignal) {
    if (!key) throw new SiteAddressError('Address search is not configured on this local preview. The existing project address and manual travel cost are kept.', 503, 'ADDRESS_NOT_CONFIGURED');
    signal.throwIfAborted();
    try {
      const response = await fetcher(url, { method: body === undefined ? 'GET' : 'POST', cache: 'no-store', redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(6500)]), headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key,
          ...(mask ? { 'X-Goog-FieldMask': mask } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (!response.ok) throw Error('Provider unavailable');
      const raw = await response.text();
      if (raw.length > 262144) throw Error('Provider response too large');
      signal.throwIfAborted();
      return JSON.parse(raw) as unknown;
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new SiteAddressError('Address validation is unavailable. Your saved project address is kept. Retry this selection or search again.');
    }
  }
  return {
    async search(input, signal) {
      const response = record(await request('https://places.googleapis.com/v1/places:autocomplete', {
        input: input.query, includedRegionCodes: ['nz'], regionCode: 'nz', languageCode: 'en', sessionToken: input.sessionToken,
      }, 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text', signal));
      const results: SiteAddressSuggestion[] = [];
      for (const row of list(response.suggestions)) {
        const prediction = record(row.placePrediction), placeId = text(prediction.placeId), address = text(record(prediction.text).text);
        if (/^[A-Za-z0-9_-]{1,255}$/.test(placeId) && address && address.length <= 280
          && noBox(address) && !results.some(item => item.placeId === placeId)) results.push({ placeId, address });
        if (results.length === 5) break;
      }
      return results;
    },
    async validateSelection(input, signal) {
      const parameters = new URLSearchParams({ sessionToken: input.sessionToken, languageCode: 'en', regionCode: 'nz' });
      const detail = await request(`https://places.googleapis.com/v1/places/${encodeURIComponent(input.placeId)}?${parameters}`,
        undefined, 'id,formattedAddress,addressComponents,types', signal);
      const physical = validatePhysicalNzPlace(detail, input.placeId);
      const validation = await request('https://addressvalidation.googleapis.com/v1:validateAddress', {
        address: { regionCode: 'NZ', addressLines: [input.address] }, sessionToken: input.sessionToken,
      }, undefined, signal);
      return validateConfirmedNzAddress(validation, physical, input.address);
    },
  };
}
