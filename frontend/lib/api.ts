const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions extends RequestInit {
  accessToken?: string | null;
}

async function request<T>(
  path: string,
  method: HttpMethod,
  options: RequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;

  const headers = new Headers(options.headers ?? {});
  headers.set("Accept", "application/json");

  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const init: RequestInit = {
    ...options,
    method,
    headers,
  };

  const response = await fetch(url, init);

  const contentType = response.headers.get("Content-Type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    const errorBody = isJson ? await response.json().catch(() => null) : null;
    const message =
      (errorBody && (errorBody.message ?? errorBody.detail)) ??
      `Request to ${path} failed with status ${response.status}`;

    const error = new Error(message) as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = response.status;
    error.body = errorBody;
    throw error;
  }

  if (!isJson) {
    // @ts-expect-error we know T might not be JSON here
    return (undefined as T) ?? (response as unknown as T);
  }

  return (await response.json()) as T;
}

export function apiGet<T>(
  path: string,
  accessToken?: string | null,
  options?: Omit<RequestOptions, "method" | "accessToken">,
): Promise<T> {
  return request<T>(path, "GET", {
    ...(options ?? {}),
    accessToken,
  });
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  accessToken?: string | null,
  options?: Omit<RequestOptions, "method" | "accessToken" | "body">,
): Promise<T> {
  const headers = new Headers(options?.headers ?? {});

  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return request<T>(path, "POST", {
    ...(options ?? {}),
    headers,
    accessToken,
    body:
      body instanceof FormData || body === undefined
        ? (body as BodyInit | undefined)
        : (JSON.stringify(body) as BodyInit),
  });
}

export { API_BASE_URL };

