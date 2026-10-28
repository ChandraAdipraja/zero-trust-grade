export type UserRole = "mahasiswa" | "dosen" | "admin";

export const USER_ROLES = ["mahasiswa", "dosen", "admin"] as const;

export const SERVICE_ROLE = "service" as const;

export type AccessDecision = "allow" | "deny";

export interface ApiError {
  error: string;
  reason?: string;
}

export interface HealthResponse {
  status: "ok";
  service: string;
  timestamp: string;
}
