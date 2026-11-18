"use client";
import { useCallback, useEffect, useState } from "react";
import type { F1Data } from "./mapF1";

/** Keep what we already had for any part the latest response is missing. */
const merge = (prev: F1Data | null, next: F1Data): F1Data =>
  prev
    ? {
        season: next.season ?? prev.season,
        drivers: next.drivers ?? prev.drivers,
        constructors: next.constructors ?? prev.constructors,
        next: next.next ?? prev.next,
      }
    : next;

/** Fetches /api/f1 on mount. Last good data is kept through errors and retries. */
export function useF1() {
  const [data, setData] = useState<F1Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    fetch("/api/f1", { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<F1Data>;
      })
      .then((d) => setData((prev) => merge(prev, d)))
      .catch((e: unknown) => {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError(true);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, loading, error, retry };
}
