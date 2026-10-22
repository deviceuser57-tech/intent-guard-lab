# Intent Guard Lab

Build the Enterprise Prompt Engineering Workbench web app based on the Prompts repository and workbench specification:

1. General-Purpose Prompt Workbench:
- Generate production-ready prompts across specialized task archetypes (Software Engineering/Code, Business Strategy, Copywriting/Content, Data Analytics, Autonomous Agents/System Instructions, Deep Research, Creative/Visual, and General Inquiries), not just image prompts.
- Clean separation between system instructions, user inputs, output contracts, and dynamic variable placeholders.

2. Architecture & Core Engines:
- Intent Analyzer (`src/lib/prompt/intentAnalyzer.ts`): Analyze user intent, classify task type (15 categories), estimate risk level (low, medium, high, critical), assess complexity (simple, moderate, complex), and select required prompt components and personas.
- Prompt Registry (`src/lib/prompt/registry.ts`): Manage prompt assets with semantic versioning (v1.0.0), full lifecycle (draft -> review -> published -> deprecated), immutable audit logging, and version comparison.
- Red-Team Engine (`src/lib/prompt/redTeam.ts`): Security analysis covering prompt injection, context poisoning, data leakage, unsafe instructions, output violations, and hallucination inducement with transparent static analysis reports.
- Evaluation Engine (`src/lib/prompt/evaluation.ts`): Measure correctness, coverage, specificity, groundedness, citation precision, token usage, and test cases.

3. Workspace UI & Modes:
- 3 operating modes: Quick Mode (streamlined prompt generation), Expert Mode (full specification controls and component tuning), and Enterprise Mode (registry, versioning, governance, and security audits).
- Tabbed panels: Intent Analysis, Specification, Compiled Prompts, Security/Validation, and Prompt Registry.
- Model integrations: Configurable OpenAI (including o1/o3), Anthropic Claude, Gemini, DeepSeek-R1, and custom OpenAI-compatible endpoints. API keys are kept in memory and are not persisted in localStorage; model IDs and endpoint metadata can be remembered locally.\n- Model-specific prompt adapters and few-shot retrieval: Provider-aware prompt boundaries, embedding-based example ranking where supported, and lexical fallback.\n- Iterative optimization: Generate and evaluate five prompt candidates using model judging, static evaluation, and red-team findings. This is DSPy-inspired candidate search, not the DSPy library itself.\n- Cloud registry: Optional Supabase persistence with per-user RLS and shared workspace snapshots/invitations. Requires the SQL migration in `docs/supabase-cloud-storage.sql`; shared snapshots are not real-time co-editing.
- Manual archetype override control alongside automated classification.
- Full bilingual English and Arabic support (i18n).

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://intent-guard-lab.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ecef960a-40d2-49b7-bcbd-ff60deca8ca7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
