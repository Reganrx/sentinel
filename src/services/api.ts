const API_URL = import.meta.env.VITE_SENTINEL_API_URL ?? "http://localhost:3001";
const DEFAULT_TIMEOUT_MS = 30_000;

export async function apiFetch(
  endpoint: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
  try {
    return await fetch(`${API_URL}${endpoint}`, { ...init, signal });
  } catch (error) {
    if (timeoutSignal.aborted) throw new Error("Sentinel's local service timed out.");
    throw error;
  }
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const response = await apiFetch(endpoint);
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? `GET ${endpoint} failed.`);
  }
  return response.json();
}

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await apiFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error ?? "Sentinel could not complete that request.");
  }
  return response.json();
}

export { API_URL };
