import { BRASILAPI_RATE_LIMIT_MESSAGE, type BrasilApiGateway } from "../integrations/brasilapi/brasilapi-client.js";
import type { ApifyGateway } from "./apify-client.js";
import { priorityCnaeCodes } from "./cnae-catalog.js";
import { matchRow, type MatchOutcome, type SheetRow } from "./match.js";
import type { ReceitaCompany } from "./receita-company.js";
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
  concurrency?: number;
};

export async function runEnrichmentJob(input: RunEnrichmentInput): Promise<void> {
  const limit = createLimiter(input.concurrency ?? 3);
  const pending = new Map<string, Promise<ReceitaCompany[]>>();
  const loaded = new Map<string, ReceitaCompany[]>();
  let processed = 0;

  try {
    for (const group of groupRows(input.rows, input.defaultState)) {
      const outcomes = await matchGroup(group);
      for (const outcome of outcomes) {
        input.store.insertResult({ ...outcome, jobId: input.jobId });
        processed += 1;
        input.store.updateJob(input.jobId, { processed });
      }
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

  async function matchGroup(group: RowGroup): Promise<NewResult[]> {
    if (!group.city) return confirm(group.rows.map((row) => toResult(row, unmatched("A linha não tem cidade."))));

    const municipality = await resolveMunicipality(group.city, group.state);
    if (!municipality) {
      return confirm(group.rows.map((row) => toResult(row, unmatched(`Cidade não encontrada no IBGE para ${group.state}.`))));
    }

    const catalog = input.store.listCnaes();
    const selected = new Map(group.rows.map((row) => [row.line, priorityCnaeCodes(row.specialty, catalog)]));
    await load(group.state, municipality.code, unique(group.rows.flatMap((row) => selected.get(row.line) ?? [])));

    const draft = group.rows.map((row) => ({
      row,
      cnaes: selected.get(row.line) ?? [],
      outcome: matchRow(row, companiesFor(municipality.code, selected.get(row.line) ?? [])),
    }));

    const expandable = draft.filter((item) => item.outcome.score < 50);
    if (expandable.length > 0) {
      const allCodes = catalog.map((item) => item.code);
      await load(group.state, municipality.code, allCodes.filter((code) => !loaded.has(`${municipality.code}:${code}`)));
      for (const item of expandable) {
        item.cnaes = allCodes;
        item.outcome = matchRow(item.row, companiesFor(municipality.code, allCodes));
      }
    }

    const medium = draft.filter((item) => item.outcome.confidence === "MEDIA" && item.outcome.cnpj);
    if (medium.length > 0) {
      const lookedUp = await limit(() => input.apify.run({ mode: "lookup", cnpjs: unique(medium.map((item) => item.outcome.cnpj ?? "")) }));
      input.store.addCost(input.jobId, lookedUp.estimatedCostUsd);
      const details = new Map(lookedUp.items.map((company) => [company.cnpj, company]));
      for (const item of medium) {
        const detail = item.outcome.cnpj ? details.get(item.outcome.cnpj) : undefined;
        if (!detail) continue;
        const companies = companiesFor(municipality.code, item.cnaes).map((company) => (company.cnpj === detail.cnpj ? detail : company));
        item.outcome = matchRow(item.row, companies);
      }
    }

    return confirm(draft.map((item) => toResult(item.row, item.outcome)));
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
      const run = await input.apify.run({ mode: "discovery", cnae, uf: state, municipio, maxResults: 1000 });
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

  async function confirm(results: NewResult[]): Promise<NewResult[]> {
    let blocked = false;
    for (const result of results) {
      if (!result.cnpj || (result.confidence !== "ALTA" && result.confidence !== "MEDIA")) {
        result.brasilApi = skipped(null);
        continue;
      }
      if (blocked) {
        result.brasilApi = skipped(BRASILAPI_RATE_LIMIT_MESSAGE);
        continue;
      }
      const lookup = await input.brasilApi.lookup(result.cnpj);
      if (lookup.status === "rate_limited") {
        blocked = true;
        result.brasilApi = { status: "rate_limited", message: lookup.message };
        continue;
      }
      if (lookup.status === "confirmed") {
        result.razaoSocial = lookup.company.legalName ?? result.razaoSocial;
        result.nomeFantasia = lookup.company.tradeName ?? result.nomeFantasia;
        result.situacaoCadastral = lookup.company.registrationStatus ?? result.situacaoCadastral;
        if (lookup.company.address) result.enderecoReceita = lookup.company.address;
        if (lookup.company.phones.length > 0) result.telefonesReceita = lookup.company.phones;
        result.justification = `${result.justification} Validado pela Brasil API.`;
        result.brasilApi = { status: "confirmed", message: null };
        continue;
      }
      result.brasilApi = { status: lookup.status, message: "message" in lookup ? lookup.message : null };
    }
    return results;
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
