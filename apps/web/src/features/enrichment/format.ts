import type { Confidence } from "./api";

export function formatCnpj(value: string | null): string {
  if (!value) return "Sem CNPJ";
  return value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  return value;
}

export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function confidenceClass(confidence: Confidence): string {
  if (confidence === "ALTA") return "bg-[#e7f6ee] text-[#027a48]";
  if (confidence === "MEDIA") return "bg-[#fff6e5] text-[#b54708]";
  if (confidence === "BAIXA") return "bg-[#fff1e8] text-[#c4320a]";
  return "bg-[#f2f4f7] text-[#667085]";
}

export function statusClass(status: string | null): string {
  const normalized = (status ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (normalized === "ATIVA") return "bg-[#e7f6ee] text-[#027a48]";
  if (normalized.includes("BAIX") || normalized.includes("INAPT")) return "bg-[#fdecec] text-[#b42318]";
  return "bg-[#f2f4f7] text-[#667085]";
}
