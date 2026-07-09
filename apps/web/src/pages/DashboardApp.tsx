import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "../components/dashboard/Layout";
import { Overview } from "./dashboard/Overview";
import { Intake } from "./dashboard/Intake";
import { Jobs } from "./dashboard/Jobs";
import { Settings } from "./dashboard/Settings";
import { Clients } from "./dashboard/Clients";
import { Calls } from "./dashboard/Calls";

export default function DashboardApp() {
  return (
    <Layout>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="intake" element={<Intake />} />
        <Route path="jobs" element={<Jobs />} />
        <Route path="clients" element={<Clients />} />
        <Route path="calls" element={<Calls />} />
        <Route path="settings" element={<Settings />} />
        {/* Catch-all within dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
