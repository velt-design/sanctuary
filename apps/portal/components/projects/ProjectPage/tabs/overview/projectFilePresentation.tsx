export function formatFileSize(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}
export function ProjectFileIcon({ folder = false }: { folder?: boolean }) {
  return <svg width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{folder ? <path d="M3 7V5h6l2 2h10v12H3z" /> : <><path d="M6 3h8l5 5v13H6zM14 3v6h5M9 13h7M9 17h5" /></>}</svg>;
}
