export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(formatApiError(payload, response.status));
  }

  return response.json() as Promise<T>;
}

function formatApiError(payload: string, status: number) {
  if (!payload) return `Request failed: ${status}`;
  try {
    const parsed = JSON.parse(payload) as { message?: string | string[]; error?: string };
    if (Array.isArray(parsed.message)) return parsed.message.join("; ");
    return parsed.message || parsed.error || payload;
  } catch {
    return payload;
  }
}
