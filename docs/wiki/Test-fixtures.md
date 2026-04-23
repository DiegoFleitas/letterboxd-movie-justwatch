# Test fixtures

Static files under [`tests/fixtures/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/tests/fixtures) support unit tests (scrapers, API shapes, state).

## Contents

| Path                                                              | Purpose                                           |
| ----------------------------------------------------------------- | ------------------------------------------------- |
| `api/letterboxd-watchlist.json`, `api/search-movie.json`          | Request/response style JSON for local or test use |
| `letterboxd-watchlist-page.html`, `letterboxd-list-fragment.html` | HTML snippets for Letterboxd list scraper tests   |

## Refreshing Letterboxd HTML fixtures

To pull updated HTML from live Letterboxd pages into the repo:

```bash
bun run update:letterboxd-fixtures
```

Script: [`scripts/updateLetterboxdFixtures.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/scripts/updateLetterboxdFixtures.ts).

See also: [Tests](Tests).

**In-repo copy:** [`tests/fixtures/README.md`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/tests/fixtures/README.md).
