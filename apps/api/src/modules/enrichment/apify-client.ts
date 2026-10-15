import { isValidCnpj } from "../search/cnpj.js";
import type { ReceitaCompany } from "./receita-company.js";

const ACTOR = "johnatan029~cnpj-empresas-brasil-scraper";
const USER_AGENT = "OrbytsCompanyFinder/0.1";

export type ApifyRunInput =
  | { mode: "discovery"; cnae: string; uf: string; municipio: string; maxResults: number }
  | { mode: "lookup"; cnpjs: string[] };

export type ApifyRunResult = {
  items: ReceitaCompany[];
  runId: string | null;
  datasetId: string | null;
  estimatedCostUsd: number;
};

export type ApifyGateway = {
  run(input: ApifyRunInput): Promise<ApifyRunResult>;
};

type ApifyGatewayOptions = {
  baseUrl?: string;
  token: string | null;
  maxChargeUsd?: number;
  pricePerResultUsd?: number;
  timeoutSeconds?: number;
  lookupMaxChargeUsd?: number;
  pageSize?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  logger?: (message: string) => void;
};

export class ApifyRequestError extends Error {
  readonly retryable: boolean;
  readonly timedOut: boolean;

  constructor(message: string, options: { retryable?: boolean; timedOut?: boolean } = {}) {
    super(message);
    this.name = "ApifyRequestError";
    this.retryable = options.retryable ?? false;
    this.timedOut = options.timedOut ?? false;
  }
}

export function createApifyGateway(options: ApifyGatewayOptions): ApifyGateway {
  const baseUrl = (options.baseUrl ?? "https://api.apify.com/v2").replace(/\/$/, "");
  const token = options.token;
  const maxChargeUsd = options.maxChargeUsd ?? 1;
  const lookupMaxChargeUsd = options.lookupMaxChargeUsd ?? 0.5;
  const pricePerResultUsd = options.pricePerResultUsd ?? 0.0015;
  const pageSize = options.pageSize ?? 100;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? delay;
  const logger = options.logger ?? ((message: string) => console.info(message));

  return {
    async run(input) {
      if (!token) {
        throw new ApifyRequestError("O token da Apify não está configurado no servidor.");
      }
      return withRetry(() => execute(input), sleep);
    },
  };

  async function execute(input: ApifyRunInput): Promise<ApifyRunResult> {
    const charge = input.mode === "lookup" ? lookupMaxChargeUsd : maxChargeUsd;
    const started = await call(`${baseUrl}/acts/${ACTOR}/runs?maxTotalChargeUsd=${charge}&waitForFinish=60`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    const startBody = await readRecord(started);
    const runId = readString(startBody.data, "id");
    const datasetId = readString(startBody.data, "defaultDatasetId");
    if (!runId || !datasetId) throw new ApifyRequestError("A Apify não devolveu a execução.");
    logger(`Apify runId=${runId} datasetId=${datasetId}`);

    let status = readString(startBody.data, "status");
    const maxPolls = input.mode === "lookup" ? 30 : 10;
    for (let poll = 0; !isTerminal(status) && poll < maxPolls; poll += 1) {
      const statusResponse = await call(`${baseUrl}/actor-runs/${runId}?waitForFinish=60`, { method: "GET" });
      const statusBody = await readRecord(statusResponse);
      status = readString(statusBody.data, "status");
    }

    if (status === "SUCCEEDED") {
      const items = await readDataset(datasetId);
      return resultFrom(items, runId, datasetId);
    }
    if (status === "FAILED" || status === "TIMED-OUT") {
      throw new ApifyRequestError("A execução da Apify falhou.", { retryable: true, timedOut: status === "TIMED-OUT" });
    }
    if (status === "ABORTED") throw new ApifyRequestError("A execução da Apify foi abortada.");
    throw new ApifyRequestError("A execução da Apify ainda não terminou.");
  }

  async function readDataset(datasetId: string): Promise<unknown[]> {
    let items = await readPages(datasetId);
    for (let attempt = 1; items.length === 0 && attempt < 3; attempt += 1) {
      await sleep(400);
      items = await readPages(datasetId);
    }
    return items;
  }

  async function readPages(datasetId: string): Promise<unknown[]> {
    const items: unknown[] = [];
    let offset = 0;
    while (true) {
      const response = await call(
        `${baseUrl}/datasets/${datasetId}/items?format=json&clean=true&limit=${pageSize}&offset=${offset}`,
        { method: "GET" },
      );
      const page = await response.json();
      if (!Array.isArray(page)) throw new ApifyRequestError("A Apify devolveu um dataset inesperado.");
      items.push(...page);
      if (page.length < pageSize) return items;
      offset += pageSize;
    }
  }

  async function call(url: string, init: { method: string; body?: string }): Promise<Response> {
    if (url.includes(token ?? "\u0000")) {
      throw new ApifyRequestError("A URL da Apify não pode carregar o token.");
    }
    try {
      const response = await fetchImpl(url, {
        method: init.method,
        body: init.body,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "user-agent": USER_AGENT,
        },
        signal: AbortSignal.timeout((options.timeoutSeconds ?? 90) * 1000),
      });
      if (response.status === 408) throw new ApifyRequestError("A Apify excedeu o tempo.", { timedOut: true, retryable: true });
      if (response.status === 429 || response.status >= 500) {
        throw new ApifyRequestError("A Apify limitou ou falhou a consulta.", { retryable: true });
      }
      if (response.status === 401 || response.status === 403) {
        throw new ApifyRequestError("A Apify recusou o token.");
      }
      if (!response.ok) throw new ApifyRequestError("A Apify recusou a consulta.");
      return response;
    } catch (error) {
      if (error instanceof ApifyRequestError) throw error;
      if (isTimeout(error)) throw new ApifyRequestError("A Apify excedeu o tempo.", { timedOut: true, retryable: true });
      throw new ApifyRequestError("Não foi possível consultar a Apify.", { retryable: true });
    }
  }

  function resultFrom(items: unknown[], runId: string | null, datasetId: string | null): ApifyRunResult {
    const companies = items.flatMap((item) => {
      const company = mapActorItem(item);
      return company ? [company] : [];
    });
    return {
      items: companies,
      runId,
      datasetId,
      estimatedCostUsd: roundUsd(companies.length * pricePerResultUsd),
    };
  }
}

export function mapActorItem(value: unknown): ReceitaCompany | null {
  if (!isRecord(value)) return null;
  const cnpj = String(value.cnpj ?? "").replace(/\D/g, "");
  if (!isValidCnpj(cnpj)) return null;
  const address = isRecord(value.endereco) ? value.endereco : {};
  const phones = Array.isArray(value.telefones) ? value.telefones.map((phone) => String(phone).replace(/\D/g, "")).filter(Boolean) : [];
  const partners = Array.isArray(value.socios)
    ? value.socios.flatMap((partner) => {
        if (!isRecord(partner) || typeof partner.nome !== "string" || partner.nome.trim() === "") return [];
        return [{ nome: partner.nome, qualificacao: typeof partner.qualificacao === "string" ? partner.qualificacao : null }];
      })
    : [];

  return {
    cnpj,
    razaoSocial: text(value.razaoSocial) ?? "Sem razão social",
    nomeFantasia: text(value.nomeFantasia),
    situacaoCadastral: text(value.situacaoCadastral),
    cnaePrincipal: text(value.cnaePrincipal),
    endereco: {
      logradouro: text(address.logradouro),
      numero: text(address.numero),
      bairro: text(address.bairro),
      municipio: text(address.municipio),
      uf: text(address.uf),
      cep: text(address.cep),
    },
    telefones: phones,
    socios: partners,
  };
}

async function withRetry(operation: () => Promise<ApifyRunResult>, sleep: (ms: number) => Promise<void>): Promise<ApifyRunResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApifyRequestError) || !error.retryable || attempt === 3) throw error;
      await sleep(200 * attempt);
    }
  }
  throw lastError;
}

async function readRecord(response: Response): Promise<{ data: unknown }> {
  const payload = await response.json();
  if (!isRecord(payload)) throw new ApifyRequestError("A Apify devolveu um formato inesperado.");
  return { data: payload.data };
}

function readString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const field = value[key];
  return typeof field === "string" && field.trim() !== "" ? field : null;
}

function text(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed === "" || trimmed === "." ? null : trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTerminal(status: string | null): boolean {
  return status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT";
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function roundUsd(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
