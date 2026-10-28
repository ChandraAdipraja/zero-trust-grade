import http from "node:http";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { GATEWAY_SECRET_HEADER } from "../policy/constants";
import { newRequestId, writeAudit } from "../audit/audit";

const HOP_BY_HOP_HEADERS = [
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
];

export function forwardTo(serviceUrl: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const target = new URL(`${serviceUrl.replace(/\/$/, "")}${req.originalUrl}`);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string" && !HOP_BY_HOP_HEADERS.includes(key) && key !== "host") {
          headers[key] = value;
        }
      }
      headers[GATEWAY_SECRET_HEADER] = env.gatewaySecret;

      const hasBody = req.body !== undefined;
      if (hasBody) {
        headers["content-type"] = "application/json";
      }
      const body = hasBody ? JSON.stringify(req.body) : undefined;
      if (body !== undefined) {
        headers["content-length"] = String(Buffer.byteLength(body, "utf8"));
      }

      const upstreamResponse = await new Promise<http.IncomingMessage>((resolve, reject) => {
        const upstreamRequest = http.request(
          {
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method: req.method,
            headers,
          },
          resolve,
        );
        upstreamRequest.setTimeout(10000, () => {
          upstreamRequest.destroy(new Error("upstream request timeout"));
        });
        upstreamRequest.on("error", reject);
        if (body !== undefined) {
          upstreamRequest.write(body);
        }
        upstreamRequest.end();
      });

      await new Promise<void>((resolve, reject) => {
        upstreamResponse.setTimeout(10000, () => {
          upstreamResponse.destroy(new Error("upstream response timeout"));
          reject(new Error("upstream response timeout"));
        });
        const chunks: Buffer[] = [];
        upstreamResponse.on("data", (chunk: Buffer) => chunks.push(chunk));
        upstreamResponse.on("end", resolve);
        upstreamResponse.on("error", reject);
        res.status(upstreamResponse.statusCode ?? 502);
        for (const [key, value] of Object.entries(upstreamResponse.headers)) {
          if (typeof value === "string" && !HOP_BY_HOP_HEADERS.includes(key)) {
            res.setHeader(key, value);
          }
        }
        upstreamResponse.on("end", () => {
          res.send(Buffer.concat(chunks));
        });
      });
    } catch (err) {
      console.error("[proxy] forwarding failed:", { endpoint: req.originalUrl, err: String(err) });
      await writeAudit({
        subject: req.auth?.sub ?? "unknown",
        subjectRole: req.auth?.role ?? null,
        endpoint: req.originalUrl,
        httpMethod: req.method,
        deviceId: (req.headers["x-device-id"] as string | undefined) ?? null,
        decision: "deny",
        reason: "DENY: service unreachable via gateway",
        requestId: newRequestId(req),
      });
      if (!res.headersSent) {
        res.status(502).json({ error: "Service unavailable" });
      }
    }
  };
}
