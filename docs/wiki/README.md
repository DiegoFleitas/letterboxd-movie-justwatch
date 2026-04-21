# Wiki source files

These Markdown files are the canonical copy for **[GitHub Wiki](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/wiki)** pages of the same name, kept in-repo so updates can go through pull requests.

To publish changes to the wiki:

1. Enable the wiki on the repository if it is not already (**Settings → General → Features**).
2. Clone the wiki repository:  
   `git clone https://github.com/DiegoFleitas/letterboxd-movie-justwatch.wiki.git`
3. Copy the updated `.md` files from `docs/wiki/` into the wiki clone (page title should match the filename without extension, e.g. `Commands.md` → wiki page **Commands**). Pages: **Commands**, **Configuration**, **Observability**, **Sentry-and-logger**, **Branding**, **Repository-layout** (skip this `README.md` file—it is maintainer documentation only).
4. Commit and push the wiki repository.

Wiki-relative links in the synced pages may need verification after the first publish. Absolute links to `github.com/.../blob/master/...` always point at the main repository.
