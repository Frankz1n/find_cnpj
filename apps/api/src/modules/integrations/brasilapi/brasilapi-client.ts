import { mapBrasilApiCompany, type BrasilApiCompany } from "./brasilapi-mapper.js";

const CACHE_TTL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const USER_AGENT = "OrbytsCompanyFinder/0.1";

export const BRASILAPI_SOURCE_URL = "https://brasilapi.com.br/docs";
export const BRASILAPI_NOT_FOUND_MESSAGE = "CNPJ não encontrado na Brasil API.";
export const BRASILAPI_RATE_LIMIT_MESSAGE = "A Brasil API limitou as requisições. A validação parou sem nova tentativa.";
export const BRASILAPI_FORMAT_MESSAGE = "A Brasil API devolveu um formato inesperado.";
export const BRASILAPI_NETWORK_MESSAGE = "Não foi possível consultar a Brasil API.";
export const BRASILAPI_TIMEOUT_MESSAGE = "A Brasil API não respondeu a tempo.";

export type BrasilApiLookup =
  | { status: "confirmed"; company: BrasilApiCompany }
  | { status: "not_found" }
  | { status: "failed"; message: string }
  | { status: "rate_limited"; message: string };

export type BrasilApiGateway = {
  lookup(cnpj: string): Promise<BrasilApiLookup>;
};

type BrasilApiGatewayOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  cacheTtlMs?: number;
};

type CacheEntry = { expiresAt: number; value: BrasilApiLookup };

export function createBrasilApiGateway(options: BrasilApiGatewayOptions): BrasilApiGateway {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const cache = new Map<string, CacheEntry>();
  const ttlMs = options.cacheTtlMs ?? CACHE_TTL_MS;

  return {
    async lookup(cnpj) {
      const cached = readCache(cache, cnpj, now);
      if (cached) return cached;

      const url = `${baseUrl}/api/cnpj/v1/${cnpj}`;
      try {
        const response = await fetchImpl(url, {
          headers: { accept: "application/json", "user-agent": USER_AGENT },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (response.status === 429) return { status: "rate_limited", message: BRASILAPI_RATE_LIMIT_MESSAGE };
        if (response.status === 404) {
          const missing: BrasilApiLookup = { status: "not_found" };
          writeCache(cache, cnpj, missing, now, ttlMs);
          return missing;
        }

        const text = (await response.text()).trim();
        if (!response.ok) return { status: "failed", message: `A Brasil API respondeu com status ${response.status}.` };
        if (!text.startsWith("{")) return { status: "failed", message: BRASILAPI_FORMAT_MESSAGE };

        const company = mapBrasilApiCompany(JSON.parse(text));
        if (!company?.cnpj) return { status: "failed", message: BRASILAPI_FORMAT_MESSAGE };

        const confirmed: BrasilApiLookup = { status: "confirmed", company };
        writeCache(cache, cnpj, confirmed, now, ttlMs);
        return confirmed;
      } catch (error) {
        if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
          return { status: "failed", message: BRASILAPI_TIMEOUT_MESSAGE };
        }
        if (error instanceof SyntaxError) return { status: "failed", message: BRASILAPI_FORMAT_MESSAGE };
        return { status: "failed", message: BRASILAPI_NETWORK_MESSAGE };
      }
    },
  };
}

function readCache(cache: Map<string, CacheEntry>, key: string, now: () => number): BrasilApiLookup | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache(cache: Map<string, CacheEntry>, key: string, value: BrasilApiLookup, now: () => number, ttlMs: number): void {
  cache.set(key, { expiresAt: now() + ttlMs, value });
}
