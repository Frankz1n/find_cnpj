import type { ReceitaCompany } from "./receita-company.js";
import type { SheetRow } from "./match.js";

function company(input: {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string | null;
  situacaoCadastral?: string;
  logradouro?: string | null;
  numero?: string | null;
  telefones?: string[];
  socios?: string[];
}): ReceitaCompany {
  return {
    cnpj: input.cnpj,
    razaoSocial: input.razaoSocial,
    nomeFantasia: input.nomeFantasia ?? null,
    situacaoCadastral: input.situacaoCadastral ?? "ATIVA",
    cnaePrincipal: "8630504",
    endereco: {
      logradouro: input.logradouro ?? null,
      numero: input.numero ?? null,
      bairro: input.logradouro ? "CENTRO" : null,
      municipio: "SANTA FE DO SUL",
      uf: "SP",
      cep: "15775000",
    },
    telefones: input.telefones ?? [],
    socios: (input.socios ?? []).map((nome) => ({ nome, qualificacao: null })),
  };
}

export const SANTA_FE_DO_SUL_COMPANIES: ReceitaCompany[] = [
  company({
    cnpj: "58475175000135",
    razaoSocial: "ODONTOLOGIA DO CENTRO LTDA",
    logradouro: "05",
    numero: "1679",
    telefones: ["1736315822"],
  }),
  company({
    cnpj: "52185340000138",
    razaoSocial: "FLAVIO ROBERTO DA SILVA RADIOLOGIA LTDA",
    nomeFantasia: "RDO RADIOLOGIA",
    logradouro: "18",
    numero: "230",
    telefones: ["1736313291"],
  }),
  company({
    cnpj: "37306530000172",
    razaoSocial: "RUBIA LARANJO SERVICOS MEDICOS LTDA",
    nomeFantasia: "CLINICA LARANJO",
    socios: ["SILVIA MARIA M LARANJO"],
  }),
  company({
    cnpj: "20433893000176",
    razaoSocial: "ZELO ODONTOLOGIA LTDA",
    nomeFantasia: "ZELO ODONTOLOGIA",
    logradouro: "CINCO",
    numero: "1543",
    telefones: ["1736316795"],
  }),
  company({
    cnpj: "61874778000114",
    razaoSocial: "DENTISTA PESSOAL LTDA",
    logradouro: "5",
    numero: "1543",
  }),
  company({
    cnpj: "36736535000172",
    razaoSocial: "CLINICA INFANTIL MUNICIPAL LTDA",
    logradouro: "5",
    numero: "1229",
    telefones: ["1736312290"],
  }),
  company({
    cnpj: "11111111000191",
    razaoSocial: "ESCRITORIO CONTABIL ALFA LTDA",
    logradouro: "40",
    numero: "10",
    telefones: ["1736312290"],
  }),
  company({
    cnpj: "22222222000191",
    razaoSocial: "ESCRITORIO CONTABIL BETA LTDA",
    logradouro: "41",
    numero: "10",
    telefones: ["1736312290"],
  }),
  company({
    cnpj: "33333333000191",
    razaoSocial: "ESCRITORIO CONTABIL GAMA LTDA",
    logradouro: "42",
    numero: "10",
    telefones: ["1736312290"],
  }),
  company({
    cnpj: "20702409000167",
    razaoSocial: "EMPRESA BAIXADA LTDA",
    situacaoCadastral: "BAIXADA",
    logradouro: "5",
    numero: "1242",
  }),
  company({
    cnpj: "48923458000149",
    razaoSocial: "NAHIARA BARBATO BAPTISTA ZONTA LTDA",
    logradouro: "SETE",
    numero: "1061",
    telefones: ["1736312174"],
  }),
  company({
    cnpj: "35512645000198",
    razaoSocial: "PAULO FAVALESSA LTDA",
    nomeFantasia: "CENTRO ODONTOLOGICO",
    logradouro: "SETE",
    numero: "1155",
    telefones: ["1736310880"],
  }),
  company({
    cnpj: "41928526000113",
    razaoSocial: "IKKI ODONTOLOGIA LTDA",
    nomeFantasia: "IKKI ODONTOLOGIA",
    logradouro: "7",
    numero: "1060",
    telefones: ["1736412775", "17996681717"],
  }),
];

function row(input: Partial<SheetRow> & Pick<SheetRow, "line" | "name" | "address">): SheetRow {
  return {
    landline: null,
    mobile: null,
    instagram: null,
    professionals: null,
    specialty: "Odontologia",
    city: "Santa Fé do Sul",
    state: "SP",
    ...input,
  };
}

export const SANTA_FE_DO_SUL_ROWS: SheetRow[] = [
  row({
    line: 1,
    name: "Clínica Odonto",
    address: "Rua 5, 1679 - entre 10 e 12 - Centro",
    landline: "(17)3631-5822",
    mobile: "(17)99711-5082",
    professionals: "RT: Dra. Franciele Bassi",
  }),
  row({
    line: 2,
    name: "RDO Radiologia",
    address: "Rua 18, 230 - Centro",
    landline: "(17)3631-3291",
    mobile: "(17)99624-0687",
    professionals: "RT Flávio Roberto da Silva",
    specialty: "Radiologia",
  }),
  row({
    line: 3,
    name: "Clínica Laranjo",
    address: "Rua 5, 1445 - Centro",
    landline: "(17)3631-3047",
    mobile: "(17)99712-3354",
    professionals: "Dra. Rubia Laranjo, Dra. Silvia Maria M. Laranjo",
    specialty: "Medicina",
  }),
  row({
    line: 4,
    name: "Zelo Odontologia",
    address: "Rua 5, 1543 - Centro",
    landline: "(17)3631-6795",
    professionals: "Dra. Paula Minomi",
    instagram: "@zelo.odonto",
  }),
  row({
    line: 5,
    name: "Pediatria e Cirurgia",
    address: "Rua 5, 1229 - Centro",
    landline: "(17)3631-2290",
    professionals: "Dra. Marina",
    specialty: "Pediatria",
  }),
  row({
    line: 6,
    name: "Clínica Médica Santa Fé do Sul",
    address: "Rua 5, 1242 - Centro",
    mobile: "(17)99660-1368",
    specialty: "Medicina",
  }),
  row({
    line: 7,
    name: "Clínica Odontológica",
    address: "Rua 7, 1061 - Centro",
    landline: "(17)3631-2174",
    professionals: "Dra Nahiara Barbato B. Zonta",
  }),
  row({
    line: 8,
    name: "Centro Odontológico",
    address: "Rua Sete, 1155, Centro",
    landline: "(17)3641-0880",
    professionals: "Dr. Paulo Favalessa",
  }),
  row({
    line: 9,
    name: "Ikki Odontologia",
    address: "R. Sete, 1060 - Centro, Santa Fé do Sul - SP, 15775-045",
    landline: "(17)3641-2775",
    mobile: "(17)99668-1717",
  }),
];
