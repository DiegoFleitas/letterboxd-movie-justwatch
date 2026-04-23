# Publishing the GitHub Wiki

The **[GitHub Wiki](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/wiki)** content is maintained as Markdown in the main repository under **`docs/wiki/`**. Every `*.md` file in that folder (including **`Home.md`** and **`_Sidebar.md`**) is meant to be copied into the wiki git repository—there is no separate “do not publish” file in that directory.

## Prerequisites

1. Wiki enabled on the repository: **Settings → General → Features → Wikis**.
2. A local clone of the wiki remote (separate repo):  
   `git clone https://github.com/DiegoFleitas/letterboxd-movie-justwatch.wiki.git`

## Publish steps

1. Pull latest on the default branch of the **main** app repo and edit `docs/wiki/*.md` in a branch / pull request as usual.
2. After merge (or to preview), copy all wiki-facing files into the wiki clone root:

   ```bash
   WIKI_CLONE=../letterboxd-movie-justwatch.wiki   # adjust path
   cp docs/wiki/*.md "$WIKI_CLONE/"
   ```

3. In the wiki clone, review `git status`, commit, and push to `origin` (the wiki’s default branch, usually `master`).

## File list

Typical files to sync (names must match wiki page slugs):

- `Home.md` — default wiki landing (**[Home](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/wiki)**)
- `_Sidebar.md` — [GitHub Wiki sidebar](https://docs.github.com/en/communities/documenting-your-project-with-wikis/creating-a-footer-or-sidebar-for-your-wiki)
- `Branding.md`, `Commands.md`, `Configuration.md`, `E2E-Playwright.md`, `Observability.md`, `Redis-and-local-dev.md`, `Repository-layout.md`, `Sentry-and-logger.md`, `Test-fixtures.md`, `Test-goldens.md`, `Tests.md`

Run `ls docs/wiki/*.md` before each publish in case new pages were added.

## Links

- Cross-page links inside `docs/wiki/` use **wiki-relative** targets (e.g. `[Commands](Commands)`). They work on the rendered GitHub Wiki; in the main repo’s Markdown preview, those targets may not resolve.
- Links to application source use full URLs to **`github.com/.../blob/<branch>/...`** so they work from both the wiki and the main repo.
