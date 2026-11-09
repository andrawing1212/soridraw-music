# Reviewed upstream skill sources (2026-11-09, pinned read-only snapshots)

These are references only. **No external scripts, npm packages, APIs, secrets or infrastructure are installed by this skill.**

- Microsoft **system-type-event-driven** (MIT), checked at `1eff6a2bcebe7c42d5d8d4962e1937a3bb932b0c`. Vendored verbatim at `../system-type-event-driven/SKILL.md`; original: https://github.com/microsoft/amplifier-bundle-systems-design/blob/main/skills/system-type-event-driven/SKILL.md . Focus: at-least-once delivery, idempotent consumer, ordering, dead-letter handling.
- Cloudflare **workers-best-practices** (Apache-2.0), checked at `6eb6c781aa9b6438e0c7307bd102788a75fe1a6d`. Vendored as `../workers-best-practices/SKILL.md` with its references and original license. Original: https://github.com/cloudflare/skills/tree/main/skills/workers-best-practices . Focus: `waitUntil` lifetime, bindings, secrets, queues and workflows.
- Official Cloudflare docs: https://developers.cloudflare.com/queues/ and https://developers.cloudflare.com/workflows/ — durable processing requires actual configured infrastructure; do not install it silently.
- Firebase Security Rules: https://firebase.google.com/docs/database/security/ and https://firebase.google.com/docs/rules/insecure-rules — parent read/write inheritance and server/Admin access need careful verification.
- Vercel React best practices (reference only): https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices — deduplicate client fetch and listener, but do **not** replace proven SORIDRAW local-first flow with SWR by default.
- Firebase agent-skills (reference only): https://github.com/firebase/agent-skills . The Firestore auditor is not an RTDB-specific follow solution; it does not authorize schema/Rules changes.

If official upstream later changes, review specific revisions; never automatically rewrite working SORIDRAW code or globally install update scripts.
