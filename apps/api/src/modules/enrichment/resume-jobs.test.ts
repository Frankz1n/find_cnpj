import { describe, expect, it } from "vitest";
import type { BrasilApiGateway } from "../integrations/brasilapi/brasilapi-client.js";
import type { ApifyGateway } from "./apify-client.js";
import type { EnrichmentServices } from "./enrichment.routes.js";
import type { SheetRow } from "./match.js";
import { resumeRunningJobs } from "./resume-jobs.js";
import type { IbgeGateway } from "./run-job.js";
import { EnrichmentStore } from "./store.js";

describe("retomada da pesquisa", () => {
  it("grava só as linhas que ainda não estavam salvas", async () => {
    const store = new EnrichmentStore(":memory:");
    store.createJob({
      id: "job-1",
      fileName: "ficha.xlsx",
      status: "running",
      total: 2,
      processed: 1,
      estimatedCostUsd: 0,
      createdAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
    });
    const first = row(1, "Clínica Odonto");
    const second = row(2, "Clínica Nova");
    store.saveSheet("job-1", { defaultState: "SP", rows: [first, second] });
    store.insertResult({
      id: "result-1",
      jobId: "job-1",
      line: first,
      cnpj: "58475175000135",
      razaoSocial: "ODONTOLOGIA DO CENTRO LTDA",
      nomeFantasia: null,
      situacaoCadastral: "ATIVA",
      enderecoReceita: null,
      telefonesReceita: [],
      confidence: "ALTA",
      score: 80,
      justification: "Já gravada.",
      alternatives: [],
      decision: "aceito",
      brasilApi: null,
    });

    await resumeRunningJobs(services(store));

    const results = store.listResults("job-1");
    expect(results.map((result) => result.line.line)).toEqual([1, 2]);
    expect(results.filter((result) => result.line.line === 1)).toHaveLength(1);
    expect(store.getJob("job-1")).toMatchObject({ status: "succeeded", processed: 2 });
  });
});

function row(line: number, name: string): SheetRow {
  return {
    line,
    name,
    landline: null,
    mobile: null,
    instagram: null,
    professionals: null,
    specialty: null,
    address: "Rua 1, 10",
    city: "Cidade Inexistente",
    state: "SP",
  };
}

function services(store: EnrichmentStore): EnrichmentServices {
  const apify: ApifyGateway = { async run() { return { items: [], runId: null, datasetId: null, estimatedCostUsd: 0 }; } };
  const ibge: IbgeGateway = { async listByState() { return []; } };
  const brasilApi: BrasilApiGateway = { async lookup() { return { status: "not_found" }; } };
  return { store, apify, ibge, brasilApi };
}
