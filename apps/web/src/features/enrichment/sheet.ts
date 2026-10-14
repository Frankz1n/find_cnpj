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
  name: /nome|clinica|empresa|fantasia/,
  landline: /fixo|telefone|fone|tel/,
  mobile: /celular|whats|zap|movel/,
  instagram: /insta/,
  professionals: /respons|profissional|\brt\b|dentista|medico/,
  specialty: /especial|tipo|segmento/,
  address: /endereco|logradouro|rua/,
  city: /cidade|municipio/,
  state: /\buf\b|estado/,
};

export function readDelimitedTable(contents: string): string[][] {
  const lines = contents.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter = detectDelimiter(lines[0] ?? "");
  return lines.map((line) => splitLine(line, delimiter).map((cell) => cell.trim()));
}

export function guessColumns(headers: string[]): Partial<Record<SheetColumn, number>> {
  const normalized = headers.map((header) => header.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase());
  const used = new Set<number>();
  const mapping: Partial<Record<SheetColumn, number>> = {};
  for (const field of SHEET_FIELDS) {
    const index = normalized.findIndex((header, column) => !used.has(column) && FIELD_HINTS[field.id].test(header));
    if (index >= 0) {
      mapping[field.id] = index;
      used.add(index);
    }
  }
  return mapping;
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
