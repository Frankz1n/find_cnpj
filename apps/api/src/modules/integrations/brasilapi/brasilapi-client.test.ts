import { describe, expect, it, vi } from "vitest";
import { BRASILAPI_RATE_LIMIT_MESSAGE, createBrasilApiGateway } from "./brasilapi-client.js";

describe("createBrasilApiGateway", () => {
  it("consulta o CNPJ na rota pública e reaproveita a resposta", async () => {
    const fetchImpl = vi.fn(async (input: Parameters<typeof fetch>[0], _init: Parameters<typeof fetch>[1]) => json({
      cnpj: "19131243000197",
      razao_social: "OPEN KNOWLEDGE BRASIL",
      descricao_situacao_cadastral: "ATIVA",
      municipio: "SAO PAULO",
      uf: "SP",
      ddd_telefone_1: "1123851939",
    }, String(input)));
    const gateway = createBrasilApiGateway({
      baseUrl: "https://brasilapi.com.br",
      fetchImpl,
      now: () => 1_700_000_000_000,
    });

    const first = await gateway.lookup("19131243000197");
    const second = await gateway.lookup("19131243000197");

    expect(first).toMatchObject({
      status: "confirmed",
      company: { legalName: "OPEN KNOWLEDGE BRASIL", state: "SP", phones: ["1123851939"] },
    });
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe("https://brasilapi.com.br/api/cnpj/v1/19131243000197");
    const init = fetchImpl.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(headers.get("user-agent")).toBe("OrbytsCompanyFinder/0.1");
  });

  it("trata CNPJ ausente sem repetir a chamada seguinte do cache", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ message: "CNPJ 00000000000000 não encontrado" }), { status: 404 }));
    const gateway = createBrasilApiGateway({ baseUrl: "https://brasilapi.com.br", fetchImpl, now: () => 1_700_000_000_000 });

    await expect(gateway.lookup("11444777000161")).resolves.toEqual({ status: "not_found" });
    await gateway.lookup("11444777000161");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("para no limite sem nova tentativa", async () => {
    const fetchImpl = vi.fn(async () => new Response("limit", { status: 429 }));
    const gateway = createBrasilApiGateway({ baseUrl: "https://brasilapi.com.br", fetchImpl, now: () => 1_700_000_000_000 });

    await expect(gateway.lookup("19131243000197")).resolves.toEqual({
      status: "rate_limited",
      message: BRASILAPI_RATE_LIMIT_MESSAGE,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

function json(body: unknown, url: string): Response {
  if (!url.includes("/api/cnpj/v1/")) throw new Error(url);
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}
