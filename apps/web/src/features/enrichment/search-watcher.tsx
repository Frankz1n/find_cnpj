import { useEffect, useState } from "react";
import { apiGet, type EnrichmentJob } from "./api";

const STORAGE_KEY = "orbyts.job-progress";

export function SearchWatcher() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;

    async function watch() {
      try {
        const jobs = await apiGet<EnrichmentJob[]>("/api/enrichment/jobs");
        if (stopped) return;
        const seen = readProgress();
        let foundMore = false;
        for (const job of jobs) {
          const previous = seen[job.id];
          if (previous === undefined) {
            seen[job.id] = job.processed;
            continue;
          }
          if (job.processed > previous) {
            seen[job.id] = job.processed;
            foundMore = true;
          }
        }
        writeProgress(seen);
        if (!foundMore) return;
        setMessage("Mais empresas encontradas");
        window.dispatchEvent(new Event("orbyts-results-updated"));
      } catch {
        return;
      }
    }

    void watch();
    const timer = window.setInterval(() => void watch(), 4000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <p className="fixed bottom-6 right-6 z-50 rounded-2xl bg-[#1d2433] px-4 py-3 text-sm text-white shadow-[0_16px_40px_rgba(29,36,51,0.24)]" role="status">
      <span className="block text-xs text-white/60">Pesquisa</span>
      {message}
    </p>
  );
}

function readProgress(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeProgress(progress: Record<string, number>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}
