import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { Env } from "../config/env.js";
import { AppError } from "./app-error.js";
import { createErrorHandler } from "./error-handler.js";

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

function createHarness() {
  const app = express();
  app.use(express.json());
  app.get("/boom", () => {
    throw new Error("falha sensível");
  });
  app.get("/known", () => {
    throw new AppError(409, "SOURCE_DISABLED", "A integração está desativada.");
  });
  app.use(createErrorHandler(env));
  return app;
}

describe("createErrorHandler", () => {
  it("esconde a causa interna de uma falha inesperada", async () => {
    const response = await request(createHarness()).get("/boom");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno do servidor.",
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("falha sensível");
  });

  it("preserva o erro conhecido da aplicação", async () => {
    const response = await request(createHarness()).get("/known");

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: {
        code: "SOURCE_DISABLED",
        message: "A integração está desativada.",
      },
    });
  });

  it("rejeita JSON malformado", async () => {
    const response = await request(createHarness())
      .post("/ignored")
      .set("Content-Type", "application/json")
      .send('{"companyName":');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_JSON");
  });
});
