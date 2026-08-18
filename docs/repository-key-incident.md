# Repository Key Incident

Status: Closed on 2026-08-18 by removal plus audited absence from the known authorization surfaces.

This record contains identifiers and verification evidence only. It must never contain the historical private key or its public-key body.

## Incident

- Historical path: `# 1) Generate an SSH key (ed25519)`.
- Added in commit: `862dbd712f66a6c83ac6de29f39a4048f80bc3ae`.
- Removed from the current tree in commit: `db20ed2e94b28c07f4c1c8fe389e490321bd2e8b`.
- Key type: OpenSSH Ed25519 private key.
- Public fingerprint: `SHA256:LPBthMkNie4ON9qkULnEcnIVTy/hT2hExrAO1jHkzQM`.

The private key remains recoverable from Git history and must always be considered compromised. Git history was deliberately not rewritten because rewriting does not revoke a credential and would disrupt existing clones and references.

## Revocation And Downstream Audit Evidence

On 2026-08-18 the fingerprint was derived in memory from the historical blob. Neither the private key nor its public-key body was printed, restored to the working tree, or copied into this record.

The exact fingerprint was absent from every known authorization surface available to this repository owner:

- the current Git tree;
- the public GitHub account SSH authentication keys for `velt-design` (one different key was present);
- the public GitHub account SSH signing keys (none were present);
- the `velt-design/sanctuary` deploy keys (none were present);
- the current Windows user's `.ssh` key files (the separate Mac mini administration keypair has a different fingerprint);
- the current SSH agent (no matching loaded identity); and
- repository configuration and documentation, which contain no SSH host or `authorized_keys` inventory. The repository remote uses HTTPS.

The owner reported no known use of the historical credential. Because there is no matching authorized public key in the known access paths, there is no live matching GitHub, repository, or local credential record to delete. Removal from the repository plus verified absence from those authorization surfaces closes the known incident.

## Continuing Rule

If this fingerprint is ever found in an unrecorded server, NAS, workstation, deployment platform, or `authorized_keys` file, remove that exact authorization immediately, review access logs for its period of exposure, and record the additional revocation evidence here. Never restore or test authentication with the compromised private key.
