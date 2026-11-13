/* ============================================================================
 *  LOGIQUE — réseau de neurones (inférence + entraînement navigateur)
 * ==========================================================================*/
const CONT = ["density", "dbh", "oa_ratio", "suspect", "tally_ratio", "edge"];
const REGION_LIST = ["Sud", "Centre", "Est", "Littoral"];
const UC_AREA_HA = 25; // 1000 m × 250 m

function rawFeatures(uc) {
  const trees = uc.trees_total ?? uc.trees ?? 0;
  const density = uc.density ?? trees / UC_AREA_HA;
  return {
    density,
    dbh: uc.mean_dbh_cm ?? uc.dbh ?? 100,
    oa_ratio: uc.oa_ratio ?? (trees > 0 ? (uc.grade_oa ?? 0) / trees : 0),
    suspect: (uc.suspect ?? uc.suspect_rate_pct ?? 0) / 100,
    tally_ratio: uc.tally_ratio ?? (trees > 0 ? (uc.tally ?? trees) / trees : 1),
    edge: uc.edge ?? uc.edge_flag ?? 0,
  };
}
function vectorize(uc, norm, region) {
  const r = rawFeatures(uc);
  const cont = CONT.map((f) => (r[f] - norm[f].mean) / norm[f].std);
  const oh = REGION_LIST.map((x) => (x === region ? 1 : 0));
  return cont.concat(oh);
}
function forward(net, x) {
  let a = x;
  for (let l = 0; l < net.W.length; l++) {
    const last = l === net.W.length - 1;
    a = net.W[l].map((wj, j) => {
      let s = net.b[l][j];
      for (let k = 0; k < wj.length; k++) s += wj[k] * a[k];
      return last ? 1 / (1 + Math.exp(-s)) : s > 0 ? s : 0;
    });
  }
  return a;
}
function verdict(p) {
  if (p >= 0.8) return { level: "conforme", label: "Conforme au profil certifié" };
  if (p >= 0.5) return { level: "a_surveiller", label: "Écart modéré au profil certifié" };
  return { level: "atypique", label: "Profil atypique — contrôle recommandé" };
}
function scoreUc(model, uc, region) {
  if (!model) return null;
  const p = forward(model.net, vectorize(uc, model.norm, region))[0];
  return { region, conformity: Math.round(p * 1000) / 10, probability: +p.toFixed(4), ...verdict(p) };
}

// PRNG déterministe (mulberry32).
function rng(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Perceptron multicouche avec rétropropagation (identique au backend nn.js).
class MLP {
  constructor(sizes, seed = 42) {
    this.sizes = sizes;
    const rand = rng(seed);
    this.W = []; this.b = [];
    for (let l = 1; l < sizes.length; l++) {
      const fanIn = sizes[l - 1], scale = Math.sqrt(2 / fanIn);
      this.W.push(Array.from({ length: sizes[l] }, () =>
        Array.from({ length: fanIn }, () => (rand() * 2 - 1) * scale)));
      this.b.push(new Array(sizes[l]).fill(0));
    }
  }
  _fwd(x) {
    const a = [x], z = [];
    for (let l = 0; l < this.W.length; l++) {
      const last = l === this.W.length - 1;
      const zl = [], al = [];
      for (let j = 0; j < this.W[l].length; j++) {
        let s = this.b[l][j]; const wj = this.W[l][j], prev = a[l];
        for (let k = 0; k < prev.length; k++) s += wj[k] * prev[k];
        zl[j] = s; al[j] = last ? 1 / (1 + Math.exp(-s)) : s > 0 ? s : 0;
      }
      z.push(zl); a.push(al);
    }
    return { a, z };
  }
  _batch(batch, lr, l2) {
    const gW = this.W.map((m) => m.map((r) => r.map(() => 0)));
    const gb = this.b.map((v) => v.map(() => 0));
    let loss = 0;
    for (const { x, y } of batch) {
      const { a, z } = this._fwd(x); const out = a[a.length - 1];
      let delta = out.map((o, j) => {
        loss += -(y[j] * Math.log(o + 1e-9) + (1 - y[j]) * Math.log(1 - o + 1e-9));
        return o - y[j];
      });
      for (let l = this.W.length - 1; l >= 0; l--) {
        const prev = a[l];
        for (let j = 0; j < this.W[l].length; j++) {
          gb[l][j] += delta[j];
          for (let k = 0; k < prev.length; k++) gW[l][j][k] += delta[j] * prev[k];
        }
        if (l > 0) {
          const nd = new Array(prev.length).fill(0);
          for (let k = 0; k < prev.length; k++) {
            let s = 0;
            for (let j = 0; j < this.W[l].length; j++) s += this.W[l][j][k] * delta[j];
            nd[k] = s * (z[l - 1][k] > 0 ? 1 : 0);
          }
          delta = nd;
        }
      }
    }
    const n = batch.length;
    for (let l = 0; l < this.W.length; l++)
      for (let j = 0; j < this.W[l].length; j++) {
        this.b[l][j] -= lr * (gb[l][j] / n);
        for (let k = 0; k < this.W[l][j].length; k++)
          this.W[l][j][k] -= lr * (gW[l][j][k] / n + l2 * this.W[l][j][k]);
      }
    return loss / n;
  }
  fit(samples, { epochs = 150, lr = 0.08, batchSize = 24, l2 = 1e-4, seed = 7, cb } = {}) {
    const rand = rng(seed); let loss = 0;
    for (let e = 0; e < epochs; e++) {
      const d = samples.slice();
      for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[d[i], d[j]] = [d[j], d[i]]; }
      let sum = 0, nb = 0;
      for (let i = 0; i < d.length; i += batchSize) { sum += this._batch(d.slice(i, i + batchSize), lr, l2); nb++; }
      loss = sum / nb; if (cb) cb(e + 1, loss);
    }
    return loss;
  }
  toJSON() { return { sizes: this.sizes, W: this.W, b: this.b }; }
}

// Génère le jeu de référence des 4 régions (conformes + anomalies).
function gauss(rand, mean, std, min = 0, max = Infinity) {
  const u = Math.max(rand(), 1e-9), v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(max, Math.max(min, mean + z * std));
}
function conformeSample(rand, region) {
  const p = PROFILES[region];
  const density = gauss(rand, p.density[0], p.density[1], 0.4);
  return {
    region, label: 1, density, trees: Math.round(density * 25),
    dbh: gauss(rand, p.dbh[0], p.dbh[1], 60, 160),
    oa_ratio: gauss(rand, p.oaRatio[0], p.oaRatio[1], 0, 0.6),
    suspect: gauss(rand, p.suspect[0], p.suspect[1], 0, 12),
    tally_ratio: gauss(rand, 0.985, 0.02, 0.9, 1),
    edge: rand() < 0.12 ? 1 : 0,
  };
}
function anomalieSample(rand, region) {
  const p = PROFILES[region], s = conformeSample(rand, region), kind = Math.floor(rand() * 4);
  s.label = 0;
  if (kind === 0) s.suspect = gauss(rand, 22, 8, 12, 100);
  else if (kind === 1) s.density = gauss(rand, p.density[0] * 2.4, 0.7, 3);
  else if (kind === 2) s.dbh = gauss(rand, 78, 6, 40, 92);
  else s.oa_ratio = gauss(rand, 0.45, 0.1, 0.3, 0.9);
  s.trees = Math.round(s.density * 25);
  if (kind !== 1) s.tally_ratio = gauss(rand, 0.82, 0.06, 0.55, 0.95);
  return s;
}
function generateReference() {
  const rand = rng(2024), all = [];
  for (const region of REGION_LIST) {
    for (let i = 0; i < 220; i++) all.push(conformeSample(rand, region));
    for (let i = 0; i < 110; i++) all.push(anomalieSample(rand, region));
  }
  return all;
}
function fitNorm(samples) {
  const raw = samples.map(rawFeatures), norm = {};
  for (const f of CONT) {
    const xs = raw.map((r) => r[f]);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const varr = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
    norm[f] = { mean, std: Math.sqrt(varr) || 1 };
  }
  return norm;
}
function evalMetrics(net, set, norm) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const s of set) {
    const yhat = forward(net, vectorize(s, norm, s.region))[0] >= 0.5 ? 1 : 0;
    if (s.label === 1 && yhat === 1) tp++; else if (s.label === 0 && yhat === 0) tn++;
    else if (yhat === 1) fp++; else fn++;
  }
  const acc = (tp + tn) / set.length, prec = tp + fp ? tp / (tp + fp) : 0, rec = tp + fn ? tp / (tp + fn) : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  return { acc: +acc.toFixed(4), precision: +prec.toFixed(4), recall: +rec.toFixed(4), f1: +f1.toFixed(4) };
}
// Entraîne un modèle complet dans le navigateur et renvoie l'objet modèle.
function trainModel(epochs = 150, cb) {
  const samples = generateReference();
  const rand = rng(99), data = samples.slice();
  for (let i = data.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[data[i], data[j]] = [data[j], data[i]]; }
  const n = Math.floor(data.length * 0.8);
  const trainSet = data.slice(0, n), testSet = data.slice(n);
  const norm = fitNorm(trainSet);
  const net = new MLP([10, 16, 8, 1], 42);
  let last = 0;
  net.fit(trainSet.map((s) => ({ x: vectorize(s, norm, s.region), y: [s.label] })),
    { epochs, lr: 0.08, batchSize: 24, l2: 1e-4, seed: 7, cb: (e, loss) => { last = loss; cb && cb(e, loss); } });
  return {
    arch: [10, 16, 8, 1], trained_at: new Date().toISOString(), net: net.toJSON(), norm,
    training: { samples: samples.length, train: trainSet.length, test: testSet.length, epochs, final_loss: +last.toFixed(4) },
    metrics: { train: evalMetrics(net, trainSet, norm), test: evalMetrics(net, testSet, norm) },
  };
}

/* ============================================================================
 *  THÈME + RÉFÉRENTIELS
 * ==========================================================================*/
const T = {
  bg: "#040905", srf: "#0b1208", elv: "#111d0e", bdr: "#1e3018", mut: "#5a7a52",
  txt: "#dff0d8", grn: "#5fb84a", amb: "#f59e0b", red: "#ef4444", blu: "#38bdf8", pur: "#a78bfa",
};
const TABS = [
  ["overview", "Aperçu"], ["ucs", "Unités de comptage"], ["blocs", "Blocs & assiettes"],
  ["species", "Espèces"], ["dbh", "Diamètres (DBH)"], ["alerts", "Alertes"],
  ["model", "Modèle IA"], ["map", "Carte GIS"],
];
const SEVERITY = { 0: { label: "Conforme", color: "#5fb84a" }, 1: { label: "Vigilance", color: "#f59e0b" }, 2: { label: "Critique", color: "#ef4444" } };
const REVIEW = {
  a_verifier: { label: "À vérifier", color: "#64748b" }, en_cours: { label: "En cours", color: "#38bdf8" },
  valide: { label: "Validé", color: "#5fb84a" }, rejete: { label: "Rejeté", color: "#ef4444" },
};
const CONFORMITY = { conforme: { label: "Conforme", color: "#5fb84a" }, a_surveiller: { label: "À surveiller", color: "#f59e0b" }, atypique: { label: "Atypique", color: "#ef4444" } };
const SP_PALETTE = ["#fbbf24", "#fb923c", "#f87171", "#a78bfa", "#4ade80", "#38bdf8", "#22d3ee", "#818cf8", "#f9a8d4", "#86efac"];
const fmt = (n) => (n ?? 0).toLocaleString("fr-FR");

/* ============================================================================
 *  PETITS COMPOSANTS
 * ==========================================================================*/
function Badge({ color, children }) {
  return <span className="badge" style={{ color }}><span className="dot" />{children}</span>;
}
const SeverityBadge = ({ level }) => { const s = SEVERITY[level] ?? SEVERITY[0]; return <Badge color={s.color}>{s.label}</Badge>; };
const ReviewBadge = ({ status }) => { const s = REVIEW[status] ?? REVIEW.a_verifier; return <Badge color={s.color}>{s.label}</Badge>; };
function Kpi({ value, label, sub, accent }) {
  return (
    <div className="card kpi">
      <div className="v" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="l">{label}</div>{sub && <div className="sub">{sub}</div>}
    </div>
  );
}
function Bar({ value, max, color = T.grn }) {
  const w = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return <div className="bar-track"><div className="bar-fill" style={{ width: w + "%", background: color }} /></div>;
}

/* ============================================================================
 *  DONNÉES DÉRIVÉES (calculées à partir des constantes embarquées)
 * ==========================================================================*/
function useDerived() {
  return useMemo(() => {
    const trees = [];
    for (const id in TREES_BY_UC) for (const t of TREES_BY_UC[id]) trees.push({ ...t, uc_id: id });
    const overview = {
      ucs: UCS.length,
      trees_total: UCS.reduce((s, u) => s + u.trees_total, 0),
      suspect_count: UCS.reduce((s, u) => s + u.suspect_count, 0),
      grade_oa: UCS.reduce((s, u) => s + u.grade_oa, 0),
      suspect_rate_pct: +(UCS.reduce((s, u) => s + u.suspect_rate_pct, 0) / UCS.length).toFixed(2),
      mean_dbh_cm: +(UCS.reduce((s, u) => s + (u.mean_dbh_cm || 0), 0) / UCS.length).toFixed(1),
      critical: UCS.filter((u) => u.severity === 2).length,
      warning: UCS.filter((u) => u.severity === 1).length,
      ok: UCS.filter((u) => u.severity === 0).length,
      edge: UCS.filter((u) => u.edge_flag).length,
      species: new Set(trees.map((t) => t.species)).size,
      alerts: ALERTS.length,
    };
    const blocMap = {};
    for (const u of UCS) {
      const b = (blocMap[u.bloc] ||= { bloc: u.bloc, ucs: 0, trees_total: 0, suspect_count: 0, grade_oa: 0, srSum: 0, dbhSum: 0, critical: 0, warning: 0, ok: 0 });
      b.ucs++; b.trees_total += u.trees_total; b.suspect_count += u.suspect_count; b.grade_oa += u.grade_oa;
      b.srSum += u.suspect_rate_pct; b.dbhSum += u.mean_dbh_cm || 0;
      b[["ok", "warning", "critical"][u.severity]]++;
    }
    const blocs = Object.values(blocMap).sort((a, b) => a.bloc.localeCompare(b.bloc)).map((b) => ({
      ...b, color: (BLOC_META[b.bloc] || {}).color || T.grn, region: (BLOC_META[b.bloc] || {}).region || "Est",
      suspect_rate_pct: +(b.srSum / b.ucs).toFixed(2), mean_dbh_cm: +(b.dbhSum / b.ucs).toFixed(1),
    }));
    const spMap = {};
    for (const t of trees) {
      const s = (spMap[t.species] ||= { species: t.species, n: 0, oa: 0, dbhSum: 0 });
      s.n++; if (t.grade === "OA") s.oa++; s.dbhSum += t.dbh_cm;
    }
    const totalTrees = trees.length || 1;
    const species = Object.values(spMap).sort((a, b) => b.n - a.n).map((s, i) => ({
      ...s, pct: Math.round((s.n / totalTrees) * 1000) / 10, mean_dbh_cm: +(s.dbhSum / s.n).toFixed(1), col: SP_PALETTE[i % SP_PALETTE.length],
    }));
    const bins = {};
    for (const t of trees) { const b = Math.floor(t.dbh_cm / 10) * 10; bins[b] = (bins[b] || 0) + 1; }
    const dbh = Object.keys(bins).map(Number).sort((a, b) => a - b).map((b) => ({ from: b, to: b + 10, n: bins[b] }));
    const worst = UCS.filter((u) => u.trees_total > 0).slice().sort((a, b) => b.suspect_rate_pct - a.suspect_rate_pct).slice(0, 8);
    return { trees, overview, blocs, species, dbh, worst };
  }, []);
}

/* ============================================================================
 *  PAGES
 * ==========================================================================*/
function Overview({ d, model, onSelect }) {
  const ov = d.overview;
  return (
    <>
      <div className="page-head"><div>
        <h2>Aperçu de la campagne de contrôle</h2>
        <p>Région {META.region} · {META.crs} · UC {META.uc_dimensions.width_m}×{META.uc_dimensions.height_m} m ({META.uc_dimensions.area_ha} ha)</p>
      </div></div>
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi value={ov.ucs} label="Unités de comptage" sub={ov.edge + " en bordure"} />
        <Kpi value={fmt(ov.trees_total)} label="Tiges inventoriées" />
        <Kpi value={ov.suspect_rate_pct + "%"} label="Taux d'anomalie moyen" accent={T.amb} sub={ov.suspect_count + " tiges suspectes"} />
        <Kpi value={ov.critical} label="UC critiques" accent={T.red} sub={ov.warning + " en vigilance"} />
        <Kpi value={ov.species} label="Espèces relevées" />
        <Kpi value={ov.alerts} label="Alertes d'isolement" accent={T.pur} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card"><h3>Conformité des UC</h3>
          {[[2, "critical"], [1, "warning"], [0, "ok"]].map(([lvl, key]) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><SeverityBadge level={lvl} /><b>{ov[key]}</b></div>
              <Bar value={ov[key]} max={ov.ucs} color={SEVERITY[lvl].color} />
            </div>
          ))}
        </div>
        <div className="card"><h3>UC les plus problématiques</h3>
          <table><thead><tr><th>UC</th><th>Bloc</th><th className="num">Taux</th><th>Sévérité</th></tr></thead>
            <tbody>{d.worst.map((u) => (
              <tr key={u.uc_id} className="rowlink" onClick={() => onSelect(u.uc_id)}>
                <td><b>{u.uc_id}</b></td><td>{u.bloc}</td><td className="num">{u.suspect_rate_pct}%</td><td><SeverityBadge level={u.severity} /></td>
              </tr>))}</tbody></table>
        </div>
      </div>
    </>
  );
}

function Ucs({ d, model, statusOf, onSelect }) {
  const [f, setF] = useState({ bloc: "", severity: "", status: "", q: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rows = UCS.filter((u) =>
    (!f.bloc || u.bloc === f.bloc) &&
    (f.severity === "" || u.severity === Number(f.severity)) &&
    (!f.status || statusOf(u.uc_id) === f.status) &&
    (!f.q || u.uc_id.toLowerCase().includes(f.q.toLowerCase()))
  ).slice().sort((a, b) => b.suspect_rate_pct - a.suspect_rate_pct);
  return (
    <>
      <div className="page-head"><div><h2>Unités de comptage</h2><p>Contrôle unité par unité (1000 m × 250 m — 25 ha).</p></div></div>
      <div className="toolbar">
        <input type="search" placeholder="Rechercher une UC…" value={f.q} onChange={set("q")} />
        <select value={f.bloc} onChange={set("bloc")}><option value="">Tous les blocs</option>{d.blocs.map((b) => <option key={b.bloc} value={b.bloc}>{b.bloc}</option>)}</select>
        <select value={f.severity} onChange={set("severity")}><option value="">Toutes sévérités</option>{Object.entries(SEVERITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select value={f.status} onChange={set("status")}><option value="">Tous statuts</option>{Object.entries(REVIEW).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
      </div>
      <div className="card">
        <div className="muted" style={{ marginBottom: 8 }}>{rows.length} UC</div>
        <div style={{ overflow: "auto", maxHeight: "70vh" }}>
          <table><thead><tr><th>UC</th><th>Bloc</th><th className="num">Taux</th><th className="num">Suspectes</th><th className="num">Tiges</th><th className="num">DBH</th><th>Sévérité</th><th>Contrôle</th></tr></thead>
            <tbody>{rows.map((u) => (
              <tr key={u.uc_id} className="rowlink" onClick={() => onSelect(u.uc_id)}>
                <td><b>{u.uc_id}</b></td><td>{u.bloc}</td><td className="num">{u.suspect_rate_pct}%</td>
                <td className="num">{u.suspect_count}</td><td className="num">{u.trees_total}</td><td className="num">{u.mean_dbh_cm ?? "–"}</td>
                <td><SeverityBadge level={u.severity} /></td><td><ReviewBadge status={statusOf(u.uc_id)} /></td>
              </tr>))}</tbody></table>
        </div>
      </div>
    </>
  );
}

function Blocs({ d }) {
  const maxUcs = Math.max(...d.blocs.map((b) => b.ucs), 1);
  return (
    <>
      <div className="page-head"><div><h2>Blocs & assiettes de coupe</h2><p>Synthèse de conformité par bloc d'exploitation.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        {d.blocs.map((b) => (
          <div className="card" key={b.bloc}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h3 style={{ margin: 0, color: b.color }}>{b.bloc}</h3><span className="muted">{b.ucs} UC</span></div>
            <div style={{ margin: "12px 0" }}><Bar value={b.ucs} max={maxUcs} color={b.color} /></div>
            <div className="def" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div><span>Tiges</span><b>{b.trees_total}</b></div><div><span>Taux d'anomalie</span><b>{b.suspect_rate_pct}%</b></div>
              <div><span>Qualité OA</span><b>{b.grade_oa}</b></div><div><span>DBH moyen</span><b>{b.mean_dbh_cm} cm</b></div>
              <div><span>Critiques</span><b style={{ color: T.red }}>{b.critical}</b></div><div><span>Vigilance</span><b style={{ color: T.amb }}>{b.warning}</b></div>
            </div>
          </div>))}
      </div>
    </>
  );
}

function Species({ d }) {
  const max = Math.max(...d.species.map((s) => s.n), 1);
  return (
    <>
      <div className="page-head"><div><h2>Répartition par espèce</h2><p>Espèces relevées sur les {d.trees.length} tiges irrégulières contrôlées.</p></div></div>
      <div className="card"><table>
        <thead><tr><th>Espèce</th><th className="num">Tiges</th><th className="num">%</th><th className="num">OA</th><th className="num">DBH moyen</th><th style={{ width: "30%" }}>Part</th></tr></thead>
        <tbody>{d.species.map((s) => (
          <tr key={s.species}><td><b>{s.species}</b></td><td className="num">{s.n}</td><td className="num">{s.pct}%</td><td className="num">{s.oa}</td><td className="num">{s.mean_dbh_cm} cm</td><td><Bar value={s.n} max={max} color={s.col} /></td></tr>
        ))}</tbody></table></div>
    </>
  );
}

function Dbh({ d }) {
  const max = Math.max(...d.dbh.map((x) => x.n), 1), total = d.dbh.reduce((s, x) => s + x.n, 0);
  return (
    <>
      <div className="page-head"><div><h2>Distribution des diamètres (DBH)</h2><p>Classes de 10 cm sur {total} tiges mesurées.</p></div></div>
      <div className="card">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 260, padding: "10px 0" }}>
          {d.dbh.map((x) => (
            <div key={x.from} title={x.from + "–" + x.to + " cm : " + x.n} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", height: "100%" }}>
              <span className="muted" style={{ fontSize: 11 }}>{x.n}</span>
              <div style={{ width: "100%", height: (x.n / max) * 100 + "%", background: "linear-gradient(" + T.grn + ",#2f7a24)", borderRadius: "5px 5px 0 0", minHeight: 2 }} />
              <span className="muted" style={{ fontSize: 10, marginTop: 4 }}>{x.from}</span>
            </div>))}
        </div>
        <div className="muted" style={{ textAlign: "center" }}>DBH (cm)</div>
      </div>
    </>
  );
}

function Alerts({ onSelect }) {
  const bloc = (id) => (UCS.find((u) => u.uc_id === id) || {}).bloc;
  return (
    <>
      <div className="page-head"><div><h2>Alertes d'isolement</h2><p>Tiges relevées à distance anormale de leurs congénères.</p></div></div>
      <div className="card"><table>
        <thead><tr><th>UC</th><th>Bloc</th><th>Espèce</th><th className="num">Distance</th></tr></thead>
        <tbody>{ALERTS.map((a, i) => (
          <tr key={i} className="rowlink" onClick={() => onSelect(a.buc)}><td><b>{a.buc}</b></td><td>{bloc(a.buc)}</td><td>{a.sp}</td><td className="num">{a.dist} m</td></tr>
        ))}</tbody></table></div>
    </>
  );
}

function Model({ model, setModel }) {
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(null);
  const [sim, setSim] = useState({ region: "Est", trees_total: 60, mean_dbh_cm: 105, grade_oa: 9, suspect_rate_pct: 4, tally: 59, edge_flag: 0 });
  const simRes = scoreUc(model, sim, sim.region);
  const scan = useMemo(() => {
    const dist = { conforme: 0, a_surveiller: 0, atypique: 0 }, flagged = [];
    for (const u of UCS) {
      const s = scoreUc(model, u, (BLOC_META[u.bloc] || {}).region || "Est"); dist[s.level]++;
      if (s.level === "atypique") flagged.push({ ...u, conformity: s.conformity });
    }
    flagged.sort((a, b) => a.conformity - b.conformity);
    return { dist, flagged: flagged.slice(0, 12) };
  }, [model]);
  const num = (k) => (e) => setSim({ ...sim, [k]: Number(e.target.value) });

  function retrain() {
    setBusy(true); setProg({ epoch: 0, loss: null });
    setTimeout(() => {
      const m = trainModel(150, (e, loss) => { if (e % 30 === 0) setProg({ epoch: e, loss: +loss.toFixed(4) }); });
      setModel(m); setBusy(false); setProg({ epoch: 150, loss: m.training.final_loss });
    }, 30);
  }

  const mt = model.metrics.test;
  return (
    <>
      <div className="page-head"><div>
        <h2>Modèle de conformité (réseau de neurones)</h2>
        <p>Apprend la signature des inventaires certifiés sur les 4 régions forestières du Cameroun.</p>
      </div>
      <button className="btn" disabled={busy} onClick={retrain}>{busy ? "Entraînement…" : "Réentraîner"}</button>
      </div>
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <Kpi value={(mt.acc * 100).toFixed(1) + "%"} label="Exactitude (test)" accent={T.grn} />
        <Kpi value={mt.f1.toFixed(3)} label="Score F1 (test)" />
        <Kpi value={model.training.samples} label="UC de référence" sub={model.training.train + " / " + model.training.test} />
        <Kpi value={model.arch.join("–")} label="Architecture (MLP)" sub={"perte " + model.training.final_loss} />
      </div>
      {prog && <div className="card" style={{ marginBottom: 16 }}><h3>Entraînement</h3><div className="muted">époque {prog.epoch}/150{prog.loss != null ? " · perte " + prog.loss : ""}</div><Bar value={prog.epoch} max={150} color={T.blu} /></div>}
      <div className="grid" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <div className="card"><h3>Régions d'apprentissage</h3>
          <table><thead><tr><th>Région</th><th className="num">Réf.</th><th className="num">Dens./ha</th><th className="num">DBH</th><th className="num">OA</th><th className="num">Anom.</th></tr></thead>
            <tbody>{REGION_LIST.map((r) => { const p = PROFILES[r]; return (
              <tr key={r}><td><b>{r}</b><div className="muted" style={{ fontSize: 11 }}>{p.species.slice(0, 3).join(", ")}</div></td>
                <td className="num">{REF_COUNTS[r]}</td><td className="num">{p.density[0]}</td><td className="num">{p.dbh[0]}</td><td className="num">{Math.round(p.oaRatio[0] * 100)}%</td><td className="num">{p.suspect[0]}%</td></tr>
            ); })}</tbody></table>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Données de référence synthétiques reproduisant les ordres de grandeur des massifs camerounais — à remplacer par les inventaires réels des sociétés certifiées.</p>
        </div>
        <div className="card"><h3>Simulateur de conformité</h3>
          <div className="def" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <label className="field"><span className="muted">Région</span><select value={sim.region} onChange={(e) => setSim({ ...sim, region: e.target.value })}>{REGION_LIST.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="field"><span className="muted">Tiges</span><input type="number" value={sim.trees_total} onChange={num("trees_total")} /></label>
            <label className="field"><span className="muted">DBH moyen</span><input type="number" value={sim.mean_dbh_cm} onChange={num("mean_dbh_cm")} /></label>
            <label className="field"><span className="muted">Qualité OA</span><input type="number" value={sim.grade_oa} onChange={num("grade_oa")} /></label>
            <label className="field"><span className="muted">Taux anomalie %</span><input type="number" step="0.1" value={sim.suspect_rate_pct} onChange={num("suspect_rate_pct")} /></label>
            <label className="field"><span className="muted">Retenues</span><input type="number" value={sim.tally} onChange={num("tally")} /></label>
          </div>
          {simRes && (<div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: CONFORMITY[simRes.level].color }}>{simRes.conformity}%</div>
              <div><Badge color={CONFORMITY[simRes.level].color}>{CONFORMITY[simRes.level].label}</Badge><div className="muted" style={{ marginTop: 4 }}>{simRes.label}</div></div>
            </div>
            <div style={{ marginTop: 8 }}><Bar value={simRes.conformity} max={100} color={CONFORMITY[simRes.level].color} /></div>
          </div>)}
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}><h3>Analyse de la concession par le modèle</h3>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.entries(CONFORMITY).map(([k, v]) => (<div key={k}><div style={{ fontSize: 22, fontWeight: 700, color: v.color }}>{scan.dist[k]}</div><div className="muted">{v.label}</div></div>))}
        </div>
        {Object.entries(CONFORMITY).map(([k, v]) => <div key={k} style={{ marginBottom: 6 }}><Bar value={scan.dist[k]} max={UCS.length} color={v.color} /></div>)}
        <h3 style={{ marginTop: 14 }}>UC signalées atypiques par le réseau</h3>
        <table><thead><tr><th>UC</th><th>Bloc</th><th className="num">Conformité</th><th className="num">Taux anomalie</th></tr></thead>
          <tbody>{scan.flagged.map((u) => (<tr key={u.uc_id}><td><b>{u.uc_id}</b></td><td>{u.bloc}</td><td className="num" style={{ color: T.red }}>{u.conformity}%</td><td className="num">{u.suspect_rate_pct}%</td></tr>))}</tbody></table>
      </div>
    </>
  );
}

function MapGIS({ onSelect }) {
  const cvRef = useRef(null);
  const [hover, setHover] = useState(null);
  const CELL_W = 1000, CELL_H = 250;
  useEffect(() => {
    const cv = cvRef.current, ctx = cv.getContext("2d"), W = cv.width, H = cv.height, pad = 20;
    const ext = META.extent, s = Math.min((W - 2 * pad) / (ext.X1 - ext.X0), (H - 2 * pad) / (ext.Y1 - ext.Y0));
    const px = (x) => pad + (x - ext.X0) * s, py = (y) => H - pad - (y - ext.Y0) * s;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#02150a"; ctx.fillRect(0, 0, W, H);
    for (const u of UCS) {
      const x = px(u.x_utm), y = py(u.y_utm + CELL_H), w = CELL_W * s, h = CELL_H * s, c = SEVERITY[u.severity].color;
      ctx.fillStyle = c + "30"; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = hover && hover.uc_id === u.uc_id ? "#fff" : c;
      ctx.lineWidth = hover && hover.uc_id === u.uc_id ? 2 : 1; ctx.strokeRect(x, y, w, h);
    }
    cv._ucs = UCS.map((u) => ({ ...u, _x: px(u.x_utm), _y: py(u.y_utm + CELL_H), _w: CELL_W * s, _h: CELL_H * s }));
  }, [hover]);
  function pick(e) {
    const cv = cvRef.current, r = cv.getBoundingClientRect();
    const mx = (e.clientX - r.left) * (cv.width / r.width), my = (e.clientY - r.top) * (cv.height / r.height);
    return (cv._ucs || []).find((u) => mx >= u._x && mx <= u._x + u._w && my >= u._y && my <= u._y + u._h);
  }
  return (
    <>
      <div className="page-head"><div><h2>Carte GIS de la concession</h2><p>{META.crs} — UC de 1000 m × 250 m (25 ha). Cliquez une UC pour ouvrir son dossier.</p></div></div>
      <div className="legend" style={{ marginBottom: 12 }}>{Object.entries(SEVERITY).map(([k, v]) => <span key={k}><i className="chip" style={{ background: v.color }} />{v.label}</span>)}</div>
      <div className="card" style={{ position: "relative" }}>
        <canvas ref={cvRef} width={760} height={620} style={{ maxWidth: "100%" }}
          onMouseMove={(e) => setHover(pick(e) || null)} onMouseLeave={() => setHover(null)}
          onClick={(e) => { const u = pick(e); if (u) onSelect(u.uc_id); }} />
        {hover && <div style={{ position: "absolute", top: 12, right: 12, background: T.elv, border: "1px solid " + T.bdr, borderRadius: 9, padding: "8px 12px" }}>
          <b>{hover.uc_id}</b> · {hover.suspect_rate_pct}% · <span style={{ color: SEVERITY[hover.severity].color }}>{SEVERITY[hover.severity].label}</span></div>}
      </div>
    </>
  );
}

/* ============================================================================
 *  VOLET DÉTAIL UC + WORKFLOW DE VÉRIFICATION
 * ==========================================================================*/
const GRADE_COLOR = { OA: T.red, OB: T.amb, OC: T.blu };
function UcDrawer({ id, model, history, onClose, onDecision }) {
  const uc = UCS.find((u) => u.uc_id === id);
  const region = (BLOC_META[uc.bloc] || {}).region || "Est";
  const trees = TREES_BY_UC[id] || [];
  const alerts = ALERTS.filter((a) => a.buc === id);
  const ml = scoreUc(model, uc, region);
  const hist = history[id] || [];
  const [form, setForm] = useState({ status: "en_cours", decision: "", note: "", inspector: "" });
  function submit(e) { e.preventDefault(); onDecision(id, form); setForm({ ...form, decision: "", note: "" }); }
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <button className="x" onClick={onClose} aria-label="Fermer">×</button>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>{uc.uc_id}</h2><SeverityBadge level={uc.severity} />
          <ReviewBadge status={hist.length ? hist[0].status : "a_verifier"} />
          {uc.edge_flag ? <Badge color={T.pur}>Bordure</Badge> : null}
        </div>
        <p className="muted" style={{ marginTop: 4 }}>Bloc {uc.bloc} · Région {region} · UTM {uc.x_utm}, {uc.y_utm} · 25 ha</p>

        {ml && (<div className="card" style={{ marginBottom: 14 }}><h3>Conformité IA — profil certifié {region}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: CONFORMITY[ml.level].color }}>{ml.conformity}%</div>
            <div><Badge color={CONFORMITY[ml.level].color}>{CONFORMITY[ml.level].label}</Badge><div className="muted" style={{ marginTop: 3, fontSize: 12 }}>{ml.label}</div></div>
          </div><Bar value={ml.conformity} max={100} color={CONFORMITY[ml.level].color} /></div>)}

        <div className="def">
          <div><span>Tiges inventoriées</span><b>{uc.trees_total}</b></div><div><span>Taux d'anomalie</span><b>{uc.suspect_rate_pct}%</b></div>
          <div><span>Tiges suspectes</span><b>{uc.suspect_count}</b></div><div><span>Retenues (tally)</span><b>{uc.tally}</b></div>
          <div><span>Qualité OA</span><b>{uc.grade_oa}</b></div><div><span>DBH moyen</span><b>{uc.mean_dbh_cm ?? "–"} cm</b></div>
        </div>

        {alerts.length > 0 && <div className="card" style={{ marginBottom: 14 }}><h3>Alertes d'isolement</h3>{alerts.map((a, i) => <div key={i} className="muted">{a.sp} — distance {a.dist} m</div>)}</div>}

        <div className="card" style={{ marginBottom: 14 }}><h3>Tiges irrégulières ({trees.length})</h3>
          <div style={{ maxHeight: 220, overflow: "auto" }}><table>
            <thead><tr><th>Étiquette</th><th>Espèce</th><th className="num">DBH</th><th>Qualité</th></tr></thead>
            <tbody>{trees.map((t, i) => <tr key={i}><td>{t.tag_id}</td><td>{t.species}</td><td className="num">{t.dbh_cm}</td><td style={{ color: GRADE_COLOR[t.grade] || "inherit" }}>{t.grade}</td></tr>)}
              {trees.length === 0 && <tr><td colSpan="4" className="muted">Aucune tige signalée.</td></tr>}</tbody>
          </table></div></div>

        <div className="card" style={{ marginBottom: 14 }}><h3>Décision de contrôle</h3>
          <form onSubmit={submit}>
            <div className="field"><label>Statut</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(REVIEW).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div className="field"><label>Inspecteur</label><input type="text" value={form.inspector} placeholder="Nom" onChange={(e) => setForm({ ...form, inspector: e.target.value })} /></div>
            <div className="field"><label>Conclusion</label><input type="text" value={form.decision} placeholder="Ex. Conforme après contrôle terrain" onChange={(e) => setForm({ ...form, decision: e.target.value })} /></div>
            <div className="field"><label>Note</label><textarea value={form.note} placeholder="Observations…" onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
            <button className="btn">Enregistrer la décision</button>
          </form></div>

        <div className="card"><h3>Historique</h3><div className="timeline">
          {hist.map((v, i) => (<div className="ev" key={i}><div><ReviewBadge status={v.status} /> {v.decision || ""}</div>{v.note && <div className="muted">{v.note}</div>}<small>{v.inspector || "inspecteur"} · {v.ts}</small></div>))}
          {hist.length === 0 && <div className="muted">Aucune décision enregistrée.</div>}
        </div></div>
      </aside>
    </>
  );
}

/* ============================================================================
 *  APPLICATION
 * ==========================================================================*/
export default function App() {
  const d = useDerived();
  const [tab, setTab] = useState("overview");
  const [sel, setSel] = useState(null);
  const [model, setModel] = useState(MODEL0);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("syvief_verifs") || "{}"); } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("syvief_verifs", JSON.stringify(history)); } catch { /* ignore */ }
  }, [history]);
  const statusOf = useCallback((id) => { const h = history[id]; return h && h.length ? h[0].status : "a_verifier"; }, [history]);
  const onDecision = useCallback((id, form) => {
    const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
    setHistory((h) => ({ ...h, [id]: [{ ...form, ts }, ...(h[id] || [])] }));
  }, []);
  const select = (id) => setSel(id);

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <aside className="side">
          <div className="brand">
            <div className="logo">SF</div>
            <div><h1>SYVIEF</h1><small>Vérification d'inventaire forestier</small></div>
          </div>
          <nav className="nav">{TABS.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}</nav>
        </aside>
        <main className="main">
          {tab === "overview" && <Overview d={d} model={model} onSelect={select} />}
          {tab === "ucs" && <Ucs d={d} model={model} statusOf={statusOf} onSelect={select} />}
          {tab === "blocs" && <Blocs d={d} />}
          {tab === "species" && <Species d={d} />}
          {tab === "dbh" && <Dbh d={d} />}
          {tab === "alerts" && <Alerts onSelect={select} />}
          {tab === "model" && <Model model={model} setModel={setModel} />}
          {tab === "map" && <MapGIS onSelect={select} />}
        </main>
        {sel && <UcDrawer id={sel} model={model} history={history} onClose={() => setSel(null)} onDecision={onDecision} />}
      </div>
    </>
  );
}
