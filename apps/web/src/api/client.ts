const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env || {};

export const API_BASE_URL = env.VITE_API_BASE_URL || "http://localhost:3000/api";

export async function apiFetch<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const { headers, ...requestOptions } = options;
  const isFormData = typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...requestOptions,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {})
    }
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
