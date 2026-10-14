import type { ReactNode } from "react";

type EmptyRecordsProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyRecords({ title, description, action }: EmptyRecordsProps) {
  return (
    <div className="mt-7 rounded-2xl bg-[#f5f7fb] px-6 py-16 text-center">
      <p className="text-sm font-medium text-[#1d2433]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#98a2b3]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
