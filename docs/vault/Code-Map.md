---
type: moc
---

# Code Map — how the repo actually connects

A structural companion to [[Architecture]] (which explains the *why*): this is the *what's-
where*. Each note below is one layer of the app; open this vault in Obsidian and use **Graph
View** — these notes' [[wikilinks]] to each other trace the real dependency path from a webcam
frame to a passed lesson, so you can click through it visually instead of grepping.

## The four layers
- [[Code-Map-Recognition-Engine]] — turns a video frame into pass/fail + coaching. Exists TWICE
  (Python `core/` + TypeScript `web/src/engine/`), same design, kept in parity.
- [[Code-Map-Signs-Data]] — the ~32 signs themselves, declared as data, shared by both engines.
- [[Code-Map-Web-App]] — the actual React app: pages, the Zustand store, Supabase sync, the
  gamification layer (worlds/lessons/quests/shop/gold).
- [[Code-Map-ML-Pipeline]] — how real ASL Citizen/WLASL video becomes the trained classifier that
  vetoes rule false-passes (see [[ML-Pipeline]] for the fuller narrative).

## Reading order if you're new to this codebase
1. [[Code-Map-Signs-Data]] first — signs are pure data, easiest mental model, no logic to trace.
2. [[Code-Map-Recognition-Engine]] — the one function (`verify()`) everything else calls.
3. [[Code-Map-Web-App]] — where `verify()` actually gets called from a real screen.
4. [[Code-Map-ML-Pipeline]] — only once the rule engine makes sense; the classifier is a veto
   layered on top, not a replacement (see [[Decisions-Log]] for why).
