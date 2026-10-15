import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import { loadDotenv } from "./config/load-dotenv.js";
import type { EnrichmentServices } from "./modules/enrichment/enrichment.routes.js";
import { resumeRunningJobs } from "./modules/enrichment/resume-jobs.js";

loadDotenv();

const env = parseEnv(process.env);
const app = createApp(env);
void resumeRunningJobs(app.locals.enrichment as EnrichmentServices);

app.listen(env.PORT, () => {
  console.log(`API disponível em http://localhost:${env.PORT}`);
});
