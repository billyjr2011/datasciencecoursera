#!/usr/bin/env bash
# Build a self-contained, offline preview of the NdMED prototype.
# Bundles NdMedPrototype.jsx + React into one file (no CDN, no API key) and
# wraps it in prototype/preview.html — open that file in any browser.
#
#   ./prototype/build-preview.sh
#
# Requires the repo's dev deps (`npm install`). Uses the esbuild binary that
# ships with them. Regenerate whenever NdMedPrototype.jsx changes.
set -euo pipefail
cd "$(dirname "$0")/.."

ESBUILD="node_modules/@esbuild/linux-x64/bin/esbuild"
[ -x "$ESBUILD" ] || ESBUILD="npx --yes esbuild"

cat > prototype/_preview_entry.jsx <<'EOF'
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./NdMedPrototype.jsx";
createRoot(document.getElementById("root")).render(React.createElement(App));
EOF

# NOTE: --jsx=automatic is required. The prototype imports named hooks but not the
# default React, so the classic transform's React.createElement would be undefined.
$ESBUILD prototype/_preview_entry.jsx \
  --bundle --minify --format=iife --jsx=automatic \
  --loader:.jsx=jsx \
  --define:process.env.NODE_ENV='"production"' \
  --outfile=prototype/preview.bundle.js

{
  cat <<'HTML'
<title>NdMED — Interactive Prototype</title>
<style>
  :root{color-scheme:dark;}
  html,body{margin:0;background:#07182E;}
  #nd-badge{position:fixed;right:12px;bottom:12px;z-index:50;display:flex;align-items:center;gap:7px;
    padding:6px 12px;border-radius:20px;background:rgba(13,37,64,.92);border:1px solid rgba(0,201,177,.28);
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);
    font:600 10px/1 Inter,system-ui,sans-serif;color:#7A99B8;letter-spacing:.4px;}
  #nd-badge b{color:#00C9B1;font-weight:700;}
  #nd-badge i{width:7px;height:7px;border-radius:50%;background:#00C9B1;flex-shrink:0;
    box-shadow:0 0 0 0 rgba(0,201,177,.5);animation:ndb 1.6s ease-out infinite;}
  @keyframes ndb{70%{box-shadow:0 0 0 7px rgba(0,0,0,0)}100%{box-shadow:0 0 0 0 rgba(0,0,0,0)}}
  #nd-loading{min-height:100vh;display:flex;align-items:center;justify-content:center;
    color:#7A99B8;font:400 13px Inter,system-ui,sans-serif;}
  @media (prefers-reduced-motion:reduce){#nd-badge i{animation:none}}
</style>
<div id="root"><div id="nd-loading">Loading NdMED prototype…</div></div>
<div id="nd-badge"><i></i>NdMED&nbsp;<b>Prototype</b>&nbsp;· mock engine · no API key</div>
<script>
HTML
  cat prototype/preview.bundle.js
  printf '\n</script>\n'
} > prototype/preview.html

echo "Built prototype/preview.html ($(wc -c < prototype/preview.html) bytes) — open it in a browser."
