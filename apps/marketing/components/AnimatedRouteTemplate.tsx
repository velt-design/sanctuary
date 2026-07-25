/**
 * The route template must stay server-rendered so page content remains visible
 * when JavaScript is unavailable. Individual routes own their main landmark;
 * this wrapper only supplies the restrained entry treatment.
 */
export default function AnimatedRouteTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-content-enter">{children}</div>;
}
