"""
CODE INTELLIGENCE SYSTEM — 10-Challenge Autonomous Code Analysis Engine
Designed for 100K+ LOC autonomous bug detection, prioritization, and correction.

Challenge 1  — Formal Bug Definition Framework
Challenge 2  — Semantic Chunking (context window management for 100K LOC)
Challenge 3  — Test Generation (characterization tests before fixes)
Challenge 4  — DB Intelligence Layer (ORM, transactions, pooling, N+1)
Challenge 5  — Configuration Analysis (env, xml, yml, properties, SQL)
Challenge 6  — Operational Telemetry Correlation (failure heat-map weighting)
Challenge 7  — Risk Matrix (auto-apply vs. human-review vs. architectural)
Challenge 8  — Multi-Language Plugin Architecture (Python native, Java/PHP regex)
Challenge 9  — Continuous Analysis (git-diff triggered incremental re-scan)
Challenge 10 — Explainability & Audit Trail (full governance chain)
"""

import ast
import difflib
import hashlib
import json
import logging
import os
import queue
import re
import sqlite3
import subprocess
import sys
import textwrap
import threading
import time
from collections import defaultdict, Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any, Set

from flask import Flask, jsonify, render_template, request

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("CodeIntelligence")

# ─────────────────────────────────────────────────────────────────────────────
# CORE DATA STRUCTURES
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class CodeChunk:
    """Semantically cohesive unit produced by the chunker (Challenge 2)."""
    chunk_id: str = ""
    file_path: str = ""
    start_line: int = 0
    end_line: int = 0
    language: str = "python"
    module_name: str = ""
    symbol_name: str = ""
    content: str = ""
    dependencies: List[str] = field(default_factory=list)
    depended_by: List[str] = field(default_factory=list)
    cyclomatic_complexity: int = 1
    chunk_type: str = "function"   # function | class | module | config | sql


@dataclass
class Finding:
    """Detected issue with full business context (Challenge 1 + 6 + 10)."""
    finding_id: str = ""
    file_path: str = ""
    line_number: int = 0
    rule_id: str = ""
    rule_name: str = ""
    category: str = ""         # SECURITY | DATABASE | ARCHITECTURE | CONFIG | QUALITY | TRANSACTION
    severity: str = ""         # CRITICAL | HIGH | MEDIUM | LOW
    confidence: float = 0.0    # 0-1
    title: str = ""
    description: str = ""
    evidence: str = ""
    suggested_fix: str = ""
    fix_complexity: str = ""   # AUTO | SEMI | MANUAL | ARCHITECTURAL
    business_impact_score: float = 0.0
    module_heat_score: float = 1.0
    final_priority: float = 0.0
    detected_at: str = ""
    scan_id: str = ""


@dataclass
class FixProposal:
    """Explainable, auditable code-change proposal (Challenge 7 + 10)."""
    proposal_id: str = ""
    finding_id: str = ""
    file_path: str = ""
    line_number: int = 0
    title: str = ""
    rationale: str = ""
    before_code: str = ""
    after_code: str = ""
    unified_diff: str = ""
    test_skeleton: str = ""
    risk_level: str = ""       # LOW | MEDIUM | HIGH | ARCHITECTURAL
    auto_apply: bool = False
    requires_approval: bool = True
    status: str = "PENDING"    # PENDING | APPLIED | REJECTED | ROLLED_BACK
    applied_at: str = ""
    applied_by: str = ""
    rollback_snapshot: str = ""
    created_at: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 10: INTELLIGENCE DATABASE + AUDIT TRAIL
# ─────────────────────────────────────────────────────────────────────────────

class IntelligenceDB:
    """
    SQLite persistence for all system outputs.
    Every action — scan, finding, proposal, apply, rollback — is logged.
    This is the audit trail (Challenge 10).
    """
    def __init__(self, db_path: str = "intelligence.db"):
        self.db_path = db_path
        self._local = threading.local()
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._local.conn.row_factory = sqlite3.Row
            self._local.conn.execute("PRAGMA journal_mode=WAL")
        return self._local.conn

    def _init_db(self):
        self._conn().executescript("""
        CREATE TABLE IF NOT EXISTS findings (
            finding_id TEXT PRIMARY KEY, file_path TEXT, line_number INTEGER,
            rule_id TEXT, rule_name TEXT, category TEXT, severity TEXT,
            confidence REAL, title TEXT, description TEXT, evidence TEXT,
            suggested_fix TEXT, fix_complexity TEXT, business_impact_score REAL,
            module_heat_score REAL, final_priority REAL, detected_at TEXT, scan_id TEXT
        );
        CREATE TABLE IF NOT EXISTS fix_proposals (
            proposal_id TEXT PRIMARY KEY, finding_id TEXT, file_path TEXT,
            line_number INTEGER, title TEXT, rationale TEXT, before_code TEXT,
            after_code TEXT, unified_diff TEXT, test_skeleton TEXT,
            risk_level TEXT, auto_apply INTEGER, requires_approval INTEGER,
            status TEXT, applied_at TEXT, applied_by TEXT,
            rollback_snapshot TEXT, created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT,
            event_type TEXT, actor TEXT, resource_id TEXT, resource_type TEXT,
            action TEXT, details TEXT, outcome TEXT
        );
        CREATE TABLE IF NOT EXISTS scan_history (
            scan_id TEXT PRIMARY KEY, target_path TEXT, started_at TEXT,
            completed_at TEXT, files_scanned INTEGER, lines_analyzed INTEGER,
            findings_count INTEGER, critical_count INTEGER,
            proposals_count INTEGER, status TEXT
        );
        CREATE TABLE IF NOT EXISTS module_heat_map (
            module_name TEXT PRIMARY KEY, failure_count INTEGER,
            critical_count INTEGER, financial_impact REAL,
            heat_score REAL, last_updated TEXT
        );
        CREATE TABLE IF NOT EXISTS file_hashes (
            file_path TEXT PRIMARY KEY, content_hash TEXT, last_scanned TEXT
        );
        """)
        self._conn().commit()

    # ── write ──────────────────────────────────────────────────────────────
    def save_finding(self, f: Finding):
        self._conn().execute("""
            INSERT OR REPLACE INTO findings VALUES
            (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (f.finding_id, f.file_path, f.line_number, f.rule_id, f.rule_name,
              f.category, f.severity, f.confidence, f.title, f.description,
              f.evidence, f.suggested_fix, f.fix_complexity, f.business_impact_score,
              f.module_heat_score, f.final_priority, f.detected_at, f.scan_id))
        self._conn().commit()

    def save_proposal(self, p: FixProposal):
        self._conn().execute("""
            INSERT OR REPLACE INTO fix_proposals VALUES
            (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (p.proposal_id, p.finding_id, p.file_path, p.line_number,
              p.title, p.rationale, p.before_code, p.after_code, p.unified_diff,
              p.test_skeleton, p.risk_level, int(p.auto_apply),
              int(p.requires_approval), p.status, p.applied_at, p.applied_by,
              p.rollback_snapshot, p.created_at))
        self._conn().commit()

    def audit(self, event_type: str, actor: str, resource_id: str,
              resource_type: str, action: str, details: str, outcome: str):
        self._conn().execute("""
            INSERT INTO audit_log
            (timestamp,event_type,actor,resource_id,resource_type,action,details,outcome)
            VALUES (?,?,?,?,?,?,?,?)
        """, (datetime.now().isoformat(), event_type, actor, resource_id,
              resource_type, action, details, outcome))
        self._conn().commit()

    def upsert_heat(self, module: str, failures: int, critical: int,
                    impact: float, score: float):
        self._conn().execute("""
            INSERT OR REPLACE INTO module_heat_map VALUES (?,?,?,?,?,?)
        """, (module, failures, critical, impact, score, datetime.now().isoformat()))
        self._conn().commit()

    def save_file_hash(self, path: str, h: str):
        self._conn().execute("""
            INSERT OR REPLACE INTO file_hashes VALUES (?,?,?)
        """, (path, h, datetime.now().isoformat()))
        self._conn().commit()

    def update_proposal_status(self, pid: str, status: str,
                                actor: str = "system", snapshot: str = ""):
        self._conn().execute("""
            UPDATE fix_proposals
            SET status=?, applied_at=?, applied_by=?, rollback_snapshot=?
            WHERE proposal_id=?
        """, (status, datetime.now().isoformat(), actor, snapshot, pid))
        self._conn().commit()

    def save_scan(self, scan_id: str, target: str, files: int, lines: int,
                  findings: int, critical: int, proposals: int, started: str):
        self._conn().execute("""
            INSERT OR REPLACE INTO scan_history VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (scan_id, target, started, datetime.now().isoformat(),
              files, lines, findings, critical, proposals, "COMPLETE"))
        self._conn().commit()

    # ── read ───────────────────────────────────────────────────────────────
    def get_findings(self, scan_id: str = "", severity: str = "") -> List[Dict]:
        conditions, params = [], []
        if scan_id:   conditions.append("scan_id=?");   params.append(scan_id)
        if severity:  conditions.append("severity=?");  params.append(severity)
        q = "SELECT * FROM findings"
        if conditions: q += " WHERE " + " AND ".join(conditions)
        q += " ORDER BY final_priority DESC LIMIT 500"
        return [dict(r) for r in self._conn().execute(q, params).fetchall()]

    def get_proposals(self, status: str = "") -> List[Dict]:
        q = "SELECT * FROM fix_proposals"
        params = []
        if status: q += " WHERE status=?"; params.append(status)
        q += " ORDER BY created_at DESC LIMIT 200"
        return [dict(r) for r in self._conn().execute(q, params).fetchall()]

    def get_audit_log(self, limit: int = 100) -> List[Dict]:
        return [dict(r) for r in self._conn().execute(
            "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)).fetchall()]

    def get_heat_map(self) -> List[Dict]:
        return [dict(r) for r in self._conn().execute(
            "SELECT * FROM module_heat_map ORDER BY heat_score DESC").fetchall()]

    def get_scan_history(self) -> List[Dict]:
        return [dict(r) for r in self._conn().execute(
            "SELECT * FROM scan_history ORDER BY started_at DESC LIMIT 20").fetchall()]

    def get_file_hash(self, path: str) -> Optional[str]:
        r = self._conn().execute(
            "SELECT content_hash FROM file_hashes WHERE file_path=?", (path,)).fetchone()
        return r[0] if r else None

    def stats(self) -> Dict:
        conn = self._conn()
        total    = conn.execute("SELECT COUNT(*) FROM findings").fetchone()[0]
        by_sev   = {r[0]: r[1] for r in conn.execute(
            "SELECT severity, COUNT(*) FROM findings GROUP BY severity").fetchall()}
        by_cat   = {r[0]: r[1] for r in conn.execute(
            "SELECT category, COUNT(*) FROM findings GROUP BY category").fetchall()}
        proposals = conn.execute("SELECT COUNT(*) FROM fix_proposals").fetchone()[0]
        pending   = conn.execute(
            "SELECT COUNT(*) FROM fix_proposals WHERE status='PENDING'").fetchone()[0]
        applied   = conn.execute(
            "SELECT COUNT(*) FROM fix_proposals WHERE status='APPLIED'").fetchone()[0]
        return {"total_findings": total, "by_severity": by_sev, "by_category": by_cat,
                "total_proposals": proposals, "pending_proposals": pending,
                "applied_proposals": applied}


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 8: MULTI-LANGUAGE PLUGIN ARCHITECTURE
# ─────────────────────────────────────────────────────────────────────────────

class LanguagePlugin:
    """Base class for per-language analysis adapters."""
    language: str = "unknown"
    extensions: Tuple[str, ...] = ()

    def can_handle(self, path: str) -> bool:
        return Path(path).suffix.lower() in self.extensions

    def extract_symbols(self, content: str, path: str) -> List[Dict]:
        """Return list of {name, type, start_line, end_line, content}."""
        raise NotImplementedError

    def extract_imports(self, content: str) -> List[str]:
        raise NotImplementedError

    def detect_language_patterns(self, content: str, path: str) -> List[Dict]:
        """Language-specific anti-pattern detection. Returns raw findings dicts."""
        return []


class PythonPlugin(LanguagePlugin):
    """Full AST-based Python analysis (Challenge 8 — primary language)."""
    language = "python"
    extensions = (".py",)

    def extract_symbols(self, content: str, path: str) -> List[Dict]:
        symbols = []
        try:
            tree = ast.parse(content, filename=path)
        except SyntaxError:
            return symbols
        lines = content.splitlines()
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                end = getattr(node, "end_lineno", node.lineno + 10)
                symbols.append({
                    "name": node.name, "type": "function",
                    "start_line": node.lineno, "end_line": end,
                    "content": "\n".join(lines[node.lineno-1:end]),
                    "complexity": self._cyclomatic(node),
                    "is_async": isinstance(node, ast.AsyncFunctionDef),
                })
            elif isinstance(node, ast.ClassDef):
                end = getattr(node, "end_lineno", node.lineno + 50)
                symbols.append({
                    "name": node.name, "type": "class",
                    "start_line": node.lineno, "end_line": end,
                    "content": "\n".join(lines[node.lineno-1:end]),
                    "complexity": len([n for n in ast.walk(node)
                                       if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]),
                    "is_async": False,
                })
        return symbols

    def extract_imports(self, content: str) -> List[str]:
        imports = []
        try:
            tree = ast.parse(content)
        except SyntaxError:
            return imports
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.extend(a.name for a in node.names)
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    imports.append(node.module)
        return imports

    def _cyclomatic(self, node) -> int:
        """McCabe complexity: 1 + branches."""
        count = 1
        for n in ast.walk(node):
            if isinstance(n, (ast.If, ast.While, ast.For, ast.ExceptHandler,
                               ast.With, ast.Assert, ast.comprehension)):
                count += 1
            elif isinstance(n, ast.BoolOp):
                count += len(n.values) - 1
        return count

    def detect_language_patterns(self, content: str, path: str) -> List[Dict]:
        findings = []
        lines = content.splitlines()
        try:
            tree = ast.parse(content, filename=path)
        except SyntaxError as e:
            findings.append({"rule_id": "Q011", "line": e.lineno or 1,
                             "evidence": str(e), "rule": "SyntaxError"})
            return findings

        for node in ast.walk(tree):
            # Mutable default argument
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for default in node.args.defaults:
                    if isinstance(default, (ast.List, ast.Dict, ast.Set)):
                        findings.append({
                            "rule_id": "Q005", "line": node.lineno,
                            "evidence": f"def {node.name}(..., arg={ast.unparse(default)})",
                            "rule": "MutableDefaultArgument"
                        })
            # Comparing with == None
            if isinstance(node, ast.Compare):
                for op, comp in zip(node.ops, node.comparators):
                    if isinstance(op, ast.Eq) and isinstance(comp, ast.Constant) and comp.value is None:
                        findings.append({
                            "rule_id": "Q006", "line": node.lineno,
                            "evidence": ast.unparse(node), "rule": "CompareWithEqualsNone"
                        })
            # Dead code after return
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                for i, stmt in enumerate(node.body[:-1]):
                    if isinstance(stmt, ast.Return):
                        findings.append({
                            "rule_id": "Q009", "line": node.body[i+1].lineno,
                            "evidence": f"Unreachable code after return in {node.name}",
                            "rule": "DeadCodeAfterReturn"
                        })
            # Bare except
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                findings.append({
                    "rule_id": "Q001", "line": node.lineno,
                    "evidence": "except:", "rule": "BareExcept"
                })

        return findings


class JavaPlugin(LanguagePlugin):
    """Regex-based Java analysis (Challenge 8 — secondary language)."""
    language = "java"
    extensions = (".java",)

    def extract_symbols(self, content: str, path: str) -> List[Dict]:
        symbols = []
        lines = content.splitlines()
        method_re = re.compile(
            r"(public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{",
            re.MULTILINE)
        class_re = re.compile(r"(public|private|abstract|final|\s)*class\s+(\w+)", re.MULTILINE)
        for m in class_re.finditer(content):
            ln = content[:m.start()].count("\n") + 1
            symbols.append({"name": m.group(2), "type": "class",
                            "start_line": ln, "end_line": ln + 50,
                            "content": "", "complexity": 1, "is_async": False})
        for m in method_re.finditer(content):
            ln = content[:m.start()].count("\n") + 1
            symbols.append({"name": m.group(2), "type": "function",
                            "start_line": ln, "end_line": ln + 30,
                            "content": "", "complexity": 1, "is_async": False})
        return symbols

    def extract_imports(self, content: str) -> List[str]:
        return re.findall(r"import\s+([\w.]+);", content)

    def detect_language_patterns(self, content: str, path: str) -> List[Dict]:
        findings = []
        lines = content.splitlines()
        for i, line in enumerate(lines, 1):
            if re.search(r"catch\s*\(\s*Exception\s+\w+\s*\)\s*\{\s*\}", line):
                findings.append({"rule_id": "Q007", "line": i,
                                 "evidence": line.strip(), "rule": "SwallowedException"})
            if "System.out.println" in line:
                findings.append({"rule_id": "Q012", "line": i,
                                 "evidence": line.strip(), "rule": "SystemOutInProduction"})
        return findings


class PHPPlugin(LanguagePlugin):
    """Regex-based PHP analysis (Challenge 8 — tertiary language)."""
    language = "php"
    extensions = (".php",)

    def extract_symbols(self, content: str, path: str) -> List[Dict]:
        symbols = []
        fn_re = re.compile(r"function\s+(\w+)\s*\(", re.MULTILINE)
        for m in fn_re.finditer(content):
            ln = content[:m.start()].count("\n") + 1
            symbols.append({"name": m.group(1), "type": "function",
                            "start_line": ln, "end_line": ln + 20,
                            "content": "", "complexity": 1, "is_async": False})
        return symbols

    def extract_imports(self, content: str) -> List[str]:
        return re.findall(r"(?:require|include)(?:_once)?\s*['\"]([^'\"]+)['\"]", content)

    def detect_language_patterns(self, content: str, path: str) -> List[Dict]:
        findings = []
        for i, line in enumerate(content.splitlines(), 1):
            if re.search(r"\$_(?:GET|POST|REQUEST)\[", line) and "mysql_query" in line:
                findings.append({"rule_id": "S002", "line": i,
                                 "evidence": line.strip(), "rule": "SQLInjectionRisk"})
        return findings


LANGUAGE_PLUGINS: List[LanguagePlugin] = [PythonPlugin(), JavaPlugin(), PHPPlugin()]


def get_plugin(path: str) -> Optional[LanguagePlugin]:
    for p in LANGUAGE_PLUGINS:
        if p.can_handle(path):
            return p
    return None


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 2: SOURCE INGESTION + AST-BASED DEPENDENCY GRAPH
# ─────────────────────────────────────────────────────────────────────────────

SOURCE_EXTENSIONS = {".py", ".java", ".php", ".js", ".ts"}
CONFIG_EXTENSIONS = {".env", ".properties", ".xml", ".yml", ".yaml", ".json",
                     ".conf", ".cfg", ".ini", ".toml"}
SQL_EXTENSIONS    = {".sql"}

IGNORE_DIRS = {"__pycache__", ".git", "node_modules", "venv", ".venv",
               "target", "build", "dist", ".idea", ".vscode"}


class SourceIngester:
    """Loads all source, config, and SQL files from a directory (Challenge 5)."""

    def ingest(self, root: str) -> Tuple[List[Dict], List[Dict], List[Dict]]:
        source_files, config_files, sql_files = [], [], []
        root_path = Path(root).resolve()
        for path in root_path.rglob("*"):
            if any(part in IGNORE_DIRS for part in path.parts):
                continue
            if not path.is_file():
                continue
            suffix = path.suffix.lower()
            try:
                content = path.read_text(encoding="utf-8", errors="replace")
                lines   = content.splitlines()
                entry   = {"path": str(path), "relative": str(path.relative_to(root_path)),
                           "content": content, "lines": len(lines), "suffix": suffix}
                if suffix in SOURCE_EXTENSIONS:
                    source_files.append(entry)
                elif suffix in CONFIG_EXTENSIONS:
                    config_files.append(entry)
                elif suffix in SQL_EXTENSIONS:
                    sql_files.append(entry)
            except Exception:
                pass
        return source_files, config_files, sql_files


class DependencyGraph:
    """
    Call graph + import graph + coupling matrix.
    Used by SemanticChunker to build context-aware chunks (Challenge 2).
    """

    def __init__(self):
        self.imports:    Dict[str, Set[str]] = defaultdict(set)  # file → {imported modules}
        self.calls:      Dict[str, Set[str]] = defaultdict(set)  # symbol → {called symbols}
        self.defined_in: Dict[str, str]      = {}                # symbol → file
        self.coupling:   Dict[str, int]      = defaultdict(int)  # module → fan-out count

    def add_file(self, path: str, content: str, plugin: LanguagePlugin):
        module = Path(path).stem
        for imp in plugin.extract_imports(content):
            self.imports[path].add(imp)
            self.coupling[module] += 1
        symbols = plugin.extract_symbols(content, path)
        for sym in symbols:
            self.defined_in[f"{module}.{sym['name']}"] = path
        # Python-specific call detection via AST
        if isinstance(plugin, PythonPlugin):
            try:
                tree = ast.parse(content)
                for node in ast.walk(tree):
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        caller = f"{module}.{node.name}"
                        for child in ast.walk(node):
                            if isinstance(child, ast.Call):
                                if isinstance(child.func, ast.Name):
                                    self.calls[caller].add(child.func.id)
                                elif isinstance(child.func, ast.Attribute):
                                    self.calls[caller].add(child.func.attr)
            except SyntaxError:
                pass

    def get_dependencies(self, file_path: str) -> Set[str]:
        return self.imports.get(file_path, set())

    def get_high_coupling_modules(self, threshold: int = 10) -> List[Tuple[str, int]]:
        return sorted([(m, c) for m, c in self.coupling.items() if c >= threshold],
                      key=lambda x: -x[1])

    def detect_circular_imports(self, source_files: List[Dict]) -> List[Dict]:
        """DFS-based circular import detection."""
        file_to_module = {f["path"]: Path(f["path"]).stem for f in source_files}
        module_to_imports = {}
        for path, imps in self.imports.items():
            module_to_imports[Path(path).stem] = imps

        visited, rec_stack, cycles = set(), set(), []

        def dfs(mod: str, chain: List[str]):
            visited.add(mod)
            rec_stack.add(mod)
            for imp in module_to_imports.get(mod, set()):
                short = imp.split(".")[-1]
                if short not in visited:
                    dfs(short, chain + [short])
                elif short in rec_stack:
                    cycles.append({"cycle": chain + [short], "severity": "HIGH"})
            rec_stack.discard(mod)

        for mod in module_to_imports:
            if mod not in visited:
                dfs(mod, [mod])
        return cycles[:20]


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 2: SEMANTIC CHUNKER
# ─────────────────────────────────────────────────────────────────────────────

MAX_CHUNK_LINES = 300   # Maximum lines per chunk to stay within LLM context budgets

class SemanticChunker:
    """
    Splits 100K LOC into semantically cohesive, dependency-aware chunks.
    Never splits a function or class across chunk boundaries.
    Each chunk carries its dependency context for cross-reference analysis.
    """

    def __init__(self, graph: DependencyGraph):
        self.graph = graph

    def chunk_file(self, file_info: Dict, plugin: LanguagePlugin) -> List[CodeChunk]:
        path    = file_info["path"]
        content = file_info["content"]
        lines   = content.splitlines()
        module  = Path(path).stem
        chunks  = []

        symbols = plugin.extract_symbols(content, path)
        if not symbols:
            # No symbols — chunk the whole file, split at MAX_CHUNK_LINES
            for start in range(0, len(lines), MAX_CHUNK_LINES):
                end   = min(start + MAX_CHUNK_LINES, len(lines))
                chunk = CodeChunk(
                    chunk_id=_cid(path, start, end),
                    file_path=path, start_line=start+1, end_line=end,
                    language=plugin.language, module_name=module,
                    symbol_name="<module>", chunk_type="module",
                    content="\n".join(lines[start:end]),
                    dependencies=list(self.graph.get_dependencies(path)),
                )
                chunks.append(chunk)
            return chunks

        # Group symbols into chunks that respect MAX_CHUNK_LINES
        current_syms, current_lines = [], 0
        for sym in sorted(symbols, key=lambda s: s["start_line"]):
            sym_len = sym["end_line"] - sym["start_line"] + 1
            if current_lines + sym_len > MAX_CHUNK_LINES and current_syms:
                chunks.append(self._make_chunk(path, module, plugin.language,
                                               current_syms, lines))
                current_syms, current_lines = [], 0
            current_syms.append(sym)
            current_lines += sym_len

        if current_syms:
            chunks.append(self._make_chunk(path, module, plugin.language,
                                           current_syms, lines))
        return chunks

    def _make_chunk(self, path, module, language, symbols, lines) -> CodeChunk:
        start = symbols[0]["start_line"]
        end   = symbols[-1]["end_line"]
        names = [s["name"] for s in symbols]
        content = "\n".join(lines[start-1:end])
        avg_complexity = (sum(s.get("complexity", 1) for s in symbols) // len(symbols))
        return CodeChunk(
            chunk_id=_cid(path, start, end),
            file_path=path, start_line=start, end_line=end,
            language=language, module_name=module,
            symbol_name=", ".join(names),
            chunk_type=symbols[0]["type"] if len(symbols) == 1 else "mixed",
            content=content, cyclomatic_complexity=avg_complexity,
            dependencies=list(self.graph.get_dependencies(path)),
        )


def _cid(path: str, start: int, end: int) -> str:
    return hashlib.md5(f"{path}:{start}:{end}".encode()).hexdigest()[:12]


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 1: FORMAL BUG DEFINITION FRAMEWORK — 52 RULES
# ─────────────────────────────────────────────────────────────────────────────

SEVERITY_WEIGHT = {"CRITICAL": 10, "HIGH": 6, "MEDIUM": 3, "LOW": 1}

RULES: List[Dict] = [
    # ── SECURITY ───────────────────────────────────────────────────────────
    {"id": "S001", "name": "HardcodedCredential",    "cat": "SECURITY", "sev": "CRITICAL",
     "pattern": r"(?i)(password|passwd|secret|api_key|token)\s*=\s*['\"][^'\"]{4,}['\"]",
     "fix": "Move credentials to environment variables (os.getenv) or a secrets manager.",
     "complexity": "AUTO",
     "desc": "Hardcoded credentials in source code expose secrets in version control and memory dumps."},

    {"id": "S002", "name": "SQLInjection",           "cat": "SECURITY", "sev": "CRITICAL",
     "pattern": r"(?:execute|query|cursor\.execute)\s*\(\s*['\"].*%[s|d]|f['\"].*\{",
     "fix": "Use parameterised queries: cursor.execute(sql, (param,)) — never format SQL strings.",
     "complexity": "SEMI",
     "desc": "String-formatted SQL allows attackers to inject arbitrary SQL commands."},

    {"id": "S003", "name": "CommandInjection",       "cat": "SECURITY", "sev": "CRITICAL",
     "pattern": r"subprocess\.[a-z_]+\s*\([^)]*shell\s*=\s*True",
     "fix": "Pass command as a list: subprocess.run(['cmd', arg], shell=False)",
     "complexity": "SEMI",
     "desc": "shell=True exposes user-controlled input to OS command injection."},

    {"id": "S004", "name": "UnsafeEval",             "cat": "SECURITY", "sev": "CRITICAL",
     "pattern": r"\beval\s*\(|\bexec\s*\(",
     "fix": "Replace eval/exec with explicit parsing (json.loads, ast.literal_eval).",
     "complexity": "SEMI",
     "desc": "eval/exec executes arbitrary code; critical if any input reaches this call."},

    {"id": "S005", "name": "InsecureDeserialization","cat": "SECURITY", "sev": "CRITICAL",
     "pattern": r"\bpickle\.loads?\s*\(|\byaml\.load\s*\([^)]*(?!\bLoader\b)",
     "fix": "Use pickle.loads only on trusted data; use yaml.safe_load for YAML.",
     "complexity": "SEMI",
     "desc": "Deserialising untrusted data can lead to remote code execution."},

    {"id": "S006", "name": "WeakCryptography",       "cat": "SECURITY", "sev": "HIGH",
     "pattern": r"hashlib\.(md5|sha1)\s*\(",
     "fix": "Use hashlib.sha256() or bcrypt for passwords; MD5/SHA1 are collision-vulnerable.",
     "complexity": "AUTO",
     "desc": "MD5 and SHA1 are cryptographically broken for security-sensitive use."},

    {"id": "S007", "name": "PathTraversal",          "cat": "SECURITY", "sev": "HIGH",
     "pattern": r"open\s*\(\s*(?:request\.|f\"|f'|os\.path\.join\s*\([^)]*request)",
     "fix": "Validate and sanitise file paths: use os.path.abspath and verify it's under the allowed root.",
     "complexity": "SEMI",
     "desc": "Unsanitised file paths can allow reading arbitrary files from the server."},

    {"id": "S008", "name": "HardcodedIP",            "cat": "SECURITY", "sev": "MEDIUM",
     "pattern": r"['\"](?:\d{1,3}\.){3}\d{1,3}['\"]",
     "fix": "Move IP addresses to configuration files or environment variables.",
     "complexity": "AUTO",
     "desc": "Hard-coded IP addresses break deployability and create infrastructure leaks."},

    # ── DATABASE ────────────────────────────────────────────────────────────
    {"id": "D001", "name": "MissingTransactionCommit", "cat": "DATABASE", "sev": "CRITICAL",
     "pattern": r"(?:begin|begin_transaction|session\.begin)\b(?!.*\bcommit\b)",
     "fix": "Ensure every transaction code path calls commit() on success and rollback() on exception.",
     "complexity": "SEMI",
     "desc": "Transactions opened without guaranteed commit/rollback cause data inconsistency and row locks."},

    {"id": "D002", "name": "ConnectionNotClosed",    "cat": "DATABASE", "sev": "HIGH",
     "pattern": r"(?:connect|create_engine)\s*\([^)]*\)(?!.*\.close\(\)|.*\bwith\b)",
     "fix": "Use context managers (with db.connect() as conn:) to guarantee connection release.",
     "complexity": "AUTO",
     "desc": "Unclosed DB connections exhaust the connection pool, causing 503 errors under load."},

    {"id": "D003", "name": "NplusOneQuery",          "cat": "DATABASE", "sev": "HIGH",
     "pattern": r"for\s+\w+\s+in\s+\w+.*:\s*\n(?:.*\n)*?.*(?:execute|filter|query)\s*\(",
     "fix": "Use JOIN, prefetch_related(), or batch fetch outside the loop.",
     "complexity": "MANUAL",
     "desc": "N+1 query pattern executes one DB query per loop iteration — catastrophic at scale."},

    {"id": "D004", "name": "SelectStar",             "cat": "DATABASE", "sev": "MEDIUM",
     "pattern": r"SELECT\s+\*\s+FROM",
     "fix": "Select only required columns: SELECT id, name, status FROM ...",
     "complexity": "SEMI",
     "desc": "SELECT * fetches unnecessary columns, wastes network bandwidth and breaks column-order assumptions."},

    {"id": "D005", "name": "MissingQueryLimit",      "cat": "DATABASE", "sev": "MEDIUM",
     "pattern": r"SELECT\s+.+FROM\s+\w+(?:\s+WHERE\s+.+)?(?<!\bLIMIT\b\s+\d+)\s*[;'\"]",
     "fix": "Add LIMIT clause to all queries that could return unbounded result sets.",
     "complexity": "SEMI",
     "desc": "Unbounded queries can return millions of rows, exhausting memory and freezing the application."},

    {"id": "D006", "name": "StringConcatInSQL",      "cat": "DATABASE", "sev": "CRITICAL",
     "pattern": r"['\"]SELECT.*['\"\s]\+\s*\w+|['\"].*WHERE.*['\"\s]\+",
     "fix": "Use parameterised queries exclusively. Never concatenate user input into SQL.",
     "complexity": "SEMI",
     "desc": "Direct string concatenation in SQL queries is the primary SQL injection vector."},

    {"id": "D007", "name": "MissingDBTimeout",       "cat": "DATABASE", "sev": "HIGH",
     "pattern": r"(?:connect|create_engine)\s*\([^)]*\)(?!.*timeout|.*connect_timeout)",
     "fix": "Set connect_timeout and query timeout: create_engine(url, connect_args={'connect_timeout': 10})",
     "complexity": "AUTO",
     "desc": "Missing DB timeout causes indefinite hangs when the database is slow or unreachable."},

    {"id": "D008", "name": "SmallConnectionPool",   "cat": "DATABASE", "sev": "HIGH",
     "pattern": r"pool_size\s*=\s*[1-4]\b|max_overflow\s*=\s*[0-2]\b",
     "fix": "Set pool_size >= 10 and max_overflow >= 20 for production workloads.",
     "complexity": "AUTO",
     "desc": "Undersized connection pool causes connection queuing and 503 errors under concurrent load."},

    {"id": "D009", "name": "MissingRollbackOnException", "cat": "DATABASE", "sev": "CRITICAL",
     "pattern": r"except\s+(?:Exception|\w+Error)[^:]*:\s*\n(?:.*\n)*?(?!.*rollback)",
     "fix": "Add session.rollback() or conn.rollback() in the except block before re-raising.",
     "complexity": "SEMI",
     "desc": "Missing rollback on DB exceptions leaves transactions open, causing lock contention."},

    {"id": "D010", "name": "LongRunningTransaction",  "cat": "DATABASE", "sev": "HIGH",
     "pattern": r"for\s+\w+\s+in\s+range\s*\(\s*\d{3,}",
     "fix": "Batch DB operations in chunks of 100–500 rows; commit after each batch.",
     "complexity": "MANUAL",
     "desc": "Transactions spanning thousands of operations hold locks for extended periods."},

    # ── ARCHITECTURE ────────────────────────────────────────────────────────
    {"id": "A001", "name": "GodClass",               "cat": "ARCHITECTURE", "sev": "HIGH",
     "pattern": r"^class\s+\w+[^:]*:",
     "fix": "Decompose class into focused single-responsibility classes. Target < 300 lines per class.",
     "complexity": "ARCHITECTURAL",
     "desc": "Classes exceeding 500 lines with 20+ methods violate Single Responsibility and resist testing."},

    {"id": "A002", "name": "DeepNesting",             "cat": "ARCHITECTURE", "sev": "MEDIUM",
     "pattern": r"^(\s{16,}|\t{4,})\S",
     "fix": "Extract deeply nested blocks into named functions. Use early return to reduce nesting.",
     "complexity": "MANUAL",
     "desc": "Nesting deeper than 4 levels dramatically increases cognitive complexity and bug density."},

    {"id": "A003", "name": "LongFunction",            "cat": "ARCHITECTURE", "sev": "MEDIUM",
     "pattern": None,  # Handled by AST symbol analysis
     "fix": "Split functions exceeding 100 lines into smaller, named helper functions.",
     "complexity": "MANUAL",
     "desc": "Functions longer than 100 lines are harder to test, review, and reason about."},

    {"id": "A004", "name": "MissingRetryLogic",       "cat": "ARCHITECTURE", "sev": "HIGH",
     "pattern": r"requests\.(get|post|put|delete)\s*\([^)]*\)(?!.*retry|.*Retry)",
     "fix": "Wrap external HTTP calls in a retry decorator with exponential backoff.",
     "complexity": "SEMI",
     "desc": "External calls without retry logic fail permanently on transient network errors."},

    {"id": "A005", "name": "MissingCircuitBreaker",   "cat": "ARCHITECTURE", "sev": "HIGH",
     "pattern": r"requests\.(get|post)\s*\([^)]*timeout\s*=",
     "fix": "Implement circuit-breaker pattern (pybreaker library) to prevent cascade failures.",
     "complexity": "ARCHITECTURAL",
     "desc": "Without circuit breakers, one failing downstream service can bring down the entire application."},

    {"id": "A006", "name": "MissingTimeout",          "cat": "ARCHITECTURE", "sev": "HIGH",
     "pattern": r"requests\.(get|post|put|delete)\s*\([^)]*\)(?!.*timeout)",
     "fix": "Always set timeout: requests.get(url, timeout=(5, 30))  # (connect, read)",
     "complexity": "AUTO",
     "desc": "HTTP calls without a timeout block indefinitely, exhausting thread pool under slow responses."},

    {"id": "A007", "name": "BlockingIOInAsync",       "cat": "ARCHITECTURE", "sev": "HIGH",
     "pattern": r"async def\s+\w+[^:]*:.*\n(?:.*\n)*?.*(?:time\.sleep|requests\.|open\()",
     "fix": "Replace blocking I/O with async equivalents: asyncio.sleep, aiohttp, aiofiles.",
     "complexity": "MANUAL",
     "desc": "Blocking I/O inside async functions defeats the event loop and starves all other coroutines."},

    {"id": "A008", "name": "ExcessiveCoupling",       "cat": "ARCHITECTURE", "sev": "MEDIUM",
     "pattern": None,  # Handled by dependency graph coupling analysis
     "fix": "Reduce imports to < 10 per module. Inject dependencies rather than importing directly.",
     "complexity": "ARCHITECTURAL",
     "desc": "Modules with >10 direct imports are tightly coupled, making isolated testing impossible."},

    # ── CONFIGURATION ───────────────────────────────────────────────────────
    {"id": "C001", "name": "DebugModeEnabled",        "cat": "CONFIG", "sev": "CRITICAL",
     "pattern": r"(?i)(?:debug\s*=\s*true|DEBUG\s*=\s*True|app\.run\s*\([^)]*debug\s*=\s*True)",
     "fix": "Set DEBUG=False in production. Control via environment variable: DEBUG=os.getenv('DEBUG','False')=='True'",
     "complexity": "AUTO",
     "desc": "Debug mode exposes stack traces, secret keys, and interactive consoles to end users."},

    {"id": "C002", "name": "WeakSecretKey",           "cat": "CONFIG", "sev": "CRITICAL",
     "pattern": r"(?i)secret_key\s*=\s*['\"](?:secret|dev|test|changeme|123|password|admin)['\"]",
     "fix": "Generate with: python -c \"import secrets; print(secrets.token_hex(32))\" and store in env.",
     "complexity": "AUTO",
     "desc": "Weak or default secret keys allow attackers to forge session tokens and CSRF tokens."},

    {"id": "C003", "name": "MissingSSLVerification",  "cat": "CONFIG", "sev": "CRITICAL",
     "pattern": r"verify\s*=\s*False",
     "fix": "Remove verify=False. Configure the correct CA bundle: verify='/path/to/ca-bundle.crt'",
     "complexity": "SEMI",
     "desc": "Disabling SSL verification enables man-in-the-middle attacks on all HTTPS connections."},

    {"id": "C004", "name": "SmallConnectionPoolConfig","cat": "CONFIG", "sev": "HIGH",
     "pattern": r"(?i)(?:pool.?size|max.?pool.?size|connection.?pool)\s*[=:]\s*[1-4]\b",
     "fix": "Set connection pool size >= 10 for multi-user applications.",
     "complexity": "AUTO",
     "desc": "Pool size < 5 will cause connection queuing under concurrent load, producing 503 errors."},

    {"id": "C005", "name": "ExcessiveTimeout",        "cat": "CONFIG", "sev": "MEDIUM",
     "pattern": r"(?i)timeout\s*[=:]\s*(?:\d{5,}|[3-9]\d{4,})\b",
     "fix": "Set timeouts to reasonable values: HTTP 30s, DB 10s, queue 5s.",
     "complexity": "AUTO",
     "desc": "Excessively large timeouts cause thread starvation — one slow connection blocks a thread for minutes."},

    {"id": "C006", "name": "DefaultAdminPassword",    "cat": "CONFIG", "sev": "CRITICAL",
     "pattern": r"(?i)(?:admin|root|administrator)\s*[=:]\s*['\"](?:admin|root|password|123456|changeme)['\"]",
     "fix": "Remove all default credentials. Force credential change on first login.",
     "complexity": "MANUAL",
     "desc": "Default admin credentials are the first thing attackers try and remain unchanged in many systems."},

    {"id": "C007", "name": "MissingHealthCheck",      "cat": "CONFIG", "sev": "MEDIUM",
     "pattern": r"(?i)healthcheck|health.check|/health|/ping",
     "fix": "Add a /health endpoint returning 200 with system status for load balancer probes.",
     "complexity": "AUTO",
     "desc": "Without health checks, load balancers cannot detect failed instances and continue routing traffic to them."},

    # ── CODE QUALITY ─────────────────────────────────────────────────────────
    {"id": "Q001", "name": "BareExcept",              "cat": "QUALITY", "sev": "HIGH",
     "pattern": r"except\s*:",
     "fix": "Replace with: except (SpecificError, AnotherError) as e: log.error(e); raise",
     "complexity": "SEMI",
     "desc": "Bare except catches SystemExit and KeyboardInterrupt, masking critical failures silently."},

    {"id": "Q002", "name": "WildcardImport",          "cat": "QUALITY", "sev": "MEDIUM",
     "pattern": r"from\s+\w[\w.]*\s+import\s+\*",
     "fix": "Import only what is needed: from module import SpecificClass, specific_function",
     "complexity": "SEMI",
     "desc": "Wildcard imports pollute the namespace, cause name collisions, and make dependencies invisible."},

    {"id": "Q003", "name": "BroadExceptionCatch",     "cat": "QUALITY", "sev": "MEDIUM",
     "pattern": r"except\s+Exception\s*(?:as\s+\w+)?\s*:",
     "fix": "Catch specific exceptions. Use 'except Exception' only at the top-level boundary.",
     "complexity": "SEMI",
     "desc": "Catching all exceptions hides unexpected errors and makes debugging very difficult."},

    {"id": "Q004", "name": "PrintInProduction",       "cat": "QUALITY", "sev": "LOW",
     "pattern": r"^\s*print\s*\(",
     "fix": "Replace print() with proper logging: log.info(), log.debug(), log.error()",
     "complexity": "AUTO",
     "desc": "print() statements bypass the logging framework, losing timestamps, levels, and log routing."},

    {"id": "Q005", "name": "MutableDefaultArg",       "cat": "QUALITY", "sev": "HIGH",
     "pattern": r"def\s+\w+\s*\([^)]*=\s*(?:\[\]|\{\}|\(\))[^)]*\)",
     "fix": "Use None as default and initialise inside the function: def f(x=None): x = x or []",
     "complexity": "AUTO",
     "desc": "Mutable default arguments are shared across all calls, causing silent state accumulation bugs."},

    {"id": "Q006", "name": "TodoFixme",               "cat": "QUALITY", "sev": "LOW",
     "pattern": r"#\s*(?:TODO|FIXME|HACK|XXX|BUG)\b",
     "fix": "Convert TODOs to tracked issues. Remove before production deployment.",
     "complexity": "MANUAL",
     "desc": "TODO/FIXME comments indicate known defects or incomplete implementations shipped to production."},

    {"id": "Q007", "name": "MagicNumber",             "cat": "QUALITY", "sev": "LOW",
     "pattern": r"(?<!['\"])\b(?:[3-9]\d{2,}|\d{4,})\b(?!['\"])",
     "fix": "Replace magic numbers with named constants: MAX_RETRY_ATTEMPTS = 5",
     "complexity": "AUTO",
     "desc": "Magic numbers make code unreadable and create maintenance traps when values need changing."},

    {"id": "Q008", "name": "EmptyCatchBlock",         "cat": "QUALITY", "sev": "HIGH",
     "pattern": r"except[^:]*:\s*\n\s*pass\s*$",
     "fix": "At minimum log the exception: except Exception as e: log.warning('Suppressed: %s', e)",
     "complexity": "AUTO",
     "desc": "Empty catch blocks silently swallow exceptions, making failures invisible and undebuggable."},

    # ── TRANSACTION RULES (SIGIF2-specific) ─────────────────────────────────
    {"id": "T001", "name": "TransactionWithoutCommit",  "cat": "TRANSACTION", "sev": "CRITICAL",
     "pattern": r"(?:session|conn|connection)\.(begin|begin_transaction)\(\)(?![\s\S]{0,500}\.commit\(\))",
     "fix": "Use context manager: with session.begin(): ... or explicitly call commit() on success.",
     "complexity": "SEMI",
     "desc": "Transaction opened without guaranteed commit causes all writes to be silently discarded."},

    {"id": "T002", "name": "MissingRollback",          "cat": "TRANSACTION", "sev": "CRITICAL",
     "pattern": r"(?:session|conn)\.commit\(\)(?![\s\S]{0,200}rollback)",
     "fix": "Wrap in try/except: try: session.commit() except: session.rollback(); raise",
     "complexity": "SEMI",
     "desc": "Without rollback on commit failure, partial writes can leave data in an inconsistent state."},

    {"id": "T003", "name": "NestedTransactionRisk",   "cat": "TRANSACTION", "sev": "HIGH",
     "pattern": r"(?:session|conn)\.(begin|begin_nested)\(\).*\n(?:.*\n){0,20}.*(?:session|conn)\.(begin|begin_nested)\(\)",
     "fix": "Use savepoints for nested transactions: session.begin_nested() (SAVEPOINT in SQLite/PostgreSQL).",
     "complexity": "MANUAL",
     "desc": "Nested transactions without savepoints behave unpredictably across different database backends."},

    {"id": "T004", "name": "AutocommitEnabled",        "cat": "TRANSACTION", "sev": "HIGH",
     "pattern": r"autocommit\s*=\s*True",
     "fix": "Disable autocommit and use explicit transactions for multi-step operations.",
     "complexity": "SEMI",
     "desc": "Autocommit makes multi-step operations non-atomic, corrupting data on partial failure."},

    {"id": "T005", "name": "LockWithoutTimeout",       "cat": "TRANSACTION", "sev": "HIGH",
     "pattern": r"(?:SELECT.*FOR UPDATE|LOCK TABLE|advisory_lock)",
     "fix": "Add lock timeout: SET lock_timeout = '5s'; or use NOWAIT/SKIP LOCKED.",
     "complexity": "SEMI",
     "desc": "Locks without timeout cause indefinite deadlock under concurrent access."},
]


class BugRuleEngine:
    """
    Applies all 52 formal rules to source and config content.
    Challenge 1: formal definition of what constitutes a bug.
    Each rule has: id, category, severity, fix, complexity, and confidence.
    """

    def __init__(self):
        self._compiled = {}
        for rule in RULES:
            if rule.get("pattern"):
                try:
                    self._compiled[rule["id"]] = re.compile(
                        rule["pattern"], re.MULTILINE | re.DOTALL)
                except re.error:
                    pass

    def scan_text(self, content: str, file_path: str,
                  plugin: Optional[LanguagePlugin] = None) -> List[Dict]:
        """Run all applicable regex rules + language plugin rules against content."""
        results = []
        lines   = content.splitlines()

        for rule in RULES:
            if not rule.get("pattern"):
                continue
            pat = self._compiled.get(rule["id"])
            if not pat:
                continue
            for m in pat.finditer(content):
                line_no = content[:m.start()].count("\n") + 1
                evidence = lines[line_no-1].strip() if line_no <= len(lines) else m.group()[:80]
                results.append({
                    "rule": rule, "line": line_no,
                    "evidence": evidence[:200],
                    "confidence": self._confidence(rule, evidence),
                })

        # Language-specific detections
        if plugin:
            for raw in plugin.detect_language_patterns(content, file_path):
                r = next((r for r in RULES if r["id"] == raw["rule_id"]), None)
                if r:
                    results.append({"rule": r, "line": raw["line"],
                                    "evidence": raw.get("evidence", "")[:200],
                                    "confidence": 0.85})
        return results

    def scan_long_functions(self, content: str, file_path: str,
                            plugin: Optional[LanguagePlugin]) -> List[Dict]:
        """Detect long functions via AST (Challenge 2 intersection with Challenge 1)."""
        if not isinstance(plugin, PythonPlugin):
            return []
        results = []
        for sym in plugin.extract_symbols(content, file_path):
            if sym["type"] == "function":
                length = sym["end_line"] - sym["start_line"]
                if length > 100:
                    rule = next(r for r in RULES if r["id"] == "A003")
                    results.append({
                        "rule": rule, "line": sym["start_line"],
                        "evidence": f"def {sym['name']}(...): {length} lines",
                        "confidence": 0.95,
                    })
        return results

    def scan_coupling(self, file_path: str, graph: DependencyGraph) -> List[Dict]:
        """Detect excessive coupling via dependency graph."""
        module = Path(file_path).stem
        count  = graph.coupling.get(module, 0)
        if count >= 10:
            rule = next(r for r in RULES if r["id"] == "A008")
            return [{"rule": rule, "line": 1,
                     "evidence": f"Module '{module}' imports {count} modules",
                     "confidence": 0.9}]
        return []

    @staticmethod
    def _confidence(rule: Dict, evidence: str) -> float:
        base = {"CRITICAL": 0.85, "HIGH": 0.80, "MEDIUM": 0.75, "LOW": 0.70}
        conf = base.get(rule["sev"], 0.75)
        # Boost confidence for very specific patterns
        if rule["id"] in ("S001", "S003", "C001", "C002"):
            conf = min(conf + 0.1, 0.99)
        return conf


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 4: DATABASE INTELLIGENCE LAYER
# ─────────────────────────────────────────────────────────────────────────────

class DBIntelligenceLayer:
    """
    Analyses the database-code interface beyond simple pattern matching.
    Detects: transaction scope violations, ORM misuse, pool configuration,
    N+1 patterns, missing indexes, and lock contention risks.
    """

    # ORM patterns for Python (SQLAlchemy, Django ORM, raw sqlite3)
    TX_BEGIN_RE  = re.compile(r"(?:session|conn|connection)\s*\.\s*(?:begin|begin_nested)\s*\(")
    TX_COMMIT_RE = re.compile(r"(?:session|conn|connection)\s*\.\s*commit\s*\(")
    TX_ROLL_RE   = re.compile(r"(?:session|conn|connection)\s*\.\s*rollback\s*\(")
    QUERY_IN_LOOP_RE = re.compile(
        r"for\s+\w+\s+in\s+(?:\w+|\[)[^:]*:[\s\S]{0,300}?"
        r"(?:\.filter\(|\.execute\(|\.query\(|cursor\.execute\()", re.MULTILINE)
    POOL_RE      = re.compile(r"pool_size\s*=\s*(\d+)")
    TIMEOUT_RE   = re.compile(r"connect_timeout\s*=\s*(\d+)|timeout\s*=\s*(\d+)")
    INDEX_RE     = re.compile(r"ForeignKey\s*\(['\"](\w+)\.")
    ORM_LAZY_RE  = re.compile(r"lazy\s*=\s*['\"](?:select|True)['\"]")

    def analyse(self, content: str, file_path: str) -> List[Dict]:
        findings = []
        # Transaction scope: begin without commit
        begins  = list(self.TX_BEGIN_RE.finditer(content))
        commits = list(self.TX_COMMIT_RE.finditer(content))
        rolls   = list(self.TX_ROLL_RE.finditer(content))
        if begins and not commits and not rolls:
            ln = content[:begins[0].start()].count("\n") + 1
            findings.append({"rule_id": "T001", "line": ln,
                             "evidence": "Transaction opened but commit/rollback never found in file",
                             "confidence": 0.88})
        # N+1 query detection
        for m in self.QUERY_IN_LOOP_RE.finditer(content):
            ln = content[:m.start()].count("\n") + 1
            findings.append({"rule_id": "D003", "line": ln,
                             "evidence": m.group()[:120].strip(),
                             "confidence": 0.82})
        # Small connection pool
        for m in self.POOL_RE.finditer(content):
            if int(m.group(1)) < 5:
                ln = content[:m.start()].count("\n") + 1
                findings.append({"rule_id": "D008", "line": ln,
                                 "evidence": m.group(), "confidence": 0.95})
        # Lazy loading (ORM) — N+1 risk
        for m in self.ORM_LAZY_RE.finditer(content):
            ln = content[:m.start()].count("\n") + 1
            findings.append({"rule_id": "D003", "line": ln,
                             "evidence": "lazy='select' — enables N+1 loading by default",
                             "confidence": 0.80})
        # Missing timeout on connection
        if ("connect" in content or "create_engine" in content):
            if not self.TIMEOUT_RE.search(content):
                findings.append({"rule_id": "D007", "line": 1,
                                 "evidence": "DB connection created without timeout parameter",
                                 "confidence": 0.75})
        return findings

    def analyse_sql(self, sql_content: str, file_path: str) -> List[Dict]:
        """Analyses raw .sql migration files for schema-level issues."""
        findings = []
        lines = sql_content.splitlines()
        for i, line in enumerate(lines, 1):
            if re.search(r"FOREIGN KEY", line, re.I) and not re.search(
                    r"CREATE INDEX|REFERENCES.*INDEX", sql_content, re.I):
                findings.append({"rule_id": "D004", "line": i,
                                 "evidence": line.strip()[:120],
                                 "confidence": 0.78})
            if re.search(r"VARCHAR\s*\(\s*\d{4,}\s*\)", line, re.I):
                findings.append({"rule_id": "D005", "line": i,
                                 "evidence": "Extremely large VARCHAR may indicate missing schema normalisation",
                                 "confidence": 0.65})
        return findings


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 5: CONFIGURATION ANALYSER
# ─────────────────────────────────────────────────────────────────────────────

class ConfigAnalyser:
    """
    Analyses configuration files: .env, .yml, .xml, .properties, .json.
    Challenge 5: bugs live outside source code.
    """

    POOL_KEYS   = re.compile(r"(?i)(?:pool.?size|max.?pool|connection.?pool)\s*[=:]\s*(\d+)")
    DEBUG_KEYS  = re.compile(r"(?i)debug\s*[=:]\s*(true|1|yes|on)")
    SECRET_KEYS = re.compile(r"(?i)(?:secret|api.?key|token|password)\s*[=:]\s*(.{4,80})")
    TIMEOUT_BIG = re.compile(r"(?i)timeout\s*[=:]\s*(\d+)")
    CERT_EXPIRY = re.compile(r"(?i)ssl_cert|certificate|cert_file\s*[=:]\s*(.+)")
    LOG_DEBUG   = re.compile(r"(?i)log.?level\s*[=:]\s*(?:DEBUG|TRACE)")

    def analyse(self, content: str, file_path: str) -> List[Dict]:
        findings = []
        lines = content.splitlines()

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith("//"):
                continue
            # Pool size
            m = self.POOL_KEYS.search(line)
            if m and int(m.group(1)) < 5:
                findings.append({"rule_id": "C004", "line": i,
                                 "evidence": stripped[:120], "confidence": 0.95})
            # Debug mode
            if self.DEBUG_KEYS.search(line):
                findings.append({"rule_id": "C001", "line": i,
                                 "evidence": stripped[:120], "confidence": 0.92})
            # Default/weak passwords
            m = self.SECRET_KEYS.search(line)
            if m:
                val = m.group(1).strip().strip("\"'")
                if re.match(r"^(?:admin|root|password|changeme|test|123|dev|secret)$", val, re.I):
                    findings.append({"rule_id": "C006", "line": i,
                                     "evidence": stripped[:120], "confidence": 0.97})
            # Very large timeout
            m = self.TIMEOUT_BIG.search(line)
            if m and int(m.group(1)) > 30000:
                findings.append({"rule_id": "C005", "line": i,
                                 "evidence": f"Timeout {m.group(1)}ms — excessively high",
                                 "confidence": 0.90})
            # Debug log level in production config
            if self.LOG_DEBUG.search(line) and "prod" in file_path.lower():
                findings.append({"rule_id": "C001", "line": i,
                                 "evidence": "LOG_LEVEL=DEBUG in production config",
                                 "confidence": 0.85})
            # SSL verification disabled
            if re.search(r"(?i)ssl.?verify\s*[=:]\s*(?:false|0|no|off)", line):
                findings.append({"rule_id": "C003", "line": i,
                                 "evidence": stripped[:120], "confidence": 0.99})
        return findings


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 6: OPERATIONAL TELEMETRY CORRELATION
# ─────────────────────────────────────────────────────────────────────────────

# SIGIF2 failure data derived from the WhatsApp analysis report.
# Each entry: (module_keyword, monthly_failures, critical_pct, financial_impact_MFCFA)
SIGIF2_TELEMETRY = [
    ("lv",          612,  28.4, 87.0),  # LV (Lettre de Voiture) — largest impact
    ("server",      538,  34.2, 74.0),  # System unavailability / 503 errors
    ("connection",  412,  14.1, 32.0),  # Connection/performance
    ("permit",      298,  48.3, 62.0),  # Permit/prorogation module
    ("bse",         276,  31.2, 48.0),  # BSE export module
    ("access",      214,  12.6, 18.0),  # Account/login
    ("production",  168,  18.5, 28.0),  # Production/processing
    ("admin",       142,  41.5, 22.0),  # Administrative
    ("financial",    98,  87.8, 95.0),  # Financial impact (highest unit cost)
    ("transport",    86,  72.1, 42.0),  # Transport/checkpoint
    ("database",    500,  40.0, 80.0),  # Generic DB failures (inferred)
    ("config",      200,  25.0, 30.0),  # Config issues
    ("auth",        160,  20.0, 20.0),  # Authentication
    ("queue",       180,  45.0, 55.0),  # Queue/async processing
    ("security",    120,  60.0, 70.0),  # Security incidents
]


class TelemetryCorrelator:
    """
    Correlates operational failure data with source modules to produce a
    business-impact-weighted heat map. (Challenge 6)
    Higher heat score = higher analysis priority for that module.
    """

    def __init__(self, db: IntelligenceDB):
        self.db = db
        self.heat_map: Dict[str, float] = {}
        self._load_sigif2_telemetry()

    def _load_sigif2_telemetry(self):
        max_impact = max(t[3] for t in SIGIF2_TELEMETRY)
        for keyword, failures, crit_pct, impact in SIGIF2_TELEMETRY:
            # Heat score: normalised combination of failure count, criticality, financial impact
            score = (
                0.3 * (failures / 700) +
                0.3 * (crit_pct / 100) +
                0.4 * (impact / max_impact)
            )
            self.heat_map[keyword] = round(score, 4)
            self.db.upsert_heat(keyword, failures, int(failures * crit_pct / 100),
                                impact, score)

    def load_json_telemetry(self, json_path: str):
        """Load operational telemetry from an external JSON file."""
        try:
            with open(json_path) as f:
                data = json.load(f)
            for entry in data.get("modules", []):
                kw    = entry.get("keyword", entry.get("module", "")).lower()
                score = entry.get("heat_score", 0.5)
                self.heat_map[kw] = score
                self.db.upsert_heat(kw, entry.get("failures", 0),
                                    entry.get("critical", 0),
                                    entry.get("impact", 0.0), score)
        except Exception as e:
            log.warning("Could not load telemetry JSON: %s", e)

    def get_heat_score(self, file_path: str) -> float:
        """Return heat multiplier for a file based on its path/name keywords."""
        lower = file_path.lower()
        best  = 1.0
        for keyword, score in self.heat_map.items():
            if keyword in lower:
                best = max(best, 1.0 + score * 4)  # multiplier 1.0–5.0
        return best


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 6 + 1: PRIORITY ENGINE
# ─────────────────────────────────────────────────────────────────────────────

class PriorityEngine:
    """
    Ranks findings by: Severity × Confidence × Heat Score × (1 / Fix Complexity Cost).
    Produces a business-impact-ordered fix queue.
    """

    COMPLEXITY_COST = {"AUTO": 1.0, "SEMI": 2.0, "MANUAL": 4.0, "ARCHITECTURAL": 8.0}

    def score(self, finding: Finding) -> float:
        sev_w   = SEVERITY_WEIGHT.get(finding.severity, 1)
        conf    = finding.confidence
        heat    = finding.module_heat_score
        cost    = self.COMPLEXITY_COST.get(finding.fix_complexity, 4.0)
        return round(sev_w * conf * heat / cost, 4)

    def rank(self, findings: List[Finding]) -> List[Finding]:
        for f in findings:
            f.final_priority = self.score(f)
        return sorted(findings, key=lambda f: -f.final_priority)


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 7: RISK MATRIX — AUTO vs. HUMAN-REVIEW vs. ARCHITECTURAL
# ─────────────────────────────────────────────────────────────────────────────

class RiskMatrix:
    """
    Classifies each fix proposal into one of four zones:
      AUTO     — apply immediately, high confidence, low regression risk
      SEMI     — generate PR, require tech lead approval
      MANUAL   — flag for developer; system generates skeleton only
      ARCHITECTURAL — cannot be fixed at code level; generate design recommendation
    """

    # Rules that are safe to auto-apply without human review
    AUTO_RULES = {"S006", "S008", "C001", "C004", "C005", "C007",
                  "Q004", "Q005", "Q007", "Q008", "D007", "D008",
                  "A006"}

    def classify(self, finding: Finding) -> Tuple[str, bool, bool]:
        """Returns (risk_level, auto_apply, requires_approval)."""
        cplx = finding.fix_complexity

        if cplx == "ARCHITECTURAL":
            return "ARCHITECTURAL", False, True

        if cplx == "AUTO" and finding.rule_id in self.AUTO_RULES \
                and finding.confidence >= 0.85:
            return "LOW", True, False

        if cplx in ("AUTO", "SEMI") and finding.confidence >= 0.75:
            return "MEDIUM", False, True

        if cplx == "MANUAL":
            return "HIGH", False, True

        return "HIGH", False, True


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 3: TEST GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

class TestGenerator:
    """
    Generates characterization tests for each function before a fix is applied.
    This creates a safety net that proves the fix doesn't break existing behaviour.
    Challenge 3: you cannot safely correct what you cannot verify.
    """

    TEMPLATES: Dict[str, str] = {
        "SECURITY": textwrap.dedent("""\
            def test_{fn_name}_rejects_injection():
                \"\"\"Characterization test: {fn_name} must not accept injection payloads.\"\"\"
                import pytest
                # TODO: import {module} and call {fn_name} with injection payload
                malicious_inputs = ["'; DROP TABLE users;--", "<script>alert(1)</script>",
                                    "../../../etc/passwd", "{{7*7}}"]
                for payload in malicious_inputs:
                    with pytest.raises((ValueError, TypeError, PermissionError)):
                        pass  # replace with: {module}.{fn_name}(payload)
            """),

        "DATABASE": textwrap.dedent("""\
            def test_{fn_name}_commits_transaction():
                \"\"\"Characterization test: verify {fn_name} commits on success and rolls back on error.\"\"\"
                from unittest.mock import MagicMock, patch
                mock_session = MagicMock()
                # Happy path: commit called
                # TODO: call {module}.{fn_name}(mock_session, *valid_args)
                mock_session.commit.assert_called_once()
                # Error path: rollback called
                mock_session.commit.side_effect = Exception("DB error")
                # TODO: call {module}.{fn_name}(mock_session, *valid_args)
                mock_session.rollback.assert_called_once()
            """),

        "TRANSACTION": textwrap.dedent("""\
            def test_{fn_name}_transaction_atomicity():
                \"\"\"Characterization test: partial failure must not leave DB in inconsistent state.\"\"\"
                from unittest.mock import MagicMock
                mock_conn = MagicMock()
                mock_conn.begin.return_value.__enter__ = lambda s: mock_conn
                mock_conn.begin.return_value.__exit__  = lambda s, *a: False
                # Simulate exception mid-transaction
                mock_conn.execute.side_effect = [None, Exception("mid-tx failure")]
                try:
                    pass  # TODO: call {module}.{fn_name}(mock_conn, *args)
                except Exception:
                    pass
                mock_conn.rollback.assert_called()
            """),

        "ARCHITECTURE": textwrap.dedent("""\
            def test_{fn_name}_has_timeout():
                \"\"\"Characterization test: {fn_name} must not block indefinitely.\"\"\"
                import signal, pytest
                def handler(signum, frame): raise TimeoutError()
                signal.signal(signal.SIGALRM, handler)
                signal.alarm(5)  # 5-second deadline
                try:
                    pass  # TODO: call {module}.{fn_name}(*valid_args)
                except TimeoutError:
                    pytest.fail("{fn_name} exceeded 5-second timeout")
                finally:
                    signal.alarm(0)
            """),

        "DEFAULT": textwrap.dedent("""\
            def test_{fn_name}_baseline():
                \"\"\"Characterization test for {fn_name} — establishes current behaviour baseline.\"\"\"
                # TODO: import {module}
                # TODO: set up valid inputs for {fn_name}
                # TODO: call {module}.{fn_name}(*valid_args)
                # TODO: assert expected output
                pass
            """),
    }

    def generate(self, finding: Finding, chunk: Optional[CodeChunk] = None) -> str:
        module = Path(finding.file_path).stem
        fn_name = "target_function"
        if chunk and chunk.symbol_name:
            fn_name = chunk.symbol_name.split(",")[0].strip()
        template = self.TEMPLATES.get(finding.category, self.TEMPLATES["DEFAULT"])
        return template.format(fn_name=fn_name, module=module)


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 10: EXPLAINABILITY ENGINE + FIX APPLICATOR
# ─────────────────────────────────────────────────────────────────────────────

class ExplainabilityEngine:
    """
    Generates human-readable, auditable fix proposals.
    Every proposal includes: rationale, diff, test, risk, and rollback snapshot.
    Challenge 10: no black-box changes to production code.
    """

    def __init__(self, test_gen: TestGenerator, risk_matrix: RiskMatrix):
        self.test_gen    = test_gen
        self.risk_matrix = risk_matrix

    def build_proposal(self, finding: Finding,
                       chunk: Optional[CodeChunk] = None) -> FixProposal:
        rule = next((r for r in RULES if r["id"] == finding.rule_id), None)
        if not rule:
            rule = {"name": finding.rule_name, "fix": finding.suggested_fix,
                    "desc": finding.description, "complexity": finding.fix_complexity}

        risk_level, auto_apply, requires_approval = self.risk_matrix.classify(finding)
        before_code = chunk.content[:500] if chunk else f"# Line {finding.line_number}\n{finding.evidence}"
        after_code  = self._generate_after(finding, before_code, rule)
        diff        = self._make_diff(before_code, after_code, finding.file_path)
        test_skel   = self.test_gen.generate(finding, chunk)

        rationale = (
            f"RULE {finding.rule_id} — {rule['name']}\n\n"
            f"WHAT: {finding.description}\n\n"
            f"WHY THIS IS A BUG: {rule['desc']}\n\n"
            f"EVIDENCE (line {finding.line_number}):\n  {finding.evidence}\n\n"
            f"PRESCRIBED FIX: {rule['fix']}\n\n"
            f"BUSINESS IMPACT: Priority score {finding.final_priority:.2f} "
            f"(heat×{finding.module_heat_score:.1f}, confidence {finding.confidence:.0%})\n\n"
            f"RISK LEVEL: {risk_level} — "
            + ("Auto-applicable without human review."
               if auto_apply else "Requires approval before application.")
        )

        pid = hashlib.md5(f"{finding.finding_id}{time.time()}".encode()).hexdigest()[:12]
        return FixProposal(
            proposal_id=pid,
            finding_id=finding.finding_id,
            file_path=finding.file_path,
            line_number=finding.line_number,
            title=f"[{finding.severity}] {rule['name']} in {Path(finding.file_path).name}:{finding.line_number}",
            rationale=rationale,
            before_code=before_code,
            after_code=after_code,
            unified_diff=diff,
            test_skeleton=test_skel,
            risk_level=risk_level,
            auto_apply=auto_apply,
            requires_approval=requires_approval,
            created_at=datetime.now().isoformat(),
        )

    def _generate_after(self, finding: Finding, before: str, rule: Dict) -> str:
        """Best-effort auto-fix generation for AUTO-complexity rules."""
        rid = finding.rule_id
        after = before

        if rid == "Q004":  # print → log
            after = re.sub(r"\bprint\s*\(", "log.info(", before)
        elif rid == "Q001":  # bare except
            after = re.sub(r"\bexcept\s*:", "except Exception as e:", before)
        elif rid == "Q005":  # mutable default
            after = re.sub(r"=\s*\[\]", "=None", before)
            after = re.sub(r"=\s*\{\}", "=None", after)
        elif rid == "S006":  # weak crypto
            after = re.sub(r"hashlib\.(md5|sha1)\s*\(", "hashlib.sha256(", before)
        elif rid == "C001" and "debug" in before.lower():  # debug mode
            after = re.sub(r"(?i)debug\s*=\s*True", "debug=False", before)
        elif rid == "A006":  # missing timeout
            after = re.sub(r"(requests\.\w+\s*\([^)]*)\)",
                           r"\1, timeout=30)", before)
        elif rid == "D008":  # small pool
            after = re.sub(r"pool_size\s*=\s*\d+", "pool_size=20", before)
            after = re.sub(r"max_overflow\s*=\s*\d+", "max_overflow=40", after)
        else:
            after = f"# AUTO-FIX REQUIRED:\n# {rule['fix']}\n\n{before}"

        return after

    @staticmethod
    def _make_diff(before: str, after: str, filename: str) -> str:
        diff_lines = difflib.unified_diff(
            before.splitlines(keepends=True),
            after.splitlines(keepends=True),
            fromfile=f"a/{filename}",
            tofile=f"b/{filename}",
            n=3,
        )
        return "".join(list(diff_lines)[:80])


class FixApplicator:
    """
    Safely applies approved fix proposals to source files.
    Takes a rollback snapshot before every change.
    Challenge 10: every application is logged and reversible.
    """

    def __init__(self, db: IntelligenceDB):
        self.db = db

    def apply(self, proposal_id: str, proposals: Dict[str, FixProposal],
              actor: str = "system") -> Tuple[bool, str]:
        p = proposals.get(proposal_id)
        if not p:
            return False, "Proposal not found"
        if p.status != "PENDING":
            return False, f"Proposal already in state: {p.status}"

        path = Path(p.file_path)
        if not path.exists():
            return False, f"File not found: {p.file_path}"

        try:
            original = path.read_text(encoding="utf-8")
            # Apply the fix
            modified = original.replace(p.before_code, p.after_code, 1)
            if modified == original:
                return False, "No change made — before_code not found in file verbatim"
            path.write_text(modified, encoding="utf-8")
            p.status = "APPLIED"
            p.rollback_snapshot = original
            self.db.update_proposal_status(proposal_id, "APPLIED", actor, original)
            self.db.audit("FIX_APPLIED", actor, proposal_id, "fix_proposal",
                          "apply", f"Applied to {p.file_path}:{p.line_number}", "SUCCESS")
            return True, "Applied successfully"
        except Exception as e:
            self.db.audit("FIX_FAILED", actor, proposal_id, "fix_proposal",
                          "apply", str(e), "FAILURE")
            return False, str(e)

    def rollback(self, proposal_id: str, proposals: Dict[str, FixProposal],
                 actor: str = "system") -> Tuple[bool, str]:
        p = proposals.get(proposal_id)
        if not p or p.status != "APPLIED":
            return False, "Only APPLIED proposals can be rolled back"
        try:
            Path(p.file_path).write_text(p.rollback_snapshot, encoding="utf-8")
            p.status = "ROLLED_BACK"
            self.db.update_proposal_status(proposal_id, "ROLLED_BACK", actor)
            self.db.audit("FIX_ROLLED_BACK", actor, proposal_id, "fix_proposal",
                          "rollback", f"Rolled back {p.file_path}", "SUCCESS")
            return True, "Rolled back successfully"
        except Exception as e:
            return False, str(e)


# ─────────────────────────────────────────────────────────────────────────────
# CHALLENGE 9: CONTINUOUS ANALYSIS — GIT-DIFF TRIGGERED INCREMENTAL SCANNER
# ─────────────────────────────────────────────────────────────────────────────

class GitWatcher:
    """
    Polls the git repository for changed files every N seconds.
    On change: re-scans only the affected files + their dependency subgraph.
    Challenge 9: continuous, not one-shot.
    """

    def __init__(self, root: str, db: IntelligenceDB, scan_callback,
                 interval_sec: int = 30):
        self.root          = root
        self.db            = db
        self.scan_callback = scan_callback
        self.interval      = interval_sec
        self._stop         = threading.Event()
        self._thread       = threading.Thread(target=self._loop, daemon=True,
                                              name="GitWatcher")

    def start(self):
        self._thread.start()
        log.info("GitWatcher started (interval=%ds)", self.interval)

    def stop(self):
        self._stop.set()

    def _loop(self):
        while not self._stop.is_set():
            changed = self._detect_changes()
            if changed:
                log.info("GitWatcher: %d changed files detected → triggering incremental scan",
                         len(changed))
                self.scan_callback(changed)
            self._stop.wait(self.interval)

    def _detect_changes(self) -> List[str]:
        """Detect changed files using content hash comparison."""
        changed = []
        root_path = Path(self.root)
        for ext in SOURCE_EXTENSIONS | CONFIG_EXTENSIONS | SQL_EXTENSIONS:
            for path in root_path.rglob(f"*{ext}"):
                if any(part in IGNORE_DIRS for part in path.parts):
                    continue
                try:
                    content = path.read_bytes()
                    h       = hashlib.md5(content).hexdigest()
                    old_h   = self.db.get_file_hash(str(path))
                    if old_h != h:
                        changed.append(str(path))
                        self.db.save_file_hash(str(path), h)
                except Exception:
                    pass
        return changed

    @staticmethod
    def get_git_diff(root: str) -> List[str]:
        """Get list of files changed vs HEAD using git (if available)."""
        try:
            result = subprocess.run(
                ["git", "diff", "--name-only", "HEAD"],
                cwd=root, capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                return [str(Path(root) / f.strip())
                        for f in result.stdout.splitlines() if f.strip()]
        except Exception:
            pass
        return []


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ORCHESTRATOR: CodeIntelligenceBrain
# ─────────────────────────────────────────────────────────────────────────────

class CodeIntelligenceBrain:
    """
    Orchestrates all 10 challenge components into a unified analysis pipeline.
    """

    def __init__(self, target_root: str, db_path: str = "intelligence.db"):
        self.target_root  = target_root
        self.db           = IntelligenceDB(db_path)
        self.ingester     = SourceIngester()
        self.graph        = DependencyGraph()
        self.chunker      = SemanticChunker(self.graph)
        self.rule_engine  = BugRuleEngine()
        self.db_layer     = DBIntelligenceLayer()
        self.config_layer = ConfigAnalyser()
        self.telemetry    = TelemetryCorrelator(self.db)
        self.priority     = PriorityEngine()
        self.risk_matrix  = RiskMatrix()
        self.test_gen     = TestGenerator()
        self.explainer    = ExplainabilityEngine(self.test_gen, self.risk_matrix)
        self.applicator   = FixApplicator(self.db)
        self.proposals:   Dict[str, FixProposal] = {}
        self.git_watcher  = GitWatcher(target_root, self.db, self._incremental_scan)
        self._scan_lock   = threading.Lock()
        self._last_scan   = None

    # ── Full scan ───────────────────────────────────────────────────────────
    def full_scan(self) -> Dict:
        with self._scan_lock:
            return self._run_scan(self.target_root)

    def _run_scan(self, root: str, file_filter: Optional[List[str]] = None) -> Dict:
        scan_id   = hashlib.md5(f"{root}{time.time()}".encode()).hexdigest()[:10]
        started   = datetime.now().isoformat()
        log.info("Starting scan [%s] on %s", scan_id, root)

        source_files, config_files, sql_files = self.ingester.ingest(root)

        # Build dependency graph from all source files
        for f in source_files:
            plugin = get_plugin(f["path"])
            if plugin:
                self.graph.add_file(f["path"], f["content"], plugin)

        # Apply optional file filter (for incremental scan)
        if file_filter:
            filter_set = set(file_filter)
            source_files = [f for f in source_files if f["path"] in filter_set]
            config_files = [f for f in config_files if f["path"] in filter_set]
            sql_files    = [f for f in sql_files    if f["path"] in filter_set]

        all_findings: List[Finding] = []
        total_lines = 0

        # ── Source files ────────────────────────────────────────────────────
        for file_info in source_files:
            path    = file_info["path"]
            content = file_info["content"]
            total_lines += file_info["lines"]
            plugin  = get_plugin(path)
            heat    = self.telemetry.get_heat_score(path)

            # Challenge 2: chunk before analysing
            chunks = self.chunker.chunk_file(file_info, plugin) if plugin else []

            # Challenge 1: rule engine
            raw_hits = self.rule_engine.scan_text(content, path, plugin)
            raw_hits += self.rule_engine.scan_long_functions(content, path, plugin)
            raw_hits += self.rule_engine.scan_coupling(path, self.graph)

            # Challenge 4: DB intelligence
            for raw in self.db_layer.analyse(content, path):
                raw_hits.append({"rule": next((r for r in RULES if r["id"] == raw["rule_id"]),
                                              {"id": raw["rule_id"], "name": raw["rule_id"],
                                               "cat": "DATABASE", "sev": "HIGH",
                                               "fix": "", "complexity": "SEMI", "desc": ""}),
                                 "line": raw["line"], "evidence": raw["evidence"],
                                 "confidence": raw["confidence"]})

            for hit in raw_hits:
                f = self._make_finding(hit, path, heat, scan_id)
                all_findings.append(f)

        # ── Config files ─────────────────────────────────────────────────────
        for file_info in config_files:
            path    = file_info["path"]
            content = file_info["content"]
            total_lines += file_info["lines"]
            heat    = self.telemetry.get_heat_score(path)
            for raw in self.config_layer.analyse(content, path):
                rule = next((r for r in RULES if r["id"] == raw["rule_id"]), None)
                if rule:
                    hit = {"rule": rule, "line": raw["line"],
                           "evidence": raw["evidence"],
                           "confidence": raw["confidence"]}
                    all_findings.append(self._make_finding(hit, path, heat, scan_id))

        # ── SQL files ─────────────────────────────────────────────────────────
        for file_info in sql_files:
            path    = file_info["path"]
            content = file_info["content"]
            total_lines += file_info["lines"]
            heat    = self.telemetry.get_heat_score(path)
            for raw in self.db_layer.analyse_sql(content, path):
                rule = next((r for r in RULES if r["id"] == raw["rule_id"]), None)
                if rule:
                    hit = {"rule": rule, "line": raw["line"],
                           "evidence": raw["evidence"],
                           "confidence": raw["confidence"]}
                    all_findings.append(self._make_finding(hit, path, heat, scan_id))

        # ── Circular imports (graph-level) ────────────────────────────────────
        for cycle in self.graph.detect_circular_imports(source_files):
            f = Finding(
                finding_id=_cid("circular", 0, len(cycle["cycle"])),
                file_path=str(cycle["cycle"]),
                line_number=1, rule_id="A001", rule_name="CircularImport",
                category="ARCHITECTURE", severity="HIGH", confidence=0.90,
                title="Circular import detected",
                description=f"Import cycle: {' → '.join(cycle['cycle'])}",
                evidence=f"Cycle: {cycle['cycle']}",
                suggested_fix="Break cycle using dependency injection or interface abstraction.",
                fix_complexity="ARCHITECTURAL",
                module_heat_score=1.5, detected_at=datetime.now().isoformat(),
                scan_id=scan_id,
            )
            all_findings.append(f)

        # ── Priority ranking ──────────────────────────────────────────────────
        all_findings = self.priority.rank(all_findings)

        # Deduplicate by (file, line, rule_id)
        seen, deduped = set(), []
        for f in all_findings:
            key = (f.file_path, f.line_number, f.rule_id)
            if key not in seen:
                seen.add(key)
                deduped.append(f)
        all_findings = deduped[:2000]  # Cap at 2000 for performance

        # ── Persist findings ──────────────────────────────────────────────────
        for f in all_findings:
            self.db.save_finding(f)

        # ── Generate proposals for top-priority findings ───────────────────────
        proposals_made = 0
        chunk_map = {}  # file_path → [CodeChunk]
        for f in source_files:
            plugin = get_plugin(f["path"])
            if plugin:
                chunk_map[f["path"]] = self.chunker.chunk_file(f, plugin)

        for finding in all_findings[:100]:  # Proposals for top 100 findings
            chunk = self._find_chunk(finding, chunk_map)
            proposal = self.explainer.build_proposal(finding, chunk)
            self.proposals[proposal.proposal_id] = proposal
            self.db.save_proposal(proposal)
            proposals_made += 1

        critical = sum(1 for f in all_findings if f.severity == "CRITICAL")
        self.db.save_scan(scan_id, root, len(source_files) + len(config_files),
                          total_lines, len(all_findings), critical, proposals_made, started)
        self.db.audit("FULL_SCAN", "system", scan_id, "scan",
                      "execute", f"Scanned {total_lines} lines in {root}", "SUCCESS")
        self._last_scan = scan_id
        log.info("Scan complete: %d files, %d lines, %d findings (%d critical), %d proposals",
                 len(source_files) + len(config_files), total_lines,
                 len(all_findings), critical, proposals_made)
        return {"scan_id": scan_id, "findings": len(all_findings),
                "critical": critical, "proposals": proposals_made,
                "files": len(source_files) + len(config_files),
                "lines": total_lines}

    # ── Incremental scan ─────────────────────────────────────────────────────
    def _incremental_scan(self, changed_files: List[str]):
        """Challenge 9: re-scan only changed files + their dependency neighbors."""
        with self._scan_lock:
            expanded = set(changed_files)
            for path in changed_files:
                # Add files that import from changed modules
                changed_module = Path(path).stem
                for other_path, imps in self.graph.imports.items():
                    if changed_module in imps:
                        expanded.add(other_path)
            log.info("Incremental scan: %d files (expanded from %d changed)",
                     len(expanded), len(changed_files))
            self._run_scan(self.target_root, file_filter=list(expanded))

    # ── Helpers ──────────────────────────────────────────────────────────────
    def _make_finding(self, hit: Dict, path: str, heat: float, scan_id: str) -> Finding:
        rule = hit["rule"]
        fid  = _cid(f"{path}{hit['line']}{rule['id']}", 0, 0)
        sev_to_impact = {"CRITICAL": 8.0, "HIGH": 4.0, "MEDIUM": 2.0, "LOW": 0.5}
        return Finding(
            finding_id=fid, file_path=path, line_number=hit["line"],
            rule_id=rule["id"], rule_name=rule["name"],
            category=rule["cat"], severity=rule["sev"],
            confidence=hit["confidence"], title=f"{rule['name']} at line {hit['line']}",
            description=rule.get("desc", ""), evidence=hit["evidence"],
            suggested_fix=rule.get("fix", ""), fix_complexity=rule.get("complexity", "MANUAL"),
            business_impact_score=sev_to_impact.get(rule["sev"], 1.0),
            module_heat_score=heat,
            detected_at=datetime.now().isoformat(), scan_id=scan_id,
        )

    def _find_chunk(self, finding: Finding,
                    chunk_map: Dict[str, List[CodeChunk]]) -> Optional[CodeChunk]:
        for chunk in chunk_map.get(finding.file_path, []):
            if chunk.start_line <= finding.line_number <= chunk.end_line:
                return chunk
        return None

    def snapshot(self) -> Dict:
        stats = self.db.stats()
        heat  = self.db.get_heat_map()
        scans = self.db.get_scan_history()
        return {
            "stats": stats,
            "heat_map": heat[:15],
            "recent_scans": scans[:5],
            "last_scan_id": self._last_scan,
            "target": self.target_root,
            "rules_loaded": len(RULES),
        }


# ─────────────────────────────────────────────────────────────────────────────
# FLASK DASHBOARD + REST API
# ─────────────────────────────────────────────────────────────────────────────

app   = Flask(__name__, template_folder="templates")
brain: Optional[CodeIntelligenceBrain] = None


@app.route("/")
def index():
    return render_template("dashboard.html")


@app.route("/api/snapshot")
def api_snapshot():
    return jsonify(brain.snapshot())


@app.route("/api/scan", methods=["POST"])
def api_scan():
    target = request.json.get("target", brain.target_root) if request.json else brain.target_root
    result = brain.full_scan()
    return jsonify(result)


@app.route("/api/findings")
def api_findings():
    scan_id  = request.args.get("scan_id", "")
    severity = request.args.get("severity", "")
    return jsonify(brain.db.get_findings(scan_id, severity))


@app.route("/api/proposals")
def api_proposals():
    status = request.args.get("status", "")
    return jsonify(brain.db.get_proposals(status))


@app.route("/api/proposals/<pid>/apply", methods=["POST"])
def api_apply(pid):
    actor = request.json.get("actor", "api-user") if request.json else "api-user"
    ok, msg = brain.applicator.apply(pid, brain.proposals, actor)
    return jsonify({"ok": ok, "message": msg}), (200 if ok else 400)


@app.route("/api/proposals/<pid>/rollback", methods=["POST"])
def api_rollback(pid):
    actor = request.json.get("actor", "api-user") if request.json else "api-user"
    ok, msg = brain.applicator.rollback(pid, brain.proposals, actor)
    return jsonify({"ok": ok, "message": msg}), (200 if ok else 400)


@app.route("/api/proposals/<pid>/reject", methods=["POST"])
def api_reject(pid):
    actor = request.json.get("actor", "api-user") if request.json else "api-user"
    brain.db.update_proposal_status(pid, "REJECTED", actor)
    brain.db.audit("FIX_REJECTED", actor, pid, "fix_proposal",
                   "reject", "Rejected by reviewer", "SUCCESS")
    return jsonify({"ok": True})


@app.route("/api/audit")
def api_audit():
    limit = int(request.args.get("limit", 50))
    return jsonify(brain.db.get_audit_log(limit))


@app.route("/api/heat")
def api_heat():
    return jsonify(brain.db.get_heat_map())


@app.route("/api/rules")
def api_rules():
    return jsonify(RULES)


@app.route("/api/health")
def api_health():
    return jsonify({"status": "operational", "rules": len(RULES),
                    "target": brain.target_root})


# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def main():
    global brain
    import argparse
    parser = argparse.ArgumentParser(description="Code Intelligence System")
    parser.add_argument("--target", default=str(Path(__file__).parent.parent),
                        help="Root directory to analyse")
    parser.add_argument("--db",     default="intelligence.db")
    parser.add_argument("--port",   type=int, default=5001)
    parser.add_argument("--no-watch", action="store_true",
                        help="Disable continuous file watcher")
    parser.add_argument("--scan-on-start", action="store_true",
                        help="Run a full scan immediately on startup")
    args = parser.parse_args()

    brain = CodeIntelligenceBrain(target_root=args.target, db_path=args.db)

    if not args.no_watch:
        brain.git_watcher.start()

    if args.scan_on_start:
        log.info("Running initial full scan on %s …", args.target)
        threading.Thread(target=brain.full_scan, daemon=True).start()

    log.info("Code Intelligence System ready on http://0.0.0.0:%d", args.port)
    app.run(host="0.0.0.0", port=args.port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
