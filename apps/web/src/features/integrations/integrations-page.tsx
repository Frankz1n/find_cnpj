import { DataTable } from "../../components/data-table";
import { PageHeader } from "../../components/page-header";
import { StatusText } from "../../components/status-text";
import { integrationCatalog } from "./integration-catalog";

const integrationTemplate = "grid-cols-[1.05fr_1.15fr_1fr_0.7fr_0.85fr]";

export function IntegrationsPage() {
  return (
    <section>
      <PageHeader title="Integrações" subtitle="A Apify lista as empresas do município. O cruzamento é local. A Brasil API confirma o CNPJ escolhido." />
      <DataTable
        columns={["Integração", "Função", "Limite", "Uso", "Status"]}
        template={integrationTemplate}
        rows={integrationCatalog.map((integration) => ({
          id: integration.id,
          cells: [integration.name, integration.role, integration.limit, integration.usage, <StatusText key={integration.id} status={integration.status} />],
        }))}
      />
      <p className="mt-6 max-w-2xl text-sm leading-6 text-[#667085]">
        O token da Apify fica só no servidor. Cada execução envia um teto de US$ 1. O resultado de um município e CNAE fica em cache por 30 dias.
        A lista de CNAEs pode ser ajustada na tabela cnae_catalog.
      </p>
    </section>
  );
}
