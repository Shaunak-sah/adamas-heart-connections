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

## Project rules
- Light/dark theme: dark tokens live on `:root`, light overrides on `:root.light` in src/styles.css; the `.light` class is set before paint by `themeInitScript` and toggled by `ThemeToggle`. Why: one token set per theme keeps every page themed with no per-component colour logic.
- The Discover card is the shared `ProfileCard` component; the profile page preview renders the same component. Why: the preview must always match what other students see.
- Photo/prompt limits and the prompt question list live in `src/lib/profile-extras.ts`; the database guard enforces the same caps. Why: one source for the UI, with the database as the backstop.
- Controlled Radix `Select` handlers ignore empty values (`v && …`). Why: Radix can fire `onValueChange("")` on remount, which silently cleared saved choices.
