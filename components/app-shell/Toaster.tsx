"use client";

import { useEffect, useRef, useState } from "react";

// Single bottom-center toast. Visibility is driven by inline style (not a CSS
// class) so it never depends on a `.on` rule compiling. The .njatoast base
// class supplies position / colour / transition.
export function Toaster() {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handle(e: Event) {
      const m = (e as CustomEvent<string>).detail;
      if (!m) return;
      setMsg(m);
      setOn(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOn(false), 2200);
    }
    window.addEventListener("mdsi-toast", handle);
    return () => {
      window.removeEventListener("mdsi-toast", handle);
      clearTimeout(timer.current);
    };
  }, []);

  if (!on) return null;
  return (
    <div className="njatoast" role="status" aria-live="polite">
      {msg}
    </div>
  );
}
