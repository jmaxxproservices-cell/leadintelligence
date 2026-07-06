import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import {
  DashboardPage,
  OperationsDashboardPage,
  LeadsPage,
  LeadDetailPage,
  PipelinePage,
  ActionCenterPage,
  ActivitiesPage,
  AnalyticsPage,
  SystemStatusPage,
  SettingsPage,
  ApiPage,
  LogsPage,
  WebsiteFormTestPage,
  ValidationPage,
  DeploymentPage,
} from './pages';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="operations" element={<OperationsDashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="actions" element={<ActionCenterPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="validation" element={<ValidationPage />} />
          <Route path="deployment" element={<DeploymentPage />} />
          <Route path="system" element={<SystemStatusPage />} />
          <Route path="website-integration" element={<WebsiteFormTestPage />} />
          <Route path="activities" element={<ActivitiesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="api" element={<ApiPage />} />
          <Route path="logs" element={<LogsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
