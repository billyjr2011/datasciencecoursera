import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { T } from "../theme";
import type { Question } from "../types";

export function Dot({ color = T.teal, size = 11 }: { color?: string; size?: number }) {
  return (
    <span
      style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, animation: "pulseRing 1.5s ease-out infinite" }}
    />
  );
}

export function Spin() {
  return (
    <span
      style={{ display: "inline-block", width: 16, height: 16, border: "2px solid rgba(0,201,177,0.15)", borderTopColor: T.teal, borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }}
    />
  );
}

export function Chip({ text, color = T.teal }: { text: ReactNode; color?: string }) {
  return (
    <span
      style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", padding: "3px 8px", borderRadius: 20, background: color + "20", border: "1px solid " + color + "44", color, whiteSpace: "nowrap" }}
    >
      {text}
    </span>
  );
}

export function Crd({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: T.navyCard, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px", ...style }}>
      {children}
    </div>
  );
}

export function SectionBadge({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 8, fontWeight: 800, color: T.teal, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8, padding: "2px 8px", borderRadius: 4, background: "rgba(0,201,177,0.08)", display: "inline-block" }}>
      {text}
    </div>
  );
}

export function ProgBar({ cur, tot, questions }: { cur: number; tot: number; questions: Question[] }) {
  const p = Math.round((cur / tot) * 100);
  const curSection = useMemo(() => questions[cur]?.section ?? "", [questions, cur]);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 9, color: T.dim, fontWeight: 600, letterSpacing: 1 }}>{curSection.toUpperCase()}</span>
        <span style={{ fontSize: 9, color: T.teal, fontWeight: 700 }}>{cur}/{tot} ({p}%)</span>
      </div>
      <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 2 }}>
        <div style={{ height: 3, width: p + "%", background: "linear-gradient(90deg,#00C9B1,#8B5CF6)", borderRadius: 2, transition: "width 0.4s cubic-bezier(.22,1,.36,1)" }} />
      </div>
    </div>
  );
}

export const wrapStyle: CSSProperties = {
  minHeight: "100vh", background: T.navy, display: "flex", alignItems: "flex-start", justifyContent: "center",
  padding: "18px 12px", fontFamily: "Inter,system-ui,sans-serif",
};

export const panelStyle: CSSProperties = {
  width: "100%", maxWidth: 600, background: T.navyMid, border: `1px solid ${T.border}`, borderRadius: 18,
  padding: "22px 20px", boxShadow: "0 0 60px rgba(0,201,177,0.06)",
};
