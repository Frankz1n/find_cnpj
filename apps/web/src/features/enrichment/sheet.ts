export type SheetColumn =
  | "name"
  | "landline"
  | "mobile"
  | "instagram"
  | "professionals"
  | "specialty"
  | "address"
  | "city"
  | "state";

export const SHEET_FIELDS: Array<{ id: SheetColumn; label: string }> = [
  { id: "name", label: "Nome" },
  { id: "landline", label: "Telefone fixo" },
  { id: "mobile", label: "Celular" },
  { id: "instagram", label: "Instagram" },
  { id: "professionals", label: "Responsável / profissionais" },
  { id: "specialty", label: "Especialidade" },
  { id: "address", label: "Endereço" },
  { id: "city", label: "Cidade" },
  { id: "state", label: "UF" },
];

const FIELD_HINTS: Record<SheetColumn, RegExp> = {
  name: /estabelecimento|ponto|fantasia|empresa|clinica|\bnome\b/,
  landline: /fixo|\btelefone\b|\bfone\b|\btel\b/,
  mobile: /celular|whats|zap|movel/,
  instagram: /insta/,
  professionals: /profissional|responsavel|\brt\b|dentista|medico/,
  specialty: /especialidade|segmento/,
  address: /endereco|logradouro|\brua\b/,
  city: /cidade|municipio/,
  state: /\buf\b|estado/,
};

const BRAZILIAN_STATES = "AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO";
const STATE_PATTERN = new RegExp(`(?:^|[\\s,-])(${BRAZILIAN_STATES})(?:$|[\\s,-])`, "i");

export type BuiltImport =
  | { ok: true; defaultState: string; rows: ImportRow[] }
  | { ok: false; message: string };

export type ImportRow = {
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

export function readDelimitedTable(contents: string): string[][] {
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0] ?? "");
  return lines.map((line) => splitLine(line, delimiter).map((cell) => cell.trim()));
}

export function guessColumns(headers: string[], rows: string[][] = []): Partial<Record<SheetColumn, number>> {
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();
  const mapping: Partial<Record<SheetColumn, number>> = {};
  for (const field of SHEET_FIELDS) {
    const index = normalized.findIndex((header, column) => !used.has(column) && headerMatches(field.id, header));
    if (index >= 0) {
      mapping[field.id] = index;
      used.add(index);
    }
  }
  if (mapping.city === undefined) {
    const detected = detectCityColumn(normalized, rows, used);
    if (detected !== undefined) {
      mapping.city = detected;
      used.add(detected);
    }
  }
  return mapping;
}

export function instagramFromRow(headers: string[], row: string[]): string | null {
  const handles = headers.flatMap((header, index) => {
    if (!/insta/.test(normalizeHeader(header))) return [];
    const value = cellValue(row[index]);
    return value ? [value] : [];
  });
  return handles.length > 0 ? handles.join(" ") : null;
}

export function buildImportRows(table: string[][]): BuiltImport {
  const headers = table[0] ?? [];
  const dataRows = table.slice(1);
  if (headers.length === 0 || dataRows.length === 0) return { ok: false, message: "O arquivo não tem registros." };

  const mapping = guessColumns(headers, dataRows);
  if (mapping.address === undefined) return { ok: false, message: "Não encontrei a coluna de endereço." };

  const rows = dataRows.flatMap((row, index) => {
    const address = cellValue(row[mapping.address ?? -1]);
    const located = cityAndStateFromAddress(address);
    const city = cellValue(mapping.city === undefined ? undefined : row[mapping.city]) ?? located.city;
    const name = cellValue(mapping.name === undefined ? undefined : row[mapping.name]);
    if (!name && !address) return [];
    return [{
      line: index + 2,
      name,
      landline: cellValue(mapping.landline === undefined ? undefined : row[mapping.landline]),
      mobile: cellValue(mapping.mobile === undefined ? undefined : row[mapping.mobile]),
      instagram: instagramFromRow(headers, row),
      professionals: cellValue(mapping.professionals === undefined ? undefined : row[mapping.professionals]),
      specialty: cellValue(mapping.specialty === undefined ? undefined : row[mapping.specialty]),
      address,
      city,
      state: located.state ?? cellValue(mapping.state === undefined ? undefined : row[mapping.state]),
    }];
  });

  const withCity = rows.filter((row) => row.city);
  if (withCity.length === 0) return { ok: false, message: "Não encontrei a cidade das linhas." };

  const states = rows.flatMap((row) => (row.state ? [row.state] : []));
  const defaultState = mostCommon(states) ?? "SP";
  return { ok: true, defaultState, rows };
}

function headerMatches(field: SheetColumn, header: string): boolean {
  if (field === "name") {
    if (/secretaria|profissional|responsavel|^tipo\b/.test(header)) return false;
    return /nome|estabelecimento|ponto|fantasia|empresa|clinica/.test(header);
  }
  if (field === "professionals" && /insta|secretaria/.test(header)) return false;
  if (field === "landline" && /whats|celular|zap/.test(header)) return false;
  return FIELD_HINTS[field].test(header);
}

function cityAndStateFromAddress(address: string | null): { city: string | null; state: string | null } {
  if (!address) return { city: null, state: null };
  const stateMatch = address.match(STATE_PATTERN);
  const state = stateMatch?.[1]?.toUpperCase() ?? null;
  if (!stateMatch || stateMatch.index === undefined) return { city: null, state };
  const beforeState = address.slice(0, stateMatch.index);
  const segment = (beforeState.split(",").pop() ?? beforeState).replace(/[-–]\s*$/, "").trim();
  const city = /^(centro|bairro)$/i.test(segment) || looksLikeStreet(segment) ? null : segment;
  return { city: city || null, state };
}

function mostCommon(values: string[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  return top?.[0] ?? null;
}

function detectCityColumn(headers: string[], rows: string[][], used: Set<number>): number | undefined {
  let bestIndex: number | undefined;
  let bestScore = 0;
  headers.forEach((header, index) => {
    if (used.has(index) || !/^coluna \d+$/.test(header)) return;
    const values = rows.flatMap((row) => {
      const value = cellValue(row[index]);
      return value && !looksLikeStreet(value) ? [normalizeHeader(value)] : [];
    });
    if (values.length < 3) return;
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    const repeated = [...counts.values()].filter((count) => count >= 2).reduce((total, count) => total + count, 0);
    const score = repeated / values.length;
    if (score >= 0.6 && score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestIndex;
}

function looksLikeStreet(value: string): boolean {
  return /^(rua|r|av|avenida|alameda|travessa|estrada|rodovia)\b/.test(normalizeHeader(value)) || /\d{3,}/.test(value);
}

function normalizeHeader(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function cellValue(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" || trimmed === "." ? null : trimmed;
}

export async function readFileText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  return utf8.includes("\uFFFD") ? new TextDecoder("iso-8859-1").decode(bytes) : utf8;
}

function detectDelimiter(line: string): string {
  const tab = count(line, "\t");
  const semicolon = count(line, ";");
  const comma = count(line, ",");
  if (tab > semicolon && tab > comma) return "\t";
  if (semicolon >= comma) return ";";
  return ",";
}

function count(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === delimiter && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += character ?? "";
  }
  cells.push(current);
  return cells;
}
