import cors from "cors";
import express, { type Express } from "express";
import type { Env } from "./config/env.js";
import { createErrorHandler } from "./http/error-handler.js";
import { createApifyGateway, type ApifyGateway } from "./modules/enrichment/apify-client.js";
import { createEnrichmentRouter, type EnrichmentServices } from "./modules/enrichment/enrichment.routes.js";
import { createIbgeGateway } from "./modules/enrichment/ibge-client.js";
import type { IbgeGateway } from "./modules/enrichment/run-job.js";
import { EnrichmentStore } from "./modules/enrichment/store.js";
import { createBrasilApiGateway, type BrasilApiGateway } from "./modules/integrations/brasilapi/brasilapi-client.js";

export type AppServices = Partial<EnrichmentServices>;

export function createApp(env: Env, services: AppServices = {}): Express {
  const app = express();
  const wired = resolveServices(env, services);

  app.disable("x-powered-by");
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: "8mb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "orbyts-company-finder-api",
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  app.use("/api", createEnrichmentRouter(wired));

  app.use((_request, response) => {
    response.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Rota não encontrada.",
      },
    });
  });

  app.use(createErrorHandler(env));
  return app;
}

function resolveServices(env: Env, services: AppServices): EnrichmentServices {
  const store = services.store ?? new EnrichmentStore(env.ENRICHMENT_DATABASE_PATH);
  const apify = services.apify ?? createApifyGateway({
    baseUrl: env.APIFY_BASE_URL,
    token: env.APIFY_TOKEN ?? null,
    maxChargeUsd: env.APIFY_MAX_CHARGE_USD,
    pricePerResultUsd: env.APIFY_PRICE_PER_RESULT_USD,
  });
  const ibge = services.ibge ?? createIbgeGateway();
  const brasilApi = services.brasilApi ?? createBrasilApiGateway({ baseUrl: env.BRASILAPI_BASE_URL });
  return { store, apify, ibge, brasilApi, trackJob: services.trackJob };
}

export type { ApifyGateway, BrasilApiGateway, IbgeGateway };
