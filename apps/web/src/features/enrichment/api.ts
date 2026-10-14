export type Confidence = "ALTA" | "MEDIA" | "BAIXA" | "NAO_ENCONTRADO";

export type SheetPayload = {
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

export type Alternative = {
  cnpj: string;
  razaoSocial: string;
  score: number;
  motivo: string;
};

export type EnrichmentResult = {
  id: string;
  jobId: string;
  line: SheetPayload;
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  situacaoCadastral: string | null;
  enderecoReceita: string | null;
  telefonesReceita: string[];
  confidence: Confidence;
  score: number;
  justification: string;
  alternatives: Alternative[];
  decision: "aceito" | "sem_cnpj" | null;
  brasilApi: { status: string; message: string | null } | null;
};

export type EnrichmentJob = {
  id: string;
  fileName: string;
  status: "running" | "succeeded" | "failed";
  total: number;
  processed: number;
  estimatedCostUsd: number;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
};

export const confidenceLabels: Record<Confidence, string> = {
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
  NAO_ENCONTRADO: "Não encontrado",
};

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "A API recusou a consulta.");
  return body.data as T;
}

export async function apiSend<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "A API recusou a consulta.");
  return body.data as T;
}
