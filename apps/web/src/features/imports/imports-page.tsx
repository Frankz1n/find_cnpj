import { Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { readSheet } from "read-excel-file/browser";
import { PageHeader } from "../../components/page-header";
import { apiSend, type EnrichmentJob } from "../enrichment/api";
import { buildImportRows, readDelimitedTable, readFileText } from "../enrichment/sheet";

export function ImportsPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function receiveFile(file: File | undefined) {
    if (!file) return;
    const extension = file.name.toLowerCase();
    const isCsv = extension.endsWith(".csv") || extension.endsWith(".tsv") || file.type === "text/csv" || file.type === "text/plain";
    const isWorkbook = extension.endsWith(".xlsx");
    if (!isCsv && !isWorkbook) {
      setMessage("Envie um CSV, TSV ou uma planilha .xlsx.");
      return;
    }

    setMessage(null);
    setStatus(`Lendo ${file.name}...`);
    const table = isWorkbook
      ? (await readSheet(file)).map((row) => row.map((cell) => (cell == null ? "" : String(cell))))
      : readDelimitedTable(await readFileText(file));
    const built = buildImportRows(table);
    if (!built.ok) {
      setStatus(null);
      setMessage(built.message);
      return;
    }

    setStatus(`Pesquisando ${built.rows.length} linhas...`);
    try {
      const job = await apiSend<EnrichmentJob>("/api/enrichment/jobs", {
        fileName: file.name,
        defaultState: built.defaultState,
        rows: built.rows,
      });
      navigate(`/pesquisa/${job.id}`);
    } catch (error) {
      setStatus(null);
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a pesquisa.");
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void receiveFile(event.dataTransfer.files[0]);
  }

  return (
    <section>
      <PageHeader title="Importação" subtitle="Solte a ficha. O sistema reconhece nome, endereço, cidade, telefone e especialidade e começa a pesquisa." />
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
        className={`mt-8 flex cursor-pointer flex-col items-center rounded-3xl border border-dashed px-6 py-16 text-center transition ${
          isDragging ? "border-[#547be2] bg-[#eef2fc]" : "border-[#d5deea] bg-[#f6f8fc] hover:border-[#547be2]"
        }`}
      >
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-[#547be2] shadow-[0_8px_24px_rgba(84,123,226,0.12)]">
          <Upload size={24} />
        </span>
        <p className="mt-4 text-base font-medium text-[#1d2433]">Arraste a lista para cá</p>
        <p className="mt-2 text-sm text-[#98a2b3]">CSV, TSV ou .xlsx. A pesquisa começa sozinha.</p>
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
      {status ? <p className="mt-4 text-sm text-[#667085]">{status}</p> : null}
      {message ? <p className="mt-4 text-sm text-[#b42318]">{message}</p> : null}
    </section>
  );
}
