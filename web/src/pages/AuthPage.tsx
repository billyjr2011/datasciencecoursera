import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../api/client";
import { T } from "../theme";
import { wrapStyle, panelStyle, Chip } from "../components/ui";
import type { PlanId } from "../types";

export function AuthPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const planParam = (params.get("plan") as PlanId) || "free";
  const { login, register } = useAuth();

  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "register") await register({ email, password, name: name || undefined, plan: planParam });
      else await login(email, password);
      nav("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const input = { width: "100%", padding: "11px 14px", borderRadius: 9, fontSize: 13, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(0,201,177,0.25)", color: T.white, outline: "none", marginBottom: 10 } as const;

  return (
    <div style={wrapStyle}>
      <div style={{ ...panelStyle, maxWidth: 420 }} className="fu">
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "linear-gradient(135deg,#00C9B1,#009E8D)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px", fontSize: 20 }}>⚕️</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: T.white, marginBottom: 4 }}>NdMED</h1>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: T.dim }}>{mode === "register" ? "Create your account" : "Welcome back"}</span>
            {mode === "register" && <Chip text={planParam} color={T.teal} />}
          </div>
        </div>

        <form onSubmit={submit}>
          {mode === "register" && (
            <input style={input} placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
          )}
          <input style={input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input style={input} type="password" placeholder="Password (min 8 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />

          {error && <div style={{ background: "rgba(232,57,74,0.08)", border: "1px solid rgba(232,57,74,0.25)", borderRadius: 8, padding: "8px 11px", fontSize: 11, color: "#f8a8ae", marginBottom: 10 }}>{error}</div>}

          <button type="submit" disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 9, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#00C9B1,#009E8D)", color: T.navy, border: "none", cursor: busy ? "wait" : "pointer", marginBottom: 10 }}>
            {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
          </button>
        </form>

        <button onClick={() => setMode(mode === "register" ? "login" : "register")} style={{ width: "100%", padding: "9px", borderRadius: 9, fontSize: 11, background: "transparent", border: "1px solid rgba(255,255,255,0.07)", color: T.dim, cursor: "pointer" }}>
          {mode === "register" ? "Already have an account? Sign in" : "Need an account? Register"}
        </button>
      </div>
    </div>
  );
}
