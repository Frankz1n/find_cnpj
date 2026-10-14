import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("aplica os valores padrão quando o ambiente não define as variáveis", () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: "development",
      PORT: 3333,
      CORS_ORIGIN: "http://localhost:5173",
      BRASILAPI_BASE_URL: "https://brasilapi.com.br",
      APIFY_BASE_URL: "https://api.apify.com/v2",
      APIFY_MAX_CHARGE_USD: 1,
      APIFY_PRICE_PER_RESULT_USD: 0.0015,
      ENRICHMENT_DATABASE_PATH: "data/enrichment.sqlite",
    });
  });

  it("converte a porta numérica recebida como texto", () => {
    expect(parseEnv({ PORT: "4000", NODE_ENV: "production", CORS_ORIGIN: "https://app.exemplo" })).toEqual({
      NODE_ENV: "production",
      PORT: 4000,
      CORS_ORIGIN: "https://app.exemplo",
      BRASILAPI_BASE_URL: "https://brasilapi.com.br",
      APIFY_BASE_URL: "https://api.apify.com/v2",
      APIFY_MAX_CHARGE_USD: 1,
      APIFY_PRICE_PER_RESULT_USD: 0.0015,
      ENRICHMENT_DATABASE_PATH: "data/enrichment.sqlite",
    });
  });

  it("rejeita uma porta inválida", () => {
    expect(() => parseEnv({ PORT: "abc" })).toThrow(/PORT/);
  });
});
