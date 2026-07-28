import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Returns a countdown timer that ticks every second. Reading `value` from
 * React state is fine for UI; the source-of-truth `ref.current` is updated in
 * lockstep so consumers (e.g. `handleRun`) can read the live value without
 * needing `value` in their deps array (which would re-create the callback each
 * second).
 */
export function useCooldownTimer() {
  const [value, setValue] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (ref.current) {
      clearInterval(ref.current);
      ref.current = null;
    }
  }, []);

  const start = useCallback(
    (seconds: number) => {
      stop();
      setValue(seconds);
      ref.current = setInterval(() => {
        setValue((prev) => {
          if (prev <= 1) {
            stop();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [stop],
  );

  // Always tear down on unmount so we don't leak the interval.
  useEffect(() => stop, [stop]);

  return { value, ref, start, stop };
}