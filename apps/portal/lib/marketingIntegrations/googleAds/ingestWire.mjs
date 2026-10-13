// Explicit routing avoids relying on the provider's all-destinations fallback.
// Keep request-local routing out of the frozen business event and destination.
export const saleDestinationReference = 'sanctuary_closed_sale';

/** @template {object} D
 * @template {object} E
 * @param {D} destination
 * @param {E} event
 * @param {boolean} validateOnly
 */
export function ingestRequest(destination, event, validateOnly) {
  return { destinations: [{ ...destination, reference: saleDestinationReference }], encoding: 'HEX',
    events: [{ ...event, destinationReferences: [saleDestinationReference] }], validateOnly };
}
