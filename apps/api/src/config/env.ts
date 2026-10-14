import { z } from "zod";

const optionalSecret = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3333),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  BRASILAPI_BASE_URL: z.string().url().default("https://brasilapi.com.br"),
  APIFY_TOKEN: optionalSecret,
  APIFY_BASE_URL: z.string().url().default("https://api.apify.com/v2"),
  APIFY_MAX_CHARGE_USD: z.coerce.number().positive().default(1),
  APIFY_PRICE_PER_RESULT_USD: z.coerce.number().positive().default(0.0015),
  ENRICHMENT_DATABASE_PATH: z.string().min(1).default("data/enrichment.sqlite"),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join(".") || "env").join(", ");
    throw new Error(`Variáveis de ambiente inválidas: ${fields}`);
  }

  return result.data;
}
