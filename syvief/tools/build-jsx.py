#!/usr/bin/env python3
"""Assemble the standalone single-file SYVIEF.jsx from the seed data + code template."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "server", "data")
load = lambda f: json.load(open(os.path.join(DATA, f), encoding="utf8"))

ucs = load("ucs.json")
trees = load("trees.json")
blocs = load("blocs.json")
alerts = load("alerts.json")
meta = load("meta.json")
model = json.load(open(os.path.join(ROOT, "server", "model.json"), encoding="utf8"))

# Trees grouped by UC.
trees_by_uc = {}
for t in trees:
    trees_by_uc.setdefault(t["uc_id"], []).append(
        {k: t[k] for k in ("tag_id", "species", "dbh_cm", "grade", "lat", "lon", "x_utm", "y_utm")})

bloc_meta = {b["b"]: {"color": b.get("col"), "region": meta.get("region", "Est")} for b in blocs}

meta_obj = {
    "region": meta.get("region", "Est"),
    "crs": "UTM zone 33N",
    "uc_dimensions": meta["uc_dimensions"],
    "extent": meta["extent"],
    "geo_guard": meta["geo_guard"],
}

PROFILES = {
    "Sud": {"label": "Sud — forêt sempervirente atlantique", "density": [2.4, 0.5], "dbh": [108, 9],
            "oaRatio": [0.14, 0.05], "suspect": [3.0, 1.4], "species": ["Azobé", "Moabi", "Movingui", "Bibolo", "Padouk Rouge"]},
    "Centre": {"label": "Centre — forêt semi-décidue de transition", "density": [2.0, 0.5], "dbh": [102, 8],
               "oaRatio": [0.12, 0.05], "suspect": [3.6, 1.6], "species": ["Ayous", "Sapelli", "Tali", "Fraké", "Iroko"]},
    "Est": {"label": "Est — forêt dense semi-décidue (bassin du Congo)", "density": [2.6, 0.6], "dbh": [105, 8],
            "oaRatio": [0.15, 0.05], "suspect": [3.2, 1.5], "species": ["Sapelli", "Tali", "Padouk Rouge", "Kossipo", "Sipo"]},
    "Littoral": {"label": "Littoral — forêt côtière et marécageuse", "density": [1.7, 0.5], "dbh": [98, 9],
                 "oaRatio": [0.11, 0.05], "suspect": [4.0, 1.7], "species": ["Azobé", "Ilomba", "Fraké", "Bongo", "Longhi"]},
}
REF_COUNTS = {r: 330 for r in PROFILES}

# Stylesheet = the web app's styles.css + overrides for <button> nav items.
css = open(os.path.join(ROOT, "web", "src", "styles.css"), encoding="utf8").read()
css += """
.nav button{width:100%;text-align:left;background:none;border:none;font:inherit;
  color:var(--mut);cursor:pointer;padding:9px 12px;border-radius:9px}
.nav button:hover{background:var(--elv);color:var(--txt)}
.nav button.on{background:var(--elv);color:var(--txt);box-shadow:inset 3px 0 0 var(--grn)}
body{background:var(--bg)}
"""

code = open(os.path.join(ROOT, "tools", "_syvief_code.jsx"), encoding="utf8").read()

def js(name, obj, compact=True):
    sep = (",", ":") if compact else (", ", ": ")
    return f"const {name} = {json.dumps(obj, ensure_ascii=False, separators=sep)};\n"

header = (
    "/*\n"
    " * SYVIEF — Système de Vérification d'Inventaire d'Exploitation Forestière\n"
    " * Version JSX autonome (mono-fichier, sans backend).\n"
    " *\n"
    " * Application React à composant unique : données d'inventaire, réseau de\n"
    " * neurones (inférence + entraînement navigateur) et carte GIS embarqués.\n"
    " * Les UC mesurent 1000 m × 250 m (25 ha). Le modèle apprend la signature des\n"
    " * inventaires certifiés sur 4 régions du Cameroun (Sud, Centre, Est, Littoral).\n"
    " *\n"
    " * Déposer dans un projet React (Vite/CRA) comme composant par défaut, ou\n"
    " * prévisualiser tel quel. Les décisions de contrôle sont persistées en\n"
    " * localStorage.\n"
    " */\n"
    'import { useState, useEffect, useRef, useMemo, useCallback } from "react";\n\n'
)

out = [header]
out.append("/* ===== DONNÉES EMBARQUÉES (extraites du rapport de conformité) ===== */\n")
out.append(js("UCS", ucs))
out.append(js("TREES_BY_UC", trees_by_uc))
out.append(js("BLOC_META", bloc_meta))
out.append(js("ALERTS", alerts))
out.append(js("META", meta_obj))
out.append(js("PROFILES", PROFILES))
out.append(js("REF_COUNTS", REF_COUNTS))
out.append(js("MODEL0", model))
out.append("const CSS = " + json.dumps(css, ensure_ascii=False) + ";\n\n")
out.append(code)

dest = os.path.join(ROOT, "SYVIEF.jsx")
open(dest, "w", encoding="utf8").write("".join(out))
size = os.path.getsize(dest)
print(f"écrit {dest} ({size} octets)")
print(f"  UCS={len(ucs)} trees={len(trees)} groupes={len(trees_by_uc)} alerts={len(alerts)}")
