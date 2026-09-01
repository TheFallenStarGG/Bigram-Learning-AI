---
name: Zod and OpenAPI integer compatibility
description: A workspace-specific compatibility constraint between the current Zod catalog and generated OpenAPI schemas.
---

The current workspace Zod catalog is Zod 3, while the installed OpenAPI generator emits `zod.int()` for OpenAPI integer schemas. Use numeric schemas plus runtime integer values when extending this contract unless the workspace deliberately upgrades Zod.

**Why:** Code generation succeeds, but the chained library typecheck fails when generated code calls APIs absent from the installed Zod version.

**How to apply:** After every OpenAPI change, run codegen and the library typecheck before building server routes.