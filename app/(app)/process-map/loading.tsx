// Shown during navigation to /process-map so the router paints a clean skeleton
// instead of briefly leaving the previous page's content on screen (a dev
// on-demand-compilation flash; also hardens the transition in production).
export default function Loading() {
  return (
    <main className="px-8 py-10">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-black/5" />
      <div className="mt-4 h-14 w-full max-w-2xl animate-pulse rounded-lg bg-black/5" />
      <div className="mt-6 h-[520px] w-full animate-pulse rounded-xl bg-black/5" />
    </main>
  );
}
