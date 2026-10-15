import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "../../components/page-header";
import { apiGet, confidenceLabels, type Confidence, type EnrichmentJob, type EnrichmentResult } from "./api";
import { CompanyCard } from "./company-card";
import { CompanyDetailsModal } from "./company-details-modal";

const filters: Array<Confidence | "TODAS"> = ["TODAS", "ALTA", "MEDIA", "BAIXA", "NAO_ENCONTRADO"];

export function ReviewPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState<EnrichmentJob | null>(null);
  const [results, setResults] = useState<EnrichmentResult[]>([]);
  const [filter, setFilter] = useState<Confidence | "TODAS">("TODAS");
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<EnrichmentResult | null>(null);

  useEffect(() => {
    if (!jobId) return undefined;
    localStorage.setItem("orbyts.active-job", jobId);
    let stopped = false;

    async function load() {
      try {
        const data = await apiGet<{ job: EnrichmentJob; results: EnrichmentResult[] }>(`/api/enrichment/jobs/${jobId}`);
        if (stopped) return;
        setJob(data.job);
        setResults(data.results);
        setMessage(data.job.error);
        if (data.job.status !== "running") window.clearInterval(timer);
      } catch (error) {
        if (!stopped) setMessage(error instanceof Error ? error.message : "Não foi possível carregar a importação.");
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [jobId]);

  if (!jobId) return <JobPicker />;

  const visible = results.filter((result) => filter === "TODAS" || result.confidence === filter);

  return (
    <section>
      <PageHeader
        title={job?.fileName ?? "Revisão"}
        subtitle={job ? progressText(job) : "Carregando a importação..."}
        notice={job?.status === "running" ? <ValidationNotice processed={job.processed} total={job.total} /> : undefined}
      />
      {message ? <p className="mt-4 rounded-2xl bg-[#fdecec] px-4 py-3 text-sm text-[#b42318]">{message}</p> : null}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {filters.map((item) => {
            const count = item === "TODAS" ? results.length : results.filter((result) => result.confidence === item).length;
            const isSelected = filter === item;
            return (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium ${isSelected ? "bg-[#547be2] text-white" : "bg-[#f6f8fc] text-[#667085] hover:bg-[#eef2fc]"}`}
              >
                {item === "TODAS" ? "Todas" : confidenceLabels[item]}
                <span className={isSelected ? "text-white/75" : "text-[#98a2b3]"}>{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <a href={`/api/enrichment/jobs/${jobId}/export`} className="rounded-full border border-[#e6ebf2] px-4 py-2 text-sm font-medium text-[#547be2] hover:bg-[#f6f8fc]">CSV</a>
          <a href={`/api/enrichment/jobs/${jobId}/export?format=xls`} className="rounded-full border border-[#e6ebf2] px-4 py-2 text-sm font-medium text-[#547be2] hover:bg-[#f6f8fc]">Excel</a>
        </div>
      </div>
      {!job ? null : visible.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[#d5deea] px-6 py-12 text-center text-sm text-[#667085]">Nenhuma empresa neste filtro.</p>
      ) : (
        groupByCity(visible).map(([city, items]) => (
          <section key={city} className="mt-8">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold text-[#1d2433]">{city}</h2>
              <p className="text-xs text-[#98a2b3]">{items.length} {items.length === 1 ? "empresa" : "empresas"}</p>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {items.map((result) => (
                <CompanyCard key={result.id} result={result} onOpen={setSelected} />
              ))}
            </div>
          </section>
        ))
      )}
      {selected ? <CompanyDetailsModal result={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function JobPicker() {
  const navigate = useNavigate();
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    const remembered = localStorage.getItem("orbyts.active-job");
    void apiGet<EnrichmentJob[]>("/api/enrichment/jobs")
      .then((jobs) => {
        const current = jobs.find((job) => job.id === remembered) ?? jobs.find((job) => job.status === "running") ?? jobs[0];
        if (current) navigate(`/pesquisa/${current.id}`, { replace: true });
        else setEmpty(true);
      })
      .catch(() => setEmpty(true));
  }, [navigate]);

  return (
    <section>
      <PageHeader title="Pesquisa" subtitle={empty ? "Nenhuma pesquisa salva ainda." : "Abrindo a última pesquisa salva..."} />
      {empty ? (
        <Link to="/importacao" className="mt-8 inline-flex rounded-full bg-[#547be2] px-5 py-3 text-sm font-medium text-white">Importar uma lista</Link>
      ) : null}
    </section>
  );
}

function ValidationNotice({ processed, total }: { processed: number; total: number }) {
  return (
    <p className="flex max-w-xs items-center gap-2 rounded-full bg-[#e7ecfb] px-4 py-2 text-sm text-[#547be2]" role="status">
      <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#547be2]" />
      Validando o restante da lista · {processed} de {total}
    </p>
  );
}

function progressText(job: EnrichmentJob): string {
  const cost = job.estimatedCostUsd.toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (job.status === "running") return `${job.processed} de ${job.total} linhas. Custo estimado ${cost}.`;
  if (job.status === "failed") return `A importação parou em ${job.processed} de ${job.total}.`;
  return `${job.total} linhas concluídas. Custo estimado ${cost}.`;
}

function groupByCity(results: EnrichmentResult[]): Array<[string, EnrichmentResult[]]> {
  const groups = new Map<string, EnrichmentResult[]>();
  for (const result of results) {
    const city = result.line.city?.trim() || "Cidade não informada";
    const current = groups.get(city) ?? [];
    current.push(result);
    groups.set(city, current);
  }
  return [...groups.entries()];
}
