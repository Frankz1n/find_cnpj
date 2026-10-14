import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable } from "../../components/data-table";
import { EmptyRecords } from "../../components/empty-records";
import { PageHeader } from "../../components/page-header";
import { apiGet, type EnrichmentJob } from "../enrichment/api";

export function HistoryPage() {
  const [jobs, setJobs] = useState<EnrichmentJob[] | null>(null);

  useEffect(() => {
    void apiGet<EnrichmentJob[]>("/api/enrichment/jobs").then(setJobs).catch(() => setJobs([]));
  }, []);

  return (
    <section>
      <PageHeader title="Histórico" subtitle="Cada importação guarda o progresso, o custo estimado e o resultado por linha." />
      {jobs && jobs.length > 0 ? (
        <DataTable
          columns={["Arquivo", "Status", "Progresso", "Custo"]}
          template="grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr]"
          rows={jobs.map((job) => ({
            id: job.id,
            cells: [
              <Link key={job.id} to={`/pesquisa/${job.id}`} className="font-medium text-[#547be2]">{job.fileName}</Link>,
              statusLabel(job.status),
              `${job.processed}/${job.total}`,
              job.estimatedCostUsd.toLocaleString("en-US", { style: "currency", currency: "USD" }),
            ],
          }))}
        />
      ) : (
        <EmptyRecords
          title={jobs ? "Nenhuma importação registrada." : "Carregando o histórico..."}
          description="A lista aparece depois que uma planilha entra em enriquecimento."
          action={<Link to="/importacao" className="font-medium text-[#547be2]">Importar uma lista</Link>}
        />
      )}
    </section>
  );
}

function statusLabel(status: EnrichmentJob["status"]): string {
  if (status === "running") return "Processando";
  if (status === "failed") return "Falhou";
  return "Concluída";
}
