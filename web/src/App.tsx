import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { T } from "./theme";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { AuthPage } from "./pages/AuthPage";
import { LandingPage } from "./pages/LandingPage";
import { IntakePage } from "./pages/IntakePage";
import { ResultPage } from "./pages/ResultPage";
import { HistoryPage } from "./pages/HistoryPage";

function Splash() {
  return (
    <div style={{ minHeight: "100vh", background: T.navy, display: "flex", alignItems: "center", justifyContent: "center", color: T.dim, fontFamily: "Inter,system-ui,sans-serif" }}>
      Loading NdMED…
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  return user ? <LandingPage /> : <SubscriptionPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/plans" element={<SubscriptionPage />} />
          <Route path="/consult" element={<Protected><IntakePage /></Protected>} />
          <Route path="/result/:id" element={<Protected><ResultPage /></Protected>} />
          <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
