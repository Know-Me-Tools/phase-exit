# Gotchas

## 2026-10-16 — Completion is not a synonym for stopping

WAIT, BLOCKED, REVIEW_REQUIRED and INVALID must terminate or yield truthfully.
Only phase_complete establishes phase success. Stage success may authorize a
later stage without establishing release readiness.

## 2026-10-16 — Historical UAR records disagree

The frozen inventory contains19 items but records count17. Obsolete prose lists
seven groups while the approved program has six. Preserve both original artifacts
and document the explicit adoption mapping; do not silently rewrite history.

## 2026-10-16 — Initial isolated review

Stage-wide action selection could repeatedly choose a passing gate instead of a
missing sibling gate. Collection coverage must belong to each adopted action.
Live semantic calibration must inspect actual semantic classes and retained live
judgments, because REVIEW_REQUIRED also represents service errors. Full receipt
provenance must be retained separately from semantic sample identity: refreshing
a timestamp or receipt ID cannot justify resampling unchanged uncertain evidence.

## 2026-10-16 — Preserve the actual runner arguments

The UAR adapter constructed an absolute manifest argument while native session83623 actually used a relative path. Exact observation matching would reject that real operation. Resolve the observed argument against its validated cwd, prove it identifies the same canonical original manifest, then preserve the original argv in the adopted action. Rewriting the observation would falsify provenance.

## 2026-10-16 — Freshness and acceptance are distinct facts

Real UAR import retained known ledger hash mismatches and false implementation assertions. The freshness hook compared current files against expected inventory hashes instead of captured actual hashes, hiding those criteria behind HOOK_BLOCKED. Failed-path diagnostic observed UAR_INVENTORY_ITEM_CHANGED. Compare freshness with captured bytes, preserve failed acceptance assertions, and retain bounded cause codes. Passing calibrated evidence must carry by identity for a UAR-only repair; do not require rerunning the passing calibration gate.
