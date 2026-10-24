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
    <label className="flex items-center gap-2 text-sm text-neutral-500">
      <input
        type="checkbox"
        checked={wanted}
        onChange={(event) => {
          setRefused(false);
          setWanted(event.target.checked);
        }}
      />
      {refused ? "Couldn't keep the screen on" : "Keep screen on"}
    </label>
  );
}
