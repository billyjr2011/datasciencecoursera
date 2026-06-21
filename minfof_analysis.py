"""
Passive Security & Analytics Audit — MINFOF Government Website
Analyzes: HTTP headers, TLS config, HTML quality, SEO signals,
          security posture, performance hints, and traffic indicators.
All checks are non-destructive and use only public-facing data.
"""

import ssl
import socket
import json
import re
import time
import sys
from datetime import datetime
from collections import Counter
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
import pandas as pd
from tabulate import tabulate

TARGET = "https://www.minfof.gov.cm"
TIMEOUT = 15
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; SecurityAuditBot/1.0; "
        "+https://security-audit/passive-scan)"
    )
}

# ── ANSI colour helpers ────────────────────────────────────────────────────────
RED    = "\033[91m"
YELLOW = "\033[93m"
GREEN  = "\033[92m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def c(text, colour): return f"{colour}{text}{RESET}"
def ok(msg):   print(f"  {c('✔', GREEN)} {msg}")
def warn(msg): print(f"  {c('⚠', YELLOW)} {msg}")
def fail(msg): print(f"  {c('✘', RED)} {msg}")
def info(msg): print(f"  {c('ℹ', CYAN)} {msg}")
def section(title):
    print(f"\n{BOLD}{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}{RESET}")


# ── 1. Connectivity & basic HTTP response ─────────────────────────────────────
def check_connectivity(session):
    section("1 · Connectivity & HTTP Response")
    try:
        resp = session.get(TARGET, timeout=TIMEOUT, allow_redirects=True)
        info(f"Final URL : {resp.url}")
        info(f"Status    : {resp.status_code}")
        info(f"Load time : {resp.elapsed.total_seconds():.2f}s")
        info(f"Server    : {resp.headers.get('Server', 'not disclosed')}")
        if resp.elapsed.total_seconds() > 3:
            warn("Page load >3 s — consider server-side caching / CDN")
        else:
            ok("Response time is acceptable (<3 s)")
        if resp.url != TARGET and resp.url.startswith("https://"):
            ok("HTTP→HTTPS redirect in place")
        elif not resp.url.startswith("https://"):
            fail("Site does not enforce HTTPS redirect")
        return resp
    except requests.exceptions.SSLError as e:
        fail(f"TLS/SSL error: {e}")
    except requests.exceptions.ConnectionError as e:
        fail(f"Cannot reach {TARGET}: {e}")
    except Exception as e:
        fail(f"Unexpected error: {e}")
    return None


# ── 2. TLS / Certificate ──────────────────────────────────────────────────────
def check_tls():
    section("2 · TLS / Certificate Analysis")
    hostname = urlparse(TARGET).hostname
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(
            socket.create_connection((hostname, 443), timeout=TIMEOUT),
            server_hostname=hostname
        ) as conn:
            cert = conn.getpeercert()
            proto = conn.version()
            cipher = conn.cipher()

        info(f"Protocol  : {proto}")
        info(f"Cipher    : {cipher[0]}  (bits={cipher[2]})")

        not_after = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z")
        days_left = (not_after - datetime.utcnow()).days
        info(f"Cert expires : {cert['notAfter']}  ({days_left} days left)")

        if days_left < 30:
            fail(f"Certificate expires in {days_left} days — renew URGENTLY")
        elif days_left < 90:
            warn(f"Certificate expires in {days_left} days — plan renewal")
        else:
            ok("Certificate validity looks healthy")

        if proto in ("TLSv1", "TLSv1.1"):
            fail(f"Deprecated protocol in use: {proto}")
        else:
            ok(f"Protocol {proto} is acceptable")

        if cipher[2] and cipher[2] < 128:
            fail(f"Weak cipher key length: {cipher[2]} bits")
        else:
            ok("Cipher strength looks adequate")

        san = cert.get("subjectAltName", [])
        san_values = [v for _, v in san]
        info(f"SANs      : {', '.join(san_values)}")

    except ssl.CertificateError as e:
        fail(f"Certificate validation failed: {e}")
    except Exception as e:
        warn(f"TLS check skipped: {e}")


# ── 3. Security HTTP Headers ──────────────────────────────────────────────────
SECURITY_HEADERS = {
    "strict-transport-security": {
        "desc": "HSTS",
        "check": lambda v: "max-age" in v.lower(),
        "tip": "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
    },
    "content-security-policy": {
        "desc": "CSP",
        "check": lambda v: bool(v),
        "tip": "Define a strict CSP to prevent XSS & data injection.",
    },
    "x-content-type-options": {
        "desc": "X-Content-Type-Options",
        "check": lambda v: "nosniff" in v.lower(),
        "tip": "Add: X-Content-Type-Options: nosniff",
    },
    "x-frame-options": {
        "desc": "X-Frame-Options",
        "check": lambda v: v.lower() in ("deny", "sameorigin"),
        "tip": "Add: X-Frame-Options: SAMEORIGIN  (prevents clickjacking)",
    },
    "referrer-policy": {
        "desc": "Referrer-Policy",
        "check": lambda v: bool(v),
        "tip": "Add: Referrer-Policy: strict-origin-when-cross-origin",
    },
    "permissions-policy": {
        "desc": "Permissions-Policy",
        "check": lambda v: bool(v),
        "tip": "Add Permissions-Policy to restrict camera, mic, geolocation, etc.",
    },
    "x-xss-protection": {
        "desc": "X-XSS-Protection (legacy)",
        "check": lambda v: "1" in v,
        "tip": "Add: X-XSS-Protection: 1; mode=block  (legacy browsers)",
    },
    "cache-control": {
        "desc": "Cache-Control",
        "check": lambda v: bool(v),
        "tip": "Define explicit Cache-Control to protect sensitive pages.",
    },
}

def check_security_headers(resp):
    section("3 · Security HTTP Headers")
    headers_lower = {k.lower(): v for k, v in resp.headers.items()}
    rows = []
    issues = []

    for header, meta in SECURITY_HEADERS.items():
        val = headers_lower.get(header, "")
        if val and meta["check"](val):
            status = c("PRESENT", GREEN)
        elif val:
            status = c("WEAK", YELLOW)
            issues.append(meta["tip"])
        else:
            status = c("MISSING", RED)
            issues.append(meta["tip"])
        rows.append([meta["desc"], status, val[:80] if val else "—"])

    print(tabulate(rows, headers=["Header", "Status", "Value"], tablefmt="simple"))

    if issues:
        print(f"\n{c('Recommendations:', BOLD)}")
        for i, tip in enumerate(issues, 1):
            print(f"  {i}. {tip}")

    # Extra: detect server version leakage
    server = resp.headers.get("Server", "")
    if re.search(r"[\d.]{3,}", server):
        fail(f"Server header reveals version info: '{server}' — suppress or remove it")
    elif server:
        warn(f"Server header present ('{server}') — consider removing")

    x_powered = resp.headers.get("X-Powered-By", "")
    if x_powered:
        fail(f"X-Powered-By leaks tech stack: '{x_powered}' — remove this header")


# ── 4. HTML Quality & SEO ─────────────────────────────────────────────────────
def check_html_quality(resp):
    section("4 · HTML Quality & SEO Signals")
    soup = BeautifulSoup(resp.text, "lxml")

    # Meta title
    title = soup.find("title")
    if title and title.text.strip():
        t = title.text.strip()
        ok(f"<title> present: \"{t[:60]}\"")
        if len(t) > 70:
            warn("Title exceeds 70 chars — may be truncated in SERPs")
    else:
        fail("<title> tag missing")

    # Meta description
    desc = soup.find("meta", {"name": re.compile("description", re.I)})
    if desc and desc.get("content"):
        d = desc["content"].strip()
        ok(f"Meta description present ({len(d)} chars)")
        if len(d) > 160:
            warn("Meta description >160 chars — truncated in SERPs")
    else:
        fail("Meta description missing — critical for SEO")

    # Charset
    charset = soup.find("meta", {"charset": True}) or soup.find(
        "meta", {"http-equiv": re.compile("content-type", re.I)}
    )
    if charset:
        ok("Charset declaration found")
    else:
        warn("No charset declaration — browsers may mis-render content")

    # Viewport
    viewport = soup.find("meta", {"name": re.compile("viewport", re.I)})
    if viewport:
        ok("Viewport meta tag present (mobile-friendly)")
    else:
        fail("Viewport meta missing — site may not be mobile-responsive")

    # Open Graph
    og = soup.find("meta", {"property": re.compile("^og:", re.I)})
    if og:
        ok("Open Graph tags detected (good for social sharing)")
    else:
        warn("No Open Graph tags — social share previews will be generic")

    # Heading hierarchy
    h1s = soup.find_all("h1")
    if len(h1s) == 1:
        ok(f"Single <h1> tag: \"{h1s[0].text.strip()[:50]}\"")
    elif len(h1s) == 0:
        fail("No <h1> tag found — poor accessibility & SEO")
    else:
        warn(f"{len(h1s)} <h1> tags found — should be exactly one per page")

    # Images without alt
    imgs = soup.find_all("img")
    no_alt = [i for i in imgs if not i.get("alt")]
    ok(f"Images found: {len(imgs)}")
    if no_alt:
        warn(f"{len(no_alt)}/{len(imgs)} images missing alt= attribute (accessibility & SEO)")
    else:
        ok("All images have alt attributes")

    # Links analysis
    links = soup.find_all("a", href=True)
    internal = [l for l in links if l["href"].startswith("/") or TARGET in l["href"]]
    external = [l for l in links if l["href"].startswith("http") and TARGET not in l["href"]]
    info(f"Links → internal: {len(internal)}, external: {len(external)}, total: {len(links)}")

    broken_anchors = [l["href"] for l in links if l["href"] in ("#", "", "javascript:void(0)")]
    if broken_anchors:
        warn(f"{len(broken_anchors)} empty/dead anchor href values found")

    # noindex check
    robots_meta = soup.find("meta", {"name": re.compile("robots", re.I)})
    if robots_meta and "noindex" in robots_meta.get("content", "").lower():
        fail("Page has robots=noindex — will not appear in search engines!")

    return soup, links


# ── 5. robots.txt & Sitemap ───────────────────────────────────────────────────
def check_robots_sitemap(session):
    section("5 · robots.txt & Sitemap")

    robots_url = urljoin(TARGET, "/robots.txt")
    try:
        r = session.get(robots_url, timeout=TIMEOUT)
        if r.status_code == 200 and "user-agent" in r.text.lower():
            ok(f"robots.txt found ({len(r.text)} bytes)")
            disallowed = [l for l in r.text.splitlines() if l.lower().startswith("disallow")]
            info(f"Disallow rules: {len(disallowed)}")
            sitemaps_in_robots = [
                l.split(":", 1)[1].strip()
                for l in r.text.splitlines()
                if l.lower().startswith("sitemap:")
            ]
            if sitemaps_in_robots:
                ok(f"Sitemap reference in robots.txt: {sitemaps_in_robots[0]}")
            else:
                warn("No Sitemap: directive in robots.txt")

            # Check for sensitive paths inadvertently disclosed
            sensitive_hints = [
                d for d in disallowed
                if any(k in d.lower() for k in ("admin", "config", "backup", "db", "sql", "api"))
            ]
            if sensitive_hints:
                warn("robots.txt discloses potentially sensitive path names:")
                for s in sensitive_hints:
                    print(f"    {c(s, YELLOW)}")
        else:
            warn(f"robots.txt not found or malformed (HTTP {r.status_code})")
    except Exception as e:
        warn(f"robots.txt check failed: {e}")

    for sitemap_path in ("/sitemap.xml", "/sitemap_index.xml"):
        sitemap_url = urljoin(TARGET, sitemap_path)
        try:
            r = session.get(sitemap_url, timeout=TIMEOUT)
            if r.status_code == 200 and "<url" in r.text.lower():
                urls_in_map = re.findall(r"<loc>(.*?)</loc>", r.text)
                ok(f"Sitemap found at {sitemap_path}: {len(urls_in_map)} URLs listed")
                break
            else:
                info(f"No valid sitemap at {sitemap_path}")
        except Exception:
            pass


# ── 6. JavaScript & Third-Party Dependencies ──────────────────────────────────
def check_scripts(soup):
    section("6 · JavaScript & Third-Party Dependencies")
    scripts = soup.find_all("script", src=True)
    third_party = [s["src"] for s in scripts if s["src"].startswith("http") and urlparse(s["src"]).netloc not in urlparse(TARGET).netloc]
    inline_scripts = soup.find_all("script", src=False)

    info(f"Total <script> tags : {len(scripts) + len(inline_scripts)}")
    info(f"External scripts    : {len(scripts)}")
    info(f"Third-party scripts : {len(third_party)}")
    info(f"Inline scripts      : {len(inline_scripts)}")

    if third_party:
        print(f"\n  {c('Third-party JS sources (supply chain risk):', YELLOW)}")
        for src in third_party[:10]:
            print(f"    → {src}")
        if len(third_party) > 10:
            print(f"    … and {len(third_party)-10} more")

    # Check for known CDNs / trackers
    known_trackers = {"google-analytics", "googletagmanager", "facebook", "hotjar",
                      "mixpanel", "segment", "clarity", "matomo", "piwik"}
    found_trackers = []
    all_src = " ".join(s.get("src", "") for s in scripts)
    for tracker in known_trackers:
        if tracker in all_src.lower():
            found_trackers.append(tracker)

    if found_trackers:
        info(f"Analytics/trackers detected: {', '.join(found_trackers)}")
        warn("Ensure GDPR/CNIL compliance and privacy policy disclosure")
    else:
        warn("No analytics tracker detected — consider adding Matomo (self-hosted, privacy-safe)")

    # SRI check
    scripts_without_sri = [
        s["src"] for s in scripts
        if s["src"].startswith("http") and not s.get("integrity")
    ]
    if scripts_without_sri:
        warn(f"{len(scripts_without_sri)} external scripts lack Subresource Integrity (SRI) hashes:")
        for s in scripts_without_sri[:5]:
            print(f"    {c(s[:80], YELLOW)}")


# ── 7. Form & Input Security ──────────────────────────────────────────────────
def check_forms(soup):
    section("7 · Forms & Input Security")
    forms = soup.find_all("form")
    if not forms:
        info("No forms found on the homepage")
        return

    info(f"{len(forms)} form(s) found")
    for i, form in enumerate(forms, 1):
        action = form.get("action", "(no action)")
        method = form.get("method", "GET").upper()
        inputs = form.find_all("input")
        has_csrf = any(
            i.get("name", "").lower() in ("csrf_token", "_token", "csrfmiddlewaretoken", "_csrf")
            for i in inputs
        )
        has_autocomplete_off = form.get("autocomplete") == "off"

        print(f"\n  Form {i}: action={action}  method={method}")
        if method == "GET":
            warn("  Form uses GET — sensitive data will appear in URL / server logs")
        else:
            ok("  Method is POST")
        if has_csrf:
            ok("  CSRF token field detected")
        else:
            fail("  No CSRF token field detected — verify server-side protection")
        if action.startswith("http://"):
            fail("  Form submits over plain HTTP — data sent in cleartext!")
        password_fields = [i for i in inputs if i.get("type") == "password"]
        if password_fields and not has_autocomplete_off:
            warn("  Password field without autocomplete=off")


# ── 8. Cookie Analysis ────────────────────────────────────────────────────────
def check_cookies(resp):
    section("8 · Cookie Analysis")
    cookies = resp.cookies
    if not cookies:
        info("No cookies set on homepage response")
        return

    info(f"{len(cookies)} cookie(s) set")
    for cookie in cookies:
        flags = []
        issues = []
        if cookie.secure:
            flags.append("Secure")
        else:
            issues.append("missing Secure flag")
        if cookie.has_nonstandard_attr("HttpOnly"):
            flags.append("HttpOnly")
        else:
            issues.append("missing HttpOnly flag")
        samesite = cookie._rest.get("SameSite", "")
        if samesite:
            flags.append(f"SameSite={samesite}")
        else:
            issues.append("missing SameSite attribute")

        flag_str = ", ".join(flags) if flags else "none"
        print(f"\n  Cookie: {c(cookie.name, BOLD)}")
        print(f"    Flags   : {flag_str}")
        if issues:
            fail(f"    Issues  : {', '.join(issues)}")
        else:
            ok("    All security flags set")


# ── 9. Performance Signals ────────────────────────────────────────────────────
def check_performance(resp, soup):
    section("9 · Performance Signals")
    html_size = len(resp.content)
    info(f"HTML response size : {html_size:,} bytes ({html_size/1024:.1f} KB)")
    if html_size > 200_000:
        warn("HTML payload >200 KB — look for inline CSS/JS to extract to files")
    else:
        ok("HTML size is reasonable")

    # Compression
    encoding = resp.headers.get("content-encoding", "")
    if "gzip" in encoding or "br" in encoding or "zstd" in encoding:
        ok(f"Compression enabled: {encoding}")
    else:
        fail("No content compression detected (gzip/brotli) — significant bandwidth waste")

    # Render-blocking resources
    head = soup.find("head") or soup
    head_scripts = head.find_all("script", src=True)
    if head_scripts:
        warn(f"{len(head_scripts)} render-blocking <script> tags in <head> — move to bottom or use defer/async")
    else:
        ok("No render-blocking scripts in <head>")

    # CSS files
    css_links = soup.find_all("link", {"rel": "stylesheet"})
    info(f"Stylesheet <link> tags: {len(css_links)}")
    if len(css_links) > 5:
        warn("Many CSS files — consider bundling/minifying for fewer HTTP requests")

    # Lazy loading images
    imgs = soup.find_all("img")
    lazy = [i for i in imgs if i.get("loading") == "lazy"]
    if imgs and not lazy:
        warn("No images use loading='lazy' — add for below-the-fold images")
    elif lazy:
        ok(f"{len(lazy)}/{len(imgs)} images use lazy loading")

    # Cache headers
    cc = resp.headers.get("Cache-Control", "")
    etag = resp.headers.get("ETag", "")
    lm = resp.headers.get("Last-Modified", "")
    if cc:
        ok(f"Cache-Control: {cc}")
    else:
        warn("No Cache-Control header — browsers cannot cache efficiently")
    if etag or lm:
        ok("ETag or Last-Modified present (conditional requests supported)")
    else:
        warn("No ETag / Last-Modified — reduces caching effectiveness")


# ── 10. Traffic & Analytics Signals ──────────────────────────────────────────
def check_traffic_signals(soup, resp):
    section("10 · Traffic & Analytics Signals")
    text = str(soup)

    signals = {
        "Google Analytics (GA4)"       : "gtag(" in text or "G-" in text,
        "Google Tag Manager"           : "googletagmanager.com" in text,
        "Facebook Pixel"               : "fbq(" in text or "connect.facebook.net" in text,
        "Hotjar"                       : "hotjar" in text.lower(),
        "Matomo / Piwik"              : "matomo" in text.lower() or "piwik" in text.lower(),
        "Clarity (Microsoft)"          : "clarity.ms" in text,
        "Plausible"                    : "plausible.io" in text,
        "Fathom"                       : "usefathom.com" in text,
        "Structured Data (Schema.org)" : "schema.org" in text,
        "Canonical URL tag"            : bool(soup.find("link", {"rel": "canonical"})),
        "Hreflang (multi-language)"    : bool(soup.find("link", {"rel": "alternate", "hreflang": True})),
        "RSS / Atom Feed"              : bool(soup.find("link", {"type": re.compile(r"(rss|atom)")})),
    }

    rows = [[k, c("YES", GREEN) if v else c("NO", RED)] for k, v in signals.items()]
    print(tabulate(rows, headers=["Signal", "Detected"], tablefmt="simple"))

    # Language
    html_tag = soup.find("html")
    lang = html_tag.get("lang", "") if html_tag else ""
    if lang:
        ok(f"HTML lang attribute: '{lang}'")
    else:
        warn("HTML <html> tag missing lang= attribute — affects screen readers & SEO")

    # DNS prefetch / preconnect
    prefetch = soup.find_all("link", {"rel": re.compile(r"(dns-prefetch|preconnect|preload)")})
    if prefetch:
        ok(f"{len(prefetch)} resource hint(s) found (dns-prefetch/preconnect/preload)")
    else:
        warn("No resource hints (preconnect/dns-prefetch) — add for third-party origins")


# ── 11. Consolidated Recommendations ─────────────────────────────────────────
def print_recommendations():
    section("11 · Prioritised Recommendations")
    recs = [
        ("CRITICAL", "Add all missing security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy"),
        ("CRITICAL", "Remove/suppress Server and X-Powered-By headers to prevent technology fingerprinting"),
        ("CRITICAL", "Ensure all cookies have Secure + HttpOnly + SameSite=Strict flags"),
        ("CRITICAL", "Add CSRF protection tokens to all forms"),
        ("CRITICAL", "Enable gzip/brotli compression — mandatory for performance"),
        ("HIGH",     "Implement a strict Content Security Policy (CSP) to block XSS"),
        ("HIGH",     "Add Subresource Integrity (SRI) hashes to all third-party scripts"),
        ("HIGH",     "Implement Permissions-Policy to restrict browser APIs"),
        ("HIGH",     "Create/fix sitemap.xml and submit to Google Search Console & Bing Webmaster"),
        ("HIGH",     "Add meta description, Open Graph, and Schema.org structured data"),
        ("MEDIUM",   "Use defer/async on all <script> tags to eliminate render-blocking"),
        ("MEDIUM",   "Add loading='lazy' to images below the fold"),
        ("MEDIUM",   "Bundle and minify CSS/JS — reduce HTTP request count"),
        ("MEDIUM",   "Add a self-hosted Matomo instance for privacy-respecting analytics (CNIL-compliant)"),
        ("MEDIUM",   "Implement Cache-Control, ETag, and Last-Modified for static assets"),
        ("MEDIUM",   "Add hreflang tags for French/English language variants"),
        ("LOW",      "Add robots.txt with Sitemap: directive and review disclosed paths"),
        ("LOW",      "Set lang= attribute on <html> element for accessibility"),
        ("LOW",      "Add dns-prefetch/preconnect hints for third-party origins"),
        ("LOW",      "Conduct regular dependency audits — keep CMS/plugins updated"),
    ]

    colour_map = {"CRITICAL": RED, "HIGH": YELLOW, "MEDIUM": CYAN, "LOW": GREEN}
    for priority, rec in recs:
        col = colour_map[priority]
        print(f"  [{c(priority, col)}] {rec}")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print(f"\n{BOLD}{'='*60}")
    print(f"  MINFOF Website — Passive Security & Analytics Audit")
    print(f"  Target : {TARGET}")
    print(f"  Date   : {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}")
    print(f"{'='*60}{RESET}")

    session = requests.Session()
    session.headers.update(HEADERS)

    resp = check_connectivity(session)
    if resp is None:
        print(f"\n{c('Cannot reach the target — subsequent checks skipped.', RED)}")
        print("Possible reasons: site is down, firewall blocks, incorrect URL.")
        print_recommendations()
        return

    check_tls()
    check_security_headers(resp)
    soup, links = check_html_quality(resp)
    check_robots_sitemap(session)
    check_scripts(soup)
    check_forms(soup)
    check_cookies(resp)
    check_performance(resp, soup)
    check_traffic_signals(soup, resp)
    print_recommendations()

    print(f"\n{BOLD}{'='*60}")
    print("  Audit complete — all findings are from passive public data")
    print(f"{'='*60}{RESET}\n")


if __name__ == "__main__":
    main()
