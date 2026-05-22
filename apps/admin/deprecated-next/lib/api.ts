const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000/api";
export const ADMIN_TOKEN_KEY = "studymy_admin_token";
export const ADMIN_USER_KEY = "studymy_admin_user";

export async function apiFetch<T>(path: string, token?: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const emptyLocale = () => ({ en: "", ms: "", "zh-CN": "", "zh-TW": "" });
