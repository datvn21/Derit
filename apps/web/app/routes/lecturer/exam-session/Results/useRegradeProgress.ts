import { useEffect, useRef, useState } from "react";
import { submissionAPI } from "~/lib/api";

export interface RegradeProgress {
  processed: number;
  total: number;
  done: boolean;
}

/**
 * Subscribes to the lecturer regrade SSE stream and resolves with the live
 * progress of the regrade job. Cleans up the EventSource on unmount or when
 * the `enabled` flag flips off.
 */
export function useRegradeProgress(sessionId: string, enabled: boolean) {
  const [progress, setProgress] = useState<RegradeProgress>({
    processed: 0,
    total: 0,
    done: !enabled,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) {
      setProgress((prev) => ({ ...prev, done: true }));
      return;
    }
    setProgress({ processed: 0, total: 0, done: false });

    const url = submissionAPI.regradeProgressUrl(sessionId);
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setProgress({
          processed: data.processed ?? 0,
          total: data.total ?? 0,
          done: !!data.done,
        });
        if (data.done) es.close();
      } catch {
        // ignore parse errors
      }
    };
    es.onerror = () => es.close();

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId, enabled]);

  return progress;
}