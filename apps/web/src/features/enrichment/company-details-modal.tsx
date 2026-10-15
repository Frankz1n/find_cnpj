import { X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { confidenceLabels, apiGet, type BrasilApiCompany, type EnrichmentResult } from "./api";
import { confidenceClass, formatCnpj, formatDate, formatPhone, statusClass } from "./format";

export function CompanyDetailsModal({ result, onClose }: { result: EnrichmentResult; onClose: () => void }) {
  const [company, setCompany] = useState<BrasilApiCompany | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(result.cnpj));

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!result.cnpj) return undefined;
    let stopped = false;
    void apiGet<BrasilApiCompany>(`/api/enrichment/cnpj/${result.cnpj}`)
      .then((data) => {
        if (!stopped) setCompany(data);
      })
      .catch((error: unknown) => {
        if (!stopped) setMessage(error instanceof Error ? error.message : "Não foi possível consultar a Brasil API.");
      })
      .finally(() => {
        if (!stopped) setIsLoading(false);
      });
    return () => {
      stopped = true;
    };
  }, [result.cnpj]);

  const place = [result.line.city, result.line.state].filter(Boolean).join(" / ");

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1d2433]/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-6" role="presentation" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="company-details-title"
        className="modal-panel flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_24px_80px_rgba(29,36,51,0.22)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="relative border-b border-[#eef1f6] bg-[linear-gradient(180deg,#f4f7ff_0%,#ffffff_72%)] px-5 py-5 sm:px-6">
          <button type="button" onClick={onClose} aria-label="Fechar" autoFocus className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full text-[#667085] hover:bg-white hover:text-[#1d2433]">
            <X size={18} />
          </button>
          <p className="pr-12 text-xs font-medium text-[#547be2]">{[result.line.specialty, place].filter(Boolean).join(" · ") || "Brasil API"}</p>
          <h2 id="company-details-title" className="mt-1 pr-12 text-xl font-semibold tracking-tight text-[#1d2433]">{result.line.name ?? "Empresa"}</h2>
          <p className="mt-1 pr-12 text-sm text-[#667085]">{company?.legalName ?? result.razaoSocial ?? "Sem razão social"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${confidenceClass(result.confidence)}`}>{confidenceLabels[result.confidence]}</span>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#344054] ring-1 ring-[#e6ebf2]">{formatCnpj(result.cnpj)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(company?.registrationStatus ?? result.situacaoCadastral)}`}>
              {company?.registrationStatus ?? result.situacaoCadastral ?? "Situação não informada"}
            </span>
          </div>
        </header>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {isLoading ? <LoadingFacts /> : null}
          {message ? <p className="mb-4 rounded-2xl bg-[#fdecec] px-4 py-3 text-sm text-[#b42318]">{message}</p> : null}
          {!result.cnpj ? <p className="mb-4 rounded-2xl bg-[#f6f8fc] px-4 py-3 text-sm text-[#667085]">Esta linha não tem CNPJ para consultar na Brasil API.</p> : null}

          {company ? (
            <>
              <Section title="Cadastro">
                <FactGrid facts={registrationFacts(company)} />
              </Section>
              <Section title="Contato e endereço">
                <FactGrid facts={contactFacts(company)} />
              </Section>
              <Section title="Atividade">
                <FactGrid facts={activityFacts(company)} />
                <ChipList items={company.secondaryCnaes} />
              </Section>
              {company.partners.length > 0 ? (
                <Section title="Quadro societário">
                  <ul className="flex flex-col gap-2">
                    {company.partners.map((partner) => (
                      <li key={`${partner.name}-${partner.role ?? ""}`} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f8fc] px-4 py-3">
                        <span className="text-sm font-medium text-[#1d2433]">{partner.name}</span>
                        {partner.role ? <span className="shrink-0 text-xs text-[#667085]">{partner.role}</span> : null}
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}
            </>
          ) : !isLoading ? (
            <Section title="Dados já encontrados">
              <FactGrid facts={fallbackFacts(result)} />
            </Section>
          ) : null}

          {!isLoading ? (
            <Section title="Correspondência da planilha">
              <FactGrid facts={sheetFacts(result)} />
              <p className="mt-3 rounded-2xl bg-[#f6f8fc] px-4 py-3 text-sm leading-6 text-[#344054]">{result.justification}</p>
            </Section>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#98a2b3]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FactGrid({ facts }: { facts: Array<{ label: string; value: string; wide?: boolean }> }) {
  const visible = facts.filter((fact) => fact.value.trim());
  if (visible.length === 0) return null;
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {visible.map((fact) => (
        <div key={fact.label} className={`rounded-2xl bg-[#f6f8fc] px-4 py-3 ${fact.wide ? "sm:col-span-2" : ""}`}>
          <dt className="text-xs text-[#98a2b3]">{fact.label}</dt>
          <dd className="mt-1 text-sm font-medium leading-5 text-[#1d2433]">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-2xl bg-[#f6f8fc] px-4 py-3 text-sm leading-5 text-[#344054]">{item}</li>
      ))}
    </ul>
  );
}

function LoadingFacts() {
  return (
    <div className="grid gap-2 sm:grid-cols-2" aria-hidden="true">
      {["a", "b", "c", "d", "e", "f"].map((item) => (
        <div key={item} className="h-16 animate-pulse rounded-2xl bg-[#f6f8fc]" />
      ))}
    </div>
  );
}

function registrationFacts(company: BrasilApiCompany) {
  return [
    field("Razão social", company.legalName, true),
    field("Nome fantasia", company.tradeName, true),
    field("Abertura", company.openedAt ? formatDate(company.openedAt) : null),
    field("Natureza jurídica", company.legalNature),
    field("Porte", company.size),
    field("Capital social", company.capital),
    field("Tipo", company.branch),
  ];
}

function contactFacts(company: BrasilApiCompany) {
  return [
    field("Telefones", company.phones.map(formatPhone).join(" · "), true),
    field("E-mail", company.email, true),
    field("Endereço", company.address, true),
    field("Cidade", [company.city, company.state].filter(Boolean).join(" / ")),
  ];
}

function activityFacts(company: BrasilApiCompany) {
  return [field("CNAE principal", company.mainCnae, true)];
}

function fallbackFacts(result: EnrichmentResult) {
  return [
    field("Razão social", result.razaoSocial, true),
    field("Nome fantasia", result.nomeFantasia, true),
    field("Endereço", result.enderecoReceita, true),
    field("Telefones", result.telefonesReceita.map(formatPhone).join(" · "), true),
  ];
}

function sheetFacts(result: EnrichmentResult) {
  const phones = [result.line.landline, result.line.mobile].filter((value): value is string => Boolean(value)).map(formatPhone).join(" · ");
  return [
    field("Nome na planilha", result.line.name, true),
    field("Profissional", result.line.professionals),
    field("Endereço da planilha", result.line.address, true),
    field("Telefones da planilha", phones),
  ];
}

function field(label: string, value: string | null, wide = false): { label: string; value: string; wide?: boolean } {
  return { label, value: value?.trim() ?? "", wide };
}
