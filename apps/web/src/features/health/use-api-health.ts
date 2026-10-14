import { useEffect, useState } from "react";

type HealthState =
  | { status: "loading" }
  | { status: "ok"; service: string; environment: string; checkedAt: string }
  | { status: "error"; message: string };

function isHealthPayload(value: unknown): value is { service: string; environment: string; timestamp: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.status === "ok" && typeof record.service === "string" && typeof record.environment === "string" && typeof record.timestamp === "string";
}

function formatCheckedAt(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleString("pt-BR");
}

export function useApiHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    async function loadHealth(): Promise<void> {
      try {
        const response = await fetch("/health", { signal: controller.signal });
        if (!response.ok) {
          setState({ status: "error", message: "A API respondeu com falha." });
          return;
        }

        const payload: unknown = await response.json();
        if (!isHealthPayload(payload)) {
          setState({ status: "error", message: "A API retornou um formato inesperado." });
          return;
        }

        setState({
          status: "ok",
          service: payload.service,
          environment: payload.environment,
          checkedAt: formatCheckedAt(payload.timestamp),
        });
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setState({ status: "error", message: "Não foi possível conectar à API." });
      }
    }

    void loadHealth();
    return () => controller.abort();
  }, []);

  return state;
}
