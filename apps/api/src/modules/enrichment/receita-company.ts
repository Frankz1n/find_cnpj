export type ReceitaAddress = {
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
};

export type ReceitaPartner = {
  nome: string;
  qualificacao: string | null;
};

export type ReceitaCompany = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  cnaePrincipal: string | null;
  endereco: ReceitaAddress;
  telefones: string[];
  socios: ReceitaPartner[];
};

export function isInactiveRegistration(status: string | null): boolean {
  const normalized = (status ?? "").toUpperCase();
  return normalized.includes("BAIXAD") || normalized.includes("INAPT");
}
