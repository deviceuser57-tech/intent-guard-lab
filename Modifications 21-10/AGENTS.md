<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Prompt engines live in src/lib/prompt/* as pure, deterministic client-side modules; registry persists to localStorage — no backend needed for static analysis.
- Workbench presentation is scoped by named CSS classes and semantic tokens in src/styles.css; keep reference styling separate from prompt-engine logic so visual changes cannot alter analysis.
