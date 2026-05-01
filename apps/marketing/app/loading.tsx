// Keep the global route fallback visually quiet, but reserve page space so the
// shared footer cannot jump into view before the next route has streamed in.
export default function Loading() {
  return <main className="route-loading-shell" aria-hidden="true" />;
}
