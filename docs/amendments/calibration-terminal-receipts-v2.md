# Proposed calibration amendment — not adopted

Operator instruction: **prepare an amendment for review; do not adopt it yet**.
The authoritative original remains `fixtures/semantic-examples.json`. Its hash
and the complete proposed record are in
`calibration-terminal-receipts-v2.json`. No new JEV call has used this proposal.

## Observed problem and proposed delta

The frozen positive example said that a receipt recorded exit0, but supplied
only that sentence. The real model returned support0.80 and contradiction0.02.
Provenance ambiguity is a possible explanation, not a verified diagnosis of the
model's probability. Do not tune a prompt against repeated desired outcomes.

| Field | Existing revision | Proposed revision |
| --- | --- | --- |
| Model/channel | jev-1.14.0 preview | Unchanged |
| Thresholds | support>=0.95, contradiction<=0.05 | Unchanged |
| Positive/negative evidence | Prose claim about terminal receipt | Fields projected from original real exit0/exit7 command receipts, with original receipt and command-identity hashes |
| Uncertain evidence | Started, no terminal result | Explicit controlled incomplete observation, terminal=false, exit_code=null |
| Rubric | General complete-outcome question | Entailment of terminal fields; missing result is unknown; no inference of runner authenticity |
| Adoption | Existing frozen example set | Explicit operator adoption required; absent |

The positive and negative observations came from real CLI acceptance fixture
processes, not UAR acceptance. Their hashes reference retained private originals.
The proposed public packets expose hashes, exit status, time and runner provenance;
they omit local command paths and stdout/stderr content. They cannot certify UAR.

## Invalidation and bounded execution

All three semantic examples become unevaluated under this new rubric if adopted.
Old calibration failures and caches remain immutable history. Exactly one new
semantic sample per materially changed example is allowed, with only the existing
bounded transient transport retries. Calibration checks the declared class of each
example: positive must meet support>=0.95 and contradiction<=0.05; negative must
produce confident contradiction>=0.95; the deliberately incomplete example must
produce SEMANTIC_UNCERTAIN. Expected uncertainty passes that example's class check
while its engine decision remains REVIEW_REQUIRED and its phase remains incomplete.
Unexpected uncertainty on positive or negative examples fails calibration and
stops further adoption. Service errors and invalid evidence never satisfy any class.

Existing deterministic evidence can carry only through an explicit dependency and
artifact-identity analysis. This proposal does not waive a deterministic failure,
the genuine supervisor prerequisite, UAR's review cap or either published-image
acceptance program. Real UAR adoption remains withheld until calibration passes.

The uncomfortable possibility: concrete terminal fields may still score below the
frozen thresholds. That would be another truthful REVIEW_REQUIRED result, not
permission to tune thresholds or keep sampling.

The first isolated proposal review requested the expected/ unexpected uncertainty
distinction above. That report remains preserved beside the proposal. Corrective
proposal review returned PROPOSAL_READY_FOR_OPERATOR_REVIEW with no findings;
see calibration-terminal-receipts-v2.review-2.json. Adoption status: **not adopted**.
