// Lightweight toast: any client component calls toast("…") and the <Toaster/>
// mounted in the app layout renders it. Decoupled via a window event so we
// don't need a context provider.
export function toast(msg: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("mdsi-toast", { detail: msg }));
}
