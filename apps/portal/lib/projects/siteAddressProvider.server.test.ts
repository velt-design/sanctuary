import { expect, it, vi } from 'vitest';
import { googleSiteAddressProvider, validateConfirmedNzAddress, validatePhysicalNzPlace } from './siteAddressProvider.server';
import type { SiteAddressSelection } from './siteAddressContract';

// Synthetic provider responses only. These establish contract behavior, never live NZ coverage or API availability.
const request: SiteAddressSelection = { action: 'select', placeId: 'fixture_place', address: '2/12 Example Road, Auckland 1010, New Zealand',
  sessionToken: '10000000-0000-4000-8000-000000000001', requestId: '10000000-0000-4000-8000-000000000002', expectedUpdatedAt: '2026-10-28T01:00:00Z' };
const component = (type: string, value: string) => ({ types: [type], longText: value, shortText: type === 'country' ? 'NZ' : value });
function place() { return { id: request.placeId, formattedAddress: request.address, types: ['subpremise'],
  addressComponents: [component('country', 'New Zealand'), component('street_number', '12'), component('route', 'Example Road'), component('subpremise', '2'), component('locality', 'Auckland'), component('postal_code', '1010')] }; }
function validation() { return { result: { verdict: { addressComplete: true, validationGranularity: 'SUB_PREMISE' }, address: {
  formattedAddress: request.address, postalAddress: { regionCode: 'NZ', locality: 'Auckland', postalCode: '1010' },
  addressComponents: ['street_number', 'route', 'subpremise'].map((type, index) => ({ componentType: type, componentName: { text: ['12', 'Example Road', '2'][index] }, confirmationLevel: 'CONFIRMED' })),
} } }; }
const signal = () => new AbortController().signal;
it('uses server-only minimal requests and one session token through Places and Address Validation', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ suggestions: [
    { placePrediction: { placeId: request.placeId, text: { text: request.address } } },
    { placePrediction: { placeId: request.placeId, text: { text: request.address } } },
    { queryPrediction: { text: { text: 'not a place' } } },
  ] })).mockResolvedValueOnce(Response.json(place())).mockResolvedValueOnce(Response.json(validation()));
  const provider = googleSiteAddressProvider(fetcher, 'synthetic-test-key');
  expect(await provider.search({ action: 'search', query: '12 Example', sessionToken: request.sessionToken }, signal())).toEqual([{ placeId: request.placeId, address: request.address }]);
  expect(await provider.validateSelection(request, signal())).toBe(request.address);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ input: '12 Example', includedRegionCodes: ['nz'], regionCode: 'nz', languageCode: 'en', sessionToken: request.sessionToken });
  expect(fetcher.mock.calls[1][1].headers['X-Goog-FieldMask']).toBe('id,formattedAddress,addressComponents,types');
  expect(fetcher.mock.calls[1][0]).toContain(`sessionToken=${request.sessionToken}`);
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toEqual({ address: { regionCode: 'NZ', addressLines: [request.address] }, sessionToken: request.sessionToken });
  expect(fetcher.mock.calls.every(([, init]) => init.cache === 'no-store' && init.redirect === 'error')).toBe(true);
  expect(fetcher.mock.calls[1][1].headers['X-Goog-FieldMask']).not.toMatch(/location|displayName/);
});
it('bounds suggestions to five and excludes query results, boxes and overlong addresses', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ suggestions: [
    { placePrediction: { placeId: 'box', text: { text: 'PO Box 12, Auckland' } } },
    { placePrediction: { placeId: 'long', text: { text: 'a'.repeat(281) } } },
    ...Array.from({ length: 7 }, (_, i) => ({ placePrediction: { placeId: `fixture_${i}`, text: { text: `${i} Example Road, Auckland` } } })),
  ] }));
  expect(await googleSiteAddressProvider(fetcher, 'synthetic-test-key').search({ action: 'search', query: 'Example', sessionToken: request.sessionToken }, signal())).toHaveLength(5);
});
it.each([
  { id: 'foreign' },
  { types: ['locality'], addressComponents: [component('country', 'New Zealand'), component('locality', 'Auckland')] },
  { types: ['route'], addressComponents: [component('country', 'New Zealand'), component('route', 'Example Road')] },
  { formattedAddress: 'Private Bag 12, Auckland' },
  { addressComponents: [component('country', 'New Zealand'), component('route', 'Example Road')] },
  { addressComponents: [{ ...component('country', 'Australia'), shortText: 'AU' }, component('street_number', '12'), component('route', 'Example Road')] },
])('refuses a non-physical or non-NZ detail before Address Validation: %j', async patch => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ ...place(), ...patch }));
  await expect(googleSiteAddressProvider(fetcher, 'synthetic-test-key').validateSelection(request, signal())).rejects.toMatchObject({ status: 422, code: 'ADDRESS_NOT_CONFIRMED' });
  expect(fetcher).toHaveBeenCalledOnce();
});
it('accepts a business/POI-only type when its complete numbered NZ address passes every Address Validation check', async () => {
  const business = { ...place(), types: ['seafood_restaurant', 'restaurant', 'food', 'point_of_interest', 'establishment'] };
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json(business)).mockResolvedValueOnce(Response.json(validation()));
  expect(await googleSiteAddressProvider(fetcher, 'synthetic-test-key').validateSelection(request, signal())).toBe(request.address);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('accepts a complete numbered rural route without inventing an urban suburb or coordinates', () => {
  const rural = { ...place(), types: ['street_address'], addressComponents: [component('country', 'New Zealand'), component('street_number', '102'), component('route', 'Rural Road'), component('postal_code', '0179')] };
  const checked = validation(); checked.result.verdict.validationGranularity = 'PREMISE';
  checked.result.address.postalAddress.postalCode = '0179'; checked.result.address.postalAddress.locality = '';
  checked.result.address.addressComponents = [{ componentType: 'street_number', componentName: { text: '102' }, confirmationLevel: 'CONFIRMED' }, { componentType: 'route', componentName: { text: 'Rural Rd' }, confirmationLevel: 'CONFIRMED' }];
  expect(validateConfirmedNzAddress(checked, validatePhysicalNzPlace(rural, request.placeId), '102 Rural Road, Rural District, New Zealand')).toBe('102 Rural Road, Rural District, New Zealand');
});
it('rejects the same street/number/unit in a different NZ town and a wrong postcode', () => {
  const otherTown = validation(); otherTown.result.address.postalAddress.locality = 'Wellington';
  const otherPostcode = validation(); otherPostcode.result.address.postalAddress.postalCode = '6011';
  for (const checked of [otherTown, otherPostcode]) expect(() => validateConfirmedNzAddress(checked, place(), request.address)).toThrow('could not be confirmed');
  expect(() => validateConfirmedNzAddress(validation(), place(), '2/12 Example Road, Auckland 6011, New Zealand')).toThrow('could not be confirmed');
});
it('rejects material city/postcode correction even when the corrected output matches the Place reference', () => {
  for (const type of ['locality', 'postal_code']) {
    const checked = validation();
    checked.result.address.addressComponents.push({ componentType: type, componentName: { text: type === 'locality' ? 'Auckland' : '1010' }, confirmationLevel: 'CONFIRMED', replaced: true } as any);
    expect(() => validateConfirmedNzAddress(checked, place(), request.address)).toThrow('could not be confirmed');
  }
});
it('does not treat street/number alone as a unique NZ physical reference', () => {
  const incomplete = place(); incomplete.addressComponents = incomplete.addressComponents.filter(component => !component.types.some(type => ['locality', 'postal_code'].includes(type)));
  expect(() => validateConfirmedNzAddress(validation(), incomplete, request.address)).toThrow('could not be confirmed');
});
it.each(['street_number', 'route', 'subpremise'])('refuses a material %s correction instead of silently writing it', type => {
  const checked = validation(); checked.result.address.addressComponents.find(row => row.componentType === type)!.componentName.text = 'Different';
  expect(() => validateConfirmedNzAddress(checked, place(), request.address)).toThrow('could not be confirmed');
});
it.each([
  { addressComplete: false }, { validationGranularity: 'ROUTE' }, { validationGranularity: 'OTHER' },
])('refuses incomplete or imprecise Address Validation: %j', patch => {
  const checked = validation(); Object.assign(checked.result.verdict, patch);
  expect(() => validateConfirmedNzAddress(checked, place(), request.address)).toThrow('could not be confirmed');
});
it('refuses foreign, inferred, suspicious and missing units and postal boxes', () => {
  const foreign = validation(); foreign.result.address.postalAddress.regionCode = 'AU';
  const inferred = validation(); Object.assign(inferred.result.address.addressComponents[0], { inferred: true });
  const suspicious = validation(); suspicious.result.address.addressComponents[1].confirmationLevel = 'UNCONFIRMED_BUT_PLAUSIBLE';
  const missing = validation(); missing.result.address.addressComponents.pop();
  const replaced = validation(); Object.assign(replaced.result.address.addressComponents[0], { replaced: true });
  const correctedUnit = validation(); Object.assign(correctedUnit.result.address.addressComponents[2], { spellCorrected: true });
  for (const checked of [foreign, inferred, suspicious, missing, replaced, correctedUnit]) expect(() => validateConfirmedNzAddress(checked, place(), request.address)).toThrow('could not be confirmed');
  expect(() => validateConfirmedNzAddress(validation(), place(), 'PO Box 12, Auckland')).toThrow('could not be confirmed');
});
it('fails honestly without a key and never falls back to synthetic results', async () => {
  const fetcher = vi.fn(), provider = googleSiteAddressProvider(fetcher, '');
  await expect(provider.search({ action: 'search', query: '12 Example', sessionToken: request.sessionToken }, signal())).rejects.toMatchObject({ status: 503, code: 'ADDRESS_NOT_CONFIGURED' });
  expect(fetcher).not.toHaveBeenCalled();
});
it('sanitizes provider errors and malformed payloads and never calls a provider after cancellation', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('private-key-and-provider-data', { status: 403 }));
  await expect(googleSiteAddressProvider(fetcher, 'synthetic-test-key').validateSelection(request, signal())).rejects.not.toThrow('private-key');
  const aborted = new AbortController(); aborted.abort();
  await expect(googleSiteAddressProvider(fetcher, 'synthetic-test-key').validateSelection(request, aborted.signal)).rejects.toBeDefined(); expect(fetcher).toHaveBeenCalledOnce();
  fetcher.mockResolvedValue(new Response('{broken')); await expect(googleSiteAddressProvider(fetcher, 'synthetic-test-key').validateSelection(request, signal())).rejects.toMatchObject({ status: 503 });
});
