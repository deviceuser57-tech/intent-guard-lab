# Model providers and cloud registry

## Configure a model

Open **Models, APIs & Cloud Storage** in the workbench. Choose OpenAI, Anthropic, Gemini, DeepSeek, or an OpenAI-compatible endpoint, then enter the model ID, API base URL, and API key. Use **Test connection** before running an optimization or playground request.

- API keys are held in in-memory UI state and are not written to localStorage or source control. Reloading the page clears the key.
- Provider/model/base URL metadata may be saved locally so the selection survives reloads.
- The key is sent to the server function for each request. Use a dedicated, low-privilege API key and do not use this app from a shared or untrusted device.
- Custom endpoints must use public HTTPS and the OpenAI-compatible `/chat/completions` format. Providers with proprietary APIs need a dedicated adapter.
- Model-specific adapters adjust prompt boundaries for Claude, Gemini, DeepSeek-R1, OpenAI reasoning models, and generic OpenAI-compatible models. Export payloads never include the user's actual API key.

## Few-shot retrieval and optimization

The optimizer retrieves up to three published registry examples. With a configured API key, OpenAI-compatible embedding endpoints and Gemini can rank up to nine same-archetype published examples by cosine similarity; if embeddings are unsupported or fail, the app falls back to lexical matching.

The candidate search generates and evaluates five candidates. Ranking prioritizes fewer critical/high findings, then model-judge score, static security score, static evaluation score, and token use. This is DSPy-inspired candidate search, not the DSPy library or its full BootstrapFewShot/Teleprompter implementation. Model-judge scores are heuristic model judgments, not independent ground truth. A five-candidate comparison may use up to fifteen model calls.

## Enable cloud registry persistence

1. Create a Supabase project and enable Email/Password authentication.
2. Run [supabase-cloud-storage.sql](./supabase-cloud-storage.sql) in the Supabase SQL Editor.
3. In the app's Models tab, enter the project URL, anon/publishable key, and the user's email/password.
4. Connect. The app imports the existing cloud snapshot or uploads the local snapshot on first connection. Registry changes then trigger best-effort background saves; **Sync now** forces an upload.

The SQL policy scopes each registry snapshot to the authenticated user. The app stores the active session in sessionStorage, not localStorage, and never stores the password. Local storage remains the fallback when cloud sync is disconnected or unavailable. This is per-user persistence, not real-time team collaboration; shared workspaces, team roles, and conflict resolution are not implemented.
