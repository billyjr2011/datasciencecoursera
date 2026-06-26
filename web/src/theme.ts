// Design tokens + global CSS, ported from the artifact.

export const T = {
  navy: "#07182E", navyMid: "#0D2540", navyCard: "#0F2D4A",
  teal: "#00C9B1", tealDim: "#009E8D", tealGlow: "rgba(0,201,177,0.12)",
  white: "#EDF2F7", dim: "#7A99B8", dimLight: "#A8BCCF",
  amber: "#F6A623", red: "#E8394A", green: "#21C97A", purple: "#8B5CF6",
  border: "rgba(0,201,177,0.18)", borderDim: "rgba(255,255,255,0.07)",
};

export interface TriageMeta { bg: string; label: string; icon: string; desc: string; }

export const TRIAGE: Record<string, TriageMeta> = {
  RED: { bg: "#E8394A", label: "EMERGENCY", icon: "🚨", desc: "Seek immediate emergency care — call 15/112/911" },
  ORANGE: { bg: "#F6762B", label: "URGENT", icon: "⚠️", desc: "See a doctor within 2–4 hours" },
  YELLOW: { bg: "#F6C623", label: "SEMI-URGENT", icon: "⚡", desc: "Consult a doctor within 24 hours" },
  GREEN: { bg: "#21C97A", label: "NON-URGENT", icon: "✅", desc: "Schedule a routine appointment" },
};

export const SOURCES = [
  { name: "WHO", icon: "🌐" }, { name: "NIH MedlinePlus", icon: "🔬" }, { name: "Mayo Clinic", icon: "🏥" },
  { name: "CDC", icon: "🛡️" }, { name: "WebMD", icon: "💊" }, { name: "NHS UK", icon: "🏴" }, { name: "Cleveland Clinic", icon: "⚕️" },
];

export const GBL = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:#07182E;}
@keyframes pulseRing{0%{box-shadow:0 0 0 0 rgba(0,201,177,0.5)}70%{box-shadow:0 0 0 9px rgba(0,0,0,0)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
.fu{animation:fadeUp 0.4s cubic-bezier(.22,1,.36,1) both}
.fi{animation:fadeIn 0.3s ease both}
button{font-family:inherit;}
input,select{font-family:inherit;}
a{color:inherit;}
::-webkit-scrollbar{width:4px}
::-webkit-scrollbar-thumb{background:rgba(0,201,177,0.25);border-radius:4px}
`;
