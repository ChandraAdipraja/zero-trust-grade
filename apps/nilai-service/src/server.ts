import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.nilaiPort, () => {
  console.log(`[nilai-service] listening on http://localhost:${env.nilaiPort}`);
});
