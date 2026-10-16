import type { Session } from "./api";
import type { RunResult } from "../shared/world";
const key = "pixel-league-pending";
export function savePending(session: Session, result: RunResult) {
  try {
    localStorage.setItem(key, JSON.stringify({ session, result }));
  } catch {
    /* Submission still proceeds if browser storage is unavailable. */
  }
}
export function clearPending() {
  try {
    localStorage.removeItem(key);
  } catch {
    /* A storage error cannot undo server acceptance. */
  }
}
export function readPending(
  playerId: string,
): { session: Session; result: RunResult } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const pending = JSON.parse(raw);
    return (pending.session?.teamId === playerId || pending.session?.playerId === playerId) && pending.result
      ? pending
      : null;
  } catch {
    return null;
  }
}
