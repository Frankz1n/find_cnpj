import { Router } from "express";
import { z } from "zod";
import { AppError } from "../../http/app-error.js";
import { isValidCnpj } from "../search/cnpj.js";
import type { BrasilApiGateway } from "../integrations/brasilapi/brasilapi-client.js";
import type { ApifyGateway } from "./apify-client.js";
import { runEnrichmentJob, type IbgeGateway } from "./run-job.js";
import { EnrichmentStore, type ResultRecord } from "./store.js";
import { blankToNull } from "./text.js";

const optionalText = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return blankToNull(value);
}, z.string().nullable());

const rowSchema = z.object({
  line: z.number().int().positive(),
  name: optionalText.optional(),
  landline: optionalText.optional(),
  mobile: optionalText.optional(),
  instagram: optionalText.optional(),
  professionals: optionalText.optional(),
  specialty: optionalText.optional(),
  address: optionalText.optional(),
  city: optionalText.optional(),
  state: z.preprocess((value) => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") return value;
    const trimmed = blankToNull(value);
    return trimmed ? trimmed.toUpperCase() : null;
  }, z.string().regex(/^[A-Z]{2}$/).nullable()).optional(),
});

const jobSchema = z.object({
  fileName: z.string().trim().min(1),
  defaultState: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
  rows: z.array(rowSchema).min(1).max(2000),
});

const decisionSchema = z.object({
  decision: z.enum(["aceito", "sem_cnpj", "alternativa"]),
  cnpj: z.string().regex(/^\d{14}$/).optional(),
});

export type EnrichmentServices = {
  store: EnrichmentStore;
  apify: ApifyGateway;
  ibge: IbgeGateway;
  brasilApi: BrasilApiGateway;
  trackJob?: (job: Promise<void>) => void;
};

export function createEnrichmentRouter(services: EnrichmentServices): Router {
  const router = Router();

  router.get("/enrichment/jobs", (_request, response) => {
    response.status(200).json({ data: services.store.listJobs() });
  });

  router.get("/enrichment/companies", (_request, response) => {
    response.status(200).json({ data: services.store.listAccepted() });
  });

  router.get("/enrichment/cnpj/:cnpj", async (request, response, next) => {
    const cnpj = parameter(request.params.cnpj).replace(/\D/g, "");
    if (!isValidCnpj(cnpj)) {
      next(new AppError(400, "VALIDATION_ERROR", "O CNPJ informado é inválido."));
      return;
    }
    try {
      const lookup = await services.brasilApi.lookup(cnpj);
      if (lookup.status === "confirmed") {
        response.status(200).json({ data: lookup.company });
        return;
      }
      if (lookup.status === "not_found") {
        next(new AppError(404, "NOT_FOUND", "A Brasil API não encontrou este CNPJ."));
        return;
      }
      next(new AppError(502, "UPSTREAM_ERROR", lookup.message));
    } catch (error) {
      next(error);
    }
  });

  router.get("/enrichment/jobs/:jobId", (request, response, next) => {
    const job = services.store.getJob(parameter(request.params.jobId));
    if (!job) {
      next(new AppError(404, "NOT_FOUND", "Importação não encontrada."));
      return;
    }
    response.status(200).json({ data: { job, results: services.store.listResults(job.id) } });
  });

  router.get("/enrichment/jobs/:jobId/export", (request, response, next) => {
    const job = services.store.getJob(parameter(request.params.jobId));
    if (!job) {
      next(new AppError(404, "NOT_FOUND", "Importação não encontrada."));
      return;
    }
    const results = services.store.listResults(job.id);
    const format = request.query.format === "xls" ? "xls" : "csv";
    if (format === "xls") {
      response.type("application/vnd.ms-excel");
      response.setHeader("content-disposition", `attachment; filename="${safeFileName(job.fileName)}.xls"`);
      response.send(toExcelXml(results));
      return;
    }
    response.type("text/csv; charset=utf-8");
    response.setHeader("content-disposition", `attachment; filename="${safeFileName(job.fileName)}.csv"`);
    response.send(`\uFEFF${toCsv(results)}`);
  });

  router.post("/enrichment/jobs", (request, response, next) => {
    const parsed = jobSchema.safeParse(request.body);
    if (!parsed.success) {
      next(new AppError(400, "VALIDATION_ERROR", "A planilha enviada é inválida.", parsed.error.issues.map((issue) => ({
        field: issue.path.join(".") || "body",
        message: issue.message,
      }))));
      return;
    }

    const now = new Date().toISOString();
    const job = {
      id: crypto.randomUUID(),
      fileName: parsed.data.fileName,
      status: "running" as const,
      total: parsed.data.rows.length,
      processed: 0,
      estimatedCostUsd: 0,
      createdAt: now,
      finishedAt: null,
      error: null,
    };
    services.store.createJob(job);
    const rows = parsed.data.rows.map((row) => ({
      line: row.line,
      name: row.name ?? null,
      landline: row.landline ?? null,
      mobile: row.mobile ?? null,
      instagram: row.instagram ?? null,
      professionals: row.professionals ?? null,
      specialty: row.specialty ?? null,
      address: row.address ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
    }));
    services.store.saveSheet(job.id, { defaultState: parsed.data.defaultState, rows });
    const task = runEnrichmentJob({
      store: services.store,
      apify: services.apify,
      ibge: services.ibge,
      brasilApi: services.brasilApi,
      jobId: job.id,
      rows,
      defaultState: parsed.data.defaultState,
    });
    services.trackJob?.(task);
    void task.catch(() => undefined);
    response.status(202).json({ data: job });
  });

  router.post("/enrichment/jobs/:jobId/results/:resultId/decision", (request, response, next) => {
    const result = services.store.getResult(parameter(request.params.resultId));
    if (!result || result.jobId !== parameter(request.params.jobId)) {
      next(new AppError(404, "NOT_FOUND", "Resultado não encontrado."));
      return;
    }
    const parsed = decisionSchema.safeParse(request.body);
    if (!parsed.success) {
      next(new AppError(400, "VALIDATION_ERROR", "A revisão é inválida."));
      return;
    }

    const reviewedAt = new Date().toISOString();
    if (parsed.data.decision === "sem_cnpj") {
      services.store.updateResult({ ...result, decision: "sem_cnpj", reviewedBy: "usuario", reviewedAt });
    } else if (parsed.data.decision === "alternativa") {
      const alternative = result.alternatives.find((item) => item.cnpj === parsed.data.cnpj);
      if (!alternative) {
        next(new AppError(400, "VALIDATION_ERROR", "A alternativa escolhida não pertence a esta linha."));
        return;
      }
      services.store.updateResult({
        ...result,
        cnpj: alternative.cnpj,
        razaoSocial: alternative.razaoSocial,
        nomeFantasia: alternative.nomeFantasia,
        situacaoCadastral: alternative.situacaoCadastral,
        enderecoReceita: alternative.endereco,
        telefonesReceita: alternative.telefones,
        score: alternative.score,
        justification: `${result.justification} Revisão escolheu o CNPJ ${alternative.cnpj}.`,
        decision: "aceito",
        reviewedBy: "usuario",
        reviewedAt,
      });
    } else if (!result.cnpj) {
      next(new AppError(400, "VALIDATION_ERROR", "Não há CNPJ para aceitar nesta linha."));
      return;
    } else {
      services.store.updateResult({ ...result, decision: "aceito", reviewedBy: "usuario", reviewedAt });
    }

    const updated = services.store.getResult(result.id);
    response.status(200).json({ data: updated });
  });

  return router;
}

function parameter(value: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^\w.-]+/g, "_").replace(/\.csv$|\.xlsx$|\.xls$/i, "") || "enriquecimento";
}

const EXPORT_COLUMNS = [
  "linha",
  "nome",
  "telefone_fixo",
  "celular",
  "instagram",
  "profissionais",
  "especialidade",
  "endereco",
  "cidade",
  "uf",
  "cnpj",
  "razao_social",
  "nome_fantasia",
  "situacao_cadastral",
  "confianca",
  "score",
  "justificativa",
  "decisao_final",
] as const;

function exportRows(results: ResultRecord[]): string[][] {
  return results.map((result) => [
    String(result.line.line),
    result.line.name ?? "",
    result.line.landline ?? "",
    result.line.mobile ?? "",
    result.line.instagram ?? "",
    result.line.professionals ?? "",
    result.line.specialty ?? "",
    result.line.address ?? "",
    result.line.city ?? "",
    result.line.state ?? "",
    result.decision === "sem_cnpj" ? "" : result.cnpj ?? "",
    result.razaoSocial ?? "",
    result.nomeFantasia ?? "",
    result.situacaoCadastral ?? "",
    result.confidence,
    String(result.score),
    result.justification,
    result.decision ?? "",
  ]);
}

function toCsv(results: ResultRecord[]): string {
  return [EXPORT_COLUMNS.join(";"), ...exportRows(results).map((row) => row.map(csvCell).join(";"))].join("\n");
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function toExcelXml(results: ResultRecord[]): string {
  const header = EXPORT_COLUMNS.map((column) => `<Cell><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`).join("");
  const body = exportRows(results)
    .map((row) => `<Row>${row.map((value) => `<Cell><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`).join("")}</Row>`)
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Enriquecimento"><Table><Row>${header}</Row>${body}</Table></Worksheet>
</Workbook>`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
