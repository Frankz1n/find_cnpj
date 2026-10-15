import { BadgeCheck, ChevronRight } from "lucide-react";
import { confidenceLabels, type EnrichmentResult } from "./api";
import { confidenceClass, formatCnpj, statusClass } from "./format";

export function CompanyCard({ result, onOpen }: { result: EnrichmentResult; onOpen: (result: EnrichmentResult) => void }) {
  const subtitle = result.nomeFantasia ?? result.razaoSocial;
  const location = result.line.address;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#e6ebf2] bg-white p-5 shadow-[0_1px_2px_rgba(29,36,51,0.04)] transition duration-200 hover:border-[#c5d2ee] hover:shadow-[0_14px_32px_rgba(84,123,226,0.1)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {result.line.specialty ? <p className="truncate text-xs font-medium text-[#98a2b3]">{result.line.specialty}</p> : null}
          <h3 className="mt-1 text-base font-semibold leading-6 text-[#1d2433]">{result.line.name ?? "Sem nome"}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-[#667085]">{subtitle ?? "Sem razão social na Receita"}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${confidenceClass(result.confidence)}`}>
          {confidenceLabels[result.confidence]}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[#f6f8fc] px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98a2b3]">CNPJ</dt>
          <dd className="mt-1 text-sm font-medium text-[#1d2433]">{formatCnpj(result.cnpj)}</dd>
        </div>
        <div className="rounded-xl bg-[#f6f8fc] px-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-[#98a2b3]">Situação</dt>
          <dd className="mt-1">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(result.situacaoCadastral)}`}>
              {result.situacaoCadastral ?? "Não informada"}
            </span>
          </dd>
        </div>
      </dl>

      {location ? <p className="mt-3 line-clamp-2 text-sm leading-5 text-[#667085]">{location}</p> : null}
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-[#344054]">{result.justification}</p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-4">
        {result.brasilApi?.status === "confirmed" ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#027a48]">
            <BadgeCheck size={14} />
            Brasil API
          </p>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => onOpen(result)}
          className="inline-flex items-center gap-1 rounded-full bg-[#eef2fc] px-3 py-1.5 text-sm font-medium text-[#547be2] transition hover:bg-[#547be2] hover:text-white"
        >
          Ver detalhes
          <ChevronRight size={15} />
        </button>
      </div>
    </article>
  );
}
