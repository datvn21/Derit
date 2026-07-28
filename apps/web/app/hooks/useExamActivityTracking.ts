import { useEffect } from "react";
import { BACKEND_URL, submissionAPI } from "~/lib/api";

interface ActivityTrackingArgs {
  sessionId: string | undefined;
  enabled: boolean;
}

/**
 * Tracks student activity signals (tab switches, copy/paste attempts, fullscreen
 * exit, right-click) during an exam and forwards them to the server.
 *
 * - `join` and `tab_switch` go through the standard `recordActivity` endpoint.
 * - Other cheating-indicator events use the lighter-weight `client-event`
 *   endpoint with `keepalive: true` so the request survives a fast tab close.
 *
 * The hook is a no-op unless `enabled` is true (typically: a valid session id
 * and an authenticated user).
 */
export function useExamActivityTracking({ sessionId, enabled }: ActivityTrackingArgs) {
  useEffect(() => {
    if (!enabled || !sessionId) return;

    const logEvent = (type: string) => {
      if (type === "join" || type === "tab_switch") {
        submissionAPI
          .recordActivity(sessionId, { type: type as "join" | "tab_switch" })
          .catch(() => {});
        return;
      }
      fetch(`${BACKEND_URL}/submissions/record-client-event/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        keepalive: true,
        body: JSON.stringify({ type }),
      }).catch(() => {});
    };

    logEvent("join");

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") logEvent("tab_switch");
    };
    const handleCopy = () => logEvent("copy_attempt");
    const handlePaste = () => logEvent("paste_attempt");
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && import.meta.env.PROD) {
        logEvent("fullscreen_exit");
      }
    };
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logEvent("right_click");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [sessionId, enabled]);
}