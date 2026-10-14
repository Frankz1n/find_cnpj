const STREET_PREFIXES = new Set(["RUA", "R", "AV", "AVENIDA", "AL", "ALAMEDA", "TRAVESSA", "TV", "PRACA", "ESTRADA", "ROD"]);
const NAME_PREFIXES = new Set(["RT", "DR", "DRA", "DOUTOR", "DOUTORA"]);
const UNIT_WORDS: Record<string, number> = {
  UM: 1,
  UMA: 1,
  DOIS: 2,
  DUAS: 2,
  TRES: 3,
  QUATRO: 4,
  CINCO: 5,
  SEIS: 6,
  SETE: 7,
  OITO: 8,
  NOVE: 9,
  DEZ: 10,
  ONZE: 11,
  DOZE: 12,
  TREZE: 13,
  CATORZE: 14,
  QUATORZE: 14,
  QUINZE: 15,
  DEZESSEIS: 16,
  DEZESSETE: 17,
  DEZOITO: 18,
  DEZENOVE: 19,
};
const TEN_WORDS: Record<string, number> = {
  VINTE: 20,
  TRINTA: 30,
  QUARENTA: 40,
  CINQUENTA: 50,
};

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeStreet(value: string): string {
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  if (tokens[0] && STREET_PREFIXES.has(tokens[0])) tokens.shift();
  const converted: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    const ten = TEN_WORDS[token];
    const connector = tokens[index + 1];
    const unitWord = tokens[index + 2];
    const unit = unitWord ? UNIT_WORDS[unitWord] : undefined;
    if (ten !== undefined && connector === "E" && unit !== undefined && unit < 10) {
      converted.push(String(ten + unit));
      index += 2;
      continue;
    }
    if (ten !== undefined) {
      converted.push(String(ten));
      continue;
    }
    const single = UNIT_WORDS[token];
    converted.push(single !== undefined ? String(single) : stripLeadingZeros(token));
  }

  return converted.join(" ");
}

export function normalizeNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = value.replace(/\./g, "").match(/(\d+)([A-Za-z])?/);
  if (!match?.[1]) return null;
  return `${match[1].replace(/^0+(?=\d)/, "")}${match[2]?.toUpperCase() ?? ""}`;
}

export function parseAddress(value: string | null | undefined): { street: string | null; number: string | null; cep: string | null } {
  if (!value || value.trim() === "." || value.trim() === "") return { street: null, number: null, cep: null };
  const cepMatch = value.match(/\d{5}-?\d{3}/);
  const comma = value.indexOf(",");
  const streetPart = comma >= 0 ? value.slice(0, comma) : value;
  const afterComma = comma >= 0 ? value.slice(comma + 1) : "";
  const numberMatch = afterComma.match(/(\d{1,3}(?:\.\d{3})+|\d+)([A-Za-z])?/);
  const rawNumber = numberMatch ? `${numberMatch[1] ?? ""}${numberMatch[2] ?? ""}` : null;
  const street = normalizeStreet(streetPart);
  return {
    street: street || null,
    number: normalizeNumber(rawNumber),
    cep: cepMatch?.[0]?.replace(/\D/g, "") ?? null,
  };
}

export function phoneKey(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits.slice(-8);
}

export function formatPhoneKey(key: string): string {
  return `${key.slice(0, 4)}-${key.slice(4)}`;
}

export function extractProfessionals(value: string | null | undefined): string[] {
  if (!value || value.trim() === "." ) return [];
  return value
    .split(",")
    .map((part) => {
      const tokens = normalizeText(part).split(" ").filter((token) => !NAME_PREFIXES.has(token));
      return tokens.join(" ");
    })
    .filter((name) => name.length > 0);
}

export function blankToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed === ".") return null;
  return trimmed;
}

function stripLeadingZeros(token: string): string {
  if (!/^\d+$/.test(token)) return token;
  return token.replace(/^0+(?=\d)/, "");
}
