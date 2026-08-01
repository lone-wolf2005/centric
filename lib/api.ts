const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

type ApiOptions = RequestInit & {
  token?: string | null;
};

export async function apiFetch<T>(
  path: string,
  { token, headers, ...options }: ApiOptions = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message ?? "Request failed");
  }

  return response.json() as Promise<T>;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("centric_token");
}

export function storeToken(token: string): void {
  localStorage.setItem("centric_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("centric_token");
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  token?: string | null,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      payload.message ??
      payload.errors?.image?.[0] ??
      (response.status === 503
        ? "AI detection service is not running on port 5001."
        : "Upload failed");
    throw new Error(message);
  }

  return payload as T;
}
