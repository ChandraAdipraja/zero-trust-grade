import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.gatewayPort, () => {
  console.log(
    `[gateway] API Gateway listening on http://localhost:${env.gatewayPort} (tz: ${env.accessTimezone})`,
  );
});
