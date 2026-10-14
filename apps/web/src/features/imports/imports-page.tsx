import { Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { readSheet } from "read-excel-file/browser";
import { PageHeader } from "../../components/page-header";
import { apiSend, type EnrichmentJob } from "../enrichment/api";
import { SHEET_FIELDS, cellValue, guessColumns, readDelimitedTable, readFileText, type SheetColumn } from "../enrichment/sheet";

const STATES = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

export function ImportsPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<SheetColumn, number>>>({});
  const [defaultState, setDefaultState] = useState("SP");

  const headers = table[0] ?? [];
  const dataRows = table.slice(1);

  async function receiveFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase();
    const isCsv = extension.endsWith(".csv") || extension.endsWith(".tsv") || file.type === "text/csv" || file.type === "text/plain";
    const isWorkbook = extension.endsWith(".xlsx");
    if (!isCsv && !isWorkbook) {
      setMessage("Envie um CSV, TSV ou uma planilha .xlsx.");
      return;
    }
    const rows = isWorkbook ? (await readSheet(file)).map((row) => row.map((cell) => (cell == null ? "" : String(cell)))) : readDelimitedTable(await readFileText(file));
    if (rows.length < 2) {
      setMessage("O arquivo não tem registros.");
      setTable([]);
      return;
    }
    setMessage(null);
    setFileName(file.name);
    setTable(rows);
    setMapping(guessColumns(rows[0] ?? []));
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void receiveFile(event.dataTransfer.files[0]);
  }

  async function startEnrichment() {
    if (!fileName || dataRows.length === 0) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const job = await apiSend<EnrichmentJob>("/api/enrichment/jobs", {
        fileName,
        defaultState,
        rows: dataRows.map((row, index) => ({
          line: index + 2,
          name: mapped(row, "name"),
          landline: mapped(row, "landline"),
          mobile: mapped(row, "mobile"),
          instagram: mapped(row, "instagram"),
          professionals: mapped(row, "professionals"),
          specialty: mapped(row, "specialty"),
          address: mapped(row, "address"),
          city: mapped(row, "city"),
          state: mapped(row, "state"),
        })),
      });
      navigate(`/pesquisa/${job.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar o enriquecimento.");
      setIsSubmitting(false);
    }
  }

  function mapped(row: string[], field: SheetColumn): string | null {
    const index = mapping[field];
    return index === undefined ? null : cellValue(row[index]);
  }

  return (
    <section>
      <PageHeader title="Importação" subtitle="A planilha entra por cidade e especialidade. O CNPJ sai do cruzamento com a Receita, não da busca pelo nome." />
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`mt-8 flex cursor-pointer flex-col items-center rounded-3xl border border-dashed px-6 py-14 text-center ${
          isDragging ? "border-[#547be2] bg-[#e7ecfb]" : "border-[#d5deea] bg-[#f5f7fb]"
        }`}
      >
        <Upload className="text-[#547be2]" size={28} />
        <p className="mt-4 text-base font-medium text-[#1d2433]">Arraste a lista para cá</p>
        <p className="mt-2 text-sm text-[#98a2b3]">CSV, TSV ou .xlsx. UTF-8 e Latin-1.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.xlsx,text/csv,text/tab-separated-values"
          className="sr-only"
          onChange={(event) => {
            void receiveFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
      {message ? <p className="mt-4 text-sm text-[#b42318]">{message}</p> : null}

      {fileName && headers.length > 0 ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[#1d2433]">{fileName}</h2>
          <p className="mt-1 text-sm text-[#98a2b3]">{dataRows.length} linhas. Confira o mapeamento antes de enriquecer.</p>
          <label className="mt-6 block text-sm text-[#667085]">
            UF padrão, usada quando a linha não tiver estado
            <select value={defaultState} onChange={(event) => setDefaultState(event.target.value)} className="mt-2 block rounded-2xl border border-[#d5deea] bg-white px-4 py-3 text-[#1d2433]">
              {STATES.map((state) => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </label>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SHEET_FIELDS.map((field) => (
              <label key={field.id} className="text-sm text-[#667085]">
                {field.label}
                <select
                  value={mapping[field.id] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setMapping((current) => ({ ...current, [field.id]: value === "" ? undefined : Number(value) }));
                  }}
                  className="mt-2 block w-full rounded-2xl border border-[#d5deea] bg-white px-4 py-3 text-[#1d2433]"
                >
                  <option value="">Não usar</option>
                  {headers.map((header, index) => (
                    <option key={`${header}-${index}`} value={index}>{header || `Coluna ${index + 1}`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={isSubmitting || mapping.city === undefined || mapping.address === undefined}
            onClick={() => void startEnrichment()}
            className="mt-6 rounded-full bg-[#547be2] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Enviando..." : "Enriquecer CNPJs"}
          </button>
          {mapping.city === undefined || mapping.address === undefined ? (
            <p className="mt-3 text-sm text-[#98a2b3]">Mapeie cidade e endereço. O cruzamento usa a rua e o número.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
