# Sanctuary AI Incident Response

Status: Active protocol; first tabletop rehearsal pending.

Owner: Jordan / Sanctuary Pergolas

Use this procedure for a suspected node, OpenClaw, worker, credential, data, or
effect incident. Safety and central revocation take priority over preserving a
running local process.

## How To Use This Runbook

Classify the highest plausible severity, complete the first-15-minute actions,
then use the applicable scenario card. Do not restart staging execution until
every recovery gate passes.

## Severity

| Severity | Examples | Default response |
| --- | --- | --- |
| SEV-1 | Production or broad credential present; public Gateway; customer data exposure; unapproved customer, payment, communication, or other business effect; lost node with active authority | Stop execution and producers, revoke centrally, notify the owner immediately, preserve bounded evidence, and use the compromise rebuild. |
| SEV-2 | Staging node compromise; sandbox or tool-policy escape; unapproved host execution; secret in logs; unexplained active or stale node; unexpected connector, plugin, or network access | Isolate and revoke the affected capability, keep the node dark, investigate hosted audit evidence, and rebuild if integrity is uncertain. |
| SEV-3 | Failed synthetic task, expected node outage, health drift, or backup/restore failure with no exposure or external effect | Keep execution dark, repair the bounded fault, and repeat the required rehearsal before promotion. |

When evidence is incomplete, use the higher severity until the boundary is
proved.

## First 15 Minutes

1. Start a private UTC timeline and name the incident owner. Do not paste secret
   values, recovery material, customer payloads, or personal details into it.
2. Disable task producers, the worker, and OpenClaw. If active harm is continuing,
   disconnect the node or disable its overlay device.
3. Revoke the hosted node identity once PR-AI-008 provides that control. A
   revoked node must not regain authority through a new heartbeat.
4. From a trusted device, revoke exposed overlay, SSH, staging Supabase, GitHub,
   OpenClaw, provider, connector, or plugin credentials.
5. Preserve bounded hosted audit metadata before deleting records. Do not wipe
   the Mac until immediate harm has stopped and the minimum useful evidence is
   secured, unless delay would increase harm.
6. Confirm whether any production identity, customer/private data, external
   communication, payment, irreversible mutation, or public network path was
   involved. If yes or uncertain, classify SEV-1.
7. Keep the Portal and normal manual business workflow available. The private
   node is not required for business continuity.

## Scope The Incident

Answer with evidence, not assumptions:

- Which node ID, build SHA, task/job IDs, identities, and capabilities were
  involved?
- What was the first and last observed UTC time?
- Which hosted systems accepted a request from the affected identity?
- Was the node stale, revoked, drained, or unexpectedly healthy at the time?
- Could a sandbox reach the host, network, repository write path, secret store,
  or an external connector?
- Did any customer, project, quote, invoice, email, advertisement, payment, file,
  or production record change?
- Which logs or payloads may contain a secret or private business data?
- Can integrity be proved, or is a clean rebuild required?

## Scenario Cards

### Lost Or Stolen Mac

1. Mark SEV-1 while any machine credential remains active.
2. Remove the overlay device and follow the full central revocation order in
   `node-rebuild-and-revocation.md`.
3. Check hosted audit trails for activity after the last trusted possession time.
4. Record FileVault and backup status without disclosing recovery values.
5. Replace or recover the hardware only through the compromise rebuild path.

### Exposed Credential

1. Revoke the exact credential at its issuer; deleting the local copy is not
   sufficient.
2. Identify its maximum granted scope and every place it could have been stored,
   logged, backed up, or copied.
3. Review audit metadata for use during the exposure window.
4. Rotate downstream credentials if the exposed identity could read them.
5. Issue a narrower replacement only after the storage and logging cause is fixed.

### OpenClaw, Sandbox, Tool Escape, Or Prompt Injection

1. Stop the Gateway and worker; disable all task producers.
2. Treat host execution, external network access, elevated mode, an unexpected
   plugin/connector, or a writable host mount as SEV-2 or SEV-1 by effect.
3. Preserve the effective security-audit result, approval policy, sandbox
   inventory, build/config reference, and safe event metadata.
4. Revoke every secret the escaped process could have reached.
5. Rebuild when host or secret-store integrity cannot be proved. Do not solve a
   sandbox escape only by changing the prompt.

### Unauthorised Business Effect

1. Mark SEV-1 and stop the responsible producer and capability.
2. Preserve the canonical business record, task/job linkage, approval evidence,
   idempotency key, provider receipt, and audit-event references.
3. Do not automatically repeat, reverse, email, refund, delete, or otherwise
   mutate the business record. Route remediation to the domain owner and obtain
   explicit human approval.
4. Notify affected people only through Sanctuary's approved incident and privacy
   process after facts and message ownership are established.

### Stale, Offline, Or Unexpected Heartbeat

1. Keep new claims disabled and distinguish expected outage from duplicate or
   stolen identity.
2. Revoke the identity if a heartbeat appears from an unrecognised build,
   capability set, network identity, or after an explicit revoke.
3. Confirm claimed synthetic work safely expires, retries, or requires attention;
   do not infer success from queue disappearance.
4. Prove hosted Portal and manual workflows remain available with the node off.

### Backup Or Recovery Failure

1. Keep the node dark; an unproved restore path blocks promotion.
2. Determine whether the failure affects configuration, audit evidence, or only
   disposable cache/build data.
3. Replace the backup destination or recovery material through the named
   custodian, then repeat a non-secret sample restore.
4. Do not weaken FileVault, reuse a backup password, or copy secrets into Git to
   make recovery easier.

## Evidence Boundary

Retain only what is necessary and access-controlled:

- UTC timeline and named owner;
- safe node, task, job, build, audit-event, and provider-receipt identifiers;
- effective policy/configuration references and version numbers;
- success/failure results for revocation, access, rebuild, backup, and synthetic
  tests;
- the business records required to assess an actual external effect.

Do not place tokens, keys, passwords, recovery codes, raw private task payloads,
customer exports, full environment files, or copied browser/session stores in
GitHub issues, pull requests, chat, screenshots, or general logs.

## Recovery Gates

The node remains dark until all applicable items pass:

- [ ] Cause and maximum affected scope are understood.
- [ ] Exposed identities are revoked and audit history reviewed.
- [ ] Integrity is proved or a clean compromise rebuild is complete.
- [ ] A reviewed source SHA and fresh machine identities are in use.
- [ ] Repository tests and security gates pass.
- [ ] OpenClaw deep audit, sandbox, network deny, and host-exec deny pass.
- [ ] PR-AI-008 health, stale, drain, and revocation behavior pass once available.
- [ ] One deterministic effect-free synthetic task passes.
- [ ] Node disconnect and old-identity rejection pass.
- [ ] The owner reviews the evidence and explicitly permits staging-only restart.

Recovery never grants production access or a new business effect.

## Follow-Up

Within two business days of containment:

1. record the root cause, affected window, actual effects, and recovery evidence;
2. add a focused test, guard, or monitoring rule that would have caught the issue;
3. update the canonical runbook and create an ADR only for a durable architecture
   decision;
4. confirm replacement credentials have owners and rotation dates;
5. rehearse the failed control again and keep the evidence private and
   secret-free; and
6. decide whether any legal, privacy, insurer, customer, or vendor notification
   is required with the appropriate human adviser.

The private asset register must contain the current operator, recovery custodian,
and business escalation contacts. Keep their personal details out of this repo.
