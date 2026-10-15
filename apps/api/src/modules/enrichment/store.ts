import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DEFAULT_CNAES, type CnaeDefinition } from "./cnae-catalog.js";
import type { Confidence, MatchAlternative } from "./match.js";
import type { ReceitaCompany } from "./receita-company.js";
import type { SheetRow } from "./match.js";

export type JobStatus = "running" | "succeeded" | "failed";

export type BrasilApiNote = {
  status: "confirmed" | "not_found" | "failed" | "rate_limited" | "skipped";
  message: string | null;
};

export type ResultRecord = {
  id: string;
  jobId: string;
  line: SheetRow;
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  enderecoReceita: string | null;
  telefonesReceita: string[];
  confidence: Confidence;
  score: number;
  justification: string;
  alternatives: MatchAlternative[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  decision: "aceito" | "sem_cnpj" | null;
  brasilApi: BrasilApiNote | null;
};

export type StoredSheet = {
  defaultState: string;
  rows: SheetRow[];
};

export type JobRecord = {
  id: string;
  fileName: string;
  status: JobStatus;
  total: number;
  processed: number;
  estimatedCostUsd: number;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
};

export type NewResult = Omit<ResultRecord, "reviewedBy" | "reviewedAt" | "decision"> & {
  decision: ResultRecord["decision"];
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ibge_municipio (
  codigo TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  nome_normalizado TEXT NOT NULL,
  uf TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS receita_cache (
  municipio_ibge TEXT NOT NULL,
  cnae TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (municipio_ibge, cnae)
);
CREATE TABLE IF NOT EXISTS cnae_catalog (
  codigo TEXT PRIMARY KEY,
  descricao TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cnpj_enrichment_job (
  id TEXT PRIMARY KEY,
  arquivo TEXT NOT NULL,
  status TEXT NOT NULL,
  total INTEGER NOT NULL,
  processados INTEGER NOT NULL,
  custo_estimado_usd REAL NOT NULL,
  criado_em TEXT NOT NULL,
  finalizado_em TEXT,
  erro TEXT
);
CREATE TABLE IF NOT EXISTS cnpj_enrichment_result (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  linha_original TEXT NOT NULL,
  cnpj TEXT,
  razao_social TEXT,
  nome_fantasia TEXT,
  situacao_cadastral TEXT,
  endereco_receita TEXT,
  telefones_receita TEXT NOT NULL,
  confianca TEXT NOT NULL,
  score INTEGER NOT NULL,
  justificativa TEXT NOT NULL,
  alternativas TEXT NOT NULL,
  revisado_por TEXT,
  revisado_em TEXT,
  decisao_final TEXT,
  brasil_api TEXT
);
`;

export class EnrichmentStore {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.database = new DatabaseSync(path);
    this.database.exec(SCHEMA);
    const columns = this.database.prepare("PRAGMA table_info(cnpj_enrichment_job)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "planilha")) {
      this.database.exec("ALTER TABLE cnpj_enrichment_job ADD COLUMN planilha TEXT");
    }
    const insert = this.database.prepare("INSERT OR IGNORE INTO cnae_catalog (codigo, descricao) VALUES (?, ?)");
    for (const cnae of DEFAULT_CNAES) insert.run(cnae.code, cnae.description);
  }

  listCnaes(): CnaeDefinition[] {
    const rows = this.database.prepare("SELECT codigo, descricao FROM cnae_catalog ORDER BY codigo").all() as Array<{
      codigo: string;
      descricao: string;
    }>;
    return rows.map((row) => ({ code: row.codigo, description: row.descricao }));
  }

  saveSheet(jobId: string, sheet: StoredSheet): void {
    this.database.prepare("UPDATE cnpj_enrichment_job SET planilha = ? WHERE id = ?").run(JSON.stringify(sheet), jobId);
  }

  readSheet(jobId: string): StoredSheet | null {
    const row = this.database.prepare("SELECT planilha FROM cnpj_enrichment_job WHERE id = ?").get(jobId) as { planilha: string | null } | undefined;
    if (!row?.planilha) return null;
    const parsed = JSON.parse(row.planilha) as StoredSheet;
    if (!parsed || !Array.isArray(parsed.rows) || typeof parsed.defaultState !== "string") return null;
    return parsed;
  }

  createJob(job: JobRecord): void {
    this.database
      .prepare(
        `INSERT INTO cnpj_enrichment_job
          (id, arquivo, status, total, processados, custo_estimado_usd, criado_em, finalizado_em, erro)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(job.id, job.fileName, job.status, job.total, job.processed, job.estimatedCostUsd, job.createdAt, job.finishedAt, job.error);
  }

  updateJob(id: string, patch: Partial<Pick<JobRecord, "status" | "processed" | "estimatedCostUsd" | "finishedAt" | "error">>): void {
    const current = this.getJob(id);
    if (!current) return;
    const next = { ...current, ...patch };
    this.database
      .prepare(
        `UPDATE cnpj_enrichment_job
         SET status = ?, processados = ?, custo_estimado_usd = ?, finalizado_em = ?, erro = ?
         WHERE id = ?`,
      )
      .run(next.status, next.processed, next.estimatedCostUsd, next.finishedAt, next.error, id);
  }

  addCost(id: string, amount: number): void {
    this.database.prepare("UPDATE cnpj_enrichment_job SET custo_estimado_usd = custo_estimado_usd + ? WHERE id = ?").run(amount, id);
  }

  getJob(id: string): JobRecord | null {
    const row = this.database.prepare("SELECT * FROM cnpj_enrichment_job WHERE id = ?").get(id) as JobRow | undefined;
    return row ? mapJob(row) : null;
  }

  listJobs(): JobRecord[] {
    const rows = this.database.prepare("SELECT * FROM cnpj_enrichment_job ORDER BY criado_em DESC").all() as JobRow[];
    return rows.map(mapJob);
  }

  insertResult(result: NewResult): void {
    this.database
      .prepare(
        `INSERT INTO cnpj_enrichment_result (
          id, job_id, linha_original, cnpj, razao_social, nome_fantasia, situacao_cadastral, endereco_receita,
          telefones_receita, confianca, score, justificativa, alternativas, revisado_por, revisado_em, decisao_final, brasil_api
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      )
      .run(
        result.id,
        result.jobId,
        JSON.stringify(result.line),
        result.cnpj,
        result.razaoSocial,
        result.nomeFantasia,
        result.situacaoCadastral,
        result.enderecoReceita,
        JSON.stringify(result.telefonesReceita),
        result.confidence,
        result.score,
        result.justification,
        JSON.stringify(result.alternatives),
        result.decision,
        result.brasilApi ? JSON.stringify(result.brasilApi) : null,
      );
  }

  listResults(jobId: string): ResultRecord[] {
    const rows = this.database
      .prepare("SELECT * FROM cnpj_enrichment_result WHERE job_id = ? ORDER BY json_extract(linha_original, '$.line')")
      .all(jobId) as ResultRow[];
    return rows.map(mapResult);
  }

  getResult(id: string): ResultRecord | null {
    const row = this.database.prepare("SELECT * FROM cnpj_enrichment_result WHERE id = ?").get(id) as ResultRow | undefined;
    return row ? mapResult(row) : null;
  }

  updateResult(result: ResultRecord): void {
    this.database
      .prepare(
        `UPDATE cnpj_enrichment_result
         SET cnpj = ?, razao_social = ?, nome_fantasia = ?, situacao_cadastral = ?, endereco_receita = ?,
             telefones_receita = ?, confianca = ?, score = ?, justificativa = ?, alternativas = ?,
             revisado_por = ?, revisado_em = ?, decisao_final = ?, brasil_api = ?
         WHERE id = ?`,
      )
      .run(
        result.cnpj,
        result.razaoSocial,
        result.nomeFantasia,
        result.situacaoCadastral,
        result.enderecoReceita,
        JSON.stringify(result.telefonesReceita),
        result.confidence,
        result.score,
        result.justification,
        JSON.stringify(result.alternatives),
        result.reviewedBy,
        result.reviewedAt,
        result.decision,
        result.brasilApi ? JSON.stringify(result.brasilApi) : null,
        result.id,
      );
  }

  listAccepted(): ResultRecord[] {
    const rows = this.database
      .prepare("SELECT * FROM cnpj_enrichment_result WHERE decisao_final = 'aceito' AND cnpj IS NOT NULL ORDER BY revisado_em DESC, id")
      .all() as ResultRow[];
    return rows.map(mapResult);
  }

  readCache(municipioIbge: string, cnae: string, ttlMs: number, now: number): ReceitaCompany[] | null {
    const row = this.database
      .prepare("SELECT payload, fetched_at FROM receita_cache WHERE municipio_ibge = ? AND cnae = ?")
      .get(municipioIbge, cnae) as { payload: string; fetched_at: number } | undefined;
    if (!row || now - row.fetched_at > ttlMs) return null;
    const payload = JSON.parse(row.payload) as ReceitaCompany[];
    return Array.isArray(payload) ? payload : null;
  }

  writeCache(municipioIbge: string, cnae: string, companies: ReceitaCompany[], now: number): void {
    this.database
      .prepare(
        `INSERT INTO receita_cache (municipio_ibge, cnae, payload, fetched_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (municipio_ibge, cnae) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at`,
      )
      .run(municipioIbge, cnae, JSON.stringify(companies), now);
  }

  hasMunicipalities(uf: string): boolean {
    const row = this.database.prepare("SELECT codigo FROM ibge_municipio WHERE uf = ? LIMIT 1").get(uf) as { codigo: string } | undefined;
    return row !== undefined;
  }

  saveMunicipalities(rows: Array<{ code: string; name: string; normalizedName: string; uf: string }>): void {
    const insert = this.database.prepare(
      `INSERT INTO ibge_municipio (codigo, nome, nome_normalizado, uf) VALUES (?, ?, ?, ?)
       ON CONFLICT (codigo) DO UPDATE SET nome = excluded.nome, nome_normalizado = excluded.nome_normalizado, uf = excluded.uf`,
    );
    for (const row of rows) insert.run(row.code, row.name, row.normalizedName, row.uf);
  }

  findMunicipality(normalizedName: string, uf: string): { code: string; name: string } | null {
    const row = this.database
      .prepare("SELECT codigo, nome FROM ibge_municipio WHERE nome_normalizado = ? AND uf = ?")
      .get(normalizedName, uf) as { codigo: string; nome: string } | undefined;
    return row ? { code: row.codigo, name: row.nome } : null;
  }
}

type JobRow = {
  id: string;
  arquivo: string;
  status: JobStatus;
  total: number;
  processados: number;
  custo_estimado_usd: number;
  criado_em: string;
  finalizado_em: string | null;
  erro: string | null;
};

type ResultRow = {
  id: string;
  job_id: string;
  linha_original: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao_cadastral: string | null;
  endereco_receita: string | null;
  telefones_receita: string;
  confianca: Confidence;
  score: number;
  justificativa: string;
  alternativas: string;
  revisado_por: string | null;
  revisado_em: string | null;
  decisao_final: "aceito" | "sem_cnpj" | null;
  brasil_api: string | null;
};

function mapJob(row: JobRow): JobRecord {
  return {
    id: row.id,
    fileName: row.arquivo,
    status: row.status,
    total: row.total,
    processed: row.processados,
    estimatedCostUsd: row.custo_estimado_usd,
    createdAt: row.criado_em,
    finishedAt: row.finalizado_em,
    error: row.erro,
  };
}

function mapResult(row: ResultRow): ResultRecord {
  return {
    id: row.id,
    jobId: row.job_id,
    line: JSON.parse(row.linha_original) as SheetRow,
    cnpj: row.cnpj,
    razaoSocial: row.razao_social,
    nomeFantasia: row.nome_fantasia,
    situacaoCadastral: row.situacao_cadastral,
    enderecoReceita: row.endereco_receita,
    telefonesReceita: JSON.parse(row.telefones_receita) as string[],
    confidence: row.confianca,
    score: row.score,
    justification: row.justificativa,
    alternatives: JSON.parse(row.alternativas) as MatchAlternative[],
    reviewedBy: row.revisado_por,
    reviewedAt: row.revisado_em,
    decision: row.decisao_final,
    brasilApi: row.brasil_api ? (JSON.parse(row.brasil_api) as BrasilApiNote) : null,
  };
}
