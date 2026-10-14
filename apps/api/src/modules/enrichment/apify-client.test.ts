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

describe("cliente Apify", () => {
  it("envia o token no header, o teto de custo e não coloca o token na URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => Response.json([company]));
    const gateway = createApifyGateway({
      token: "token-secreto",
      fetchImpl,
      sleep: async () => undefined,
      pricePerResultUsd: 0.0015,
    });

    const result = await gateway.run({ mode: "discovery", cnae: "8630504", uf: "SP", municipio: "3546603", maxResults: 1000 });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(String(url)).toContain("johnatan029~cnpj-empresas-brasil-scraper/run-sync-get-dataset-items");
    expect(String(url)).toContain("maxTotalChargeUsd=1");
    expect(String(url)).not.toContain("token-secreto");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer token-secreto");
    expect(result.items[0]?.cnpj).toBe("48923458000149");
    expect(result.estimatedCostUsd).toBe(0.0015);
  });

  it("repete a consulta quando a Apify responde 500", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    fetchImpl.mockResolvedValueOnce(new Response("falha", { status: 500 }));
    fetchImpl.mockResolvedValueOnce(Response.json([company]));
    const gateway = createApifyGateway({ token: "token-secreto", fetchImpl, sleep: async () => undefined });

    const result = await gateway.run({ mode: "lookup", cnpjs: ["48923458000149"] });
    expect(result.items).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("continua em modo assíncrono quando a chamada síncrona estoura o tempo e pagina o dataset", async () => {
    const logs: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (url) => {
      const address = String(url);
      if (address.includes("run-sync-get-dataset-items")) {
        throw Object.assign(new Error("tempo"), { name: "TimeoutError" });
      }
      if (address.includes("/runs?")) return Response.json({ data: { id: "run-1", defaultDatasetId: "set-1", status: "RUNNING" } });
      if (address.includes("/actor-runs/run-1")) return Response.json({ data: { id: "run-1", status: "SUCCEEDED", defaultDatasetId: "set-1" } });
      if (address.includes("offset=0")) return Response.json([company]);
      if (address.includes("offset=1")) return Response.json([{ ...company, cnpj: "35512645000198" }]);
      return Response.json([]);
    });
    const gateway = createApifyGateway({
      token: "token-secreto",
      fetchImpl,
      sleep: async () => undefined,
      pageSize: 1,
      logger: (message) => logs.push(message),
    });

    const result = await gateway.run({ mode: "discovery", cnae: "8630504", uf: "SP", municipio: "3546603", maxResults: 1000 });
    expect(result.items.map((item) => item.cnpj)).toEqual(["48923458000149", "35512645000198"]);
    expect(result.runId).toBe("run-1");
    expect(logs.join(" ")).toContain("runId=run-1");
    expect(logs.join(" ")).not.toContain("token-secreto");
  });

  it("recusa a execução sem token", async () => {
    const gateway = createApifyGateway({ token: null, fetchImpl: vi.fn<typeof fetch>() });
    await expect(gateway.run({ mode: "lookup", cnpjs: ["48923458000149"] })).rejects.toBeInstanceOf(ApifyRequestError);
  });
});
