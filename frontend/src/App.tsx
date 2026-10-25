import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import SigningDemo from "@/pages/SigningDemo";
import HistoryPage from "@/pages/HistoryPage";
import SettingsPage from "@/pages/SettingsPage";
import Portfolio from "@/pages/Portfolio";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      {/* Skip link for keyboard / screen-reader users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-cyan focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950"
      >
        Skip to content
      </a>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route element={<AppLayout />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/signing" element={<SigningDemo />} />
          <Route path="/app/portfolio" element={<Portfolio />} />
          <Route path="/app/history" element={<HistoryPage />} />
          <Route path="/app/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
