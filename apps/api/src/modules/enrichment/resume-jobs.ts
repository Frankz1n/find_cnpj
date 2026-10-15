import type { EnrichmentServices } from "./enrichment.routes.js";
import { runEnrichmentJob } from "./run-job.js";

export async function resumeRunningJobs(services: EnrichmentServices): Promise<void> {
  for (const job of services.store.listJobs()) {
    if (job.status !== "running") continue;
    const sheet = services.store.readSheet(job.id);
    if (!sheet) continue;
    const done = new Set(services.store.listResults(job.id).map((result) => result.line.line));
    const pending = sheet.rows.filter((row) => !done.has(row.line));
    if (pending.length === 0) {
      services.store.updateJob(job.id, { status: "succeeded", processed: done.size, finishedAt: new Date().toISOString() });
      continue;
    }
    await runEnrichmentJob({
      store: services.store,
      apify: services.apify,
      ibge: services.ibge,
      brasilApi: services.brasilApi,
      jobId: job.id,
      rows: pending,
      defaultState: sheet.defaultState,
      initialProcessed: done.size,
    });
  }
}
