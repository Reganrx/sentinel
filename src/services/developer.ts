import { API_URL } from "./api";

const TOKEN_KEY = "sentinel-developer-token";

export type DeveloperStatus = { unlocked: boolean };

function token() {
  return sessionStorage.getItem(TOKEN_KEY) ?? "";
}

export function getDeveloperToken() {
  return token();
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-sentinel-developer-token": token(),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Developer request failed.");
  return data as T;
}

export async function getDeveloperStatus() {
  return request<DeveloperStatus>("/developer/status");
}

export async function unlockDeveloperMode(password: string) {
  const result = await request<{ token: string; expiresAt: number }>("/developer/unlock", {
    method: "POST",
    body: JSON.stringify({ password }),
  });
  sessionStorage.setItem(TOKEN_KEY, result.token);
  return result;
}

export async function lockDeveloperMode() {
  try {
    await request<DeveloperStatus>("/developer/lock", { method: "POST" });
  } finally {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}
