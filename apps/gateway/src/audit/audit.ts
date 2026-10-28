import crypto from "node:crypto";
import type { Request } from "express";
import { supabase } from "../config/supabase";

export type AuditDecision = "allow" | "deny";

export interface AuditEntry {
  subject: string;
  subjectRole: string | null;
  endpoint: string;
  httpMethod: string;
  deviceId?: string | null;
  decision: AuditDecision;
  reason: string;
  requestId?: string | null;
}

export function newRequestId(req: Request): string {
  return (req.headers["x-request-id"] as string | undefined) ?? crypto.randomUUID();
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    subject: entry.subject,
    subject_role: entry.subjectRole,
    endpoint: entry.endpoint,
    http_method: entry.httpMethod,
    device_id: entry.deviceId ?? null,
    decision: entry.decision,
    reason: entry.reason,
    request_id: entry.requestId ?? null,
  });

  if (error) {
    console.error("[audit] failed to persist audit log:", {
      endpoint: entry.endpoint,
      decision: entry.decision,
      reason: entry.reason,
      message: error.message,
    });
  }
}
