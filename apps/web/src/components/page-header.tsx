import { Bell, Building2, FileSpreadsheet } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

type PageHeaderProps = {
  title: string;
  subtitle: string;
};

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1d2433] sm:text-[28px]">{title}</h1>
        <p className="mt-1 text-sm text-[#98a2b3]">{subtitle}</p>
      </div>
      <Toolbar />
    </header>
  );
}

function Toolbar() {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-1">
      <div className="relative">
        <IconButton
          label="Notificações"
          pressed={isNotificationOpen}
          onClick={() => setIsNotificationOpen((current) => !current)}
        >
          <Bell size={18} />
        </IconButton>
        {isNotificationOpen ? (
          <p className="absolute right-0 z-30 mt-2 w-60 rounded-2xl bg-white px-4 py-3 text-sm text-[#667085] shadow-[0_16px_40px_rgba(29,36,51,0.12)]">
            Nenhuma notificação por enquanto.
          </p>
        ) : null}
      </div>
      <Link
        to="/importacao"
        aria-label="Nova importação"
        className="grid h-10 w-10 place-items-center rounded-full text-[#98a2b3] hover:bg-[#f4f7fb] hover:text-[#1d2433]"
      >
        <FileSpreadsheet size={18} />
      </Link>
      <div
        className="ml-1 grid h-10 w-10 place-items-center rounded-full bg-[#e7ecfb] text-[#547be2]"
        aria-label="Ambiente local"
        title="Ambiente local"
      >
        <Building2 size={18} />
      </div>
    </div>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={pressed}
      onClick={onClick}
      className="grid h-10 w-10 place-items-center rounded-full text-[#98a2b3] hover:bg-[#f4f7fb] hover:text-[#1d2433]"
    >
      {children}
    </button>
  );
}
