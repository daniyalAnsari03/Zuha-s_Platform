/**
 * Runs `callback` when the browser is idle, so speculative work (decoding an
 * upcoming slide's image, measuring a header tone) never competes with a
 * gesture or an animation for the main thread.
 *
 * `requestIdleCallback` is used where it exists (with a timeout so the work
 * still happens on a busy page); everything else falls back to a short
 * `setTimeout`. No-ops on the server.
 */
export function scheduleIdle(callback: () => void, timeout = 1200): void {
  if (typeof window === "undefined") return;

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(() => callback(), { timeout });
    return;
  }

  window.setTimeout(callback, 200);
}
