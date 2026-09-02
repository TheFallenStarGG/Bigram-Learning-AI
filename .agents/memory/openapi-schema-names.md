---
name: OpenAPI schema names
description: Naming constraint for the shared OpenAPI document and generated clients.
---

Schema names in the shared OpenAPI document are global across all routes and are emitted into every generated client. New feature payloads must use distinct schema names rather than reusing a name already used by an existing endpoint.

**Why:** Reusing a familiar name can silently replace the shape of an older generated type, breaking unrelated frontend code even when the server route itself still compiles.

**How to apply:** Before adding a schema, search the full OpenAPI document for the name and preserve existing contracts; choose a feature-specific name when the shape differs.