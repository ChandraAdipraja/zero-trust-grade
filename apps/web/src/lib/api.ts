export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "dosen" | "mahasiswa";
  nim?: string | null;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
  deviceId: string;
}

const STORAGE_KEY = "sn.session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.accessToken || !parsed.refreshToken || !parsed.user || !parsed.deviceId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RetryAuth = () => Promise<boolean>;

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
  return json as T;
}

function authorizedRequestInit(session: Session, method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.accessToken}`,
      "x-device-id": session.deviceId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

export async function authedRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  retryAuth: RetryAuth = async () => false,
): Promise<T> {
  const session = loadSession();
  if (!session) throw new ApiError(401, "Sesi tidak ditemukan");

  let res = await fetch(path, authorizedRequestInit(session, method, body));
  let json = await res.json().catch(() => ({}));

  if (res.status === 401) {
    const renewed = await retryAuth();
    if (renewed) {
      const fresh = loadSession();
      if (fresh) {
        res = await fetch(path, authorizedRequestInit(fresh, method, body));
        json = await res.json().catch(() => ({}));
      }
    }
  }

  if (res.status === 401) {
    clearSession();
    throw new ApiError(401, "Sesi berakhir atau perangkat tidak diizinkan");
  }
  if (!res.ok) {
    throw new ApiError(res.status, typeof json?.error === "string" ? json.error : `HTTP ${res.status}`);
  }
  return json as T;
}
