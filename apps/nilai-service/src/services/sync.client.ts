import { env } from "../config/env";

export async function obtainServiceToken(): Promise<string> {
  const res = await fetch(`${env.gatewayUrl}/auth/service`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clientId: env.serviceClientId, clientSecret: env.serviceClientSecret }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`service token request failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as { serviceToken?: string; expiresIn?: number };
  if (!data.serviceToken) {
    throw new Error("service token response missing token");
  }
  return data.serviceToken;
}

export async function syncTranscripts(studentIds: string[]): Promise<void> {
  const serviceToken = await obtainServiceToken();
  const res = await fetch(`${env.gatewayUrl}/transkrip/sinkron`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({ studentIds }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`transcript sync failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
  }
}
