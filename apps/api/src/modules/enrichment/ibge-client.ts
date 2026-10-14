import type { IbgeGateway, IbgeMunicipality } from "./run-job.js";

const USER_AGENT = "OrbytsCompanyFinder/0.1";

export function createIbgeGateway(options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}): IbgeGateway {
  const baseUrl = (options.baseUrl ?? "https://servicodados.ibge.gov.br/api/v1/localidades").replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async listByState(state) {
      const response = await fetchImpl(`${baseUrl}/estados/${encodeURIComponent(state)}/municipios`, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error("Não foi possível consultar os municípios do IBGE.");
      const payload = await response.json();
      if (!Array.isArray(payload)) throw new Error("O IBGE devolveu um formato inesperado.");
      return payload.flatMap(readMunicipality);
    },
  };
}

function readMunicipality(value: unknown): IbgeMunicipality[] {
  if (typeof value !== "object" || value === null) return [];
  const record = value as { id?: unknown; nome?: unknown };
  const code = String(record.id ?? "");
  const name = typeof record.nome === "string" ? record.nome : "";
  if (!/^\d{7}$/.test(code) || name.trim() === "") return [];
  return [{ code, name, state: "" }];
}
