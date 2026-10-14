import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { apiGet, apiSend, confidenceLabels, type Confidence, type EnrichmentJob, type EnrichmentResult } from "./api";

const filters: Array<Confidence | "TODAS"> = ["TODAS", "ALTA", "MEDIA", "BAIXA", "NAO_ENCONTRADO"];

export function ReviewPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<EnrichmentJob | null>(null);
  const [results, setResults] = useState<EnrichmentResult[]>([]);
  const [filter, setFilter] = useState<Confidence | "TODAS">("TODAS");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return undefined;
    let stopped = false;

    async function load() {
      try {
        const data = await apiGet<{ job: EnrichmentJob; results: EnrichmentResult[] }>(`/api/enrichment/jobs/${jobId}`);
        if (stopped) return;
        setJob(data.job);
        setResults(data.results);
        setMessage(data.job.error);
      } catch (error) {
        if (!stopped) setMessage(error instanceof Error ? error.message : "Não foi possível carregar a importação.");
      }
    }

    void load();
    const timer = window.setInterval(() => {
      if (job?.status === "running" || job === null) void load();
    }, 2000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId, job?.status]);

  if (!jobId) return <JobPicker />;

  const visible = results.filter((result) => filter === "TODAS" || result.confidence === filter);

  return (
    <section>
      <PageHeader
        title={job?.fileName ?? "Revisão"}
        subtitle={job ? progressText(job) : "Carregando a importação..."}
      />
      {message ? <p className="mt-4 text-sm text-[#b42318]">{message}</p> : null}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-2 text-sm ${filter === item ? "bg-[#547be2] text-white" : "bg-[#f5f7fb] text-[#667085]"}`}
          >
            {item === "TODAS" ? "Todas" : confidenceLabels[item]}
          </button>
        ))}
        <a href={`/api/enrichment/jobs/${jobId}/export`} className="rounded-full bg-[#f5f7fb] px-4 py-2 text-sm text-[#547be2]">CSV</a>
        <a href={`/api/enrichment/jobs/${jobId}/export?format=xls`} className="rounded-full bg-[#f5f7fb] px-4 py-2 text-sm text-[#547be2]">Excel</a>
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {visible.map((result) => (
          <article key={result.id} className="rounded-3xl bg-[#f5f7fb] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1d2433]">{result.line.name ?? "Sem nome"}</h2>
                <p className="mt-1 text-sm text-[#667085]">{result.razaoSocial ?? "Sem razão social"}{result.nomeFantasia ? ` · ${result.nomeFantasia}` : ""}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[#547be2]">{confidenceLabels[result.confidence]} · {result.score}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#344054]">{result.justification}</p>
            <p className="mt-2 text-sm text-[#667085]">
              {formatCnpj(result.cnpj)} · {result.situacaoCadastral ?? "Situação não informada"} · {result.line.address}
            </p>
            {result.brasilApi?.status === "confirmed" ? <p className="mt-2 text-sm text-[#027a48]">Validado pela Brasil API.</p> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={!result.cnpj} onClick={() => void decide(result, { decision: "aceito" })} className="rounded-full bg-[#547be2] px-4 py-2 text-sm text-white disabled:opacity-40">Aceitar</button>
              <button type="button" onClick={() => void decide(result, { decision: "sem_cnpj" })} className="rounded-full bg-white px-4 py-2 text-sm text-[#667085]">Sem CNPJ</button>
              {result.alternatives.map((alternative) => (
                <button key={alternative.cnpj} type="button" onClick={() => void decide(result, { decision: "alternativa", cnpj: alternative.cnpj })} className="rounded-full bg-white px-4 py-2 text-sm text-[#547be2]">
                  {formatCnpj(alternative.cnpj)} · {alternative.score}
                </button>
              ))}
            </div>
            {result.decision ? <p className="mt-3 text-xs text-[#98a2b3]">Decisão: {result.decision === "aceito" ? "aceito" : "sem CNPJ"}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );

  async function decide(result: EnrichmentResult, body: { decision: "aceito" | "sem_cnpj" | "alternativa"; cnpj?: string }) {
    if (!jobId) return;
    const updated = await apiSend<EnrichmentResult>(`/api/enrichment/jobs/${jobId}/results/${result.id}/decision`, body);
    setResults((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }
}

function JobPicker() {
  const [jobs, setJobs] = useState<EnrichmentJob[]>([]);
  useEffect(() => {
    void apiGet<EnrichmentJob[]>("/api/enrichment/jobs").then(setJobs).catch(() => setJobs([]));
  }, []);
  const latest = jobs[0];
  return (
    <section>
      <PageHeader title="Revisão" subtitle="Escolha uma importação para aceitar, trocar ou descartar o CNPJ." />
      {latest ? (
        <Link to={`/pesquisa/${latest.id}`} className="mt-8 inline-flex rounded-full bg-[#547be2] px-5 py-3 text-sm font-medium text-white">Abrir {latest.fileName}</Link>
      ) : (
        <Link to="/importacao" className="mt-8 inline-flex rounded-full bg-[#547be2] px-5 py-3 text-sm font-medium text-white">Importar uma lista</Link>
      )}
    </section>
  );
}

function progressText(job: EnrichmentJob): string {
  const cost = job.estimatedCostUsd.toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (job.status === "running") return `${job.processed} de ${job.total} linhas. Custo estimado ${cost}.`;
  if (job.status === "failed") return `A importação parou em ${job.processed} de ${job.total}.`;
  return `${job.total} linhas concluídas. Custo estimado ${cost}.`;
}

function formatCnpj(value: string | null): string {
  if (!value) return "Sem CNPJ";
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
