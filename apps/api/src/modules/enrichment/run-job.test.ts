import { describe, expect, it } from "vitest";
import type { BrasilApiGateway } from "../integrations/brasilapi/brasilapi-client.js";
import type { ApifyGateway, ApifyRunInput } from "./apify-client.js";
import { runEnrichmentJob, type IbgeGateway } from "./run-job.js";
import { SANTA_FE_DO_SUL_COMPANIES, SANTA_FE_DO_SUL_ROWS } from "./santa-fe-fixture.js";
import { EnrichmentStore } from "./store.js";

describe("job de enriquecimento", () => {
  it("cruza a planilha de Santa Fé do Sul com uma única discovery por CNAE e confirma na Brasil API", async () => {
    const store = new EnrichmentStore(":memory:");
    const calls: ApifyRunInput[] = [];
    const apify = gateway(calls);
    store.createJob(job("job-1"));

    await runEnrichmentJob({
      store,
      apify,
      ibge: santaFeIbge(),
      brasilApi: confirmingBrasilApi(),
      jobId: "job-1",
      rows: SANTA_FE_DO_SUL_ROWS,
      defaultState: "SP",
    });

    const finished = store.getJob("job-1");
    const results = new Map(store.listResults("job-1").map((result) => [result.line.line, result]));
    expect(finished?.status).toBe("succeeded");
    expect(results.get(1)?.cnpj).toBe("58475175000135");
    expect(results.get(2)).toMatchObject({ cnpj: "52185340000138", confidence: "ALTA", decision: "aceito" });
    expect(results.get(3)?.cnpj).toBe("37306530000172");
    expect(results.get(4)?.alternatives.map((item) => item.cnpj)).toContain("61874778000114");
    expect(results.get(5)?.cnpj).toBe("36736535000172");
    expect(results.get(6)?.cnpj).toBeNull();
    expect(results.get(7)?.justification).toMatch(/Validado pela Brasil API/);
    expect(results.get(8)?.justification).toMatch(/digitação/);
    expect(results.get(9)?.cnpj).toBe("41928526000113");
    expect(calls.filter((call) => call.mode === "discovery" && call.cnae === "8630504")).toHaveLength(1);
    expect(finished?.estimatedCostUsd).toBeGreaterThan(0);

    const secondCalls: ApifyRunInput[] = [];
    store.createJob(job("job-2"));
    await runEnrichmentJob({
      store,
      apify: gateway(secondCalls),
      ibge: santaFeIbge(),
      brasilApi: confirmingBrasilApi(),
      jobId: "job-2",
      rows: SANTA_FE_DO_SUL_ROWS,
      defaultState: "SP",
    });
    expect(secondCalls.filter((call) => call.mode === "discovery")).toHaveLength(0);
  });
});

function gateway(calls: ApifyRunInput[]): ApifyGateway {
  return {
    async run(input) {
      calls.push(input);
      if (input.mode === "lookup") {
        const items = SANTA_FE_DO_SUL_COMPANIES.filter((company) => input.cnpjs.includes(company.cnpj));
        return { items, runId: "lookup-1", datasetId: "lookup-data", estimatedCostUsd: items.length * 0.0015 };
      }
      const items = input.cnae === "8630504" && input.municipio === "3546603" ? SANTA_FE_DO_SUL_COMPANIES : [];
      return { items, runId: null, datasetId: null, estimatedCostUsd: items.length * 0.0015 };
    },
  };
}

function santaFeIbge(): IbgeGateway {
  return {
    async listByState() {
      return [{ code: "3546603", name: "Santa Fé do Sul", state: "SP" }];
    },
  };
}

function confirmingBrasilApi(): BrasilApiGateway {
  return {
    async lookup(cnpj) {
      return {
        status: "confirmed",
        company: {
          cnpj,
          legalName: null,
          tradeName: null,
          registrationStatus: "ATIVA",
          phones: [],
          address: null,
          city: "SANTA FE DO SUL",
          state: "SP",
        },
      };
    },
  };
}

function job(id: string) {
  return {
    id,
    fileName: "santa-fe.csv",
    status: "running" as const,
    total: SANTA_FE_DO_SUL_ROWS.length,
    processed: 0,
    estimatedCostUsd: 0,
    createdAt: "2026-10-14T00:00:00.000Z",
    finishedAt: null,
    error: null,
  };
}
