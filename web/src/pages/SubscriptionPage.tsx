import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { T, SOURCES } from "../theme";
import { Dot, Chip } from "../components/ui";
import type { PlanDef, PlanId } from "../types";

export function SubscriptionPage() {
  const nav = useNavigate();
  const { user, setPlan } = useAuth();
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [hov, setHov] = useState<string | null>(null);

  useEffect(() => {
    api.plans().then((r) => setPlans(r.plans)).catch(() => setPlans([]));
  }, []);

  async function choose(id: PlanId) {
    if (user) {
      await setPlan(id);
      nav("/");
    } else {
      nav(`/auth?plan=${id}`);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.navy, fontFamily: "Inter,system-ui,sans-serif", padding: "24px 14px" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }} className="fu">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "5px 14px", borderRadius: 20, background: "rgba(0,201,177,0.12)", border: "1px solid rgba(0,201,177,0.18)", marginBottom: 14 }}>
            <Dot size={7} /><span style={{ fontSize: 10, color: T.teal, fontWeight: 700, letterSpacing: 1.2 }}>LIWIMALA INITIATIVE</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: T.white, lineHeight: 1.15, marginBottom: 8 }}>NdMED</h1>
          <p style={{ fontSize: 12, color: T.dimLight, maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
            Intelligent pre-clinical triage · KNN specialist matching · Google Maps integration · Evidence from 7 medical authorities
          </p>
        </div>

        <div style={{ display: "flex", gap: 7, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
          {SOURCES.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 10, color: T.dim }}>{s.icon} {s.name}</div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 13, marginBottom: 22 }}>
          {plans.map((pl) => {
            const h = hov === pl.id;
            return (
              <div key={pl.id} onMouseEnter={() => setHov(pl.id)} onMouseLeave={() => setHov(null)}
                style={{ background: pl.id === "pro" ? "linear-gradient(160deg,#0D2540,#0F2D4A)" : T.navyCard, border: `1.5px solid ${h ? pl.color : pl.id === "pro" ? pl.color + "44" : "rgba(255,255,255,0.07)"}`, borderRadius: 13, padding: "20px 16px", display: "flex", flexDirection: "column", position: "relative", transition: "border-color 0.2s,transform 0.2s", transform: h ? "translateY(-3px)" : "none" }}>
                {pl.badge && <div style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}><Chip text={pl.badge} color={pl.color} /></div>}
                <div style={{ fontSize: 20, marginBottom: 7 }}>{pl.icon}</div>
                <div style={{ fontSize: 10, color: pl.color, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{pl.name}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 2, marginBottom: 12 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: T.white }}>{pl.price}</span>
                  <span style={{ fontSize: 11, color: T.dim }}>{pl.period}</span>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 15 }}>
                  {pl.features.map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 10, color: T.dimLight }}>
                      <span style={{ color: pl.color, flexShrink: 0 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
                <button onClick={() => choose(pl.id)} style={{ width: "100%", padding: "10px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: pl.id === "free" ? "1px solid rgba(0,201,177,0.18)" : "none", background: pl.id === "free" ? "transparent" : `linear-gradient(135deg,${pl.color},${pl.color}BB)`, color: pl.id === "free" ? T.dimLight : pl.id === "pro" ? T.navy : T.white, cursor: "pointer" }}>
                  {user ? `Switch to ${pl.name}` : pl.cta}
                </button>
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: T.dim, lineHeight: 1.7 }}>
          NdMED does not replace a licensed physician. In any emergency, call 15/112/911 immediately. Subscription tiers are simulated for demonstration.
          {user && <> · <button onClick={() => nav("/")} style={{ background: "none", border: "none", color: T.teal, cursor: "pointer", fontSize: 10 }}>Back to dashboard</button></>}
        </p>
      </div>
    </div>
  );
}
