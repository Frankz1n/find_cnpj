import { normalizeText } from "./text.js";

export type CnaeDefinition = {
  code: string;
  description: string;
};

export const DEFAULT_CNAES: CnaeDefinition[] = [
  { code: "8630504", description: "Atividade odontológica" },
  { code: "8630503", description: "Atividade médica ambulatorial restrita a consultas" },
  { code: "8630502", description: "Atividade médica ambulatorial com recursos para exames complementares" },
  { code: "8630501", description: "Atividade médica ambulatorial com recursos para procedimentos cirúrgicos" },
  { code: "8640205", description: "Diagnóstico por imagem com uso de radiação ionizante, exceto tomografia" },
  { code: "8640207", description: "Diagnóstico por imagem sem uso de radiação ionizante, exceto ressonância" },
  { code: "8650004", description: "Atividades de fisioterapia" },
  { code: "8650003", description: "Atividades de psicologia e psicanálise" },
  { code: "8650002", description: "Atividades de profissionais da nutrição" },
  { code: "8610102", description: "Atendimento hospitalar, exceto pronto-socorro e urgências" },
];

const PRIMARY_CNAES = ["8630504", "8630503", "8640205"];

export const SECOND_ROUND_CNAES = ["8630502", "8630501", "8610102"];

const SPECIALTY_RULES: Array<{ pattern: RegExp; codes: string[] }> = [
  { pattern: /ODONTO|IMPLANTE|DENTISTA/, codes: ["8630504"] },
  { pattern: /RADIO|IMAGEM/, codes: ["8640205"] },
  { pattern: /FISIO/, codes: ["8650004"] },
  { pattern: /PSICO|PSIQUI/, codes: ["8650003"] },
  { pattern: /NUTRI/, codes: ["8650002"] },
  { pattern: /HOSPITAL/, codes: ["8610102"] },
  { pattern: /MEDIC|PEDIATR|CIRURG|CONSULT|CARDIO|OFTALM|LABORAT/, codes: ["8630503"] },
];

export function priorityCnaeCodes(specialty: string | null, catalog: CnaeDefinition[]): string[] {
  const available = new Set(catalog.map((item) => item.code));
  const preferred = specialty
    ? SPECIALTY_RULES.find((rule) => rule.pattern.test(normalizeText(specialty)))?.codes ?? ["8630503"]
    : PRIMARY_CNAES;
  const codes = preferred.filter((code) => available.has(code));
  return codes.length > 0 ? codes : PRIMARY_CNAES.filter((code) => available.has(code));
}

export function discoveryLimit(cnae: string): number {
  return cnae.startsWith("86402") ? 100 : 300;
}
