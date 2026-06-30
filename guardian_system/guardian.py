#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════╗
║   AUTONOMOUS GUARDIAN SYSTEM — SIGIF2 SELF-HEALING CORE v2.0          ║
║   Learn · Adapt · Predict · Resolve · Self-Heal                        ║
║                                                                          ║
║   • Independently studies any application it has access to             ║
║   • Learns from 6–12 months of historical maintenance data             ║
║   • Predicts failures before they occur via pattern recognition        ║
║   • Autonomously heals issues — zero human intervention required       ║
║   • Reduces system downtime to its absolute minimum                    ║
╚══════════════════════════════════════════════════════════════════════════╝

Architecture:
  INPUT STREAMS ──► HISTORICAL ENGINE ──► ML BRAIN ──► HEALING ENGINE
  Live Telemetry    SQLite (6-12 mo)      Anomaly       Auto-Fix
  Bug Events        Pattern Learning      Prediction    Validation
  Config Drift      Root-Cause Analysis   Prioritize    Audit Trail
  App Source Scan   Recurring Patterns    Confidence    DB Persist
"""

import os, json, time, random, logging, threading, math, sqlite3, statistics, re
from datetime import datetime, timedelta
from collections import deque, defaultdict
from typing import Dict, List, Tuple, Optional, Any
from pathlib import Path

import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from flask import Flask, jsonify, render_template_string, request

# ─────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("Guardian")

DB_PATH      = Path(__file__).parent / "guardian_history.db"
HISTORY_DAYS = 180   # 6 months of learning

# ─────────────────────────────────────────────────────────────────────
# GLOBAL CATALOGUES  (shared by all components)
# ─────────────────────────────────────────────────────────────────────
BUG_CATALOGUE: Dict[str, Dict] = {
    "NullPointerException":  {"fix": "inject_null_guard",   "severity": "HIGH",     "priority": 1},
    "ArrayIndexOutOfBounds": {"fix": "bounds_check_patch",  "severity": "HIGH",     "priority": 1},
    "DBConnectionTimeout":   {"fix": "pool_scale_up",       "severity": "CRITICAL", "priority": 0},
    "MemoryLeak":            {"fix": "gc_force_sweep",      "severity": "HIGH",     "priority": 1},
    "MissingConfig":         {"fix": "config_reload",       "severity": "MEDIUM",   "priority": 2},
    "SecurityVulnerability": {"fix": "rotate_credentials",  "severity": "CRITICAL", "priority": 0},
    "SlowQuery":             {"fix": "query_plan_optimize", "severity": "MEDIUM",   "priority": 2},
    "ServiceUnavailable":    {"fix": "circuit_breaker",     "severity": "HIGH",     "priority": 1},
}

RESOLUTION_TEMPLATES: Dict[str, str] = {
    "inject_null_guard":    "Injected null-safety guard at call site; Optional wrapper added",
    "bounds_check_patch":   "Applied bounds validation; matrix dimensions clamped to valid range",
    "pool_scale_up":        "DB pool maxSize scaled 5→50; idle-connection timeout set to 30s",
    "gc_force_sweep":       "Triggered full GC sweep; unreachable cache handles released from heap",
    "config_reload":        "Config hot-reloaded from /etc/sigif2/config.yaml; endpoint restored",
    "rotate_credentials":   "JWT secret rotated to 256-bit random key; all sessions invalidated",
    "query_plan_optimize":  "Index hint injected; query plan rebuilt — full-scan eliminated",
    "circuit_breaker":      "Circuit breaker opened; fallback route activated for payment gateway",
    "generic_patch":        "Generic runtime patch applied; module restarted cleanly",
    "apply_config_default": "Parameter updated to optimal value; service config hot-reloaded",
}

FIX_TIMES_MS: Dict[str, Tuple[int, int]] = {
    "inject_null_guard":    (200, 800),
    "bounds_check_patch":   (150, 600),
    "pool_scale_up":        (100, 300),
    "gc_force_sweep":       (500, 1500),
    "config_reload":        (50,  200),
    "rotate_credentials":   (300, 900),
    "query_plan_optimize":  (400, 1200),
    "circuit_breaker":      (200, 700),
    "generic_patch":        (300, 1000),
    "apply_config_default": (80,  250),
}

# ═══════════════════════════════════════════════════════════════════════
# 1.  HISTORICAL DATABASE — SQLite-backed long-term memory
# ═══════════════════════════════════════════════════════════════════════
class HistoricalDB:
    """
    Persistent store that survives restarts.
    Holds 6–12 months of bug events, metrics, patterns and scan findings.
    """

    _SCHEMA = """
    PRAGMA journal_mode=WAL;

    CREATE TABLE IF NOT EXISTS bug_history (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        bug_id           TEXT,
        bug_type         TEXT,
        module           TEXT,
        severity         TEXT,
        detected_at      TEXT,
        healed_at        TEXT,
        fix_applied      TEXT,
        elapsed_ms       INTEGER,
        success          INTEGER DEFAULT 1,
        anomaly_score    REAL    DEFAULT 0.0,
        recurrence       INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS metric_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        recorded_at   TEXT,
        cpu_pct       REAL, mem_pct     REAL, latency_ms  REAL,
        error_rate    REAL, req_per_sec REAL,
        is_anomaly    INTEGER, anomaly_score REAL
    );
    CREATE TABLE IF NOT EXISTS maintenance_log (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        category     TEXT, healed_id   TEXT, bug_type TEXT,
        module       TEXT, severity    TEXT, fix_applied TEXT,
        elapsed_ms   INTEGER, description TEXT,
        anomaly_score REAL, recorded_at TEXT
    );
    CREATE TABLE IF NOT EXISTS recurring_patterns (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        bug_type            TEXT UNIQUE,
        avg_interval_hours  REAL,
        occurrence_count    INTEGER,
        confidence          REAL,
        last_seen           TEXT,
        next_predicted      TEXT,
        modules             TEXT
    );
    CREATE TABLE IF NOT EXISTS scan_findings (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path   TEXT, line_no    INTEGER,
        category    TEXT, severity   TEXT,
        description TEXT, found_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_bh_type ON bug_history(bug_type);
    CREATE INDEX IF NOT EXISTS idx_bh_det  ON bug_history(detected_at);
    CREATE INDEX IF NOT EXISTS idx_mh_rec  ON metric_history(recorded_at);
    """

    def __init__(self, path: Path = DB_PATH):
        self.path  = path
        self._lock = threading.Lock()
        with sqlite3.connect(str(path)) as c:
            c.executescript(self._SCHEMA)
        log.info("HistoricalDB ready — %s", path)

    def _c(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.path))
        conn.row_factory = sqlite3.Row
        return conn

    # ── Writes ──────────────────────────────────────────────────────────
    def record_bug_fix(self, bug: Dict, fix: Dict, score: float):
        with self._lock, self._c() as c:
            rc = (c.execute(
                "SELECT MAX(recurrence) FROM bug_history WHERE bug_type=?",
                (bug["type"],)).fetchone()[0] or 0) + 1
            c.execute(
                "INSERT INTO bug_history (bug_id,bug_type,module,severity,detected_at,healed_at,"
                "fix_applied,elapsed_ms,success,anomaly_score,recurrence) VALUES (?,?,?,?,?,?,?,?,1,?,?)",
                (bug["id"], bug["type"], bug["module"], bug["severity"],
                 bug.get("detected_at"), fix.get("healed_at"),
                 fix["fix_applied"], fix["elapsed_ms"], score, rc))

    def record_maintenance(self, res: Dict, score: float):
        with self._lock, self._c() as c:
            c.execute(
                "INSERT INTO maintenance_log "
                "(category,healed_id,bug_type,module,severity,fix_applied,elapsed_ms,"
                "description,anomaly_score,recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                (res["category"], res["healed_id"], res.get("type",""), res.get("module",""),
                 res.get("severity",""), res["fix_applied"], res["elapsed_ms"],
                 res["description"], score, res["healed_at"]))

    def record_metric(self, m: Dict):
        with self._lock, self._c() as c:
            c.execute(
                "INSERT INTO metric_history "
                "(recorded_at,cpu_pct,mem_pct,latency_ms,error_rate,req_per_sec,is_anomaly,anomaly_score)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (m["timestamp"], m["cpu_pct"], m["mem_pct"], m["latency_ms"],
                 m["error_rate"], m["req_per_sec"],
                 int(m.get("is_anomaly", False)), m.get("anomaly_score", 0)))

    def upsert_pattern(self, bug_type: str, intervals: List[float], modules: List[str]):
        if not intervals:
            return
        avg  = statistics.mean(intervals)
        conf = min(0.99, len(intervals) / 12.0)
        nxt  = (datetime.now() + timedelta(hours=avg)).isoformat()
        with self._lock, self._c() as c:
            c.execute("""
                INSERT INTO recurring_patterns
                  (bug_type,avg_interval_hours,occurrence_count,confidence,
                   last_seen,next_predicted,modules)
                VALUES (?,?,?,?,?,?,?)
                ON CONFLICT(bug_type) DO UPDATE SET
                  avg_interval_hours=excluded.avg_interval_hours,
                  occurrence_count=excluded.occurrence_count,
                  confidence=excluded.confidence,
                  last_seen=excluded.last_seen,
                  next_predicted=excluded.next_predicted,
                  modules=excluded.modules
            """, (bug_type, avg, len(intervals)+1, conf,
                  datetime.now().isoformat(), nxt, json.dumps(list(set(modules)))))

    def record_scan_finding(self, f: Dict):
        with self._lock, self._c() as c:
            c.execute(
                "INSERT INTO scan_findings (file_path,line_no,category,severity,description,found_at)"
                " VALUES (?,?,?,?,?,?)",
                (f["file"], f["line"], f["category"], f["severity"],
                 f["description"], datetime.now().isoformat()))

    # ── Reads ────────────────────────────────────────────────────────────
    def count_bugs(self) -> int:
        with self._c() as c:
            return c.execute("SELECT COUNT(*) FROM bug_history").fetchone()[0]

    def get_bug_history(self, days: int = 30) -> List[Dict]:
        cut = (datetime.now() - timedelta(days=days)).isoformat()
        with self._c() as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM bug_history WHERE detected_at>? ORDER BY detected_at", (cut,))]

    def get_patterns(self) -> List[Dict]:
        with self._c() as c:
            rows = [dict(r) for r in c.execute(
                "SELECT * FROM recurring_patterns ORDER BY confidence DESC")]
        for r in rows:
            try:    r["modules"] = json.loads(r.get("modules", "[]"))
            except: r["modules"] = []
        return rows

    def get_mttr(self) -> Dict[str, float]:
        with self._c() as c:
            return {r["bug_type"]: round(r["avg_ms"] or 0, 0)
                    for r in c.execute(
                        "SELECT bug_type, AVG(elapsed_ms) as avg_ms "
                        "FROM bug_history WHERE success=1 GROUP BY bug_type")}

    def get_type_dist(self) -> Dict[str, int]:
        with self._c() as c:
            return {r["bug_type"]: r["cnt"]
                    for r in c.execute(
                        "SELECT bug_type, COUNT(*) as cnt FROM bug_history GROUP BY bug_type")}

    def get_daily_stats(self, days: int = 14) -> List[Dict]:
        cut = (datetime.now() - timedelta(days=days)).isoformat()
        with self._c() as c:
            return [dict(r) for r in c.execute("""
                SELECT DATE(detected_at) as day,
                       COUNT(*) as bugs,
                       AVG(elapsed_ms) as avg_ms
                FROM bug_history WHERE detected_at>?
                GROUP BY DATE(detected_at) ORDER BY day
            """, (cut,))]

    def get_scan_findings(self, limit: int = 60) -> List[Dict]:
        with self._c() as c:
            return [dict(r) for r in c.execute(
                "SELECT * FROM scan_findings ORDER BY found_at DESC LIMIT ?", (limit,))]

    def get_uptime_pct(self) -> float:
        """Estimate uptime = time with no active bugs / total time (last 7 days)."""
        cut = (datetime.now() - timedelta(days=7)).isoformat()
        with self._c() as c:
            total_ms = c.execute(
                "SELECT SUM(elapsed_ms) FROM bug_history WHERE detected_at>?", (cut,)
            ).fetchone()[0] or 0
        downtime_h = total_ms / 3_600_000
        return round(max(0, min(100, 100 - (downtime_h / (7*24) * 100))), 2)


# ═══════════════════════════════════════════════════════════════════════
# 2.  HISTORICAL BOOTSTRAP — generates 6-month synthetic history
# ═══════════════════════════════════════════════════════════════════════
class HistoricalBootstrap:
    """
    On first Guardian startup, synthesises 180 days of realistic maintenance
    history so the ML models have rich data to learn recurring patterns from.
    """

    # (bug_type, avg_interval_hours, std_hours, modules)
    SCHEDULES: List[Tuple] = [
        ("NullPointerException",  10.0,  3.0, ["AccountingEngine", "FiscalModule"]),
        ("DBConnectionTimeout",   18.0,  5.0, ["DataAccessLayer", "QueryEngine"]),
        ("MemoryLeak",            28.0,  8.0, ["CacheManager", "SessionManager"]),
        ("SlowQuery",              8.0,  2.0, ["QueryOptimizer", "TxLedger"]),
        ("ServiceUnavailable",    40.0, 12.0, ["MicroserviceMesh", "PayGateway"]),
        ("SecurityVulnerability", 72.0, 24.0, ["AuthService", "APIMiddleware"]),
        ("ArrayIndexOutOfBounds", 15.0,  4.0, ["ReportGenerator", "BudgetModule"]),
        ("MissingConfig",         50.0, 16.0, ["ConfigLoader", "Bootstrap"]),
    ]

    def run(self, db: HistoricalDB):
        existing = db.count_bugs()
        if existing > 0:
            log.info("History already present (%d records) — skipping bootstrap", existing)
            return

        log.info("Bootstrapping 6-month (180-day) historical maintenance data …")
        start = datetime.now() - timedelta(days=HISTORY_DAYS)
        counters: Dict[str, int] = defaultdict(int)

        for bug_type, avg_h, std_h, modules in self.SCHEDULES:
            t = start + timedelta(hours=random.uniform(0, avg_h))
            while t < datetime.now() - timedelta(minutes=5):
                counters[bug_type] += 1
                hour   = t.hour
                # Business-hours bias: bugs cluster 08-18
                factor = 0.75 if 8 <= hour <= 18 else 1.5
                elapsed = random.randint(
                    FIX_TIMES_MS.get(BUG_CATALOGUE[bug_type]["fix"], (200, 800))[0],
                    FIX_TIMES_MS.get(BUG_CATALOGUE[bug_type]["fix"], (200, 800))[1],
                )
                bug = {
                    "id":          f"{bug_type[:3].upper()}-H{counters[bug_type]:04d}",
                    "type":        bug_type,
                    "module":      random.choice(modules),
                    "severity":    BUG_CATALOGUE[bug_type]["severity"],
                    "detected_at": t.isoformat(),
                }
                fix = {
                    "healed_at":   (t + timedelta(milliseconds=elapsed)).isoformat(),
                    "fix_applied": BUG_CATALOGUE[bug_type]["fix"],
                    "elapsed_ms":  elapsed,
                }
                db.record_bug_fix(bug, fix, random.uniform(0.2, 0.75))
                interval = max(2.0, random.gauss(avg_h * factor, std_h))
                t += timedelta(hours=interval)

        total = db.count_bugs()
        log.info("Bootstrap complete — %d historical records across %d bug types",
                 total, len(self.SCHEDULES))


# ═══════════════════════════════════════════════════════════════════════
# 3.  APPLICATION INSPECTOR — scans source files for latent issues
# ═══════════════════════════════════════════════════════════════════════
class ApplicationInspector:
    """
    Static-analysis scanner: reads Python (and any text) files in the target
    directory, flags anti-patterns, security issues and tech-debt markers.
    Feeds findings into Guardian's knowledge base for autonomous remediation.
    """

    RULES: List[Tuple[str, str, str, str]] = [
        # (regex, category, severity, description)
        (r"except\s*:",                           "BareExcept",       "HIGH",     "Bare except silently swallows all exceptions"),
        (r"open\s*\([^)]+\)(?!\s*(as|,))",       "UnclosedResource", "MEDIUM",   "File opened without context manager — potential resource leak"),
        (r"(?i)\b(TODO|FIXME|HACK|XXX)\b",       "TechDebt",         "LOW",      "Technical debt marker found in production code"),
        (r"(?i)password\s*=\s*['\"][^'\"]{3,}['\"]", "HardcodedCred","CRITICAL", "Hardcoded password literal detected"),
        (r"(?i)secret\s*=\s*['\"][^'\"]{5,}['\"]",  "HardcodedCred","CRITICAL", "Hardcoded secret literal detected"),
        (r"(?i)api_?key\s*=\s*['\"][^'\"]{8,}['\"]","HardcodedCred","CRITICAL", "Hardcoded API key detected"),
        (r"SELECT\s+\*\s+FROM",                   "WildcardQuery",    "MEDIUM",   "SELECT * forces full row fetch — specify columns"),
        (r"time\.sleep\s*\(\s*[1-9]\d+",          "LongSleep",        "LOW",      "Long blocking sleep detected"),
        (r"from\s+\w+\s+import\s+\*",             "WildcardImport",   "LOW",      "Wildcard import pollutes namespace"),
        (r"\bassert\s+",                           "AssertInProd",     "MEDIUM",   "assert can be disabled with -O flag — use explicit raises"),
        (r"\beval\s*\(",                           "UnsafeEval",       "CRITICAL", "eval() executes arbitrary code — major security risk"),
        (r"\bexec\s*\(",                           "UnsafeExec",       "CRITICAL", "exec() executes arbitrary code — major security risk"),
        (r"shell\s*=\s*True",                      "ShellInjection",   "CRITICAL", "subprocess shell=True enables shell injection attacks"),
        (r"(?i)debug\s*=\s*True",                  "DebugMode",        "HIGH",     "Debug mode is enabled — must not reach production"),
        (r"\.format\s*\(.*request\.",              "PossibleSQLInject","HIGH",     "Possible SQL/template injection via format()"),
        (r"pickle\.loads?\s*\(",                   "UnsafePickle",     "HIGH",     "Deserialising pickle from untrusted source is unsafe"),
        (r"verify\s*=\s*False",                    "TLSDisabled",      "CRITICAL", "TLS certificate verification disabled"),
        (r"#.*noqa|#.*type:\s*ignore",             "SuppressedCheck",  "LOW",      "Type/lint check suppressed — verify intentional"),
        (r"input\s*\(",                            "UnvalidatedInput",  "MEDIUM",   "Raw input() used without sanitisation"),
        (r"os\.system\s*\(",                       "OsSystem",         "HIGH",     "os.system() vulnerable to command injection"),
    ]

    def scan(self, root: str = ".") -> List[Dict]:
        findings: List[Dict] = []
        py_files = list(Path(root).rglob("*.py"))[:80]
        for path in py_files:
            try:
                lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
                for lineno, line in enumerate(lines, 1):
                    stripped = line.strip()
                    if stripped.startswith("#"):
                        continue
                    for pattern, category, severity, desc in self.RULES:
                        if re.search(pattern, line):
                            findings.append({
                                "file":        str(path),
                                "line":        lineno,
                                "category":    category,
                                "severity":    severity,
                                "description": f"{desc} — `{stripped[:90]}`",
                            })
                            break
            except Exception:
                pass
        return findings


# ═══════════════════════════════════════════════════════════════════════
# 4.  SIGIF2 SIMULATOR — realistic telemetry with periodic fault injection
# ═══════════════════════════════════════════════════════════════════════
class SIGIF2Simulator:
    """Simulates the SIGIF2 financial-information system under live load."""

    BUG_POOL = [
        {"id": "NPE-001", "type": "NullPointerException",  "module": "AccountingEngine",
         "severity": "HIGH",     "description": "Null pointer in fiscal reconciliation loop",
         "stack": "at SIGIF2.AccountingEngine.reconcile(AE.java:247)\nat SIGIF2.FiscalModule.process(FM.java:89)"},
        {"id": "OOB-002", "type": "ArrayIndexOutOfBounds", "module": "ReportGenerator",
         "severity": "HIGH",     "description": "Array index out of bounds in budget matrix",
         "stack": "at SIGIF2.ReportGen.buildMatrix(RG.java:512)\nat SIGIF2.BudgetModule.export(BM.java:134)"},
        {"id": "DBC-003", "type": "DBConnectionTimeout",   "module": "DataAccessLayer",
         "severity": "CRITICAL", "description": "DB connection pool exhausted under heavy load",
         "stack": "at SIGIF2.DAL.getConnection(DAL.java:78)\nat SIGIF2.QueryEngine.execute(QE.java:201)"},
        {"id": "MEM-004", "type": "MemoryLeak",            "module": "CacheManager",
         "severity": "HIGH",     "description": "Unclosed cache handles leaking heap memory",
         "stack": "at SIGIF2.Cache.allocate(Cache.java:155)\nat SIGIF2.SessionMgr.open(SM.java:67)"},
        {"id": "CFG-005", "type": "MissingConfig",         "module": "ConfigLoader",
         "severity": "MEDIUM",   "description": "Missing treasury endpoint in config.yaml",
         "stack": "at SIGIF2.Config.load(Config.java:33)\nat SIGIF2.Bootstrap.init(Boot.java:22)"},
        {"id": "SEC-006", "type": "SecurityVulnerability", "module": "AuthService",
         "severity": "CRITICAL", "description": "JWT secret key uses default factory value",
         "stack": "at SIGIF2.Auth.validate(Auth.java:91)\nat SIGIF2.API.middleware(API.java:45)"},
        {"id": "QRY-007", "type": "SlowQuery",             "module": "QueryOptimizer",
         "severity": "MEDIUM",   "description": "Full-table scan on transactions >50 M rows",
         "stack": "at SIGIF2.QueryOpt.plan(QO.java:308)\nat SIGIF2.TxLedger.fetch(TL.java:189)"},
        {"id": "SVC-008", "type": "ServiceUnavailable",    "module": "MicroserviceMesh",
         "severity": "HIGH",     "description": "Payment-gateway microservice not responding",
         "stack": "at SIGIF2.Mesh.route(Mesh.java:77)\nat SIGIF2.PayGateway.charge(PG.java:56)"},
    ]

    DEFAULTS = [
        {"id": "DEF-101", "param": "db.pool.maxSize",     "current": "5",     "optimal": "50",
         "impact": "Connection starvation under concurrent load"},
        {"id": "DEF-102", "param": "cache.ttl.seconds",   "current": "30",    "optimal": "300",
         "impact": "Excessive DB reads, high latency"},
        {"id": "DEF-103", "param": "log.level",           "current": "DEBUG", "optimal": "INFO",
         "impact": "Log I/O saturating disk on prod"},
        {"id": "DEF-104", "param": "http.timeout.ms",     "current": "30000", "optimal": "5000",
         "impact": "Thread pool exhaustion on slow clients"},
        {"id": "DEF-105", "param": "jwt.expiry.minutes",  "current": "1440",  "optimal": "60",
         "impact": "Extended session hijacking window"},
        {"id": "DEF-106", "param": "query.cache.enabled", "current": "false", "optimal": "true",
         "impact": "Redundant queries for repeated requests"},
    ]

    def __init__(self):
        self.tick             = 0
        self.active_bugs:     List[Dict] = []
        self.active_defaults: List[Dict] = []

    def next_tick(self) -> Dict:
        self.tick += 1
        t = self.tick

        if t % random.randint(8, 16) == 0:
            bug = random.choice(self.BUG_POOL).copy()
            bug["detected_at"] = datetime.now().isoformat()
            bug["status"]      = "ACTIVE"
            if not any(b["id"] == bug["id"] for b in self.active_bugs):
                self.active_bugs.append(bug)

        if t % random.randint(15, 25) == 0:
            deflt = random.choice(self.DEFAULTS).copy()
            deflt["detected_at"] = datetime.now().isoformat()
            deflt["status"]      = "ACTIVE"
            if not any(d["id"] == deflt["id"] for d in self.active_defaults):
                self.active_defaults.append(deflt)

        base_cpu = 35 + 5  * math.sin(t / 10)       + random.gauss(0, 3)
        base_mem = 48 + 4  * math.sin(t / 15 + 1)   + random.gauss(0, 2)
        base_lat = 120 + 20 * math.sin(t / 8  + 2)  + random.gauss(0, 10)
        base_err = max(0, 0.5 + random.gauss(0, 0.3))

        spike = len(self.active_bugs) * 4
        return {
            "tick":             t,
            "timestamp":        datetime.now().isoformat(),
            "cpu_pct":          min(98, max(5,  base_cpu + spike)),
            "mem_pct":          min(98, max(5,  base_mem + spike * 0.6)),
            "latency_ms":       min(4000, max(20, base_lat + spike * 30)),
            "error_rate":       min(30, max(0, base_err + spike * 0.8)),
            "req_per_sec":      max(1, 280 - spike * 8 + random.gauss(0, 15)),
            "active_bugs":      len(self.active_bugs),
            "active_defaults":  len(self.active_defaults),
        }


# ═══════════════════════════════════════════════════════════════════════
# 5.  PATTERN ANALYZER — anomaly detection via Isolation Forest
# ═══════════════════════════════════════════════════════════════════════
class PatternAnalyzer:
    """
    Maintains a rolling feature window and learns normal system behaviour.
    Retrained periodically as new data arrives.
    """

    WINDOW = 40

    def __init__(self):
        self.history: deque         = deque(maxlen=self.WINDOW)
        self.scaler                 = StandardScaler()
        self.model                  = IsolationForest(n_estimators=150,
                                                      contamination=0.08,
                                                      random_state=42)
        self._trained               = False
        self._retrain_counter       = 0

    def _vec(self, m: Dict) -> List[float]:
        return [m["cpu_pct"], m["mem_pct"], m["latency_ms"],
                m["error_rate"], m["req_per_sec"]]

    def ingest(self, metrics: Dict) -> Tuple[bool, float]:
        """Return (is_anomaly, anomaly_score ∈ [0,1])."""
        vec = self._vec(metrics)
        self.history.append(vec)

        # Initial training
        if len(self.history) >= 20 and not self._trained:
            X = np.array(self.history)
            self.scaler.fit(X)
            self.model.fit(self.scaler.transform(X))
            self._trained = True
            log.info("PatternAnalyzer: model trained on %d samples", len(self.history))

        # Periodic retraining every 60 ticks
        self._retrain_counter += 1
        if self._trained and self._retrain_counter % 60 == 0:
            X = np.array(self.history)
            self.scaler.fit(X)
            self.model.fit(self.scaler.transform(X))

        if not self._trained:
            return False, 0.0

        Xq         = self.scaler.transform([vec])
        raw_score  = float(self.model.score_samples(Xq)[0])
        pred       = self.model.predict(Xq)[0]
        normalised = max(0.0, min(1.0, (-raw_score - 0.3) * 2))
        return (pred == -1), normalised


# ═══════════════════════════════════════════════════════════════════════
# 6.  PREDICTIVE ENGINE — forecasts upcoming failures from patterns
# ═══════════════════════════════════════════════════════════════════════
class PredictiveEngine:
    """
    Reads learned recurring patterns from DB and computes real-time predictions.
    Updates next_predicted timestamp after each healing event.
    """

    def __init__(self, db: HistoricalDB):
        self.db = db

    def get_predictions(self) -> List[Dict]:
        """Return list of upcoming predicted failures, sorted by imminence."""
        patterns = self.db.get_patterns()
        now      = datetime.now()
        preds    = []
        for p in patterns:
            if p["confidence"] < 0.15:
                continue
            try:
                nxt = datetime.fromisoformat(p["next_predicted"])
            except Exception:
                continue
            delta_h = (nxt - now).total_seconds() / 3600
            preds.append({
                "bug_type":       p["bug_type"],
                "predicted_at":   p["next_predicted"],
                "hours_from_now": round(delta_h, 1),
                "confidence":     round(p["confidence"] * 100, 1),
                "interval_h":     round(p["avg_interval_hours"], 1),
                "occurrences":    p["occurrence_count"],
                "modules":        p["modules"],
                "overdue":        delta_h < 0,
            })
        preds.sort(key=lambda x: x["hours_from_now"])
        return preds[:8]

    def advance_prediction(self, bug_type: str):
        """Called after a bug is healed — push next prediction forward."""
        patterns = self.db.get_patterns()
        for p in patterns:
            if p["bug_type"] == bug_type:
                self.db.upsert_pattern(
                    bug_type,
                    [p["avg_interval_hours"]] * max(1, p["occurrence_count"] - 1),
                    p["modules"],
                )
                break

    def learn_from_history(self):
        """Compute recurring patterns from all historical bug data."""
        bugs = self.db.get_bug_history(days=HISTORY_DAYS)
        if not bugs:
            return
        by_type: Dict[str, List[datetime]] = defaultdict(list)
        by_module: Dict[str, List[str]]    = defaultdict(list)
        for b in bugs:
            try:
                dt = datetime.fromisoformat(b["detected_at"])
                by_type[b["bug_type"]].append(dt)
                by_module[b["bug_type"]].append(b["module"])
            except Exception:
                pass

        for btype, timestamps in by_type.items():
            if len(timestamps) < 2:
                continue
            timestamps.sort()
            intervals = []
            for i in range(len(timestamps) - 1):
                h = (timestamps[i+1] - timestamps[i]).total_seconds() / 3600
                if 0.5 < h < 200:
                    intervals.append(h)
            if intervals:
                self.db.upsert_pattern(btype, intervals, list(set(by_module[btype])))

        count = len(self.db.get_patterns())
        log.info("PredictiveEngine: %d recurring patterns identified from history", count)


# ═══════════════════════════════════════════════════════════════════════
# 7.  BUG RECOGNIZER — classifies and prioritises incoming bugs
# ═══════════════════════════════════════════════════════════════════════
class BugRecognizer:
    """Matches known error signatures and classifies new ones."""

    def classify(self, bug: Dict) -> Dict:
        btype = bug.get("type", "Unknown")
        meta  = BUG_CATALOGUE.get(btype, {"fix": "generic_patch", "severity": "MEDIUM", "priority": 3})
        return {
            **bug,
            "recommended_fix": meta["fix"],
            "fix_priority":    meta["priority"],
        }


# ═══════════════════════════════════════════════════════════════════════
# 8.  DEFAULT DETECTOR — identifies non-optimal configuration params
# ═══════════════════════════════════════════════════════════════════════
class DefaultDetector:
    """Compares current config values against known optima."""

    def assess(self, deflt: Dict) -> Dict:
        current = deflt.get("current", "")
        optimal = deflt.get("optimal", "")
        try:
            c, o     = float(current), float(optimal)
            delta    = abs(o - c) / max(abs(c), 1) * 100
        except ValueError:
            delta = 100.0
        return {**deflt, "delta_pct": round(delta, 1),
                "urgency": "HIGH" if delta > 80 else "MEDIUM"}


# ═══════════════════════════════════════════════════════════════════════
# 9.  ROOT CAUSE ANALYZER — correlates metric spikes with active bugs
# ═══════════════════════════════════════════════════════════════════════
class RootCauseAnalyzer:
    """
    Examines live metric trends alongside active bug types to identify
    the most likely root cause of current degradation.
    """

    METRIC_SIGNATURES: Dict[str, Dict[str, float]] = {
        "DBConnectionTimeout":   {"latency_ms": 0.9, "cpu_pct": 0.6, "error_rate": 0.8},
        "MemoryLeak":            {"mem_pct": 0.95, "latency_ms": 0.5},
        "ServiceUnavailable":    {"error_rate": 0.9, "req_per_sec": -0.8},
        "SlowQuery":             {"latency_ms": 0.85, "cpu_pct": 0.7},
        "NullPointerException":  {"error_rate": 0.75},
        "SecurityVulnerability": {},
        "ArrayIndexOutOfBounds": {"error_rate": 0.7, "latency_ms": 0.4},
        "MissingConfig":         {"error_rate": 0.6},
    }

    def analyse(self, metrics: Dict, active_bugs: List[Dict]) -> Optional[Dict]:
        if not active_bugs:
            return None
        scores: Dict[str, float] = {}
        for bug in active_bugs:
            btype = bug.get("type", "")
            sig   = self.METRIC_SIGNATURES.get(btype, {})
            score = 0.0
            for metric, weight in sig.items():
                val = metrics.get(metric, 0)
                if weight > 0 and val > 50:
                    score += weight * (val / 100)
                elif weight < 0 and val < 100:
                    score += abs(weight) * (1 - val / 280)
            scores[btype] = score
        if not scores:
            return None
        top = max(scores, key=scores.get)
        return {"root_cause": top, "confidence": round(min(scores[top], 1.0), 2)}


# ═══════════════════════════════════════════════════════════════════════
# 10. HEALING ENGINE — applies autonomous fixes, logs outcomes
# ═══════════════════════════════════════════════════════════════════════
class HealingEngine:
    """Applies fixes silently — system recovers without human involvement."""

    def __init__(self):
        self.healed_log: List[Dict] = []
        self.stats = {
            "bugs_fixed":           0,
            "defaults_adjusted":    0,
            "anomalies_suppressed": 0,
            "total_ms_saved":       0,
        }

    def heal_bug(self, bug: Dict) -> Dict:
        fix     = bug.get("recommended_fix", "generic_patch")
        lo, hi  = FIX_TIMES_MS.get(fix, (300, 1000))
        elapsed = random.randint(lo, hi)
        time.sleep(elapsed / 1000.0)

        res = {
            "healed_id":   bug["id"],
            "type":        bug["type"],
            "module":      bug["module"],
            "severity":    bug["severity"],
            "fix_applied": fix,
            "description": RESOLUTION_TEMPLATES.get(fix, "Patch applied"),
            "elapsed_ms":  elapsed,
            "healed_at":   datetime.now().isoformat(),
            "category":    "BUG_FIX",
        }
        self.healed_log.append(res)
        self.stats["bugs_fixed"]       += 1
        self.stats["total_ms_saved"]   += elapsed
        log.info("✔ HEALED [%s] %s via %s (%d ms)",
                 bug["severity"], bug["id"], fix, elapsed)
        return res

    def adjust_default(self, deflt: Dict) -> Dict:
        lo, hi  = FIX_TIMES_MS["apply_config_default"]
        elapsed = random.randint(lo, hi)
        time.sleep(elapsed / 1000.0)

        desc = (f"Set {deflt['param']} = {deflt['optimal']} "
                f"(was {deflt['current']}). {deflt['impact']} resolved.")
        res = {
            "healed_id":   deflt["id"],
            "type":        "ConfigDefault",
            "module":      "ConfigManager",
            "severity":    deflt["urgency"],
            "fix_applied": "apply_config_default",
            "description": desc,
            "elapsed_ms":  elapsed,
            "healed_at":   datetime.now().isoformat(),
            "category":    "CONFIG_ADJUST",
        }
        self.healed_log.append(res)
        self.stats["defaults_adjusted"] += 1
        log.info("✔ CONFIG [%s] %s → %s", deflt["param"], deflt["current"], deflt["optimal"])
        return res


# ═══════════════════════════════════════════════════════════════════════
# 11. MAINTENANCE LOGGER — in-memory + DB audit trail
# ═══════════════════════════════════════════════════════════════════════
class MaintenanceLogger:
    """Dual-write: fast in-memory list for live dashboard, SQLite for history."""

    def __init__(self, db: HistoricalDB):
        self.db      = db
        self.records: List[Dict] = []

    def record(self, resolution: Dict, score: float):
        entry = {**resolution, "anomaly_score": round(score, 4),
                 "recorded_at": datetime.now().isoformat()}
        self.records.append(entry)
        self.db.record_maintenance(resolution, score)


# ═══════════════════════════════════════════════════════════════════════
# 12. GUARDIAN BRAIN — central ML orchestrator
# ═══════════════════════════════════════════════════════════════════════
class GuardianBrain:
    """
    The autonomous core.  Three daemon threads run continuously:
      • monitor   — ticks every 2 s, ingests telemetry, queues issues
      • healer    — consumes the heal queue, applies fixes in priority order
      • learner   — refreshes pattern recognition every 5 minutes
    """

    def __init__(self, db: HistoricalDB):
        self.db          = db
        self.sigif2      = SIGIF2Simulator()
        self.analyzer    = PatternAnalyzer()
        self.predictor   = PredictiveEngine(db)
        self.recognizer  = BugRecognizer()
        self.detector    = DefaultDetector()
        self.root_cause  = RootCauseAnalyzer()
        self.healer      = HealingEngine()
        self.maint_log   = MaintenanceLogger(db)
        self.inspector   = ApplicationInspector()

        self.metrics_history: deque = deque(maxlen=60)
        self.events_feed:     deque = deque(maxlen=120)
        self.active           = True
        self._heal_queue:     deque = deque()
        self._lock            = threading.Lock()

        self._health_score    = 100.0
        self._root_cause_info: Optional[Dict] = None
        self._scan_done       = False

        log.info("GuardianBrain initialised")

    # ── Health score ──────────────────────────────────────────────────
    def _calc_health(self, metrics: Dict) -> float:
        score = 100.0
        score -= len(self.sigif2.active_bugs)     * 8
        score -= len(self.sigif2.active_defaults) * 3
        if metrics.get("anomaly_score", 0) > 0.6:
            score -= 15
        if metrics.get("error_rate", 0) > 5:
            score -= 10
        if metrics.get("latency_ms", 0) > 500:
            score -= 8
        score += self.healer.stats["bugs_fixed"] * 0.5
        return round(max(0.0, min(100.0, score)), 1)

    # ── Event emitter ─────────────────────────────────────────────────
    def _emit(self, kind: str, msg: str, level: str):
        self.events_feed.appendleft({
            "kind":  kind, "msg": msg,
            "level": level, "ts": datetime.now().strftime("%H:%M:%S"),
        })

    # ── Monitor thread ────────────────────────────────────────────────
    def run_monitor(self):
        """Tick every 2 s: ingest metrics, detect anomalies, queue heals."""
        while self.active:
            try:
                metrics                  = self.sigif2.next_tick()
                is_anomaly, score        = self.analyzer.ingest(metrics)
                metrics["anomaly_score"] = round(score, 4)
                metrics["is_anomaly"]    = is_anomaly

                self._health_score       = self._calc_health(metrics)
                metrics["health_score"]  = self._health_score

                with self._lock:
                    self.metrics_history.append(metrics)

                # Persist metric sample every 5 ticks (avoid DB spam)
                if metrics["tick"] % 5 == 0:
                    self.db.record_metric(metrics)

                if is_anomaly:
                    self.healer.stats["anomalies_suppressed"] += 1
                    self._emit("ANOMALY",
                               f"Anomaly detected — score {score:.3f} | "
                               f"CPU {metrics['cpu_pct']:.0f}% | "
                               f"Lat {metrics['latency_ms']:.0f}ms",
                               "warn")

                # Root-cause analysis
                if self.sigif2.active_bugs:
                    rc = self.root_cause.analyse(metrics, self.sigif2.active_bugs)
                    self._root_cause_info = rc

                # Queue active bugs
                for bug in list(self.sigif2.active_bugs):
                    if bug.get("status") == "ACTIVE":
                        classified = self.recognizer.classify(bug)
                        bug["status"] = "QUEUED"
                        self._emit("BUG",
                                   f"[{bug['severity']}] {bug['id']} — {bug['description']}",
                                   "error")
                        with self._lock:
                            self._heal_queue.append(("bug", classified, score))

                # Queue active defaults
                for deflt in list(self.sigif2.active_defaults):
                    if deflt.get("status") == "ACTIVE":
                        assessed = self.detector.assess(deflt)
                        deflt["status"] = "QUEUED"
                        self._emit("CONFIG",
                                   f"Default {deflt['param']} = {deflt['current']} "
                                   f"(optimal: {deflt['optimal']})",
                                   "warn")
                        with self._lock:
                            self._heal_queue.append(("default", assessed, score))

            except Exception as e:
                log.error("Monitor error: %s", e)
            time.sleep(2)

    # ── Healer thread ─────────────────────────────────────────────────
    def run_healer(self):
        """Consume heal queue, apply fixes, record outcomes, update predictions."""
        while self.active:
            item = None
            with self._lock:
                if self._heal_queue:
                    # Priority sort: lower fix_priority number = handle first
                    queue_list = list(self._heal_queue)
                    queue_list.sort(key=lambda x: x[1].get("fix_priority", 99)
                                    if x[0] == "bug" else 99)
                    item = queue_list[0]
                    self._heal_queue.clear()
                    for i in queue_list[1:]:
                        self._heal_queue.append(i)

            if item:
                kind, obj, score = item
                try:
                    if kind == "bug":
                        res = self.healer.heal_bug(obj)
                        self.sigif2.active_bugs = [
                            b for b in self.sigif2.active_bugs if b["id"] != obj["id"]]
                        self.db.record_bug_fix(obj, res, score)
                        self.predictor.advance_prediction(obj["type"])
                    else:
                        res = self.healer.adjust_default(obj)
                        self.sigif2.active_defaults = [
                            d for d in self.sigif2.active_defaults if d["id"] != obj["id"]]

                    self.maint_log.record(res, score)
                    self._emit("HEALED",
                               f"✔ {res['healed_id']} resolved via "
                               f"{res['fix_applied']} ({res['elapsed_ms']} ms)",
                               "success")
                except Exception as e:
                    log.error("Healer error: %s", e)
            else:
                time.sleep(0.5)

    # ── Pattern-learner thread ─────────────────────────────────────────
    def run_learner(self):
        """Refresh recurring-pattern knowledge every 5 minutes."""
        # Initial learn right after bootstrap
        time.sleep(5)
        self.predictor.learn_from_history()
        while self.active:
            time.sleep(300)
            log.info("Learner: refreshing pattern knowledge …")
            self.predictor.learn_from_history()

    # ── App-scanner thread ────────────────────────────────────────────
    def run_scanner(self):
        """Scan application source files once at startup, store findings in DB."""
        time.sleep(8)
        log.info("Inspector: scanning application source files …")
        findings = self.inspector.scan(".")
        for f in findings:
            self.db.record_scan_finding(f)
        self._scan_done = True
        log.info("Inspector: %d findings recorded", len(findings))
        self._emit("SCAN",
                   f"App scan complete — {len(findings)} findings stored",
                   "warn" if findings else "success")

    # ── Start ─────────────────────────────────────────────────────────
    def start(self):
        for target, name in [
            (self.run_monitor, "monitor"),
            (self.run_healer,  "healer"),
            (self.run_learner, "learner"),
            (self.run_scanner, "scanner"),
        ]:
            threading.Thread(target=target, daemon=True, name=name).start()
        log.info("GuardianBrain threads started")

    # ── API snapshot ──────────────────────────────────────────────────
    def snapshot(self) -> Dict:
        with self._lock:
            hist   = list(self.metrics_history)
        latest = hist[-1] if hist else {}
        return {
            "latest_metrics":   latest,
            "metrics_history":  hist[-30:],
            "events":           list(self.events_feed)[:40],
            "stats":            self.healer.stats,
            "healed_log":       self.healer.healed_log[-25:],
            "active_bugs":      self.sigif2.active_bugs,
            "active_defaults":  self.sigif2.active_defaults,
            "queue_depth":      len(self._heal_queue),
            "model_trained":    self.analyzer._trained,
            "health_score":     self._health_score,
            "root_cause":       self._root_cause_info,
            "uptime_pct":       self.db.get_uptime_pct(),
            "predictions":      self.predictor.get_predictions(),
        }

    def history_snapshot(self) -> Dict:
        return {
            "daily_stats":      self.db.get_daily_stats(14),
            "type_dist":        self.db.get_type_dist(),
            "mttr":             self.db.get_mttr(),
            "patterns":         self.db.get_patterns(),
            "scan_findings":    self.db.get_scan_findings(40),
            "total_historical": self.db.count_bugs(),
        }


# ═══════════════════════════════════════════════════════════════════════
# 13. FLASK APPLICATION + LIVE DASHBOARD
# ═══════════════════════════════════════════════════════════════════════
app   = Flask(__name__)
db    = HistoricalDB(DB_PATH)
brain = GuardianBrain(db)

DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Autonomous Guardian System — SIGIF2 v2.0</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@300;600;800&display=swap" rel="stylesheet">
<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
<style>
:root{
  --bg:#060d1a;--panel:#0b1628;--border:#0f3460;
  --cyan:#00f5ff;--green:#00ff88;--red:#ff3860;
  --yellow:#ffd600;--purple:#c77dff;--dim:#1a2744;
  --text:#c8d8f0;--mono:'Share Tech Mono',monospace;--exo:'Exo 2',sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--text);font-family:var(--exo);min-height:100vh;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:999;
  background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.05) 2px,rgba(0,0,0,.05) 4px)}
/* Header */
header{background:linear-gradient(90deg,#00081a,var(--border),#00081a);
  border-bottom:1px solid var(--cyan);padding:10px 20px;
  display:flex;align-items:center;justify-content:space-between;
  position:sticky;top:0;z-index:100;gap:12px}
.logo{font-family:var(--exo);font-weight:800;font-size:1.05rem;color:var(--cyan);letter-spacing:2px}
.logo span{color:var(--green)}
.hdr-right{display:flex;align-items:center;gap:16px}
.status-pill{display:flex;align-items:center;gap:6px;font-size:.72rem;font-family:var(--mono);color:var(--green)}
.pulse{width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 1.4s infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(0,255,136,.5)}50%{box-shadow:0 0 0 6px rgba(0,255,136,0)}}
.health-header{font-family:var(--mono);font-size:.8rem;display:flex;align-items:center;gap:6px}
.health-val{font-size:1.1rem;font-weight:800;transition:color .5s}
/* Grid */
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:12px;max-width:1700px;margin:auto}
.col2{grid-column:span 2}.col3{grid-column:span 3}.col4{grid-column:span 4}
/* KPI */
.kpi{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:12px 14px;position:relative;overflow:hidden}
.kpi::after{content:'';position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--accent,var(--cyan)),transparent)}
.kpi-label{font-size:.62rem;letter-spacing:2px;text-transform:uppercase;color:#5a7090;font-family:var(--mono)}
.kpi-val{font-size:2rem;font-weight:800;color:var(--accent,var(--cyan));line-height:1;margin:4px 0 2px;font-family:var(--mono)}
.kpi-sub{font-size:.68rem;color:#4a6080}
/* Box panels */
.box{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px}
.box-title{font-size:.62rem;letter-spacing:2px;text-transform:uppercase;color:var(--cyan);
  font-family:var(--mono);border-bottom:1px solid var(--dim);padding-bottom:5px;
  display:flex;align-items:center;gap:6px}
.dot{width:6px;height:6px;border-radius:50%;background:var(--cyan);display:inline-block;animation:pulse 2s infinite}
/* Charts */
.chart-wrap{position:relative;height:150px}
/* Events */
#events-list{list-style:none;overflow-y:auto;max-height:260px;font-family:var(--mono);font-size:.68rem;display:flex;flex-direction:column;gap:3px}
#events-list li{padding:4px 7px;border-radius:3px;border-left:3px solid;background:rgba(255,255,255,.02);animation:slideIn .3s ease}
@keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
.ev-error{border-color:var(--red);color:#ff8fa0}
.ev-warn{border-color:var(--yellow);color:#ffe580}
.ev-success{border-color:var(--green);color:#80ffb0}
.ev-warn2{border-color:var(--purple);color:#e0b0ff}
.ev-ts{color:#4a6080;margin-right:5px}
.ev-kind{font-weight:700;margin-right:5px;font-size:.58rem;padding:1px 3px;border-radius:2px;background:rgba(255,255,255,.08)}
/* Heal table */
.heal-table{width:100%;border-collapse:collapse;font-size:.68rem;font-family:var(--mono)}
.heal-table th{color:#4a6080;padding:3px 7px;text-align:left;border-bottom:1px solid var(--dim);font-weight:normal;letter-spacing:1px}
.heal-table td{padding:4px 7px;border-bottom:1px solid rgba(255,255,255,.03)}
.heal-table tr{animation:fadeRow .5s ease}
@keyframes fadeRow{from{background:rgba(0,255,136,.07)}to{background:transparent}}
/* Badges */
.badge{padding:2px 5px;border-radius:3px;font-size:.58rem;font-weight:700}
.badge-high{background:rgba(255,56,96,.2);color:var(--red)}
.badge-critical{background:rgba(255,56,96,.35);color:#ff8fa0}
.badge-medium{background:rgba(255,214,0,.15);color:var(--yellow)}
.badge-low{background:rgba(0,245,255,.1);color:var(--cyan)}
.badge-fix{background:rgba(0,255,136,.1);color:var(--green)}
.badge-cfg{background:rgba(199,125,255,.1);color:var(--purple)}
/* Anomaly bar */
.score-bar-wrap{display:flex;align-items:center;gap:6px;font-size:.68rem}
.score-bar{flex:1;height:5px;background:var(--dim);border-radius:3px;overflow:hidden}
.score-bar-fill{height:100%;border-radius:3px;transition:width .5s;
  background:linear-gradient(90deg,var(--green),var(--yellow),var(--red))}
/* Bug/Config items */
.bug-item{background:rgba(255,56,96,.05);border:1px solid rgba(255,56,96,.18);
  border-radius:4px;padding:7px 9px;font-size:.7rem;font-family:var(--mono)}
.bug-id{color:var(--red);font-weight:700}
.bug-mod{color:var(--cyan);font-size:.62rem}
.bug-desc{color:#8090a0;margin-top:2px;font-size:.62rem}
.cfg-item{background:rgba(255,214,0,.03);border:1px solid rgba(255,214,0,.14);
  border-radius:4px;padding:7px 9px;font-size:.7rem;font-family:var(--mono)}
.cfg-param{color:var(--yellow);font-weight:700}
.cfg-vals{color:#8090a0;font-size:.62rem;margin-top:2px}
/* Guardian orb */
.orb-wrap{display:flex;justify-content:center;align-items:center;padding:8px 0}
.orb{width:80px;height:80px;border-radius:50%;position:relative;
  background:radial-gradient(circle at 38% 38%,#00f5ff33,#0a1f4a 60%,#00081a);
  border:1px solid var(--cyan);
  box-shadow:0 0 30px rgba(0,245,255,.2),0 0 60px rgba(0,245,255,.1),inset 0 0 20px rgba(0,245,255,.1);
  animation:orbPulse 3s ease-in-out infinite}
@keyframes orbPulse{0%,100%{box-shadow:0 0 30px rgba(0,245,255,.2),0 0 60px rgba(0,245,255,.1)}
  50%{box-shadow:0 0 50px rgba(0,245,255,.4),0 0 100px rgba(0,245,255,.2)}}
.orb::after{content:'AI';position:absolute;inset:0;display:flex;align-items:center;
  justify-content:center;color:var(--cyan);font-family:var(--mono);font-size:.9rem;
  font-weight:700;text-shadow:0 0 10px var(--cyan)}
.orb-label{text-align:center;font-size:.6rem;font-family:var(--mono);color:#4a6080;letter-spacing:1px;margin-top:3px}
/* Stats chips */
.stat-row{display:flex;gap:5px;flex-wrap:wrap}
.stat-chip{flex:1;min-width:70px;background:var(--dim);border-radius:4px;padding:6px;text-align:center}
.stat-chip .n{font-size:1.3rem;font-weight:800;font-family:var(--mono);color:var(--green)}
.stat-chip .l{font-size:.58rem;color:#4a6080;letter-spacing:1px;text-transform:uppercase}
/* Prediction items */
.pred-item{background:rgba(199,125,255,.04);border:1px solid rgba(199,125,255,.18);
  border-radius:4px;padding:7px 10px;font-size:.7rem;font-family:var(--mono);margin-bottom:5px}
.pred-type{color:var(--purple);font-weight:700}
.pred-time{color:var(--yellow);font-size:.65rem}
.pred-conf{color:#4a6080;font-size:.6rem}
.pred-overdue{border-color:var(--red);background:rgba(255,56,96,.06)}
/* Pattern items */
.pat-item{display:grid;grid-template-columns:180px 100px 80px 120px 1fr;
  gap:8px;align-items:center;padding:5px 8px;border-bottom:1px solid var(--dim);
  font-size:.68rem;font-family:var(--mono)}
.pat-item:last-child{border-bottom:none}
.pat-type{color:var(--cyan)}
.pat-interval{color:var(--yellow)}
.pat-conf{color:var(--green)}
.pat-next{color:#8090a0}
/* Scan findings */
.scan-item{display:grid;grid-template-columns:60px 100px 1fr;gap:6px;
  align-items:center;padding:4px 7px;border-bottom:1px solid var(--dim);
  font-size:.65rem;font-family:var(--mono)}
.scan-item:last-child{border-bottom:none}
/* Confidence bar mini */
.conf-bar{height:4px;background:var(--dim);border-radius:2px;overflow:hidden;width:60px}
.conf-fill{height:100%;border-radius:2px;background:var(--green);transition:width .5s}
/* Root cause */
.rc-box{background:rgba(255,214,0,.04);border:1px solid rgba(255,214,0,.14);
  border-radius:4px;padding:6px 10px;font-size:.68rem;font-family:var(--mono);margin-top:4px}
/* Tab buttons for historical */
.tab-row{display:flex;gap:6px;margin-bottom:8px}
.tab-btn{padding:3px 10px;border:1px solid var(--border);border-radius:3px;
  background:var(--dim);color:#5a7090;font-size:.62rem;font-family:var(--mono);
  cursor:pointer;letter-spacing:1px;transition:all .2s}
.tab-btn.active{border-color:var(--cyan);color:var(--cyan);background:rgba(0,245,255,.06)}
/* Health gauge */
.gauge-wrap{position:relative;width:100px;height:55px;margin:0 auto}
.gauge-track{fill:none;stroke:var(--dim);stroke-width:8}
.gauge-fill{fill:none;stroke-width:8;stroke-linecap:round;transition:stroke-dashoffset .8s,stroke .5s}
.gauge-text{text-anchor:middle;font-family:var(--mono);fill:var(--cyan);font-size:14px;font-weight:700}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.col3,.col4{grid-column:span 2}.col2{grid-column:span 2}}
</style>
</head>
<body>
<header>
  <div>
    <div class="logo">Autonomous <span>Guardian</span> System <span style="font-size:.65rem;color:#3a5070">v2.0</span></div>
    <div style="font-size:.6rem;color:#3a5070;font-family:var(--mono);margin-top:1px">
      SIGIF2 · Self-Healing · ML Core · Pattern Learning · Predictive Engine
    </div>
  </div>
  <div class="hdr-right">
    <div class="health-header">
      HEALTH <span class="health-val" id="hdr-health">—</span>
    </div>
    <div class="status-pill"><div class="pulse"></div> AUTONOMOUS — OPERATIONAL</div>
  </div>
</header>

<div class="grid" id="app">

  <!-- KPI Row -->
  <div class="kpi" style="--accent:var(--cyan)">
    <div class="kpi-label">CPU Usage</div>
    <div class="kpi-val" id="kpi-cpu">—</div>
    <div class="kpi-sub">% utilisation</div>
  </div>
  <div class="kpi" style="--accent:var(--purple)">
    <div class="kpi-label">Memory</div>
    <div class="kpi-val" id="kpi-mem">—</div>
    <div class="kpi-sub">% heap used</div>
  </div>
  <div class="kpi" style="--accent:var(--yellow)">
    <div class="kpi-label">Latency</div>
    <div class="kpi-val" id="kpi-lat">—</div>
    <div class="kpi-sub">ms avg response</div>
  </div>
  <div class="kpi" style="--accent:var(--green)">
    <div class="kpi-label">Throughput</div>
    <div class="kpi-val" id="kpi-rps">—</div>
    <div class="kpi-sub">req / sec</div>
  </div>

  <!-- Secondary KPI Row -->
  <div class="kpi" style="--accent:var(--green)">
    <div class="kpi-label">System Health</div>
    <div class="kpi-val" id="kpi-health">—</div>
    <div class="kpi-sub">composite score / 100</div>
  </div>
  <div class="kpi" style="--accent:var(--red)">
    <div class="kpi-label">Error Rate</div>
    <div class="kpi-val" id="kpi-err">—</div>
    <div class="kpi-sub">% requests failing</div>
  </div>
  <div class="kpi" style="--accent:var(--cyan)">
    <div class="kpi-label">Uptime (7d)</div>
    <div class="kpi-val" id="kpi-up">—</div>
    <div class="kpi-sub">% availability</div>
  </div>
  <div class="kpi" style="--accent:var(--yellow)">
    <div class="kpi-label">Total Healed</div>
    <div class="kpi-val" id="kpi-healed">—</div>
    <div class="kpi-sub">bugs + configs fixed</div>
  </div>

  <!-- Live Charts -->
  <div class="box col2">
    <div class="box-title"><span class="dot"></span> CPU + Memory (rolling 30 ticks)</div>
    <div class="chart-wrap"><canvas id="chartCpuMem"></canvas></div>
  </div>
  <div class="box col2">
    <div class="box-title"><span class="dot"></span> Latency + Error Rate</div>
    <div class="chart-wrap"><canvas id="chartLatErr"></canvas></div>
  </div>

  <!-- Guardian Orb + Stats -->
  <div class="box" style="justify-content:center">
    <div class="box-title"><span class="dot"></span> ML Guardian Core</div>
    <div class="orb-wrap"><div class="orb"></div></div>
    <div class="orb-label">PATTERN RECOGNITION<br>ANOMALY DETECTION<br>PREDICTIVE HEALING</div>
    <div class="score-bar-wrap" style="margin-top:5px">
      <span style="font-size:.6rem;color:#4a6080;font-family:var(--mono);white-space:nowrap">ANOMALY</span>
      <div class="score-bar"><div class="score-bar-fill" id="anomaly-bar" style="width:0%"></div></div>
      <span id="anomaly-val" style="font-size:.62rem;font-family:var(--mono);color:var(--cyan);white-space:nowrap">0.000</span>
    </div>
    <div class="stat-row" style="margin-top:3px">
      <div class="stat-chip"><div class="n" id="st-bugs">0</div><div class="l">Fixed</div></div>
      <div class="stat-chip"><div class="n" id="st-cfg">0</div><div class="l">Configs</div></div>
      <div class="stat-chip"><div class="n" id="st-anom">0</div><div class="l">Anomalies</div></div>
    </div>
    <div id="rc-display"></div>
  </div>

  <!-- Live Events -->
  <div class="box col2">
    <div class="box-title"><span class="dot"></span> Live Event Stream</div>
    <ul id="events-list"></ul>
  </div>

  <!-- Predictions -->
  <div class="box">
    <div class="box-title"><span class="dot" style="background:var(--purple)"></span>
      Predictive Failures <span style="color:var(--purple);margin-left:4px;font-size:.6rem" id="pred-count"></span>
    </div>
    <div id="pred-list" style="overflow-y:auto;max-height:240px"></div>
  </div>

  <!-- Active Bugs -->
  <div class="box">
    <div class="box-title">
      <span class="dot" style="background:var(--red)"></span>
      Active Bugs <span id="bug-count" style="color:var(--red);margin-left:4px">0</span>
    </div>
    <div id="bug-list" style="display:flex;flex-direction:column;gap:5px;overflow-y:auto;max-height:240px"></div>
  </div>

  <!-- Config Defaults -->
  <div class="box">
    <div class="box-title">
      <span class="dot" style="background:var(--yellow)"></span>
      Config Defaults <span id="cfg-count" style="color:var(--yellow);margin-left:4px">0</span>
    </div>
    <div id="cfg-list" style="display:flex;flex-direction:column;gap:5px;overflow-y:auto;max-height:240px"></div>
  </div>

  <!-- Historical charts -->
  <div class="box col2">
    <div class="box-title"><span class="dot" style="background:var(--yellow)"></span> Historical Bug Frequency (14 days)</div>
    <div class="chart-wrap"><canvas id="chartDaily"></canvas></div>
  </div>
  <div class="box">
    <div class="box-title"><span class="dot" style="background:var(--purple)"></span> Bug Type Distribution</div>
    <div class="chart-wrap"><canvas id="chartDist"></canvas></div>
  </div>
  <div class="box">
    <div class="box-title"><span class="dot" style="background:var(--green)"></span> MTTR by Type (ms)</div>
    <div class="chart-wrap"><canvas id="chartMttr"></canvas></div>
  </div>

  <!-- Recurring Patterns -->
  <div class="box col4">
    <div class="box-title"><span class="dot" style="background:var(--purple)"></span>
      Learned Recurring Patterns — Guardian's Historical Knowledge Base
      <span id="hist-count" style="color:#4a6080;margin-left:8px;font-size:.6rem"></span>
    </div>
    <div style="overflow-x:auto">
      <div style="display:grid;grid-template-columns:190px 110px 90px 160px 1fr;
           gap:8px;padding:3px 8px;font-size:.6rem;color:#4a6080;font-family:var(--mono);
           border-bottom:1px solid var(--dim);letter-spacing:1px">
        <span>BUG TYPE</span><span>AVG INTERVAL</span><span>CONFIDENCE</span>
        <span>NEXT PREDICTED</span><span>MODULES</span>
      </div>
      <div id="patterns-list"></div>
    </div>
  </div>

  <!-- App Scan Findings -->
  <div class="box col4">
    <div class="box-title"><span class="dot" style="background:var(--yellow)"></span>
      Application Inspector — Static Analysis Findings
    </div>
    <div style="overflow-x:auto;max-height:200px;overflow-y:auto">
      <div id="scan-list"></div>
    </div>
  </div>

  <!-- Resolution Log -->
  <div class="box col4">
    <div class="box-title"><span class="dot" style="background:var(--green)"></span>
      Resolution Log — Autonomous Healing Actions
    </div>
    <div style="overflow-x:auto;max-height:280px;overflow-y:auto">
      <table class="heal-table">
        <thead>
          <tr>
            <th>TIME</th><th>ID</th><th>TYPE</th><th>MODULE</th>
            <th>SEVERITY</th><th>FIX APPLIED</th><th>MS</th><th>RESOLUTION</th>
          </tr>
        </thead>
        <tbody id="heal-tbody"></tbody>
      </table>
    </div>
  </div>

</div><!-- /grid -->

<script>
const API      = '/api/snapshot';
const HIST_API = '/api/history';
const POLL_MS  = 2000;
const HIST_MS  = 30000;

let charts      = {};
let seenHeal    = new Set();
let seenEv      = new Set();

const C = {
  cyan:'#00f5ff', green:'#00ff88', red:'#ff3860',
  yellow:'#ffd600', purple:'#c77dff', dim:'#1a2744'
};

Chart.defaults.color        = '#4a6080';
Chart.defaults.borderColor  = '#1a2744';
Chart.defaults.font.family  = "'Share Tech Mono', monospace";
Chart.defaults.font.size    = 10;

function mkLine(id, datasets, yMax) {
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type:'line', data:{labels:[],datasets},
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      interaction:{mode:'index',intersect:false},
      plugins:{legend:{position:'top',labels:{boxWidth:8,padding:8}},
               tooltip:{backgroundColor:'#0b1628',borderColor:'#0f3460',borderWidth:1,padding:6}},
      scales:{
        x:{grid:{color:'#0d1e38'},ticks:{maxTicksLimit:8}},
        y:{grid:{color:'#0d1e38'},min:0,...(yMax?{max:yMax}:{}),ticks:{maxTicksLimit:5}}
      }
    }
  });
}

function mkBar(id, labels, data, color) {
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type:'bar',
    data:{labels, datasets:[{data, backgroundColor:color+'44', borderColor:color, borderWidth:1}]},
    options:{responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{legend:{display:false}},
      scales:{x:{grid:{color:'#0d1e38'},ticks:{maxTicksLimit:10}},
              y:{grid:{color:'#0d1e38'},min:0}}}
  });
}

function mkDoughnut(id, labels, data) {
  const ctx = document.getElementById(id).getContext('2d');
  const colors = [C.cyan,C.purple,C.red,C.yellow,C.green,'#ff8fa0','#80ffb0','#ffe580'];
  return new Chart(ctx, {
    type:'doughnut',
    data:{labels, datasets:[{data, backgroundColor:colors.map(c=>c+'66'), borderColor:colors, borderWidth:1}]},
    options:{responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{legend:{position:'right',labels:{boxWidth:8,padding:6,font:{size:9}}}}}
  });
}

function initCharts() {
  charts.cpuMem = mkLine('chartCpuMem',[
    {label:'CPU %', data:[], borderColor:C.cyan,   borderWidth:2, pointRadius:0, tension:.4,
     fill:true, backgroundColor:'rgba(0,245,255,.05)'},
    {label:'Mem %', data:[], borderColor:C.purple, borderWidth:2, pointRadius:0, tension:.4, fill:false}
  ], 100);

  charts.latErr = mkLine('chartLatErr',[
    {label:'Latency ms', data:[], borderColor:C.yellow, borderWidth:2, pointRadius:0, tension:.4, yAxisID:'y'},
    {label:'Error Rate', data:[], borderColor:C.red,    borderWidth:2, pointRadius:0, tension:.4, yAxisID:'y2',
     fill:true, backgroundColor:'rgba(255,56,96,.05)'}
  ]);
  charts.latErr.options.scales.y2 = {
    position:'right', grid:{drawOnChartArea:false}, min:0, max:35, ticks:{maxTicksLimit:4}
  };
  charts.latErr.update();
}

function pushPt(chart, tick, values) {
  const L = chart.data.labels;
  L.push(String(tick).padStart(4,'0'));
  values.forEach((v,i) => chart.data.datasets[i].data.push(v));
  if (L.length > 30) { L.shift(); chart.data.datasets.forEach(d=>d.data.shift()); }
  chart.update('none');
}

const fmt = (n, d=1) => n==null?'—':Number(n).toFixed(d);

function esc(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function healthColor(h){
  if(h>=80) return 'var(--green)';
  if(h>=50) return 'var(--yellow)';
  return 'var(--red)';
}

function renderKPIs(m, data) {
  document.getElementById('kpi-cpu').textContent    = fmt(m.cpu_pct)+'%';
  document.getElementById('kpi-mem').textContent    = fmt(m.mem_pct)+'%';
  document.getElementById('kpi-lat').textContent    = fmt(m.latency_ms,0);
  document.getElementById('kpi-rps').textContent    = fmt(m.req_per_sec,0);
  document.getElementById('kpi-err').textContent    = fmt(m.error_rate,1)+'%';
  const h = m.health_score || 0;
  document.getElementById('kpi-health').textContent = fmt(h,1);
  document.getElementById('kpi-health').style.color = healthColor(h);
  document.getElementById('hdr-health').textContent = fmt(h,0);
  document.getElementById('hdr-health').style.color = healthColor(h);
  document.getElementById('kpi-up').textContent     = fmt(data.uptime_pct,2)+'%';
  const tot = (data.stats.bugs_fixed||0)+(data.stats.defaults_adjusted||0);
  document.getElementById('kpi-healed').textContent = tot;
}

function renderAnomaly(score){
  document.getElementById('anomaly-bar').style.width = Math.min(100,score*100)+'%';
  document.getElementById('anomaly-val').textContent = fmt(score,3);
}

function renderStats(s){
  document.getElementById('st-bugs').textContent = s.bugs_fixed||0;
  document.getElementById('st-cfg').textContent  = s.defaults_adjusted||0;
  document.getElementById('st-anom').textContent = s.anomalies_suppressed||0;
}

function renderRootCause(rc){
  const el = document.getElementById('rc-display');
  if(!rc){ el.innerHTML=''; return; }
  el.innerHTML = `<div class="rc-box">
    <span style="color:#4a6080">ROOT CAUSE:</span>
    <span style="color:var(--yellow);margin-left:6px">${esc(rc.root_cause)}</span>
    <span style="color:#4a6080;margin-left:6px">(${Math.round(rc.confidence*100)}% conf)</span>
  </div>`;
}

function renderEvents(events){
  const ul = document.getElementById('events-list');
  events.forEach(ev => {
    const key = ev.ts+ev.msg;
    if(seenEv.has(key)) return;
    seenEv.add(key);
    const li  = document.createElement('li');
    const cls = ev.level==='error'?'ev-error':ev.level==='success'?'ev-success':
                ev.level==='warn'?'ev-warn':'ev-warn2';
    li.className = cls;
    li.innerHTML = `<span class="ev-ts">${ev.ts}</span><span class="ev-kind">${ev.kind}</span>${esc(ev.msg)}`;
    ul.prepend(li);
    while(ul.children.length>50) ul.removeChild(ul.lastChild);
  });
}

function renderBugs(bugs){
  document.getElementById('bug-count').textContent = bugs.length;
  const w = document.getElementById('bug-list');
  w.innerHTML = bugs.length===0
    ? '<div style="color:#2a4060;font-size:.7rem;font-family:var(--mono);text-align:center;padding:20px">NO ACTIVE BUGS — SYSTEM HEALTHY</div>'
    : bugs.map(b=>`
      <div class="bug-item">
        <div><span class="bug-id">${esc(b.id)}</span>
          <span class="badge badge-${b.severity.toLowerCase()}" style="margin-left:5px">${esc(b.severity)}</span></div>
        <div class="bug-mod">${esc(b.module)}</div>
        <div class="bug-desc">${esc(b.description)}</div>
      </div>`).join('');
}

function renderDefaults(defs){
  document.getElementById('cfg-count').textContent = defs.length;
  const w = document.getElementById('cfg-list');
  w.innerHTML = defs.length===0
    ? '<div style="color:#2a4060;font-size:.7rem;font-family:var(--mono);text-align:center;padding:20px">ALL CONFIGS OPTIMAL</div>'
    : defs.map(d=>`
      <div class="cfg-item">
        <div class="cfg-param">${esc(d.param)}</div>
        <div class="cfg-vals">current: <b>${esc(d.current)}</b> → optimal: <b style="color:var(--green)">${esc(d.optimal)}</b></div>
      </div>`).join('');
}

function renderPredictions(preds){
  document.getElementById('pred-count').textContent = preds.length ? `(${preds.length})` : '';
  const w = document.getElementById('pred-list');
  if(!preds.length){
    w.innerHTML = '<div style="color:#2a4060;font-size:.68rem;font-family:var(--mono);text-align:center;padding:20px">No patterns learned yet</div>';
    return;
  }
  w.innerHTML = preds.map(p=>`
    <div class="pred-item${p.overdue?' pred-overdue':''}">
      <div class="pred-type">${esc(p.bug_type)}</div>
      <div class="pred-time">${p.overdue?'⚠ OVERDUE':'⏱ In '+(Math.abs(p.hours_from_now)).toFixed(1)+'h'}</div>
      <div class="pred-conf">Confidence: ${p.confidence}% · every ${p.interval_h}h · ${p.occurrences} historical occurrences</div>
    </div>`).join('');
}

function renderHealLog(log){
  const tb = document.getElementById('heal-tbody');
  log.forEach(r => {
    const key = r.healed_id+r.healed_at;
    if(seenHeal.has(key)) return;
    seenHeal.add(key);
    const sev = (r.severity||'').toLowerCase();
    const cat = r.category==='CONFIG_ADJUST'?'badge-cfg':'badge-fix';
    const tr  = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.healed_at?r.healed_at.split('T')[1].slice(0,8):''}</td>
      <td style="color:var(--cyan)">${esc(r.healed_id)}</td>
      <td>${esc(r.type||'')}</td>
      <td style="color:#8090a0">${esc(r.module||'')}</td>
      <td><span class="badge badge-${sev}">${esc(r.severity||'')}</span></td>
      <td><span class="badge ${cat}">${esc(r.fix_applied||'')}</span></td>
      <td style="color:var(--green)">${r.elapsed_ms}</td>
      <td style="color:#6080a0;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.description||'')}</td>`;
    tb.prepend(tr);
    while(tb.children.length>60) tb.removeChild(tb.lastChild);
  });
}

function renderPatterns(patterns){
  const w = document.getElementById('patterns-list');
  if(!patterns.length){
    w.innerHTML='<div style="color:#2a4060;font-size:.7rem;font-family:var(--mono);padding:16px;text-align:center">Learning patterns from history...</div>';
    return;
  }
  w.innerHTML = patterns.map(p=>{
    const conf = Math.round(p.confidence*100);
    const mods = (p.modules||[]).join(', ');
    let nxt = p.next_predicted||'';
    try{ nxt = new Date(nxt).toLocaleString(); }catch(e){}
    return `<div class="pat-item">
      <span class="pat-type">${esc(p.bug_type)}</span>
      <span class="pat-interval">~${(p.avg_interval_hours||0).toFixed(1)}h</span>
      <span class="pat-conf">
        <div class="conf-bar"><div class="conf-fill" style="width:${conf}%"></div></div>
        <span style="font-size:.58rem;color:#4a6080">${conf}%</span>
      </span>
      <span class="pat-next">${esc(nxt)}</span>
      <span style="color:#4a6080;font-size:.62rem">${esc(mods)}</span>
    </div>`;
  }).join('');
}

function renderHistCount(n){
  document.getElementById('hist-count').textContent = n ? `${n} historical bug records` : '';
}

function renderScanFindings(findings){
  const w = document.getElementById('scan-list');
  if(!findings.length){
    w.innerHTML='<div style="color:#2a4060;font-size:.7rem;font-family:var(--mono);padding:12px;text-align:center">Scan pending or no findings...</div>';
    return;
  }
  w.innerHTML = findings.map(f=>`
    <div class="scan-item">
      <span><span class="badge badge-${(f.severity||'low').toLowerCase()}">${esc(f.severity||'')}</span></span>
      <span style="color:var(--yellow);font-size:.62rem">${esc(f.category||'')}</span>
      <span style="color:#8090a0;font-size:.62rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${esc(f.file_path||'')}:${f.line_no||'?'} — ${esc(f.description||'').slice(0,100)}
      </span>
    </div>`).join('');
}

function updateHistCharts(hist){
  const daily = hist.daily_stats||[];
  const dist  = hist.type_dist||{};
  const mttr  = hist.mttr||{};

  // Daily bug chart
  const dayLabels = daily.map(d=>(d.day||'').slice(5));
  const dayData   = daily.map(d=>d.bugs||0);
  if(!charts.daily){
    charts.daily = mkBar('chartDaily', dayLabels, dayData, C.purple);
  } else {
    charts.daily.data.labels   = dayLabels;
    charts.daily.data.datasets[0].data = dayData;
    charts.daily.update('none');
  }

  // Distribution donut
  const distLabels = Object.keys(dist);
  const distData   = Object.values(dist);
  if(!charts.dist){
    charts.dist = mkDoughnut('chartDist', distLabels, distData);
  } else {
    charts.dist.data.labels   = distLabels;
    charts.dist.data.datasets[0].data = distData;
    charts.dist.update('none');
  }

  // MTTR bar
  const mttrLabels = Object.keys(mttr).map(k=>k.slice(0,8));
  const mttrData   = Object.values(mttr);
  if(!charts.mttr){
    charts.mttr = mkBar('chartMttr', mttrLabels, mttrData, C.green);
  } else {
    charts.mttr.data.labels   = mttrLabels;
    charts.mttr.data.datasets[0].data = mttrData;
    charts.mttr.update('none');
  }
}

// ── Main poll ──────────────────────────────────────────────────────────
async function poll(){
  try {
    const resp = await fetch(API);
    if(!resp.ok) throw new Error('HTTP '+resp.status);
    const data = await resp.json();
    const m    = data.latest_metrics||{};
    if(!Object.keys(m).length) return;

    renderKPIs(m, data);
    renderAnomaly(m.anomaly_score||0);
    renderStats(data.stats||{});
    renderRootCause(data.root_cause);
    renderEvents(data.events||[]);
    renderBugs(data.active_bugs||[]);
    renderDefaults(data.active_defaults||[]);
    renderPredictions(data.predictions||[]);
    renderHealLog(data.healed_log||[]);
    pushPt(charts.cpuMem, m.tick, [m.cpu_pct, m.mem_pct]);
    pushPt(charts.latErr, m.tick, [m.latency_ms, m.error_rate]);
  } catch(e){
    console.warn('Poll error:', e.message);
  }
}

async function pollHistory(){
  try {
    const resp = await fetch(HIST_API);
    if(!resp.ok) return;
    const hist = await resp.json();
    updateHistCharts(hist);
    renderPatterns(hist.patterns||[]);
    renderScanFindings(hist.scan_findings||[]);
    renderHistCount(hist.total_historical||0);
  } catch(e){
    console.warn('History poll error:', e.message);
  }
}

initCharts();
poll();
pollHistory();
setInterval(poll,       POLL_MS);
setInterval(pollHistory, HIST_MS);
</script>
</body>
</html>
"""

# ─────────────────────────────────────────────────────────────────────
# API ROUTES
# ─────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template_string(DASHBOARD_HTML)

@app.route("/api/snapshot")
def api_snapshot():
    return jsonify(brain.snapshot())

@app.route("/api/history")
def api_history():
    return jsonify(brain.history_snapshot())

@app.route("/api/stats")
def api_stats():
    return jsonify(brain.healer.stats)

@app.route("/api/healed")
def api_healed():
    n = int(request.args.get("n", 20))
    return jsonify(brain.healer.healed_log[-n:])

@app.route("/api/events")
def api_events():
    return jsonify(list(brain.events_feed))

@app.route("/api/predictions")
def api_predictions():
    return jsonify(brain.predictor.get_predictions())

@app.route("/api/patterns")
def api_patterns():
    return jsonify(db.get_patterns())

@app.route("/api/scan")
def api_scan():
    return jsonify(db.get_scan_findings())

@app.route("/api/health")
def api_health():
    snap = brain.snapshot()
    return jsonify({
        "score":         snap["health_score"],
        "uptime_pct":    snap["uptime_pct"],
        "active_bugs":   len(snap["active_bugs"]),
        "queue_depth":   snap["queue_depth"],
        "model_trained": snap["model_trained"],
        "stats":         snap["stats"],
    })


# ═══════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    log.info("=" * 68)
    log.info("  AUTONOMOUS GUARDIAN SYSTEM — SIGIF2 Self-Healing Core v2.0")
    log.info("  Learn · Adapt · Predict · Resolve · Self-Heal")
    log.info("=" * 68)

    # Step 1: Generate 6-month historical data if DB is empty
    bootstrap = HistoricalBootstrap()
    bootstrap.run(db)

    # Step 2: Start the Guardian Brain (monitor, healer, learner, scanner threads)
    brain.start()

    # Step 3: Warm-up — let monitoring threads gather initial data
    log.info("Warming up — collecting initial telemetry …")
    time.sleep(4)

    # Step 4: Serve dashboard
    log.info("Dashboard ready → http://0.0.0.0:5000")
    log.info("API endpoints:")
    log.info("  GET /api/snapshot    — live system state")
    log.info("  GET /api/history     — 6-month historical analytics")
    log.info("  GET /api/predictions — predicted upcoming failures")
    log.info("  GET /api/patterns    — learned recurring patterns")
    log.info("  GET /api/health      — composite health score")
    log.info("  GET /api/scan        — static code analysis findings")
    app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False)
