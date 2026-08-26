# OX_ALPHA_I2_SEO_STRUCTURED_DATA.md

**Task:** ASL-I2 · `[REPORT]` SEO / structured data — audit meta/OG/JSON-LD, robots.txt, sitemap.xml,
and the web manifest for correctness and consistency.
**Date:** 2026-08-25 · **Branch:** `audit/round4-corrections` (working tree at `bf9b723`) ·
**Method:** executed probe (`web/e2e-adhoc/probe-seo.mjs`) against the **production origin**
(aslgame.vercel.app) — read-only HTTP checks of exactly what crawlers and link-preview bots see.
No code changed, nothing mutated.

---

## 1. Executed results — 12/12 PASS against production

| Check | Result |
|---|---|
| `robots.txt` served (200), declares sitemap | ✅ points at `/sitemap.xml` |
| robots policy shape | ✅ `Allow:` for landing.html, asl-alphabet.html, and `/`; `Disallow: /` for everything else (the app shell is intentionally unrankable — camera-gated product, documented decision in-file) |
| sitemap lists 3 URLs, all resolve 200 | ✅ /landing.html, /asl-alphabet.html, / |
| landing.html JSON-LD blocks parse | ✅ 3/3 valid (FAQ schema incl. "Is it free? Yes" — matches I1's honesty audit) |
| index.html JSON-LD blocks parse | ✅ 2/2 valid (Organization + SoftwareApplication, price "0") |
| og:image resolves on production CDN | ✅ /og-image.png → 200 |
| web manifest linked, parses, PWA-complete | ✅ name="QuickSign — Learn ASL with Zippy", 3 icons, start_url set |

## 2. Findings

**No SEO defects found.** Specifics worth recording:

- The robots.txt header comment documents *why* the app shell is disallowed and instructs future
  maintainers to add each new marketing page to both robots.txt and vercel.json CSP — a rare,
  welcome piece of self-documenting infrastructure.
- Sitemap priorities are sensibly ordered (landing 1.0 > alphabet 0.9 > app 0.8).
- JSON-LD claims stay consistent with I1's copy-honesty verdicts (SoftwareApplication price=0
  matches the genuinely free product; EducationalApplication category is accurate).
- One nit, not a defect: sitemap omits `<lastmod>`; harmless at this scale since changefreq hints
  carry the freshness signal.

## 3. Re-run

`node web/e2e-adhoc/probe-seo.mjs` — network-dependent (hits production); exit 0 iff all checks pass.
Read-only by construction.
