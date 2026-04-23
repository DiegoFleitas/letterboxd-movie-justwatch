# Test goldens

[`tests/goldens/`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/tree/master/tests/goldens) holds **optional golden (snapshot) JSON** for backend integration tests.

Current integration tests lean on **schema-level** assertions rather than full response byte equality. Add stable, deterministic JSON files here when an endpoint needs **exact response parity** for regression detection.

Convention: keep files small, deterministic, and free of secrets or volatile timestamps where possible.

See also: [Tests](Tests), [`tests/backend.integration.test.ts`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/tests/backend.integration.test.ts).

**In-repo copy:** [`tests/goldens/README.md`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch/blob/master/tests/goldens/README.md).
