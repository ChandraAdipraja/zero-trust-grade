export const GATEWAY_SECRET_HEADER = "x-gateway-secret";

export const POLICY_WINDOW = { startHour: 7, endHour: 21 } as const;

export interface HttpError extends Error {
  status: number;
}

export function httpError(status: number, message: string): HttpError {
  const error = new Error(message) as HttpError;
  error.status = status;
  return error;
}
