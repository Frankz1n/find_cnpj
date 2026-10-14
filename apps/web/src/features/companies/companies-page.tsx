import { useEffect, useState } from "react";
import { PageHeader } from "../../components/page-header";
import { apiGet, type EnrichmentResult } from "../enrichment/api";

export function CompaniesPage() {
  const [companies, setCompanies] = useState<EnrichmentResult[] | null>(null);

  useEffect(() => {
    void apiGet<EnrichmentResult[]>("/api/enrichment/companies").then(setCompanies).catch(() => setCompanies([]));
  }, []);

  return (
    <section>
      <PageHeader title="Empresas" subtitle="CNPJs aceitos, com a confiança do cruzamento e a validação da Brasil API." />
      <div className="mt-8 grid gap-4">
        {(companies ?? []).map((company) => (
          <article key={company.id} className="rounded-3xl bg-[#f5f7fb] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#547be2]">{company.situacaoCadastral ?? "Situação não informada"}</p>
                <h2 className="mt-1 text-lg font-semibold text-[#1d2433]">{company.razaoSocial}</h2>
                <p className="mt-1 text-sm text-[#667085]">{company.nomeFantasia ?? company.line.name}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-xs text-[#547be2]">{company.score}</span>
            </div>
            <p className="mt-3 text-sm text-[#344054]">{formatCnpj(company.cnpj)} · {company.line.city}/{company.line.state}</p>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{company.enderecoReceita ?? company.line.address}</p>
          </article>
        ))}
      </div>
      {companies && companies.length === 0 ? <p className="mt-8 text-sm text-[#98a2b3]">Nenhum CNPJ aceito ainda.</p> : null}
    </section>
  );
}

function formatCnpj(value: string | null): string {
  if (!value) return "Sem CNPJ";
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
