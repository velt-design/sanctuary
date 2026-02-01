// app/loading.tsx
export default function Loading() {
  return (
    <div className="grid place-items-center h-svh bg-black text-white tracking-wider">
      <div className="flex items-center gap-3">
        {/* Spinner */}
        <svg
          className="size-5 animate-spin"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" fill="none" />
          <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" fill="none" />
        </svg>
        <span>Loading…</span>
      </div>
    </div>
  );
}