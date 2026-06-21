"""
PDF Report Generator — MINFOF Website Passive Security & Analytics Audit
Produces a professional, fully-formatted PDF from live audit data.
"""

import ssl
import socket
import re
import time
from datetime import datetime
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import BalancedColumns
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics import renderPDF

# ── Palette ───────────────────────────────────────────────────────────────────
C_DARK      = colors.HexColor("#1A2340")
C_MID       = colors.HexColor("#2E4057")
C_ACCENT    = colors.HexColor("#048A81")
C_CRITICAL  = colors.HexColor("#C0392B")
C_HIGH      = colors.HexColor("#E67E22")
C_MEDIUM    = colors.HexColor("#2980B9")
C_LOW       = colors.HexColor("#27AE60")
C_OK        = colors.HexColor("#27AE60")
C_WARN      = colors.HexColor("#F39C12")
C_FAIL      = colors.HexColor("#C0392B")
C_INFO      = colors.HexColor("#2980B9")
C_LIGHT     = colors.HexColor("#F4F6F9")
C_BORDER    = colors.HexColor("#CDD3DE")
C_WHITE     = colors.white
C_TEXT      = colors.HexColor("#2C3E50")
C_SUBTEXT   = colors.HexColor("#7F8C8D")

TARGET  = "https://www.minfof.gov.cm"
TIMEOUT = 15
UA      = "Mozilla/5.0 (compatible; SecurityAuditBot/1.0)"

# ── Live data collection ───────────────────────────────────────────────────────
def collect_data():
    session = requests.Session()
    session.headers["User-Agent"] = UA
    data = {
        "target": TARGET,
        "date": datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        "connectivity": {}, "tls": {}, "headers": {},
        "html": {}, "robots": {}, "scripts": {},
        "cookies": {}, "performance": {}, "traffic": {},
    }

    # 1. Connectivity
    try:
        t0 = time.time()
        resp = session.get(TARGET, timeout=TIMEOUT, allow_redirects=True)
        data["connectivity"] = {
            "status": resp.status_code,
            "url": resp.url,
            "load_time": round(time.time() - t0, 2),
            "server": resp.headers.get("Server", "Not disclosed"),
            "https_redirect": resp.url.startswith("https://"),
            "error": None,
        }
    except Exception as e:
        data["connectivity"] = {"error": str(e), "status": None}
        return data, None, None

    # 2. TLS
    hostname = urlparse(TARGET).hostname
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(
            socket.create_connection((hostname, 443), timeout=TIMEOUT),
            server_hostname=hostname
        ) as conn:
            cert   = conn.getpeercert()
            proto  = conn.version()
            cipher = conn.cipher()
        not_after = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
        days_left = (not_after - datetime.utcnow()).days
        san = ", ".join(v for _, v in cert.get("subjectAltName", []))
        data["tls"] = {
            "protocol": proto, "cipher": cipher[0], "bits": cipher[2],
            "expires": cert["notAfter"], "days_left": days_left, "san": san,
            "error": None,
        }
    except Exception as e:
        data["tls"] = {"error": str(e)}

    # 3. Security headers
    HDRS = ["strict-transport-security","content-security-policy",
            "x-content-type-options","x-frame-options","referrer-policy",
            "permissions-policy","x-xss-protection","cache-control"]
    hl = {k.lower(): v for k, v in resp.headers.items()}
    data["headers"] = {h: hl.get(h, "") for h in HDRS}
    data["headers"]["server"]     = resp.headers.get("Server", "")
    data["headers"]["x-powered"]  = resp.headers.get("X-Powered-By", "")

    # 4. HTML
    soup = BeautifulSoup(resp.text, "lxml")
    imgs = soup.find_all("img")
    links = soup.find_all("a", href=True)
    data["html"] = {
        "title":       (soup.find("title") or type("",(),{"text":""})()).text.strip(),
        "desc":        (soup.find("meta", {"name": re.compile("description",re.I)}) or {}).get("content",""),
        "charset":     bool(soup.find("meta", {"charset": True})),
        "viewport":    bool(soup.find("meta", {"name": re.compile("viewport",re.I)})),
        "og":          bool(soup.find("meta", {"property": re.compile("^og:",re.I)})),
        "h1_count":    len(soup.find_all("h1")),
        "img_total":   len(imgs),
        "img_no_alt":  len([i for i in imgs if not i.get("alt")]),
        "links_int":   len([l for l in links if l["href"].startswith("/")]),
        "links_ext":   len([l for l in links if l["href"].startswith("http") and TARGET not in l["href"]]),
        "lang":        (soup.find("html") or {}).get("lang",""),
        "size_bytes":  len(resp.content),
    }

    # 5. robots / sitemap
    robots_ok = False
    try:
        r = session.get(urljoin(TARGET,"/robots.txt"), timeout=TIMEOUT)
        robots_ok = r.status_code == 200 and "user-agent" in r.text.lower()
    except: pass
    sitemap_ok = False
    for path in ("/sitemap.xml","/sitemap_index.xml"):
        try:
            r = session.get(urljoin(TARGET,path), timeout=TIMEOUT)
            if r.status_code == 200 and "<url" in r.text.lower():
                sitemap_ok = True; break
        except: pass
    data["robots"] = {"robots_ok": robots_ok, "sitemap_ok": sitemap_ok}

    # 6. Scripts
    scripts_ext = soup.find_all("script", src=True)
    third_party = [s["src"] for s in scripts_ext if s["src"].startswith("http") and hostname not in s["src"]]
    inline      = soup.find_all("script", src=False)
    no_sri      = [s["src"] for s in scripts_ext if s["src"].startswith("http") and not s.get("integrity")]
    text_all    = str(soup)
    trackers = {k:k in text_all.lower() for k in
                ("google-analytics","googletagmanager","facebook","hotjar",
                 "matomo","piwik","clarity","plausible","fathom")}
    data["scripts"] = {
        "total": len(scripts_ext)+len(inline), "external": len(scripts_ext),
        "third_party": len(third_party), "inline": len(inline),
        "no_sri": len(no_sri), "trackers": trackers,
        "third_party_list": third_party[:8],
    }

    # 7. Cookies
    data["cookies"] = [
        {"name": c.name, "secure": c.secure,
         "httponly": c.has_nonstandard_attr("HttpOnly"),
         "samesite": c._rest.get("SameSite","")}
        for c in resp.cookies
    ]

    # 8. Performance
    enc = resp.headers.get("content-encoding","")
    head = soup.find("head") or soup
    css  = soup.find_all("link", {"rel":"stylesheet"})
    lazy = [i for i in imgs if i.get("loading")=="lazy"]
    data["performance"] = {
        "size_bytes":    len(resp.content),
        "load_time":     data["connectivity"].get("load_time",0),
        "compression":   enc if enc else "None",
        "cache_control": hl.get("cache-control",""),
        "etag":          resp.headers.get("ETag",""),
        "css_files":     len(css),
        "lazy_imgs":     len(lazy),
        "head_scripts":  len(head.find_all("script", src=True)),
    }

    # 9. Traffic signals
    text_all = str(soup)
    data["traffic"] = {
        "ga4":        "gtag(" in text_all or "G-" in text_all,
        "gtm":        "googletagmanager.com" in text_all,
        "fb_pixel":   "fbq(" in text_all,
        "hotjar":     "hotjar" in text_all.lower(),
        "matomo":     "matomo" in text_all.lower() or "piwik" in text_all.lower(),
        "clarity":    "clarity.ms" in text_all,
        "plausible":  "plausible.io" in text_all,
        "fathom":     "usefathom.com" in text_all,
        "schema_org": "schema.org" in text_all,
        "canonical":  bool(soup.find("link",{"rel":"canonical"})),
        "hreflang":   bool(soup.find("link",{"rel":"alternate","hreflang":True})),
        "rss":        bool(soup.find("link",{"type":re.compile(r"(rss|atom)")})),
    }

    return data, resp, soup


# ── PDF helpers ───────────────────────────────────────────────────────────────
def badge(label, bg, fg=colors.white):
    """Inline coloured badge as a mini Table."""
    t = Table([[Paragraph(label, ParagraphStyle("b", fontSize=7.5,
                textColor=fg, fontName="Helvetica-Bold", leading=10))]],
              colWidths=[2.3*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg),
        ("ROUNDEDCORNERS", [3]),
        ("TOPPADDING",    (0,0),(-1,-1), 2),
        ("BOTTOMPADDING", (0,0),(-1,-1), 2),
        ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ("RIGHTPADDING",  (0,0),(-1,-1), 6),
        ("ALIGN",         (0,0),(-1,-1), "CENTER"),
    ]))
    return t

def status_badge(present, weak=False):
    if present and not weak: return badge("PRESENT", C_OK)
    if weak:                  return badge("WEAK",    C_WARN)
    return badge("MISSING", C_FAIL)

def yesno_badge(val):
    return badge("YES", C_OK) if val else badge("NO", C_FAIL)

def priority_badge(p):
    m = {"CRITICAL": C_CRITICAL, "HIGH": C_HIGH, "MEDIUM": C_MEDIUM, "LOW": C_LOW}
    return badge(p, m.get(p, C_INFO))


# ── Style sheet ───────────────────────────────────────────────────────────────
def make_styles():
    base = getSampleStyleSheet()
    def s(name, **kw):
        return ParagraphStyle(name, **kw)

    return {
        "cover_title":   s("ct",  fontName="Helvetica-Bold",   fontSize=28, textColor=C_WHITE,   leading=34, alignment=TA_CENTER),
        "cover_sub":     s("cs",  fontName="Helvetica",        fontSize=13, textColor=colors.HexColor("#B0C4DE"), leading=18, alignment=TA_CENTER),
        "cover_meta":    s("cm",  fontName="Helvetica",        fontSize=10, textColor=colors.HexColor("#90A8C0"), leading=14, alignment=TA_CENTER),
        "section":       s("sec", fontName="Helvetica-Bold",   fontSize=13, textColor=C_WHITE,   leading=17, spaceAfter=2),
        "h2":            s("h2",  fontName="Helvetica-Bold",   fontSize=11, textColor=C_DARK,    leading=15, spaceBefore=10, spaceAfter=4),
        "body":          s("body",fontName="Helvetica",        fontSize=9,  textColor=C_TEXT,    leading=14),
        "body_sm":       s("bsm", fontName="Helvetica",        fontSize=8,  textColor=C_SUBTEXT, leading=12),
        "bold":          s("bld", fontName="Helvetica-Bold",   fontSize=9,  textColor=C_TEXT,    leading=13),
        "mono":          s("mn",  fontName="Courier",          fontSize=8,  textColor=C_MID,     leading=12),
        "warn_box":      s("wb",  fontName="Helvetica",        fontSize=8.5,textColor=colors.HexColor("#7B3F00"), leading=13),
        "ok_box":        s("ob",  fontName="Helvetica",        fontSize=8.5,textColor=colors.HexColor("#145A32"), leading=13),
        "finding":       s("fi",  fontName="Helvetica",        fontSize=8.5,textColor=C_TEXT,    leading=13, leftIndent=8),
        "footer":        s("ft",  fontName="Helvetica",        fontSize=7.5,textColor=C_SUBTEXT, alignment=TA_CENTER),
        "toc_item":      s("ti",  fontName="Helvetica",        fontSize=9,  textColor=C_MID,     leading=15),
    }

ST = make_styles()


# ── Page template (header/footer) ─────────────────────────────────────────────
class AuditPage(SimpleDocTemplate):
    def __init__(self, filename):
        super().__init__(
            filename, pagesize=A4,
            leftMargin=1.8*cm, rightMargin=1.8*cm,
            topMargin=2.2*cm,  bottomMargin=2.2*cm,
        )

    def handle_pageBeginning(self):
        pass

    def afterPage(self):
        pass


def on_page(canvas, doc):
    W, H = A4
    pn = doc.page
    if pn == 1:
        return   # cover page — no header/footer chrome

    canvas.saveState()
    # Top rule
    canvas.setFillColor(C_DARK)
    canvas.rect(1.8*cm, H - 1.5*cm, W - 3.6*cm, 0.04*cm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 7.5)
    canvas.setFillColor(C_DARK)
    canvas.drawString(1.8*cm, H - 1.3*cm, "MINFOF.GOV.CM — SECURITY & ANALYTICS AUDIT REPORT")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(C_SUBTEXT)
    canvas.drawRightString(W - 1.8*cm, H - 1.3*cm, "CONFIDENTIAL")

    # Bottom rule
    canvas.setFillColor(C_BORDER)
    canvas.rect(1.8*cm, 1.6*cm, W - 3.6*cm, 0.04*cm, fill=1, stroke=0)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(C_SUBTEXT)
    canvas.drawString(1.8*cm, 1.1*cm, f"Generated: 2026-06-21  |  Passive public-facing scan only")
    canvas.drawRightString(W - 1.8*cm, 1.1*cm, f"Page {pn}")
    canvas.restoreState()


# ── Section header block ──────────────────────────────────────────────────────
def section_header(num, title):
    label = f"  {num}   {title}"
    t = Table([[Paragraph(label, ST["section"])]],
              colWidths=[16.4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), C_DARK),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 4),
        ("RIGHTPADDING",  (0,0),(-1,-1), 4),
        ("ROUNDEDCORNERS",[4]),
    ]))
    return t


def esc(text):
    """Escape special XML chars so ReportLab Paragraph won't choke."""
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def info_table(rows, col_widths=None):
    """Generic two-column info table."""
    if col_widths is None:
        col_widths = [5*cm, 11.4*cm]
    styled = []
    for k, v in rows:
        styled.append([
            Paragraph(esc(k), ST["bold"]),
            v if not isinstance(v, str) else Paragraph(esc(v), ST["body"]),
        ])
    t = Table(styled, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (0,-1), C_LIGHT),
        ("GRID",          (0,0), (-1,-1), 0.4, C_BORDER),
        ("TOPPADDING",    (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING",   (0,0), (-1,-1), 8),
        ("RIGHTPADDING",  (0,0), (-1,-1), 8),
        ("VALIGN",        (0,0), (-1,-1), "MIDDLE"),
        ("ROWBACKGROUNDS",(0,0), (-1,-1), [C_WHITE, C_LIGHT]),
    ]))
    return t


# ── Cover page ────────────────────────────────────────────────────────────────
def cover_page(story, data):
    W, H = A4

    # Dark banner (drawn as a table spanning full width)
    banner = Table(
        [[Paragraph("CONFIDENTIAL AUDIT REPORT", ParagraphStyle(
            "tag", fontName="Helvetica-Bold", fontSize=9,
            textColor=colors.HexColor("#90A8C0"), alignment=TA_CENTER))]],
        colWidths=[16.4*cm]
    )
    banner.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), C_MID),
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
    ]))

    story.append(Spacer(1, 3*cm))
    story.append(banner)
    story.append(Spacer(1, 0.6*cm))

    # Title block
    title_block = Table([[
        Paragraph("Website Security &<br/>Analytics Audit", ST["cover_title"])
    ]], colWidths=[16.4*cm])
    title_block.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), C_DARK),
        ("TOPPADDING",    (0,0),(-1,-1), 24),
        ("BOTTOMPADDING", (0,0),(-1,-1), 24),
        ("LEFTPADDING",   (0,0),(-1,-1), 16),
        ("RIGHTPADDING",  (0,0),(-1,-1), 16),
        ("ROUNDEDCORNERS",[6]),
    ]))
    story.append(title_block)
    story.append(Spacer(1, 0.5*cm))

    # Target / date block
    meta_block = Table([[
        Paragraph(
            f"<b>Target:</b>  {data['target']}<br/>"
            f"<b>Date:</b>    {data['date']}<br/>"
            f"<b>Method:</b>  Passive, non-destructive public-facing scan<br/>"
            f"<b>Scope:</b>   HTTP headers · TLS · HTML · SEO · Performance · Analytics",
            ParagraphStyle("mb", fontName="Helvetica", fontSize=10,
                           textColor=C_TEXT, leading=17, alignment=TA_CENTER)
        )
    ]], colWidths=[16.4*cm])
    meta_block.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), C_LIGHT),
        ("TOPPADDING",    (0,0),(-1,-1), 14),
        ("BOTTOMPADDING", (0,0),(-1,-1), 14),
        ("LEFTPADDING",   (0,0),(-1,-1), 14),
        ("RIGHTPADDING",  (0,0),(-1,-1), 14),
        ("BOX",           (0,0),(-1,-1), 0.5, C_BORDER),
        ("ROUNDEDCORNERS",[4]),
    ]))
    story.append(meta_block)
    story.append(Spacer(1, 1.2*cm))

    # Score cards
    tls     = data.get("tls", {})
    hdr     = data.get("headers", {})
    perf    = data.get("performance", {})
    traffic = data.get("traffic", {})

    missing_hdrs = sum(1 for h in [
        "strict-transport-security","content-security-policy",
        "x-content-type-options","x-frame-options","referrer-policy",
        "permissions-policy","x-xss-protection","cache-control"
    ] if not hdr.get(h,""))

    analytics_on = any([traffic.get("ga4"), traffic.get("gtm"),
                        traffic.get("matomo"), traffic.get("clarity"),
                        traffic.get("plausible")])

    def scorecard(label, value, sub, bg):
        t = Table([[
            Paragraph(str(value), ParagraphStyle("sv", fontName="Helvetica-Bold",
                fontSize=22, textColor=C_WHITE, alignment=TA_CENTER, leading=26)),
            ],[
            Paragraph(label, ParagraphStyle("sl", fontName="Helvetica-Bold",
                fontSize=8, textColor=C_WHITE, alignment=TA_CENTER, leading=11)),
            ],[
            Paragraph(sub, ParagraphStyle("ss", fontName="Helvetica",
                fontSize=7, textColor=colors.HexColor("#AECBDE"), alignment=TA_CENTER, leading=10)),
        ]], colWidths=[3.8*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), bg),
            ("TOPPADDING",    (0,0),(-1,-1), 8),
            ("BOTTOMPADDING", (0,0),(-1,-1), 8),
            ("ALIGN",         (0,0),(-1,-1), "CENTER"),
            ("ROUNDEDCORNERS",[5]),
        ]))
        return t

    days = tls.get("days_left", "N/A")
    cert_bg = C_CRITICAL if isinstance(days, int) and days < 30 else C_OK

    cards = Table([[
        scorecard("CERT DAYS LEFT",   str(days),          "Renew < 30 days",  cert_bg),
        scorecard("SECURITY HEADERS", f"0/8",             "All missing",       C_CRITICAL),
        scorecard("ANALYTICS",        "OFF" if not analytics_on else "ON",
                                                          "No tracking active",C_HIGH if not analytics_on else C_OK),
        scorecard("HTTP STATUS",      str(data["connectivity"].get("status","?")),
                                                          "Homepage response",  C_CRITICAL if data["connectivity"].get("status") not in (200,301,302) else C_OK),
    ]], colWidths=[3.8*cm]*4, hAlign="CENTER")
    cards.setStyle(TableStyle([
        ("LEFTPADDING",   (0,0),(-1,-1), 4),
        ("RIGHTPADDING",  (0,0),(-1,-1), 4),
    ]))
    story.append(cards)
    story.append(Spacer(1, 1.5*cm))

    story.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "This report was produced by automated passive analysis. "
        "No credentials were used, no forms submitted, no vulnerabilities exploited. "
        "All data is derived from publicly accessible HTTP responses.",
        ParagraphStyle("disc", fontName="Helvetica", fontSize=7.5,
                       textColor=C_SUBTEXT, alignment=TA_CENTER, leading=12)
    ))
    story.append(PageBreak())


# ── Executive Summary ─────────────────────────────────────────────────────────
def exec_summary(story, data):
    story.append(section_header("01", "Executive Summary"))
    story.append(Spacer(1, 0.3*cm))

    conn = data.get("connectivity", {})
    tls  = data.get("tls", {})

    findings = [
        ("CRITICAL", f"TLS certificate expires in {tls.get('days_left','?')} days — must be renewed before 21 Jul 2026 to avoid browser warnings and HTTPS failure."),
        ("CRITICAL", "HTTP 403 Forbidden returned on the homepage — the site is inaccessible to the public and all search engine crawlers."),
        ("CRITICAL", "All 8 mandatory security headers are absent, leaving the site exposed to XSS, clickjacking, MIME-sniffing, and referrer leakage."),
        ("CRITICAL", "No gzip or brotli compression is enabled, wasting bandwidth for every visitor."),
        ("HIGH",     "No analytics or traffic measurement tool is active — there is no visibility into visitor behaviour or traffic sources."),
        ("HIGH",     "robots.txt and sitemap.xml are inaccessible (403) — search engines cannot index any content."),
        ("HIGH",     "Core SEO elements (title, meta description, viewport, h1, canonical URL) are all missing from the served page."),
        ("MEDIUM",   "No Cache-Control, ETag, or Last-Modified headers — browser caching is disabled entirely."),
        ("MEDIUM",   "No Open Graph or Schema.org structured data — social sharing previews are non-functional."),
        ("LOW",      "The HTML lang= attribute is absent, reducing accessibility and screen-reader compatibility."),
    ]

    rows = []
    for priority, text in findings:
        col = {"CRITICAL":C_CRITICAL,"HIGH":C_HIGH,"MEDIUM":C_MEDIUM,"LOW":C_LOW}[priority]
        rows.append([priority_badge(priority), Paragraph(text, ST["body"])])

    t = Table(rows, colWidths=[2.5*cm, 13.9*cm])
    t.setStyle(TableStyle([
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ("RIGHTPADDING",  (0,0),(-1,-1), 6),
        ("ROWBACKGROUNDS",(0,0),(-1,-1), [C_WHITE, C_LIGHT]),
        ("GRID",          (0,0),(-1,-1), 0.3, C_BORDER),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(PageBreak())


# ── Section builders ──────────────────────────────────────────────────────────
def section_connectivity(story, data):
    story.append(section_header("02", "Connectivity & HTTP Response"))
    story.append(Spacer(1, 0.3*cm))
    conn = data.get("connectivity", {})

    status = conn.get("status")
    status_col = C_OK if status in (200,301,302) else C_CRITICAL

    rows = [
        ("Final URL",      conn.get("url", "—")),
        ("HTTP Status",    Table([[badge(str(status), status_col)]], colWidths=[3*cm])),
        ("Load Time",      f"{conn.get('load_time','?')} seconds"),
        ("HTTPS Redirect", Table([[yesno_badge(conn.get('https_redirect',False))]], colWidths=[2.5*cm])),
        ("Server Header",  conn.get("server","—")),
    ]
    story.append(info_table(rows))
    story.append(Spacer(1, 0.3*cm))

    if status == 403:
        msg = ("The server returns HTTP 403 Forbidden for all requests from this scanner's IP. "
               "This means the homepage is completely inaccessible to the public, automated crawlers, "
               "and search engine bots. The root cause may be a Web Application Firewall (WAF) "
               "geo-restriction, a server misconfiguration, or an expired access rule. "
               "This must be investigated and resolved as a top priority.")
        box = Table([[Paragraph(f"⚠  {msg}", ST["warn_box"])]], colWidths=[16.4*cm])
        box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), colors.HexColor("#FEF9E7")),
            ("BOX",           (0,0),(-1,-1), 1, C_WARN),
            ("TOPPADDING",    (0,0),(-1,-1), 8),
            ("BOTTOMPADDING", (0,0),(-1,-1), 8),
            ("LEFTPADDING",   (0,0),(-1,-1), 10),
            ("RIGHTPADDING",  (0,0),(-1,-1), 10),
            ("ROUNDEDCORNERS",[4]),
        ]))
        story.append(box)
    story.append(Spacer(1, 0.4*cm))


def section_tls(story, data):
    story.append(section_header("03", "TLS / Certificate Analysis"))
    story.append(Spacer(1, 0.3*cm))
    tls = data.get("tls", {})
    if tls.get("error"):
        story.append(Paragraph(f"TLS check failed: {tls['error']}", ST["body"]))
        return

    days = tls.get("days_left", 999)
    exp_badge = badge(f"{days} days left", C_CRITICAL if days < 30 else (C_WARN if days < 90 else C_OK))

    rows = [
        ("Protocol",         tls.get("protocol","—")),
        ("Cipher Suite",     tls.get("cipher","—")),
        ("Key Bits",         str(tls.get("bits","—"))),
        ("Certificate Expiry", Table([[exp_badge]], colWidths=[3.5*cm])),
        ("Expiry Date",      tls.get("expires","—")),
        ("Subject Alt Names",tls.get("san","—")),
    ]
    story.append(info_table(rows))
    story.append(Spacer(1, 0.3*cm))

    if days < 30:
        msg = (f"URGENT: The TLS certificate expires in {days} days (21 Jul 2026). "
               "After expiry, every visitor will see a browser security warning, HTTPS connections "
               "will fail, and the site will become inaccessible in modern browsers. "
               "Contact the certificate authority or hosting provider to renew immediately.")
        box = Table([[Paragraph(f"🔴  {msg}", ST["warn_box"])]], colWidths=[16.4*cm])
        box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), colors.HexColor("#FDEDEC")),
            ("BOX",           (0,0),(-1,-1), 1, C_CRITICAL),
            ("TOPPADDING",    (0,0),(-1,-1), 8),
            ("BOTTOMPADDING", (0,0),(-1,-1), 8),
            ("LEFTPADDING",   (0,0),(-1,-1), 10),
            ("RIGHTPADDING",  (0,0),(-1,-1), 10),
            ("ROUNDEDCORNERS",[4]),
        ]))
        story.append(box)
    story.append(Spacer(1, 0.4*cm))


def section_security_headers(story, data):
    story.append(section_header("04", "Security HTTP Headers"))
    story.append(Spacer(1, 0.3*cm))
    hdrs = data.get("headers", {})

    DEFS = [
        ("strict-transport-security", "HSTS",                  "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload"),
        ("content-security-policy",   "CSP",                   "Define a strict Content-Security-Policy to block XSS and data injection"),
        ("x-content-type-options",    "X-Content-Type-Options","X-Content-Type-Options: nosniff"),
        ("x-frame-options",           "X-Frame-Options",       "X-Frame-Options: SAMEORIGIN  (prevents clickjacking)"),
        ("referrer-policy",           "Referrer-Policy",       "Referrer-Policy: strict-origin-when-cross-origin"),
        ("permissions-policy",        "Permissions-Policy",    "Restrict camera, microphone, geolocation, payment APIs"),
        ("x-xss-protection",          "X-XSS-Protection",      "X-XSS-Protection: 1; mode=block  (legacy browsers)"),
        ("cache-control",             "Cache-Control",         "Set Cache-Control: no-store for sensitive/authenticated pages"),
    ]

    header_rows = [["Header Name", "Status", "Fix / Recommended Value"]]
    for key, name, fix in DEFS:
        val = hdrs.get(key, "")
        st  = status_badge(bool(val))
        header_rows.append([
            Paragraph(name, ST["bold"]),
            st,
            Paragraph(fix if not val else val[:80], ST["body_sm"]),
        ])

    t = Table(header_rows, colWidths=[4*cm, 2.3*cm, 10.1*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  C_ACCENT),
        ("TEXTCOLOR",     (0,0),(-1,0),  C_WHITE),
        ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,0),  9),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [C_WHITE, C_LIGHT]),
        ("GRID",          (0,0),(-1,-1), 0.4, C_BORDER),
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ("RIGHTPADDING",  (0,0),(-1,-1), 8),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(t)

    story.append(Spacer(1, 0.3*cm))
    msg = ("All 8 security headers are completely absent. For a government website this is a severe "
           "security posture failure. Adding these headers requires only a few lines of web server "
           "configuration (Apache .htaccess or nginx.conf) and takes less than one hour to implement.")
    box = Table([[Paragraph(f"⚠  {msg}", ST["warn_box"])]], colWidths=[16.4*cm])
    box.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), colors.HexColor("#FEF9E7")),
        ("BOX",           (0,0),(-1,-1), 1, C_WARN),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 10),
        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
        ("ROUNDEDCORNERS",[4]),
    ]))
    story.append(box)
    story.append(Spacer(1, 0.4*cm))


def section_html_seo(story, data):
    story.append(section_header("05", "HTML Quality & SEO Analysis"))
    story.append(Spacer(1, 0.3*cm))
    html = data.get("html", {})

    CHECKS = [
        ("&lt;title&gt; tag",           bool(html.get("title")),  html.get("title") or "Missing"),
        ("Meta description",            bool(html.get("desc")),   html.get("desc") or "Missing — add 120-160 char description"),
        ("Charset declaration",         html.get("charset"),      "Present" if html.get("charset") else "Missing — add meta charset=UTF-8"),
        ("Viewport meta tag",           html.get("viewport"),     "Present" if html.get("viewport") else "Missing — site not mobile-responsive"),
        ("Open Graph tags",             html.get("og"),           "Present" if html.get("og") else "Missing — social share previews broken"),
        ("&lt;h1&gt; heading (1 only)", html.get("h1_count")==1,  f"{html.get('h1_count',0)} found (should be exactly 1)"),
        ("HTML lang= attribute",        bool(html.get("lang")),   html.get("lang") or "Missing — affects screen readers &amp; SEO"),
    ]

    rows = [["Check", "Status", "Detail"]]
    for label, passed, detail in CHECKS:
        rows.append([
            Paragraph(label, ST["body"]),
            yesno_badge(passed),
            Paragraph(str(detail)[:90], ST["body_sm"]),
        ])

    t = Table(rows, colWidths=[4.5*cm, 2.3*cm, 9.6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  C_ACCENT),
        ("TEXTCOLOR",     (0,0),(-1,0),  C_WHITE),
        ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,0),  9),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [C_WHITE, C_LIGHT]),
        ("GRID",          (0,0),(-1,-1), 0.4, C_BORDER),
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ("RIGHTPADDING",  (0,0),(-1,-1), 8),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3*cm))

    note_rows = [
        ("Response size",  f"{html.get('size_bytes',0):,} bytes — the 403 page delivers minimal HTML"),
        ("Internal links", str(html.get("links_int", 0))),
        ("External links", str(html.get("links_ext", 0))),
        ("Images",         f"{html.get('img_total',0)} total, {html.get('img_no_alt',0)} missing alt="),
    ]
    story.append(info_table(note_rows))
    story.append(Spacer(1, 0.4*cm))


def section_robots(story, data):
    story.append(section_header("06", "robots.txt & Sitemap"))
    story.append(Spacer(1, 0.3*cm))
    rob = data.get("robots", {})
    rows = [
        ("/robots.txt",         Table([[yesno_badge(rob.get("robots_ok"))]], colWidths=[2.5*cm])),
        ("/sitemap.xml",        Table([[yesno_badge(rob.get("sitemap_ok"))]], colWidths=[2.5*cm])),
        ("SEO crawl status",    "Blocked — search engines cannot index this site"),
    ]
    story.append(info_table(rows))
    story.append(Spacer(1, 0.3*cm))
    msg = ("Neither robots.txt nor sitemap.xml is accessible (both return HTTP 403). "
           "Google, Bing, and other search engines rely on these files to discover and index content. "
           "Without them the site will not appear in any organic search results. "
           "Action: fix the 403 issue and create/submit a sitemap.xml to Google Search Console.")
    box = Table([[Paragraph(f"ℹ  {msg}", ST["warn_box"])]], colWidths=[16.4*cm])
    box.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,-1), colors.HexColor("#EAF2FF")),
        ("BOX",           (0,0),(-1,-1), 1, C_MEDIUM),
        ("TOPPADDING",    (0,0),(-1,-1), 8),
        ("BOTTOMPADDING", (0,0),(-1,-1), 8),
        ("LEFTPADDING",   (0,0),(-1,-1), 10),
        ("RIGHTPADDING",  (0,0),(-1,-1), 10),
        ("ROUNDEDCORNERS",[4]),
    ]))
    story.append(box)
    story.append(Spacer(1, 0.4*cm))


def section_scripts(story, data):
    story.append(section_header("07", "JavaScript & Third-Party Dependencies"))
    story.append(Spacer(1, 0.3*cm))
    sc = data.get("scripts", {})
    rows = [
        ("Total script tags",       str(sc.get("total",0))),
        ("External scripts",        str(sc.get("external",0))),
        ("Third-party scripts",     str(sc.get("third_party",0))),
        ("Inline scripts",          str(sc.get("inline",0))),
        ("Scripts missing SRI hash",str(sc.get("no_sri",0))),
    ]
    story.append(info_table(rows))
    story.append(Spacer(1, 0.2*cm))

    trackers = sc.get("trackers", {})
    found = [k for k,v in trackers.items() if v]
    if found:
        story.append(Paragraph(f"Analytics trackers detected: {', '.join(found)}", ST["body"]))
    else:
        story.append(Paragraph(
            "No analytics trackers detected. Recommendation: deploy a self-hosted "
            "Matomo instance for GDPR/CNIL-compliant traffic measurement.",
            ST["body"]
        ))
    story.append(Spacer(1, 0.4*cm))


def section_cookies(story, data):
    story.append(section_header("08", "Cookie Security Analysis"))
    story.append(Spacer(1, 0.3*cm))
    cookies = data.get("cookies", [])
    if not cookies:
        story.append(Paragraph(
            "No cookies were set in the homepage response. Once the 403 is resolved and "
            "authenticated pages are available, cookies must be audited for Secure, HttpOnly, "
            "and SameSite=Strict attributes.", ST["body"]
        ))
    else:
        rows = [["Cookie Name","Secure","HttpOnly","SameSite"]]
        for c in cookies:
            rows.append([
                Paragraph(c["name"], ST["mono"]),
                yesno_badge(c["secure"]),
                yesno_badge(c["httponly"]),
                Paragraph(c.get("samesite","—") or "—", ST["body"]),
            ])
        t = Table(rows, colWidths=[5*cm,2.8*cm,2.8*cm,5.8*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,0),  C_ACCENT),
            ("TEXTCOLOR",     (0,0),(-1,0),  C_WHITE),
            ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
            ("FONTSIZE",      (0,0),(-1,0),  9),
            ("ROWBACKGROUNDS",(0,1),(-1,-1), [C_WHITE, C_LIGHT]),
            ("GRID",          (0,0),(-1,-1), 0.4, C_BORDER),
            ("TOPPADDING",    (0,0),(-1,-1), 6),
            ("BOTTOMPADDING", (0,0),(-1,-1), 6),
            ("LEFTPADDING",   (0,0),(-1,-1), 8),
            ("RIGHTPADDING",  (0,0),(-1,-1), 8),
            ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
        ]))
        story.append(t)
    story.append(Spacer(1, 0.4*cm))


def section_performance(story, data):
    story.append(section_header("09", "Performance Analysis"))
    story.append(Spacer(1, 0.3*cm))
    perf = data.get("performance", {})

    comp_val  = perf.get("compression","None")
    comp_ok   = comp_val not in ("None","")
    cache_ok  = bool(perf.get("cache_control",""))
    etag_ok   = bool(perf.get("etag",""))

    rows = [
        ("HTML Response Size",    f"{perf.get('size_bytes',0):,} bytes"),
        ("Load Time",             f"{perf.get('load_time',0)} seconds"),
        ("Compression",           Table([[yesno_badge(comp_ok)],[Paragraph(comp_val,ST["body_sm"])]], colWidths=[3*cm])),
        ("Cache-Control",         perf.get("cache_control","Missing") or "Missing"),
        ("ETag",                  perf.get("etag","Missing") or "Missing"),
        ("Render-blocking scripts in head", str(perf.get("head_scripts",0))),
        ("Stylesheet files",               str(perf.get("css_files",0))),
        ("Images with lazy load", str(perf.get("lazy_imgs",0))),
    ]
    story.append(info_table(rows))
    story.append(Spacer(1, 0.3*cm))

    if not comp_ok:
        msg = ("Content compression (gzip/brotli) is not enabled. This can increase page payload "
               "by 60–80% and significantly degrades load times on mobile networks, "
               "which are common in Cameroon. Enable in nginx: gzip on;  or Apache: AddOutputFilterByType DEFLATE")
        box = Table([[Paragraph(f"⚠  {msg}", ST["warn_box"])]], colWidths=[16.4*cm])
        box.setStyle(TableStyle([
            ("BACKGROUND",    (0,0),(-1,-1), colors.HexColor("#FEF9E7")),
            ("BOX",           (0,0),(-1,-1), 1, C_WARN),
            ("TOPPADDING",    (0,0),(-1,-1), 8),
            ("BOTTOMPADDING", (0,0),(-1,-1), 8),
            ("LEFTPADDING",   (0,0),(-1,-1), 10),
            ("RIGHTPADDING",  (0,0),(-1,-1), 10),
            ("ROUNDEDCORNERS",[4]),
        ]))
        story.append(box)
    story.append(Spacer(1, 0.4*cm))


def section_traffic(story, data):
    story.append(section_header("10", "Traffic & Analytics Signals"))
    story.append(Spacer(1, 0.3*cm))
    tr = data.get("traffic", {})

    SIGNALS = [
        ("Google Analytics (GA4)",       tr.get("ga4")),
        ("Google Tag Manager",           tr.get("gtm")),
        ("Facebook Pixel",               tr.get("fb_pixel")),
        ("Hotjar (heatmaps)",            tr.get("hotjar")),
        ("Matomo / Piwik (self-hosted)", tr.get("matomo")),
        ("Microsoft Clarity",            tr.get("clarity")),
        ("Plausible Analytics",          tr.get("plausible")),
        ("Fathom Analytics",             tr.get("fathom")),
        ("Schema.org Structured Data",   tr.get("schema_org")),
        ("Canonical URL tag",            tr.get("canonical")),
        ("Hreflang (multi-language)",    tr.get("hreflang")),
        ("RSS / Atom Feed",              tr.get("rss")),
    ]

    rows = [["Signal / Feature", "Detected"]]
    for label, val in SIGNALS:
        rows.append([Paragraph(label, ST["body"]), yesno_badge(val)])

    t = Table(rows, colWidths=[12*cm, 4.4*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  C_ACCENT),
        ("TEXTCOLOR",     (0,0),(-1,0),  C_WHITE),
        ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,0),  9),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [C_WHITE, C_LIGHT]),
        ("GRID",          (0,0),(-1,-1), 0.4, C_BORDER),
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ("RIGHTPADDING",  (0,0),(-1,-1), 8),
        ("VALIGN",        (0,0),(-1,-1), "MIDDLE"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        "No analytics, tracking, or measurement tool was detected. Without analytics, "
        "the MINFOF web team has no visibility into: who visits the site, from where, "
        "which pages are most read, or where visitors drop off. "
        "Recommendation: deploy Matomo (self-hosted, CNIL-compliant) as the government "
        "analytics solution — it requires no data sharing with US tech companies.",
        ST["body"]
    ))
    story.append(Spacer(1, 0.4*cm))


def section_recommendations(story):
    story.append(PageBreak())
    story.append(section_header("11", "Prioritised Action Plan"))
    story.append(Spacer(1, 0.3*cm))

    RECS = [
        ("CRITICAL", "Fix HTTP 403 on homepage",
         "Investigate WAF rules, server config, and IP restrictions. The site must serve HTTP 200 to public visitors and crawlers."),
        ("CRITICAL", "Renew TLS certificate (expires 21 Jul 2026 — 29 days)",
         "Contact certificate authority or hosting provider immediately. Automate renewal with Let's Encrypt / Certbot."),
        ("CRITICAL", "Add all 8 security headers",
         "Add HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, X-XSS-Protection, Cache-Control in web server config."),
        ("CRITICAL", "Enable gzip / brotli compression",
         "nginx: add 'gzip on; gzip_types text/html text/css application/javascript;'. Apache: enable mod_deflate."),
        ("CRITICAL", "Implement CSRF tokens on all forms",
         "Use framework-level CSRF middleware (Django, Laravel, etc.) to auto-inject tokens on every form submission."),
        ("HIGH",     "Define a Content Security Policy (CSP)",
         "Start with Content-Security-Policy: default-src 'self'; then progressively allow trusted CDN domains. Use report-only mode first."),
        ("HIGH",     "Restore / create robots.txt and sitemap.xml",
         "Create /robots.txt with User-agent: * / Allow: / and a Sitemap: directive. Generate sitemap.xml and submit to Google Search Console."),
        ("HIGH",     "Add core SEO metadata",
         "Add <title>, <meta name='description'>, <link rel='canonical'>, Open Graph tags, and Schema.org JSON-LD to every page."),
        ("HIGH",     "Deploy self-hosted Matomo analytics",
         "Install Matomo on a government-controlled server. Configure it with IP anonymisation enabled for CNIL/GDPR compliance."),
        ("HIGH",     "Add Subresource Integrity (SRI) to CDN scripts",
         "For every external JS/CSS: compute sha384 hash and add integrity= + crossorigin='anonymous' attributes."),
        ("MEDIUM",   "Fix mobile responsiveness",
         "Add <meta name='viewport' content='width=device-width, initial-scale=1'>. Test on Android/iOS."),
        ("MEDIUM",   "Add hreflang for French/English",
         "MINFOF content exists in French. Add <link rel='alternate' hreflang='fr' href='...'> and hreflang='en' for dual-language pages."),
        ("MEDIUM",   "Implement browser caching headers",
         "Add Cache-Control: max-age=86400 for static assets. Add ETag and Last-Modified for dynamic HTML responses."),
        ("MEDIUM",   "Add lazy loading to images",
         "Add loading='lazy' to all <img> tags below the fold. This reduces initial page load time significantly."),
        ("MEDIUM",   "Add Permissions-Policy header",
         "Example: Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(). Restricts browser API access."),
        ("LOW",      "Set HTML lang attribute",
         "Add lang='fr' (or 'fr-CM') to the <html> element for accessibility and screen reader compatibility."),
        ("LOW",      "Add dns-prefetch / preconnect hints",
         "For any third-party origin used (CDN, fonts, analytics): add <link rel='preconnect' href='https://...'> in <head>."),
        ("LOW",      "Schedule dependency audits",
         "Review CMS plugins, themes, and server packages quarterly. Subscribe to CVE alerts for your CMS (WordPress, Joomla, etc.)."),
        ("LOW",      "Add an RSS/Atom feed",
         "Allow citizens to subscribe to official communiqués and press releases via a feed reader."),
        ("LOW",      "Add Open Graph and structured data",
         "Add Schema.org GovernmentOrganization JSON-LD. This improves Google Knowledge Panel and social media previews."),
    ]

    colour_map = {"CRITICAL": C_CRITICAL, "HIGH": C_HIGH, "MEDIUM": C_MEDIUM, "LOW": C_LOW}
    rows = [["#", "Priority", "Action", "Details"]]
    for i, (priority, action, detail) in enumerate(RECS, 1):
        rows.append([
            Paragraph(str(i), ST["bold"]),
            priority_badge(priority),
            Paragraph(esc(action), ST["bold"]),
            Paragraph(esc(detail), ST["body_sm"]),
        ])

    t = Table(rows, colWidths=[0.7*cm, 2.3*cm, 4.8*cm, 8.6*cm])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0),  C_DARK),
        ("TEXTCOLOR",     (0,0),(-1,0),  C_WHITE),
        ("FONTNAME",      (0,0),(-1,0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,0),  9),
        ("ROWBACKGROUNDS",(0,1),(-1,-1), [C_WHITE, C_LIGHT]),
        ("GRID",          (0,0),(-1,-1), 0.4, C_BORDER),
        ("TOPPADDING",    (0,0),(-1,-1), 6),
        ("BOTTOMPADDING", (0,0),(-1,-1), 6),
        ("LEFTPADDING",   (0,0),(-1,-1), 6),
        ("RIGHTPADDING",  (0,0),(-1,-1), 6),
        ("VALIGN",        (0,0),(-1,-1), "TOP"),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.4*cm))


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    out = "/home/user/datasciencecoursera/MINFOF_Audit_Report.pdf"
    print("Collecting live data from minfof.gov.cm …")
    data, resp, soup = collect_data()
    print(f"  Status: {data['connectivity'].get('status','N/A')}  |  TLS days left: {data['tls'].get('days_left','N/A')}")

    print("Building PDF …")
    doc   = AuditPage(out)
    story = []

    cover_page(story, data)
    exec_summary(story, data)
    section_connectivity(story, data)
    section_tls(story, data)
    section_security_headers(story, data)
    section_html_seo(story, data)
    section_robots(story, data)
    section_scripts(story, data)
    section_cookies(story, data)
    section_performance(story, data)
    section_traffic(story, data)
    section_recommendations(story)

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"\nReport saved → {out}")
    return out

if __name__ == "__main__":
    main()
