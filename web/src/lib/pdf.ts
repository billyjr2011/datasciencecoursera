// Client-side PDF report generation via a print window. Ported from the artifact.

import type { Specialist, TriageResult } from "../types";

const tMap: Record<string, { label: string; color: string }> = {
  RED: { label: "EMERGENCY", color: "#E8394A" },
  ORANGE: { label: "URGENT", color: "#F6762B" },
  YELLOW: { label: "SEMI-URGENT", color: "#F6C623" },
  GREEN: { label: "NON-URGENT", color: "#21C97A" },
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function li(arr?: string[]): string {
  if (!arr || !arr.length) return "<i style='color:#8a9ab0;font-size:10px;'>None noted.</i>";
  return "<ul style='margin:4px 0 0 14px;padding:0;'>" + arr.map((x) => `<li style='margin:2px 0;font-size:11px;color:#1a2a3a;'>${esc(x)}</li>`).join("") + "</ul>";
}

export function generatePDFReport(result: TriageResult, planName: string, patientZone: string, specialists: Specialist[]) {
  const tr = tMap[result.triage_color ?? "GREEN"] ?? tMap.GREEN;
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const condRows = (result.possible_conditions ?? []).map((c) => {
    const pc = c.probability === "High" ? "#E8394A" : c.probability === "Moderate" ? "#F6762B" : "#21C97A";
    return `<tr><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:11px;font-weight:600;color:#0B1F3A;'>${esc(c.name)}</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;text-align:center;'><span style='background:${pc}22;color:${pc};font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;border:1px solid ${pc}55;'>${esc(c.probability)}</span></td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#4a6080;'>${esc(c.icd10 ?? "")}</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#4a6080;'>${esc((c.description ?? "").slice(0, 80))}…</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:9px;color:#00796B;'>${esc(c.source ?? "")}</td></tr>`;
  }).join("");

  const actHTML = (result.immediate_actions ?? []).map((a, i) =>
    `<div style='display:flex;gap:8px;align-items:flex-start;margin:4px 0;'><span style='min-width:18px;height:18px;border-radius:3px;background:#00C9B1;color:#07182E;font-size:9px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;'>${i + 1}</span><span style='font-size:11px;color:#1a2a3a;line-height:1.5;'>${esc(a)}</span></div>`,
  ).join("");

  const rfHTML = result.red_flags?.length
    ? `<div style='background:#fff0f1;border:1px solid #ffc0c5;border-radius:5px;padding:9px 13px;margin-bottom:12px;'><div style='font-size:9px;font-weight:800;color:#E8394A;letter-spacing:1px;text-transform:uppercase;margin-bottom:5px;'>Red Flags Detected</div>${result.red_flags.map((f) => `<div style='font-size:11px;color:#c0202a;margin:2px 0;'>• ${esc(f)}</div>`).join("")}</div>`
    : "";

  const evHTML = result.evidence_sources?.length
    ? `<div style='margin-top:12px;'><h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #00C9B1;padding-bottom:3px;margin-bottom:7px;'>Clinical Evidence Sources</h3>${result.evidence_sources.map((s) => `<div style='margin-bottom:6px;padding:6px 10px;background:#f7fafb;border-left:3px solid #00C9B1;'><div style='font-size:11px;font-weight:700;color:#0B1F3A;'>${esc(s.title ?? "")}</div><div style='font-size:9px;color:#00796B;'>${esc(s.source ?? "")}${s.url ? " | " + esc(s.url) : ""}</div><div style='font-size:10px;color:#4a6080;'>${esc(s.relevance ?? "")}</div></div>`).join("")}</div>`
    : "";

  const specHTML = specialists.length
    ? `<div style='margin-top:12px;'><h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #00C9B1;padding-bottom:3px;margin-bottom:7px;'>KNN Matched Specialists${patientZone ? " — near " + esc(patientZone) : ""}</h3><table><thead><tr><th>Specialist</th><th>Specialty</th><th style='width:110px;'>Zone</th><th style='width:130px;'>Contact</th></tr></thead><tbody>${specialists.map((sp) => `<tr><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:11px;font-weight:600;color:#0B1F3A;'>${esc(sp.name)}<br/><span style='font-size:9px;color:#4a6080;font-weight:400;'>${esc(sp.facility)}</span></td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#00796B;'>${esc(sp.specialty)}</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:10px;color:#4a6080;'>${esc(sp.zone)}<br/>${esc(sp.city)}</td><td style='padding:5px 7px;border-bottom:1px solid #e8edf2;font-size:9px;'><span style='color:#21C97A;'>${esc(sp.phone)}</span><br/><span style='color:#00796B;'>${esc(sp.email)}</span></td></tr>`).join("")}</tbody></table></div>`
    : "";

  const html =
    `<!DOCTYPE html><html><head><meta charset='UTF-8'/><title>NdMED Report ${date}</title>` +
    `<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#1a2a3a;font-size:12px;}` +
    `@page{margin:12mm 10mm;size:A4;}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}` +
    `table{border-collapse:collapse;width:100%;}th{background:#0B1F3A;color:#fff;padding:6px 7px;font-size:10px;text-align:left;}</style></head><body>` +
    `<div style='background:#0B1F3A;color:#fff;padding:14px 17px;display:flex;align-items:center;justify-content:space-between;'>` +
    `<div><div style='font-size:19px;font-weight:900;letter-spacing:0.5px;'>NdMED<span style='font-size:10px;font-weight:600;color:#00C9B1;border:1px solid #00C9B1;padding:2px 7px;border-radius:10px;margin-left:7px;vertical-align:middle;'>${esc(planName)}</span></div>` +
    `<div style='font-size:8px;color:#00C9B1;letter-spacing:2px;margin-top:2px;text-transform:uppercase;'>LIWIMALA INITIATIVE — Pre-Clinical Consultation Report</div></div>` +
    `<div style='text-align:right;font-size:9px;color:#A8BCCF;'><div>${esc(date)} at ${esc(time)}</div>${patientZone ? "<div style='margin-top:1px;'>Zone: " + esc(patientZone) + "</div>" : ""}<div style='font-size:8px;'>Confidential — Patient Copy</div></div>` +
    `</div>` +
    `<div style='background:${tr.color}12;border-left:5px solid ${tr.color};padding:10px 13px;margin-bottom:12px;display:flex;align-items:center;gap:18px;'>` +
    `<div><div style='font-size:8px;color:#4a6080;text-transform:uppercase;letter-spacing:1px;font-weight:700;'>Triage</div><div style='font-size:18px;font-weight:900;color:${tr.color};'>${tr.label}</div><div style='font-size:10px;color:#4a6080;margin-top:1px;'>${esc(result.triage_label ?? "")}</div></div>` +
    `<div style='margin-left:auto;text-align:right;'><div style='font-size:8px;color:#4a6080;text-transform:uppercase;letter-spacing:1px;'>Referral Specialty</div><div style='font-size:13px;font-weight:800;color:#0B1F3A;'>${esc(result.referral?.specialty ?? "")}</div><div style='font-size:10px;color:${tr.color};font-weight:700;'>${result.referral?.urgency_hours != null ? "Within " + result.referral.urgency_hours + "h" : "At convenience"}</div></div>` +
    `</div>` +
    `<div style='background:#f0f8f7;border:1px solid #c0e8e4;border-radius:5px;padding:9px 12px;margin-bottom:12px;'><div style='font-size:8px;font-weight:800;color:#00796B;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;'>Patient Summary</div><p style='font-size:11px;line-height:1.6;'>${esc(result.summary ?? "")}</p></div>` +
    rfHTML +
    `<div style='display:flex;gap:12px;margin-bottom:12px;'>` +
    `<div style='flex:1;'><h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #00C9B1;padding-bottom:3px;margin-bottom:6px;'>Immediate Actions</h3>${actHTML}</div>` +
    `<div style='flex:1;'><h3 style='font-size:10px;font-weight:800;color:#E8394A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #E8394A;padding-bottom:3px;margin-bottom:6px;'>Do NOT Do</h3>${li(result.do_not)}${result.first_aid?.length ? "<h3 style='font-size:10px;font-weight:800;color:#21C97A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #21C97A;padding-bottom:3px;margin:9px 0 6px;'>First Aid</h3>" + li(result.first_aid) : ""}</div>` +
    `</div>` +
    `<h3 style='font-size:10px;font-weight:800;color:#0B1F3A;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #0B1F3A;padding-bottom:3px;margin-bottom:6px;'>Differential Diagnosis</h3>` +
    `<table style='margin-bottom:12px;'><thead><tr><th>Condition</th><th style='width:70px;text-align:center;'>Likelihood</th><th style='width:70px;'>ICD-10</th><th>Description</th><th style='width:90px;'>Source</th></tr></thead><tbody>${condRows}</tbody></table>` +
    (result.clinical_notes ? `<div style='background:#f5f3ff;border:1px solid #d4c8f8;border-radius:5px;padding:9px 12px;margin-bottom:12px;'><div style='font-size:8px;font-weight:800;color:#7C3AED;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;'>Clinical Commentary</div><p style='font-size:11px;color:#1a2a3a;line-height:1.6;'>${esc(result.clinical_notes)}</p></div>` : "") +
    evHTML + specHTML +
    `<div style='margin-top:12px;padding:8px 12px;background:#fffbf0;border:1px solid #f0dfa0;border-radius:5px;'><div style='font-size:8px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;'>Medical Disclaimer</div><p style='font-size:9px;color:#78530a;line-height:1.55;'>${esc(result.disclaimer ?? "")}</p></div>` +
    `<div style='margin-top:8px;border-top:1px solid #e0e8f0;padding-top:5px;display:flex;justify-content:space-between;font-size:8px;color:#8a9ab0;'><span>NdMED — LIWIMALA INITIATIVE</span><span>${esc(date)} ${esc(time)} | Plan: ${esc(planName)}</span></div>` +
    `</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups to print the PDF report.");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 800);
}
