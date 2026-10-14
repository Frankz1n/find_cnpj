export type IntegrationStatus = "inactive" | "available" | "unavailable";

export type IntegrationRecord = {
  id: string;
  name: string;
  role: string;
  limit: string;
  usage: string;
  status: IntegrationStatus;
};

export const integrationCatalog: IntegrationRecord[] = [
  {
    id: "apify",
    name: "Apify",
    role: "Lista da Receita por CNAE e município",
    limit: "US$ 1 por execução",
    usage: "Token no servidor",
    status: "available",
  },
  {
    id: "ibge",
    name: "IBGE",
    role: "Código do município",
    limit: "Sem chave",
    usage: "Cache permanente",
    status: "available",
  },
  {
    id: "brasilapi",
    name: "Brasil API",
    role: "Confirma o CNPJ escolhido",
    limit: "Sem chave",
    usage: "Depois do cruzamento",
    status: "available",
  },
];

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  inactive: "Não ativada",
  available: "Disponível",
  unavailable: "Indisponível",
};
