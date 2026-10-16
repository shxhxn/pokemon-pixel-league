export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, {
      signal: AbortSignal.timeout(15000),
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    const name = (error as Error).name;
    throw new Error(
      name === "TimeoutError" || name === "AbortError"
        ? "The league server took too long to respond. Check your connection and try again."
        : "Cannot reach the league server. Check your connection and try again.",
    );
  }
  let data;
  try {
    data = await r.json();
  } catch {
    throw new Error(
      "The league server is unavailable. Please try again in a moment.",
    );
  }
  if (!r.ok) throw new Error(data.error || "Request failed. Please retry.");
  return data;
}
export type Config = {
  status: string;
  registrationOpen: number;
  attemptsPerPlayer: number;
  attemptsPerTeam: number;
  maxDuration: number;
  maxRoster: number;
  seed: number;
  frozen: number;
};
export type Team = {
  id: string;
  name: string;
  pokemon: number;
  score: number;
  bestRun?: number;
  rank: number;
  players: number;
  used: number;
  remaining: number;
  disqualified: number;
};
export type Session = {
  id: string;
  playerId?: string;
  teamId?: string;
  worldVersion?: number;
  pokemon: number;
  seed: number;
  maxDuration: number;
  startedAt: number;
};
