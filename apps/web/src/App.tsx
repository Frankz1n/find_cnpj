import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { CompaniesPage } from "./features/companies/companies-page";
import { DashboardPage } from "./features/dashboard/dashboard-page";
import { ReviewPage } from "./features/enrichment/review-page";
import { HistoryPage } from "./features/history/history-page";
import { ImportsPage } from "./features/imports/imports-page";
import { IntegrationsPage } from "./features/integrations/integrations-page";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="pesquisa" element={<ReviewPage />} />
          <Route path="pesquisa/:jobId" element={<ReviewPage />} />
          <Route path="empresas" element={<CompaniesPage />} />
          <Route path="importacao" element={<ImportsPage />} />
          <Route path="historico" element={<HistoryPage />} />
          <Route path="integracoes" element={<IntegrationsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
