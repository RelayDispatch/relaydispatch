import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth.tsx";
import { ToastProvider } from "./components/dashboard/Toast";
import { Loader2 } from "lucide-react";

import LandingPage from "./pages/LandingPage";
import DashboardApp from "./pages/DashboardApp";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

// ── Theme switcher: sets body class based on current route ──
function ThemeSwitcher() {
  const location = useLocation();

  useEffect(() => {
    const isLanding = ['/', '', '/privacy', '/terms'].includes(location.pathname);
    document.body.classList.toggle("page-landing", isLanding);
    document.body.classList.toggle("page-dashboard", !isLanding);
  }, [location.pathname]);

  return null;
}

// ── Protected Route: redirects to /login if not authenticated ────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-void text-text-primary flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-accent-primary" size={32} />
        <span className="text-xs font-mono tracking-widest text-text-secondary mt-4 uppercase">Syncing Security Core...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <ThemeSwitcher />
          <Routes>
            {/* Public — Landing Page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />

            {/* Auth Pages */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected — Dashboard (and all sub-routes) */}
            <Route
              path="/dashboard/*"
              element={
                <ProtectedRoute>
                  <DashboardApp />
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
