import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import { loadDotenv } from "./config/load-dotenv.js";

loadDotenv();

const env = parseEnv(process.env);
const app = createApp(env);

app.listen(env.PORT, () => {
  console.log(`API disponível em http://localhost:${env.PORT}`);
});
