# Security and authority

Report vulnerabilities privately through the repository owner's GitHub contact
before posting evidence containing credentials or customer details. Never attach
raw environment files, profile contents, database URLs or unredacted run logs.

The trust boundary is the host that adopts contracts and launches actions. The
engine does not execute commands from contracts or import executable acceptance
modules. Explicit adoption is an auditable operator action, not a cryptographic
proof that a human clicked a button. Protect the adopted state directory and the
configured expected contract identity using your host's existing access controls.

Evidence hashes identify exact bytes. They do not prove that an untrusted runner
told the truth. Use receipts from the approved runner and preserve its command,
terminal result, source, fixture, platform, configuration and artifact identities.
Unknown impact or provenance requires review. Old failed receipts remain visible.

JEV requests contain minimized semantic evidence. Keys are read from the process
environment and are never sent in the request body, logged, cached or passed to
hook children. The preview model must match exactly. Input limits are enforced
without truncation or enabling long context. Transport retries are bounded;
semantic uncertainty is never retried until a favorable answer appears.

Extension hooks are trusted executable Node code. Hash verification, a minimal
environment and time limits constrain dispatch; they are not a security sandbox
against hostile same-user code. Hook proposals cannot adopt themselves, change
mandatory predicates or override failures. A required hook failure prevents
certification. Optional notification failures remain observations.

Native host hooks have documented coverage and failure behavior. Disabling a
plugin or using an unintercepted execution path can bypass it. The independent
engine decision remains necessary for publication. Never interpret a stopped
assistant as a successfully completed phase.

The uncomfortable limit: anyone able to replace the engine, trusted hook or
adopted state can bypass this local process. This project does not claim otherwise.
