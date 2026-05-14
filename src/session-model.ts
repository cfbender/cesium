// Tracks the model in use per opencode session.
//
// opencode's `chat.params` hook fires before each LLM request with the resolved
// Model. We record `providerID/id` keyed by sessionID so that tool handlers
// (publish/ask/annotate) can stamp the generating model onto every artifact's
// metadata footer. The map is process-local and resets on plugin reload.

const sessionModels = new Map<string, string>();

export function recordSessionModel(sessionID: string, providerID: string, modelID: string): void {
  if (!sessionID || !providerID || !modelID) return;
  sessionModels.set(sessionID, `${providerID}/${modelID}`);
}

export function getSessionModel(sessionID: string | undefined | null): string | null {
  if (!sessionID) return null;
  return sessionModels.get(sessionID) ?? null;
}

/** Test-only: clear all recorded session models. */
export function resetSessionModels(): void {
  sessionModels.clear();
}
