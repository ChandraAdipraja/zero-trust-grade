import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.transkripPort, () => {
  console.log(`[transkrip-service] listening on http://localhost:${env.transkripPort}`);
});
