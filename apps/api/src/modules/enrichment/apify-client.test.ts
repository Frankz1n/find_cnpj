import { describe, expect, it, vi } from "vitest";
import { ApifyRequestError, createApifyGateway } from "./apify-client.js";

const company = {
  cnpj: "48923458000149",
  razaoSocial: "NAHIARA BARBATO BAPTISTA ZONTA LTDA",
  nomeFantasia: null,
  situacaoCadastral: "ATIVA",
  endereco: { logradouro: "SETE", numero: "1061", bairro: "CENTRO", municipio: "SANTA FE DO SUL", uf: "SP", cep: "15775000" },
  telefones: ["1736312174"],
  socios: [],
};

function runningThenSucceeded(datasetPages: unknown[][]): typeof fetch {
  let datasetReads = 0;
  return vi.fn<typeof fetch>(async (url) => {
    const address = String(url);
    if (address.includes("/runs?")) {
      return Response.json({ data: { id: "run-1", defaultDatasetId: "set-1", status: "RUNNING", stats: { itemCount: 0 } } });
    }
    if (address.includes("/actor-runs/run-1")) {
      return Response.json({ data: { id: "run-1", status: "SUCCEEDED", defaultDatasetId: "set-1", stats: { itemCount: 0 } } });
    }
    const page = datasetPages[datasetReads] ?? [];
    datasetReads += 1;
    return Response.json(page);
  });
}

describe("cliente Apify", () => {
  it("dispara a execução assíncrona com o teto de custo e lê o dataset mesmo com itemCount 0", async () => {
    const logs: string[] = [];
    const fetchImpl = runningThenSucceeded([[company]]);
    const gateway = createApifyGateway({
      token: "token-secreto",
      fetchImpl,
      sleep: async () => undefined,
      pricePerResultUsd: 0.0015,
      logger: (message) => logs.push(message),
    });

    const result = await gateway.run({ mode: "discovery", cnae: "8630504", uf: "SP", municipio: "3546603", maxResults: 300 });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toContain("johnatan029~cnpj-empresas-brasil-scraper/runs?");
    expect(String(url)).toContain("maxTotalChargeUsd=1");
    expect(String(url)).toContain("waitForFinish=60");
    expect(String(url)).not.toContain("run-sync");
    expect(String(url)).not.toContain("token-secreto");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-secreto");
    expect(result.items[0]?.cnpj).toBe("48923458000149");
    expect(result.runId).toBe("run-1");
    expect(result.estimatedCostUsd).toBe(0.0015);
    expect(logs.join(" ")).toContain("runId=run-1 datasetId=set-1");
    expect(logs.join(" ")).not.toContain("token-secreto");
  });

  it("usa teto menor no lookup e pagina o dataset", async () => {
    const fetchImpl = runningThenSucceeded([[company], [{ ...company, cnpj: "35512645000198" }], []]);
    const gateway = createApifyGateway({
      token: "token-secreto",
      fetchImpl,
      sleep: async () => undefined,
      pageSize: 1,
    });

    const result = await gateway.run({ mode: "lookup", cnpjs: ["48923458000149", "35512645000198"] });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("maxTotalChargeUsd=0.5");
    expect(result.items.map((item) => item.cnpj)).toEqual(["48923458000149", "35512645000198"]);
  });

  it("repete a consulta quando a Apify responde 500", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(new Response("falha", { status: 500 }));
    fetchImpl.mockImplementationOnce(async () => Response.json({ data: { id: "run-2", defaultDatasetId: "set-2", status: "SUCCEEDED" } }));
    fetchImpl.mockResolvedValueOnce(Response.json([company]));
    const gateway = createApifyGateway({ token: "token-secreto", fetchImpl, sleep: async () => undefined });

    const result = await gateway.run({ mode: "lookup", cnpjs: ["48923458000149"] });
    expect(result.items).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("recusa a execução sem token", async () => {
    const gateway = createApifyGateway({ token: null, fetchImpl: vi.fn<typeof fetch>() });
    await expect(gateway.run({ mode: "lookup", cnpjs: ["48923458000149"] })).rejects.toBeInstanceOf(ApifyRequestError);
  });
});
