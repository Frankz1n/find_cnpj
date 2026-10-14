import { isInactiveRegistration, type ReceitaCompany } from "./receita-company.js";
import {
  extractProfessionals,
  formatPhoneKey,
  normalizeNumber,
  normalizeStreet,
  normalizeText,
  parseAddress,
  phoneKey,
} from "./text.js";

const GENERIC_WORDS = new Set([
  "CLINICA",
  "ODONTO",
  "ODONTOLOGIA",
  "ODONTOLOGICA",
  "CENTRO",
  "MEDICA",
  "LTDA",
  "ME",
  "EIRELI",
  "SERVICOS",
  "SANTA",
  "FE",
  "SUL",
]);
const NAME_PARTICLES = new Set(["DA", "DE", "DO", "DOS", "DAS", "E"]);

export type SheetRow = {
  line: number;
  name: string | null;
  landline: string | null;
  mobile: string | null;
  instagram: string | null;
  professionals: string | null;
  specialty: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
};

export type Confidence = "ALTA" | "MEDIA" | "BAIXA" | "NAO_ENCONTRADO";

export type MatchAlternative = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  endereco: string | null;
  telefones: string[];
  score: number;
  motivo: string;
};

export type MatchOutcome = {
  confidence: Confidence;
  score: number;
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  enderecoReceita: string | null;
  telefonesReceita: string[];
  justification: string;
  alternatives: MatchAlternative[];
};

type Scored = {
  company: ReceitaCompany;
  score: number;
  reasons: string[];
  divergences: string[];
};

export function matchRow(row: SheetRow, companies: ReceitaCompany[]): MatchOutcome {
  const genericPhones = genericPhoneKeys(companies);
  const scored = companies
    .map((company) => scoreCandidate(row, company, genericPhones))
    .sort((left, right) => right.score - left.score || left.company.cnpj.localeCompare(right.company.cnpj));
  const best = scored[0];
  if (!best || best.score <= 0) {
    return emptyOutcome("Nenhum candidato da Receita coincidiu com o endereço, o telefone ou os nomes.");
  }

  const strong = scored.filter((item) => item.score >= 50);
  const activeStrong = strong.filter((item) => !isInactiveRegistration(item.company.situacaoCadastral));
  const confidence = classify(best, activeStrong);
  const chosen = confidence === "NAO_ENCONTRADO" ? null : best;
  const alternatives = (confidence === "NAO_ENCONTRADO" ? [best, ...strong] : strong)
    .filter((item) => item.company.cnpj !== chosen?.company.cnpj)
    .filter((item, index, list) => list.findIndex((candidate) => candidate.company.cnpj === item.company.cnpj) === index)
    .map(toAlternative);

  return {
    confidence,
    score: best.score,
    cnpj: chosen?.company.cnpj ?? null,
    razaoSocial: chosen?.company.razaoSocial ?? null,
    nomeFantasia: chosen?.company.nomeFantasia ?? null,
    situacaoCadastral: chosen?.company.situacaoCadastral ?? null,
    enderecoReceita: chosen ? formatAddress(chosen.company) : null,
    telefonesReceita: chosen?.company.telefones ?? [],
    justification: buildJustification(best, confidence),
    alternatives,
  };
}

export function genericPhoneKeys(companies: ReceitaCompany[]): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const company of companies) {
    for (const key of new Set(company.telefones.map((phone) => phoneKey(phone)).filter((key): key is string => key !== null))) {
      const current = owners.get(key) ?? new Set<string>();
      current.add(company.cnpj);
      owners.set(key, current);
    }
  }
  return new Set([...owners.entries()].filter(([, cnpjs]) => cnpjs.size > 3).map(([key]) => key));
}

function classify(best: Scored, activeStrong: Scored[]): Confidence {
  const inactive = isInactiveRegistration(best.company.situacaoCadastral);
  if (inactive && activeStrong.length === 0) return "NAO_ENCONTRADO";
  if (best.score < 50) return "BAIXA";
  if (best.score >= 80) return "ALTA";
  return "MEDIA";
}

function scoreCandidate(row: SheetRow, company: ReceitaCompany, genericPhones: Set<string>): Scored {
  const reasons: string[] = [];
  const divergences: string[] = [];
  let score = 0;
  const sheetAddress = parseAddress(row.address);
  const receitaStreet = company.endereco.logradouro ? normalizeStreet(company.endereco.logradouro) : null;
  const receitaNumber = normalizeNumber(company.endereco.numero);
  const sameStreet = sheetAddress.street !== null && sheetAddress.street === receitaStreet;
  const sameNumber = sheetAddress.number !== null && sheetAddress.number === receitaNumber;

  if (sameStreet && sameNumber) {
    score += 50;
    reasons.push(`Endereço (${streetLabel(sheetAddress.street ?? "")}, ${sheetAddress.number})`);
  } else if (sameStreet && sheetAddress.number && receitaNumber && numericDistance(sheetAddress.number, receitaNumber) <= 10) {
    score += 15;
    reasons.push(`Mesma rua, número a ${numericDistance(sheetAddress.number, receitaNumber)} de distância`);
  }

  const sheetPhones = [row.landline, row.mobile].map((phone) => phoneKey(phone)).filter((key): key is string => key !== null);
  const receitaPhones = company.telefones.map((phone) => phoneKey(phone)).filter((key): key is string => key !== null);
  const matchedPhone = sheetPhones.find((key) => receitaPhones.includes(key) && !genericPhones.has(key));
  if (matchedPhone) {
    score += 25;
    reasons.push(`telefone ${formatPhoneKey(matchedPhone)}`);
  }

  const typedPhone = closestPhoneDivergence(sheetPhones, receitaPhones, genericPhones);
  if (typedPhone) {
    divergences.push(
      `Telefone da planilha ${formatPhoneKey(typedPhone.sheet)} difere do da Receita ${formatPhoneKey(typedPhone.receita)} (possível erro de digitação).`,
    );
  }

  if (row.name && company.nomeFantasia && tokenSetScore(row.name, company.nomeFantasia) >= 85) {
    score += 25;
    reasons.push("nome da planilha coincide com o nome fantasia");
  }

  const people = extractProfessionals(row.professionals);
  const companyNames = [company.razaoSocial, ...company.socios.map((partner) => partner.nome)];
  const matchedPerson = people.find((person) => companyNames.some((companyName) => personMatches(person, companyName)));
  if (matchedPerson) {
    score += 25;
    reasons.push(`nome de ${matchedPerson} na razão social ou no quadro de sócios`);
  }

  if (instagramHits(row.instagram, company)) {
    score += 10;
    reasons.push("Instagram contém um termo da razão social ou do nome fantasia");
  }

  if (isInactiveRegistration(company.situacaoCadastral)) {
    score -= 40;
    divergences.push(`Situação cadastral ${company.situacaoCadastral}.`);
  }

  return { company, score: Math.min(100, Math.max(0, score)), reasons, divergences };
}

function personMatches(person: string, companyName: string): boolean {
  const personTokens = normalizeText(person).split(" ").filter((token) => token.length >= 4 && !NAME_PARTICLES.has(token));
  const surname = personTokens[personTokens.length - 1];
  const companyTokens = new Set(normalizeText(companyName).split(" "));
  if (surname && companyTokens.has(surname)) return true;
  return tokenSetScore(person, companyName, new Set()) >= 80;
}

function tokenSetScore(left: string, right: string, ignored: Set<string> = GENERIC_WORDS): number {
  const a = distinctiveTokens(left, ignored);
  const b = distinctiveTokens(right, ignored);
  if (a.length === 0 || b.length === 0) return 0;
  const bSet = new Set(b);
  const shared = [...new Set(a.filter((token) => bSet.has(token)))].sort();
  if (shared.length === 0) return 0;
  const aOnly = a.filter((token) => !bSet.has(token)).sort();
  const aSet = new Set(a);
  const bOnly = b.filter((token) => !aSet.has(token)).sort();
  const intersection = shared.join(" ");
  const leftSide = [intersection, aOnly.join(" ")].filter(Boolean).join(" ");
  const rightSide = [intersection, bOnly.join(" ")].filter(Boolean).join(" ");
  return Math.max(characterRatio(intersection, leftSide), characterRatio(intersection, rightSide), characterRatio(leftSide, rightSide));
}

function distinctiveTokens(value: string, ignored: Set<string>): string[] {
  return normalizeText(value).split(" ").filter((token) => token.length > 1 && !ignored.has(token));
}

function characterRatio(left: string, right: string): number {
  if (left === right) return 100;
  if (left.length === 0 || right.length === 0) return 0;
  const distance = levenshtein(left, right);
  return Math.round((1 - distance / Math.max(left.length, right.length)) * 100);
}

function levenshtein(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  const first = rows[0];
  if (!first) return right.length;
  for (let column = 1; column <= right.length; column += 1) first[column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    const current = rows[row];
    const previous = rows[row - 1];
    if (!current || !previous) continue;
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min((previous[column] ?? 0) + 1, (current[column - 1] ?? 0) + 1, (previous[column - 1] ?? 0) + cost);
    }
  }
  return rows[left.length]?.[right.length] ?? Math.max(left.length, right.length);
}

function instagramHits(instagram: string | null, company: ReceitaCompany): boolean {
  if (!instagram) return false;
  const handle = normalizeText(instagram).replace(/ /g, "");
  const tokens = distinctiveTokens(`${company.razaoSocial} ${company.nomeFantasia ?? ""}`, GENERIC_WORDS).filter((token) => token.length >= 4);
  return tokens.some((token) => handle.includes(token));
}

function closestPhoneDivergence(sheetPhones: string[], receitaPhones: string[], genericPhones: Set<string>): { sheet: string; receita: string } | null {
  let best: { sheet: string; receita: string } | null = null;
  for (const sheet of sheetPhones) {
    if (genericPhones.has(sheet) || receitaPhones.includes(sheet)) continue;
    for (const receita of receitaPhones) {
      if (genericPhones.has(receita) || hamming(sheet, receita) !== 1) continue;
      best = { sheet, receita };
    }
  }
  return best;
}

function hamming(left: string, right: string): number {
  if (left.length !== right.length) return 99;
  return [...left].filter((character, index) => character !== right[index]).length;
}

function numericDistance(left: string, right: string): number {
  const leftNumber = Number.parseInt(left, 10);
  const rightNumber = Number.parseInt(right, 10);
  if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return 999;
  return Math.abs(leftNumber - rightNumber);
}

function streetLabel(street: string): string {
  return /^\d+$/.test(street) ? `Rua ${street}` : street;
}

function formatAddress(company: ReceitaCompany): string | null {
  const parts = [company.endereco.logradouro, company.endereco.numero, company.endereco.bairro, company.endereco.cep].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function buildJustification(best: Scored, confidence: Confidence): string {
  const evidence = best.reasons.filter((reason) => reason.startsWith("Endereço") || reason.startsWith("telefone") || reason.startsWith("Mesma rua"));
  const names = best.reasons.filter((reason) => !evidence.includes(reason));
  const sentences: string[] = [];
  if (evidence.length > 0) sentences.push(`${evidence.join(" e ")} batem`);
  if (names.length > 0) sentences.push(names.join("; "));
  if (sentences.length === 0) sentences.push("Os sinais encontrados ficaram abaixo do necessário.");
  if (!best.company.endereco.logradouro && !best.company.telefones.length) {
    sentences.push("A Receita não trouxe endereço nem telefone.");
  }
  sentences.push(...best.divergences);
  if (confidence === "NAO_ENCONTRADO") {
    sentences.push(`O CNPJ ${best.company.cnpj} não foi aceito porque a situação não está ativa.`);
  }
  const text = sentences.join(". ").replace("batem.", "batem.");
  return text.endsWith(".") ? text : `${text}.`;
}

function toAlternative(item: Scored): MatchAlternative {
  return {
    cnpj: item.company.cnpj,
    razaoSocial: item.company.razaoSocial,
    nomeFantasia: item.company.nomeFantasia,
    situacaoCadastral: item.company.situacaoCadastral,
    endereco: formatAddress(item.company),
    telefones: item.company.telefones,
    score: item.score,
    motivo: [...item.reasons, ...item.divergences].join(". "),
  };
}

function emptyOutcome(justification: string): MatchOutcome {
  return {
    confidence: "NAO_ENCONTRADO",
    score: 0,
    cnpj: null,
    razaoSocial: null,
    nomeFantasia: null,
    situacaoCadastral: null,
    enderecoReceita: null,
    telefonesReceita: [],
    justification,
    alternatives: [],
  };
}
