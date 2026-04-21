# Security policy

## Supported versions

This project does not maintain separate release lines for security backports. Fixes are applied on the **default branch** ([`master`](https://github.com/DiegoFleitas/letterboxd-movie-justwatch)) and published from there (including deploys from CI). Run the **latest commit** you can deploy; older snapshots may not receive fixes.

| Area                       | Notes                                             |
| -------------------------- | ------------------------------------------------- |
| **Application** (`master`) | Receives security-relevant fixes when reported.   |
| **Dependencies**           | Updated via normal maintenance (e.g. Dependabot). |

## Reporting a vulnerability

**Please do not** open a **public** issue for an unfixed security problem (that can put users at risk).

1. **Preferred:** Use GitHub **private vulnerability reporting** for this repository: open the repo → **Security** → **Report a vulnerability** (if the feature is enabled for the repo). See [GitHub’s documentation on private reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability).

2. **If that option is not available:** Contact the maintainer via **[GitHub](https://github.com/DiegoFleitas)** (e.g. verified contact on profile or a minimal issue asking for a secure channel—without disclosing exploit details in public text).

Include enough detail to reproduce or understand the issue (affected component, version/commit, steps, impact). Reports are read in good faith; there is no bounty program unless stated elsewhere.

## What to expect

- **Acknowledgment:** You should receive an initial reply within **a few business days** when contact is possible; timelines can vary for small projects.
- **Fixes:** Valid issues are addressed with a severity-appropriate fix and release or deploy process; you may be credited in the advisory or release notes if you want.
- **Disclosure:** Please allow time for a patch before public disclosure; coordinated disclosure is appreciated.

## Scope (high level)

In scope: this application’s code, configuration, and deployment as described in this repository (e.g. Fastify server, session handling, scraping/proxy behavior, frontend). Out of scope: third-party services’ policies, social engineering, or issues in dependencies best reported upstream (we still appreciate knowing if something affects this app directly).

Thank you for helping keep users safe.
