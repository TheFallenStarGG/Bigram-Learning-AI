---
name: Imported artifact runtime
description: Replit import behavior that can affect managed service bundles and connector availability.
---

Managed artifact services can continue serving an older compiled bundle after an import or source update, so restart the exact artifact workflow before diagnosing route, authentication, or database errors.

**Why:** An API process served a removed authentication implementation until its managed workflow was restarted; the source and live bundle were temporarily different.

**How to apply:** Compare the live route behavior with current source, restart the artifact-owned workflow, and only then decide whether code or data changes are needed. Treat a connector shown as authorized but not added as unavailable to the current Repl until it is attached.