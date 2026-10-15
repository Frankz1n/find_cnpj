import type { ReactNode } from "react";

export type DataRow = {
  id: string;
  tone?: "plain" | "selected";
  cells: ReactNode[];
};

type DataTableProps = {
  columns: string[];
  template: string;
  rows: DataRow[];
};

export function DataTable({ columns, template, rows }: DataTableProps) {
  return (
    <div className="mt-7">
      <div className={`grid ${template} px-3`}>
        {columns.map((column) => (
          <div key={column} className="py-3 pr-2 text-[11px] font-medium text-[#98a2b3] sm:text-xs">
            {column}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row) => {
          const isSelected = row.tone === "selected";

          return (
            <div
              key={row.id}
              className={`grid ${template} items-center rounded-2xl border px-3 py-3 text-[13px] transition sm:px-4 sm:py-4 sm:text-sm ${
                isSelected
                  ? "border-[#547be2] bg-[#547be2] text-white shadow-[0_12px_28px_rgba(84,123,226,0.28)]"
                  : "border-[#e6ebf2] bg-white text-[#1d2433] hover:border-[#c5d2ee]"
              }`}
            >
              {row.cells.map((cell, index) => (
                <div key={`${row.id}-${index}`} className="min-w-0 break-words pr-3 leading-5">
                  {cell}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
