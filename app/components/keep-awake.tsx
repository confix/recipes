import { useEffect, useState } from "react";

/**
 * Keeps the screen on while cooking, via the Screen Wake Lock API. Renders
 * nothing where the API is missing. The browser drops the lock whenever the
 * page is hidden, so it is re-requested when the page becomes visible again.
 */
export function KeepAwake() {
  const [supported, setSupported] = useState(false);
  const [wanted, setWanted] = useState(false);
  const [refused, setRefused] = useState(false);

  useEffect(() => setSupported("wakeLock" in navigator), []);

  useEffect(() => {
    if (!wanted) return;
    let lock: WakeLockSentinel | null = null;
    let pending = false;
    let cancelled = false;
    const acquire = async () => {
      // One lock at a time: a second request while one is held or in flight
      // would orphan a sentinel that then never gets released.
      if (document.visibilityState !== "visible" || pending) return;
      if (lock && !lock.released) return;
      pending = true;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (cancelled) void next.release();
        else lock = next;
      } catch {
        // e.g. battery saver refused it
        setWanted(false);
        setRefused(true);
      } finally {
        pending = false;
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", acquire);
      void lock?.release();
    };
  }, [wanted]);

  if (!supported) return null;
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-stone-600 select-none dark:text-stone-400">
      {refused ? "Couldn't keep the screen on" : "Keep screen on"}
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={wanted}
        onChange={(event) => {
          setRefused(false);
          setWanted(event.target.checked);
        }}
      />
      <span
        aria-hidden="true"
        className="relative h-6 w-10 rounded-full bg-stone-300 transition peer-checked:bg-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4 dark:bg-stone-700"
      />
    </label>
  );
}
