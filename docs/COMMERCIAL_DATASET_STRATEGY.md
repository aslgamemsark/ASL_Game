# Commercial ASL Dataset Strategy & Licensing Audit

> **Purpose:** the single reference for which sign-language datasets QuickSign may legally train
> on when the app makes money, which it may not, and how to expand vocabulary safely over time.
> Built from a Gemini Deep-Research report (2026-07-23) **after independently web-verifying every
> load-bearing claim** — verification status is marked on each row. Supersedes nothing in
> `docs/LICENSING_CHECKLIST.md`; that file stays the master pre-launch checklist, this one is the
> deeper dataset-specific audit + expansion plan.

> ⚠️ **NOT LEGAL ADVICE.** This is engineering diligence, not legal cover. Before charging money,
> have an IP attorney review the actual training data. The downside the research flags — statutory
> damages, forced deletion of model weights — is serious enough to warrant real counsel, not an AI
> report (Gemini's *or* Claude's).

---

## The core problem (plain English)

QuickSign's current shipped models (`model_v4` / `v5` / `v6`, in `web/public/models/signs/`) were
trained on **WLASL + ASL Citizen**. Both are **research-only / non-commercial**. Training a
*paid* product on them is a legal risk. This is not new — it's already flagged in
`docs/LICENSING_CHECKLIST.md` and in `CLAUDE.md`. The plan (chosen by the owner 2026-07-23) is to
**keep deferring monetization**, and when we do rebuild for commercial use, retrain on
commercially-clean data + our own collected data.

### One important legal nuance the research overstated

The report repeatedly states, as settled fact, that **"AI model weights ARE derivative works of
the training data."** This is **NOT legally settled** — it's one of the most actively litigated
open questions in AI law right now. The *prudent conservative posture* is to behave as if weights
*could* be derivative (so: avoid non-commercial data for a paid product). But the confident legal
rationale in the report is stronger than the actual law supports. The practical conclusion is
right; the stated certainty is not.

---

## Dataset audit — the verdict table

Legend: ✅ safe for commercial use · ⚠️ conditional (needs a signed agreement) · ❌ do not use commercially

| Dataset | License | Commercial? | Verified? | Notes |
|---|---|---|---|---|
| **PopSign ASL v1.0** | CC BY 4.0 *(claimed)* | ✅ | ⚠️ existence + specs verified; exact license string not directly quoted — **confirm on the Kaggle/GT page before relying** | 250 signs, ~210k clips, 47 Deaf signers, Pixel 4A selfie cam. Georgia Tech + RIT + DPAN. **MediaPipe-native → mirrors our webcam input exactly.** The single best foundation. |
| **Google FSboard** | CC BY 4.0 | ✅ | ✅ **confirmed** — paper states: *"We publicly release FSboard… under a CC BY 4.0 license."* | 3M+ fingerspelled characters, 147 Deaf signers, MediaPipe Holistic landmarks. Fingerspelling (alphabet/numbers/names). |
| **ASL Citizen** | Research-only (repo is MIT, **data is not**) | ⚠️ | ✅ exists (Microsoft Research, ~83k clips, ~2.7k signs, consented) | Microsoft can grant a commercial license (data was consented, not scraped). Contact `ASL_Citizen@microsoft.com`. Toxic **without** a signed contract. Currently used in our models. |
| **WLASL** | C-UDA-1.0 | ❌ | ✅ | Scraped from YouTube → double copyright problem. Authors: *"academic and computational use only. No commercial usage."* Currently used in our models. **Purge before commercial rebuild.** |
| **How2Sign** | CC BY-NC 4.0 | ❌ | — | Non-commercial. Extracted features inherit the NC license. |
| **MS-ASL** | MS Research / C-UDA | ❌ | — | Non-commercial **and** scraped YouTube (underlying video not Microsoft's to license). |
| **ASLLVD** | CC BY-NC-**ND** 4.0 | ❌ | — | NoDerivatives clause is especially hostile to model training. |
| **OpenASL** | CC BY-NC-ND 4.0 | ❌ | — | Non-commercial + NoDerivatives. |
| **ChicagoFSWild(+)** | CC BY-NC 4.0 | ❌ | — | Non-commercial fingerspelling. |
| **ASL-LEX 2.0** | CC BY-NC-ND 4.0 | ❌ | — | Linguistic reference DB, non-commercial. |
| **Purdue RVL-SLLL** | Custom non-profit agreement | ❌ | — | Explicitly forbids profit/sale. |
| **RWTH PHOENIX-2014** | Restrictive research | ❌ | — | Also **German Sign Language, not ASL** — linguistically incompatible anyway. |

### Commercial data vendors (both confirmed real)

| Vendor | What it is | Verified? | Contact |
|---|---|---|---|
| **GoSign.AI** | Deaf-led AI company; generates/licenses commercial-ready sign-language training data, pays Deaf contributors | ✅ real (gosign.ai) | via gosign.ai |
| **CLERC** | US company building a "native ASL data layer"; expert-annotated datasets + **tiered commercial licensing for AI labs**; open subset **Épée v0.2** on Hugging Face | ✅ real (clerc.io) | `florian@clerc.io` |

> Both exist and both really do offer commercial ASL data licensing — the report did **not**
> fabricate them (unlike the marketing report's contact list). Actual pricing/terms require
> direct contact; nothing was priced or verifiable beyond "commercial tiers exist."

---

## Recommended commercial training stack

When rebuilding for a paid product, in priority order:

1. **PopSign v1.0** (CC BY 4.0) → foundation classifier, 250 core signs. *Confirm license string first.*
2. **FSboard** (CC BY 4.0, ✅ confirmed) → fingerspelling: alphabet, numbers, names, URLs.
3. **GoSign.AI or CLERC** (paid commercial license) → vocabulary expansion beyond PopSign's 250. *Only after a signed agreement.*
4. **First-party telemetry** (our own data moat) → long-term independence.

**Attribution obligation for CC BY 4.0:** build an in-app "Attributions / Open Source" page
crediting Georgia Tech, DPAN, and Google, with a link to the CC BY 4.0 license and a note that
data was modified. That single page satisfies the entire obligation for PopSign + FSboard.

---

## The first-party data moat (the long game — already the chosen plan)

Because recognition runs locally via MediaPipe, we can store **only numeric landmark coordinates
(x/y/z arrays), never raw video** — privacy-safe and cheap. The research's projection (illustrative,
not a forecast):

- 5,000 daily users × 20 attempts = 100k sequences/day → ~3M/month
- ~70% filtered out (novice errors, low confidence) → ~900k clean/month
- Across 1,000 target words → ~900 real examples/word/month
- **~12–18 months post-launch → a proprietary dataset larger & cleaner than WLASL**, and external
  dataset licenses can be phased out entirely.

(The "500–1,000 examples per class" and "70% rejection" figures are reasonable assumptions, not
measured facts.)

---

## Action checklist

**Before charging money / commercial launch:**
- [ ] Get an IP attorney to review actual training data (non-negotiable).
- [ ] **Purge** WLASL and any WLASL/MS-ASL-derived pretrained weights from training infra, cloud buckets, local envs.
- [ ] Directly confirm **PopSign's** exact license on its official Kaggle/Georgia Tech page (very likely CC BY 4.0 — not yet quoted verbatim).
- [ ] Rebuild the classifier on **PopSign + FSboard** (both CC BY 4.0).
- [ ] Add an in-app **Attributions page** (GA Tech, DPAN, Google + CC BY 4.0 link + "modified" note).
- [ ] Decide on ASL Citizen: either sign a commercial license with Microsoft (`ASL_Citizen@microsoft.com`) or drop it.

**For vocabulary expansion beyond ~250 signs:**
- [ ] Contact **GoSign.AI** (gosign.ai) and **CLERC** (`florian@clerc.io`); get real pricing/terms in writing.
- [ ] Evaluate the open **Épée v0.2** subset (Hugging Face) as a low-risk trial before licensing.

**Ongoing (the moat):**
- [ ] Transparent privacy policy covering storage of anonymized MediaPipe landmarks (already partly in place — `collect_training_data` flag exists).
- [ ] Accumulate first-party landmark data toward the 12–18 month independence target.

**Never use commercially:** WLASL, How2Sign, MS-ASL, OpenASL, ASLLVD, ASL-LEX, ChicagoFSWild, Purdue RVL-SLLL, PHOENIX-2014.

---

## Sources (verified 2026-07-23)

- PopSign ASL v1.0 (NeurIPS 2023): https://proceedings.neurips.cc/paper_files/paper/2023/hash/00dada608b8db212ea7d9d92b24c68de-Abstract-Datasets_and_Benchmarks.html
- FSboard (arXiv 2407.15806) — CC BY 4.0 confirmed: https://arxiv.org/html/2407.15806v1 · dataset: https://www.kaggle.com/datasets/googleai/fsboard
- GoSign.AI: https://www.gosign.ai/
- CLERC: https://clerc.io/ (open subset Épée v0.2 on Hugging Face)
- ASL Citizen (Microsoft Research): https://www.microsoft.com/en-us/research/project/asl-citizen/

*Last verified: 2026-07-23. Re-check licenses before commercial launch — dataset terms and takedown status can change.*
