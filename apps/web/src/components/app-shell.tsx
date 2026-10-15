import { Cable, FileSpreadsheet, History, LayoutGrid, Search, type LucideIcon } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";

const navigation: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: "/", label: "Painel", icon: LayoutGrid, end: true },
  { to: "/pesquisa", label: "Pesquisa", icon: Search },
  { to: "/importacao", label: "Importação", icon: FileSpreadsheet },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/integracoes", label: "Integrações", icon: Cable },
];

export function AppShell() {
  return (
    <div className="flex h-dvh overflow-hidden bg-white">
      <aside className="relative z-20 flex h-full w-[240px] shrink-0 flex-col overflow-hidden bg-[#547be2] px-4 py-8 text-white">
        <Link to="/" className="block px-3">
          <img src="/aguia-logo.png" alt="Águia" className="h-12 w-auto max-w-full" />
        </Link>
        <nav className="mt-10 flex flex-col gap-1" aria-label="Seções">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex max-w-full items-center gap-3 rounded-full px-4 py-3 text-sm font-medium",
                  isActive ? "bg-white text-[#547be2]" : "text-white hover:bg-white/15",
                ].join(" ")
              }
            >
              <item.icon size={18} className="shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-auto px-4 text-xs text-white/70">Enriquecimento de CNPJ</p>
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-8 lg:px-12">
        <Outlet />
      </div>
    </div>
  );
}
