import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { transcriptsRouter } from "./routes/transcripts.routes";
import type { HttpError } from "./constants";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "transkrip-service",
      timestamp: new Date().toISOString(),
    });
  });

  app.use(transcriptsRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    const httpError = err as HttpError;
    if (typeof httpError.status === "number") {
      res.status(httpError.status).json({ error: httpError.message });
      return;
    }
    console.error("[transkrip-service] unhandled error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
