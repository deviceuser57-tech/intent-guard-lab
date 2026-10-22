# Roadmap

## Free guided assistant
- [x] Add bilingual templates, matching suggestions and step-by-step questions.
- [x] Read uploaded references locally and synthesize editable application settings without AI credits.
- [ ] Verify adoption → Generate Prompt → filled fields and default playground inputs; run rule tests.

1. [x] Pull the Prompts repository from GitHub (staged at /tmp/prompts-repo, public repo deviceuser57-tech/Prompts)
2. [x] Confirm current preview builds and renders without errors (user is viewing an old-commit preview — needs Restore button click)
3. [ ] Full upgrade: integrate the repo's authoritative domain layer (specification IR, decisionEngine, linter, readiness, evidence-backed scoring, Arabic-aware classification) replacing/upgrading the app's engines, wired into the existing Workbench UI
   - [x] Require explicit user acknowledgment before generation when the legacy analyzer and decision engine disagree; cancellation returns to editable input.
4. [ ] Verify end-to-end in the preview (prompt generation, linter findings, readiness score, security, playground)

## HTML-reference interface
- [ ] Apply the uploaded HTML's header, palette, section headings, tabs and metric styling without changing prompt logic.
- [ ] Verify prompt generation and tab navigation at desktop and narrow widths.
