# Contributing

Read AGENTS.md and the active phase ledger before changing code. Keep one writer
per file and one builder per target directory. An approved plan establishes the
scope; a model suggestion does not change that scope.

Implement the entire phase, including fixtures, documentation and packaging,
before running verification. Record an implementation-complete inventory first.
Run the approved local acceptance gates serially. If a gate fails, preserve its
receipt, finish the observed repair cohort, renew the inventory, and rerun only
affected gates. GitHub Actions must not run product verification.

Use Rust for decisions and transport; use Node 24.22.0 and TypeScript 7.0.2 for
scripts and adapters. Distribute compiled JavaScript. Use filesystem APIs and
executable/argument arrays. Do not add shell scripts, Python wrappers, automatic
updates, symlinks or platform qualification beyond the adopted contract.

Changes to requirements, evidence, model, thresholds or mandatory hooks need an
amendment, a readable diff, an evidence-invalidation map and explicit adoption.
Retain prior revisions and failed receipts. Record discoveries under .prometheus
and in the relevant phase's learning records. Private evidence and credentials
must stay out of Git; sanitized case studies must retain their limitations.

The uncomfortable limit: a passing test can establish only the behavior it
observed. Distinguish package shape from a real host execution receipt.
