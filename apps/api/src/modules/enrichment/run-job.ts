import { BRASILAPI_RATE_LIMIT_MESSAGE, type BrasilApiGateway } from "../integrations/brasilapi/brasilapi-client.js";
import type { ApifyGateway } from "./apify-client.js";
import { priorityCnaeCodes, discoveryLimit, SECOND_ROUND_CNAES } from "./cnae-catalog.js";
import { matchRow, type MatchOutcome, type SheetRow } from "./match.js";
import { isInactiveRegistration, type ReceitaCompany } from "./receita-company.js";
import { type BrasilApiNote, type NewResult, type EnrichmentStore } from "./store.js";
import { normalizeText } from "./text.js";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type IbgeMunicipality = { code: string; name: string; state: string };

export type IbgeGateway = {
  listByState(state: string): Promise<IbgeMunicipality[]>;
};

type RunEnrichmentInput = {
  store: EnrichmentStore;
  apify: ApifyGateway;
  ibge: IbgeGateway;
  brasilApi: BrasilApiGateway;
  jobId: string;
  rows: SheetRow[];
  defaultState: string;
  initialProcessed?: number;
  concurrency?: number;
};

export async function runEnrichmentJob(input: RunEnrichmentInput): Promise<void> {
  const limit = createLimiter(input.concurrency ?? 3);
  const pending = new Map<string, Promise<ReceitaCompany[]>>();
  const loaded = new Map<string, ReceitaCompany[]>();
  let processed = input.initialProcessed ?? 0;
  const savedLines = new Set(input.store.listResults(input.jobId).map((result) => result.line.line));

  function remember(results: NewResult[]): NewResult[] {
    const fresh: NewResult[] = [];
    for (const result of results) {
      if (savedLines.has(result.line.line)) continue;
      input.store.insertResult({ ...result, jobId: input.jobId });
      savedLines.add(result.line.line);
      processed += 1;
      input.store.updateJob(input.jobId, { processed });
      fresh.push(result);
    }
    return fresh;
  }

  try {
    for (const group of groupRows(input.rows, input.defaultState)) {
      await matchGroup(group);
    }
    input.store.updateJob(input.jobId, { status: "succeeded", processed, finishedAt: new Date().toISOString() });
  } catch (error) {
    input.store.updateJob(input.jobId, {
      status: "failed",
      processed,
      finishedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "O enriquecimento falhou.",
    });
  }

  async function matchGroup(group: RowGroup): Promise<void> {
    if (!group.city) {
      await finish(group.rows.map((row) => toResult(row, unmatched("A linha não tem cidade."))));
      return;
    }

    const municipality = await resolveMunicipality(group.city, group.state);
    if (!municipality) {
      await finish(group.rows.map((row) => toResult(row, unmatched(`Cidade não encontrada no IBGE para ${group.state}.`))));
      return;
    }

    const catalog = input.store.listCnaes();
    const firstCodes = unique(group.rows.flatMap((row) => priorityCnaeCodes(row.specialty, catalog)));
    await load(group.state, municipality.code, firstCodes);
    let pool = companiesFor(municipality.code, firstCodes);
    const draft = group.rows.map((row) => ({ row, outcome: matchRow(row, pool) }));

    const unmatchedRows = draft.filter((item) => item.outcome.cnpj === null || item.outcome.confidence === "BAIXA");
    if (unmatchedRows.length > 0) {
      const secondCodes = SECOND_ROUND_CNAES.filter((code) => catalog.some((item) => item.code === code));
      await load(group.state, municipality.code, secondCodes);
      pool = companiesFor(municipality.code, [...firstCodes, ...secondCodes]);
      for (const item of unmatchedRows) item.outcome = matchRow(item.row, pool);
    }

    const results = remember(draft.map((item) => toResult(item.row, item.outcome)));
    await lookupChosen(results);
    await confirm(results);
  }

  function load(state: string, municipio: string, cnaes: string[]): Promise<void> {
    return Promise.all(cnaes.map((cnae) => discover(state, municipio, cnae))).then(() => undefined);
  }

  function discover(state: string, municipio: string, cnae: string): Promise<ReceitaCompany[]> {
    const key = `${municipio}:${cnae}`;
    const existing = pending.get(key);
    if (existing) return existing;
    const task = limit(async () => {
      const cached = input.store.readCache(municipio, cnae, CACHE_TTL_MS, Date.now());
      if (cached) {
        loaded.set(key, cached);
        return cached;
      }
      const run = await input.apify.run({ mode: "discovery", cnae, uf: state, municipio, maxResults: discoveryLimit(cnae) });
      input.store.addCost(input.jobId, run.estimatedCostUsd);
      input.store.writeCache(municipio, cnae, run.items, Date.now());
      loaded.set(key, run.items);
      return run.items;
    });
    pending.set(key, task);
    return task;
  }

  function companiesFor(municipio: string, cnaes: string[]): ReceitaCompany[] {
    const byCnpj = new Map<string, ReceitaCompany>();
    for (const cnae of cnaes) {
      for (const company of loaded.get(`${municipio}:${cnae}`) ?? []) byCnpj.set(company.cnpj, company);
    }
    return [...byCnpj.values()];
  }

  async function resolveMunicipality(city: string, state: string): Promise<{ code: string; name: string } | null> {
    if (!input.store.hasMunicipalities(state)) {
      const municipalities = await input.ibge.listByState(state);
      input.store.saveMunicipalities(
        municipalities.map((municipality) => ({
          code: municipality.code,
          name: municipality.name,
          normalizedName: normalizeText(municipality.name),
          uf: state,
        })),
      );
    }
    return input.store.findMunicipality(normalizeText(city), state);
  }

  async function lookupChosen(results: NewResult[]): Promise<void> {
    const cnpjs = unique(
      results
        .filter((result) => result.cnpj && (result.confidence === "ALTA" || result.confidence === "MEDIA"))
        .map((result) => result.cnpj ?? ""),
    );
    if (cnpjs.length === 0) return;
    const lookedUp = await limit(() => input.apify.run({ mode: "lookup", cnpjs }));
    input.store.addCost(input.jobId, lookedUp.estimatedCostUsd);
    const details = new Map(lookedUp.items.map((company) => [company.cnpj, company]));
    for (const result of results) {
      const detail = result.cnpj ? details.get(result.cnpj) : undefined;
      if (!detail) continue;
      result.razaoSocial = detail.razaoSocial;
      result.nomeFantasia = detail.nomeFantasia;
      result.situacaoCadastral = detail.situacaoCadastral;
      const address = [detail.endereco.logradouro, detail.endereco.numero, detail.endereco.bairro].filter((part) => part && part.trim()).join(", ");
      if (address) result.enderecoReceita = address;
      if (detail.telefones.length > 0) result.telefonesReceita = detail.telefones;
      if (isInactiveRegistration(detail.situacaoCadastral)) {
        result.confidence = "NAO_ENCONTRADO";
        result.decision = null;
        result.cnpj = null;
        result.justification = `${result.justification} O lookup confirmou situação ${detail.situacaoCadastral}.`;
      }
      input.store.updateResult({ ...result, reviewedBy: null, reviewedAt: null });
    }
  }

  async function finish(results: NewResult[]): Promise<void> {
    await confirm(remember(results));
  }

  async function confirm(results: NewResult[]): Promise<void> {
    let blocked = false;
    for (const result of results) {
      if (!result.cnpj || (result.confidence !== "ALTA" && result.confidence !== "MEDIA")) {
        result.brasilApi = skipped(null);
      } else if (blocked) {
        result.brasilApi = skipped(BRASILAPI_RATE_LIMIT_MESSAGE);
      } else {
        const lookup = await input.brasilApi.lookup(result.cnpj);
        if (lookup.status === "rate_limited") {
          blocked = true;
          result.brasilApi = { status: "rate_limited", message: lookup.message };
        } else if (lookup.status === "confirmed") {
          result.razaoSocial = lookup.company.legalName ?? result.razaoSocial;
          result.nomeFantasia = lookup.company.tradeName ?? result.nomeFantasia;
          result.situacaoCadastral = lookup.company.registrationStatus ?? result.situacaoCadastral;
          if (lookup.company.address) result.enderecoReceita = lookup.company.address;
          if (lookup.company.phones.length > 0) result.telefonesReceita = lookup.company.phones;
          result.justification = `${result.justification} Validado pela Brasil API.`;
          result.brasilApi = { status: "confirmed", message: null };
        } else {
          result.brasilApi = { status: lookup.status, message: "message" in lookup ? lookup.message : null };
        }
      }
      input.store.updateResult({ ...result, reviewedBy: null, reviewedAt: null });
    }
  }
}

type RowGroup = { city: string | null; state: string; rows: SheetRow[] };

function groupRows(rows: SheetRow[], defaultState: string): RowGroup[] {
  const groups = new Map<string, RowGroup>();
  for (const row of rows) {
    const state = (row.state ?? defaultState).toUpperCase();
    const city = row.city?.trim() || null;
    const key = `${normalizeText(city ?? "")}:${state}`;
    const current = groups.get(key) ?? { city, state, rows: [] };
    current.rows.push({ ...row, state });
    groups.set(key, current);
  }
  return [...groups.values()];
}

function toResult(row: SheetRow, outcome: MatchOutcome): NewResult {
  return {
    id: crypto.randomUUID(),
    jobId: "",
    line: row,
    cnpj: outcome.cnpj,
    razaoSocial: outcome.razaoSocial,
    nomeFantasia: outcome.nomeFantasia,
    situacaoCadastral: outcome.situacaoCadastral,
    enderecoReceita: outcome.enderecoReceita,
    telefonesReceita: outcome.telefonesReceita,
    confidence: outcome.confidence,
    score: outcome.score,
    justification: outcome.justification,
    alternatives: outcome.alternatives,
    decision: outcome.confidence === "ALTA" && outcome.cnpj ? "aceito" : null,
    brasilApi: null,
  };
}

function unmatched(justification: string): MatchOutcome {
  return {
    confidence: "NAO_ENCONTRADO",
    score: 0,
    cnpj: null,
    razaoSocial: null,
    nomeFantasia: null,
    situacaoCadastral: null,
    enderecoReceita: null,
    telefonesReceita: [],
    justification,
    alternatives: [],
  };
}

function skipped(message: string | null): BrasilApiNote {
  return { status: "skipped", message };
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function createLimiter(max: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}
