import type { IntegrationStatus } from "../features/integrations/integration-catalog";
import { integrationStatusLabels } from "../features/integrations/integration-catalog";

const dotColors: Record<IntegrationStatus, string> = {
  inactive: "bg-[#98a2b3]",
  available: "bg-[#12b76a]",
  unavailable: "bg-[#f04438]",
};

type StatusTextProps = {
  status: IntegrationStatus;
  inverted?: boolean;
};

export function StatusText({ status, inverted = false }: StatusTextProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${inverted ? "text-white" : "text-[#667085]"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${inverted ? "bg-white" : dotColors[status]}`} />
      {integrationStatusLabels[status]}
    </span>
  );
}
