# Test Notes

Automated tests are expected to cover these areas as the codebase grows:

- Prompt variable replacement.
- SQLite schema creation and CRUD.
- Markdown export.
- API request body construction.
- UI smoke flow.

Run the core/backend and Markdown security suites after building:

```bash
ctest --test-dir Source/build/x64-Release --output-on-failure
```

Security tests use fake Codex processes and temporary databases/images. They do
not read user credentials or contact a model provider. UI tests use the offscreen
Qt platform. See `docs/security_audit.md` for coverage and remaining boundaries.

