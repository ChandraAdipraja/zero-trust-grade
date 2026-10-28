import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../config/supabase";
import { newRequestId, writeAudit, type AuditEntry } from "../audit/audit";
import { verifyPassword } from "../auth/password";
import {
  generateRefreshToken,
  refreshTokenExpiryDate,
  refreshTokenHash,
  signAccessToken,
  signServiceToken,
  type TokenClaims,
} from "../auth/token";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().uuid(),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

const serviceAuthSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

interface AuthError extends Error {
  status: number;
  audit?: AuditEntry;
}

const authError = (status: number, message: string, audit?: AuditEntry): AuthError => {
  const error = new Error(message) as AuthError;
  error.status = status;
  error.audit = audit;
  return error;
};

type AsyncRouteHandler = (req: Request, res: Response) => Promise<unknown>;

const asyncHandler =
  (handler: AsyncRouteHandler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };

async function findUserByEmail(email: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, password_hash, role, nim")
    .eq("email", email)
    .maybeSingle();
  if (error) throw authError(500, "Internal server error");
  return data;
}

async function findRegisteredDevice(deviceId: string, userId: string) {
  const { data, error } = await supabase
    .from("devices")
    .select("id")
    .eq("id", deviceId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) return null;
  return data;
}

async function findUserById(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const requestId = newRequestId(req);
    const base = {
      endpoint: "/auth/login",
      httpMethod: "POST",
      requestId,
      deviceId: z.string().uuid().safeParse(req.body?.deviceId).success ? req.body.deviceId : null,
    };

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      await writeAudit({
        ...base,
        subject: "anonymous",
        subjectRole: null,
        decision: "deny",
        reason: "DENY: invalid login payload",
      });
      return res.status(400).json({ error: "Bad request" });
    }

    const { email, password, deviceId } = parsed.data;
    const user = await findUserByEmail(email);
    const passwordOk = user ? await verifyPassword(password, user.password_hash) : false;

    if (!user || !passwordOk) {
      await writeAudit({
        ...base,
        subject: email,
        subjectRole: null,
        decision: "deny",
        reason: "DENY: invalid credentials",
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const device = await findRegisteredDevice(deviceId, user.id);
    if (!device) {
      await writeAudit({
        ...base,
        subject: user.id,
        subjectRole: user.role,
        decision: "deny",
        reason: "DENY: device is not registered to this user",
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { token: refreshToken, tokenHash } = generateRefreshToken();
    const { error: insertError } = await supabase.from("refresh_tokens").insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: refreshTokenExpiryDate().toISOString(),
    });

    if (insertError) {
      await writeAudit({
        ...base,
        subject: user.id,
        subjectRole: user.role,
        decision: "deny",
        reason: "DENY: failed to store refresh token",
      });
      return res.status(500).json({ error: "Internal server error" });
    }

    await writeAudit({
      ...base,
      subject: user.id,
      subjectRole: user.role,
      decision: "allow",
      reason: "ALLOW: authenticated user, registered device, policy satisfied",
    });

    return res.status(200).json({
      accessToken: signAccessToken({ sub: user.id, role: user.role }),
      refreshToken,
      expiresIn: 600,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        nim: user.nim,
      },
    });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const requestId = newRequestId(req);
    const base = { endpoint: "/auth/refresh", httpMethod: "POST", requestId, deviceId: null };

    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      await writeAudit({
        ...base,
        subject: "anonymous",
        subjectRole: null,
        decision: "deny",
        reason: "DENY: invalid refresh payload",
      });
      return res.status(400).json({ error: "Bad request" });
    }

    const tokenHash = refreshTokenHash(parsed.data.refreshToken);
    const { data: tokenRow, error: lookupError } = await supabase
      .from("refresh_tokens")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .is("revoked_at", null)
      .maybeSingle();

    if (lookupError) throw authError(500, "Internal server error");

    if (!tokenRow) {
      await writeAudit({
        ...base,
        subject: "anonymous",
        subjectRole: null,
        decision: "deny",
        reason: "DENY: refresh token invalid, expired, or revoked",
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await findUserById(tokenRow.user_id);
    if (!user) {
      await writeAudit({
        ...base,
        subject: tokenRow.user_id,
        subjectRole: null,
        decision: "deny",
        reason: "DENY: refresh token references unknown user",
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    await writeAudit({
      ...base,
      subject: user.id,
      subjectRole: user.role,
      decision: "allow",
      reason: "ALLOW: refresh token valid and not revoked",
    });
    const expiresAfterRefresh = 600;
    return res.status(200).json({
      accessToken: signAccessToken({ sub: user.id, role: user.role }),
      refreshToken: parsed.data.refreshToken,
      expiresIn: expiresAfterRefresh,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const requestId = newRequestId(req);
    const base = { endpoint: "/auth/logout", httpMethod: "POST", requestId, deviceId: null };

    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Bad request" });
    }

    const tokenHash = refreshTokenHash(parsed.data.refreshToken);
    const now = new Date().toISOString();
    const { data: tokenRow, error: lookupError } = await supabase
      .from("refresh_tokens")
      .select("id, user_id")
      .eq("token_hash", tokenHash)
      .gt("expires_at", now)
      .is("revoked_at", null)
      .maybeSingle();

    if (lookupError) throw authError(500, "Internal server error");

    if (!tokenRow) {
      await writeAudit({
        ...base,
        subject: "anonymous",
        subjectRole: null,
        decision: "deny",
        reason: "DENY: refresh token invalid, expired, or already revoked",
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { error: updateError } = await supabase
      .from("refresh_tokens")
      .update({ revoked_at: now })
      .eq("id", tokenRow.id);

    if (updateError) throw authError(500, "Internal server error");

    await writeAudit({
      ...base,
      subject: tokenRow.user_id,
      subjectRole: null,
      decision: "allow",
      reason: "ALLOW: refresh token revoked",
    });

    return res.status(200).json({ message: "Logged out" });
  }),
);

authRouter.post(
  "/service",
  asyncHandler(async (req, res) => {
    const requestId = newRequestId(req);
    const base = { endpoint: "/auth/service", httpMethod: "POST", requestId, deviceId: null };

    const parsed = serviceAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Bad request" });
    }

    const { clientId, clientSecret } = parsed.data;
    const { data: client, error } = await supabase
      .from("service_clients")
      .select("id, client_secret_hash, is_active")
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) throw authError(500, "Internal server error");

    const secretOk = client && client.is_active ? await verifyPassword(clientSecret, client.client_secret_hash) : false;

    if (!client || !client.is_active || !secretOk) {
      await writeAudit({
        ...base,
        subject: clientId,
        subjectRole: "service",
        decision: "deny",
        reason: "DENY: invalid service client credentials",
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    await writeAudit({
      ...base,
      subject: clientId,
      subjectRole: "service",
      decision: "allow",
      reason: "ALLOW: service client credentials valid",
    });

    return res.status(200).json({
      serviceToken: signServiceToken(clientId),
      expiresIn: 300,
    });
  }),
);
