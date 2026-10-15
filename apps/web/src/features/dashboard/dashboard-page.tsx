import { Link } from "react-router-dom";
import { DataTable } from "../../components/data-table";
import { PageHeader } from "../../components/page-header";
import { StatusText } from "../../components/status-text";
import { useApiHealth } from "../health/use-api-health";
import { integrationCatalog } from "../integrations/integration-catalog";

const integrationTemplate = "grid-cols-[1.05fr_1.15fr_1fr_0.7fr_0.85fr]";

export function DashboardPage() {
  const health = useApiHealth();

  return (
    <section>
      <PageHeader title="Painel" subtitle={healthSubtitle(health)} />
      <div className="mt-6 max-w-2xl rounded-2xl border border-[#e6ebf2] bg-[#f6f8fc] px-5 py-4 text-sm leading-6 text-[#667085]">
        A pesquisa não usa mais o nome da clínica como razão social. A importação puxa as empresas de saúde do município e cruza pelo endereço, telefone e profissionais.
      </div>
      <Link to="/importacao" className="mt-6 inline-flex rounded-full bg-[#547be2] px-5 py-3 text-sm font-medium text-white">Importar uma lista</Link>
      <DataTable
        columns={["Integração", "Função", "Limite", "Uso", "Status"]}
        template={integrationTemplate}
        rows={integrationCatalog.map((integration) => ({
          id: integration.id,
          cells: [integration.name, integration.role, integration.limit, integration.usage, <StatusText key={integration.id} status={integration.status} />],
        }))}
      />
    </section>
  );
}

function healthSubtitle(health: ReturnType<typeof useApiHealth>): string {
  if (health.status === "loading") return "Consultando a API...";
  if (health.status === "error") return health.message;
  return `API disponível · verificada em ${health.checkedAt}`;
}
