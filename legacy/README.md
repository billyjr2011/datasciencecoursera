# Legacy artifact

`preclinicalplatform.jsx` is the **original single-file React artifact** (NdMED v4.0)
this project was developed from. It is preserved here for reference and provenance.

⚠️ This standalone version calls `api.anthropic.com` **directly from the browser**,
which exposes the API key. **Do not deploy it.** The production application in
[`server/`](../server) and [`web/`](../web) replaces it: the API key stays server-side,
with authentication, persistence, plan enforcement, and rate limiting added.

See the root [README](../README.md) and [docs/](../docs) for the current architecture.
