import { isValidCnpj } from "../../search/cnpj.js";

export type BrasilApiPartner = {
  name: string;
  role: string | null;
};

export type BrasilApiCompany = {
  cnpj: string;
  legalName: string | null;
  tradeName: string | null;
  registrationStatus: string | null;
  openedAt: string | null;
  legalNature: string | null;
  size: string | null;
  capital: string | null;
  email: string | null;
  branch: string | null;
  mainCnae: string | null;
  secondaryCnaes: string[];
  partners: BrasilApiPartner[];
  phones: string[];
  address: string | null;
  city: string | null;
  state: string | null;
};

export function mapBrasilApiCompany(value: unknown): BrasilApiCompany | null {
  if (!isRecord(value)) return null;

  const cnpj = readCnpj(value.cnpj);
  if (!cnpj) return null;
  const legalName = readText(value.razao_social);

  const phones = unique([readPhone(value.ddd_telefone_1), readPhone(value.ddd_telefone_2)].filter((phone): phone is string => phone !== null));
  const street = joinStreet(readText(value.descricao_tipo_de_logradouro), readText(value.logradouro));
  const number = readTextish(value.numero);
  const streetWithNumber = street && number && !street.endsWith(number) ? `${street}, ${number}` : street ?? number;

  return {
    cnpj,
    legalName,
    tradeName: readText(value.nome_fantasia),
    registrationStatus: readText(value.descricao_situacao_cadastral),
    openedAt: readText(value.data_inicio_atividade),
    legalNature: readText(value.natureza_juridica),
    size: readText(value.porte),
    capital: readCapital(value.capital_social),
    email: readText(value.email),
    branch: readText(value.descricao_identificador_matriz_filial),
    mainCnae: readText(value.cnae_fiscal_descricao),
    secondaryCnaes: readActivities(value.cnaes_secundarios),
    partners: readPartners(value.qsa),
    phones,
    address: joinParts([
      streetWithNumber,
      readText(value.complemento),
      readText(value.bairro),
      formatCep(readTextish(value.cep)),
    ]),
    city: readText(value.municipio),
    state: readState(value.uf),
  };
}

function readCapital(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const [reais, cents] = value.toFixed(2).split(".");
    const grouped = (reais ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `R$ ${grouped},${cents ?? "00"}`;
  }
  return readTextish(value);
}

function readActivities(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const description = readText(item.descricao);
    return description ? [description] : [];
  }));
}

function readPartners(value: unknown): BrasilApiPartner[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = readText(item.nome_socio);
    if (!name) return [];
    return [{ name, role: readText(item.qualificacao_socio) }];
  });
}

function readCnpj(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  return isValidCnpj(digits) ? digits : null;
}

function readPhone(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  let digits = String(value).replace(/\D/g, "");
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) digits = digits.slice(2);
  return digits.length === 10 || digits.length === 11 ? digits : null;
}

function joinStreet(streetType: string | null, street: string | null): string | null {
  if (streetType && street) {
    if (street.toLowerCase().startsWith(streetType.toLowerCase())) return street;
    return `${streetType} ${street}`;
  }
  return street ?? streetType;
}

function formatCep(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null;
}

function readState(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const state = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(state) ? state : null;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readTextish(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return readText(value);
}

function joinParts(parts: Array<string | null>): string | null {
  const present = parts.filter((part): part is string => part !== null && part.length > 0);
  return present.length > 0 ? present.join(", ") : null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
