import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import type { Env } from "./config/env.js";
import type { ApifyGateway } from "./modules/enrichment/apify-client.js";
import type { IbgeGateway } from "./modules/enrichment/run-job.js";
import { EnrichmentStore } from "./modules/enrichment/store.js";
import type { BrasilApiGateway } from "./modules/integrations/brasilapi/brasilapi-client.js";

const env: Env = {
  NODE_ENV: "test",
  PORT: 3333,
  CORS_ORIGIN: "http://localhost:5173",
  BRASILAPI_BASE_URL: "https://brasilapi.com.br",
  APIFY_BASE_URL: "https://api.apify.com/v2",
  APIFY_MAX_CHARGE_USD: 1,
  APIFY_PRICE_PER_RESULT_USD: 0.0015,
  ENRICHMENT_DATABASE_PATH: ":memory:",
};

const store = new EnrichmentStore(":memory:");
const jobs: Array<Promise<void>> = [];
const app = createApp(env, {
  store,
  apify: { async run() { return { items: [], runId: null, datasetId: null, estimatedCostUsd: 0 }; } } satisfies ApifyGateway,
  ibge: { async listByState() { return []; } } satisfies IbgeGateway,
  brasilApi: { async lookup() { return { status: "not_found" }; } } satisfies BrasilApiGateway,
  trackJob: (job) => jobs.push(job),
});

describe("GET /health", () => {
  it("informa que a API está no ar", async () => {
    const response = await request(app).get("/health").set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("orbyts-company-finder-api");
    expect(response.body.environment).toBe("test");
    expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("POST /api/enrichment/jobs", () => {
  it("recusa uma planilha sem linhas", async () => {
    const response = await request(app).post("/api/enrichment/jobs").send({ fileName: "ficha.csv", defaultState: "SP", rows: [] });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("aceita a planilha e conclui o job sem inventar CNPJ", async () => {
    const response = await request(app).post("/api/enrichment/jobs").send({
      fileName: "ficha.csv",
      defaultState: "sp",
      rows: [{ line: 1, name: "Clínica Odonto", address: "Rua 5, 10", city: "Cidade Inexistente", state: null, landline: ".", mobile: "", professionals: null }],
    });

    expect(response.status).toBe(202);
    await Promise.all(jobs);
    const stored = store.getJob(response.body.data.id);
    const results = store.listResults(response.body.data.id);
    expect(stored?.status).toBe("succeeded");
    expect(results[0]?.cnpj).toBeNull();
    expect(results[0]?.confidence).toBe("NAO_ENCONTRADO");
  });
});
