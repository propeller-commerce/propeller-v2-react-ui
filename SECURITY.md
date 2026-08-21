# Security Policy

## Supported versions

`propeller-v2-react-ui` is pre-1.0. Until a 1.0 release, only the latest
`0.x` version receives security fixes. Once 1.0 ships, this section will be
updated with a supported-version matrix.

| Version | Supported |
| ------- | --------- |
| latest `0.x` | ✅ |
| older `0.x`  | ❌ — upgrade to the latest |

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Report suspected vulnerabilities privately to the Propeller Commerce
security contact. Include:

- A description of the vulnerability and its impact.
- The package version affected.
- Steps to reproduce, or a proof-of-concept.
- Any suggested remediation, if you have one.

You will receive an acknowledgement of the report. Once triaged, a fix
will be prepared, released, and credited (unless you ask to remain
anonymous).

## Scope

This package is a **UI component library**. It renders e-commerce
components and calls the Propeller GraphQL API through the `propeller-sdk-v2`
SDK. It deliberately owns very little security-sensitive surface:

**In scope:**

- Cross-site scripting (XSS) introduced by component rendering — e.g. an
  unescaped value reaching `dangerouslySetInnerHTML`. The package uses
  `marked` to render product description HTML; markdown-rendering paths are
  the most relevant area to scrutinize.
- Prototype pollution or injection in the shared utilities
  (`composables/shared/utils/`).
- Dependency vulnerabilities in the package's own bundled dependencies.

**Out of scope (the consuming application's responsibility):**

- **GraphQL transport and authentication.** The package ships no GraphQL
  client, no endpoint, and no auth logic. The consumer constructs its own
  `GraphQLClient`, decides the endpoint, owns the proxy (if any), and owns
  token storage and refresh. Endpoint hardening — rate limiting, query-depth
  limits, body-size caps, CSP, cookie flags — lives in the consumer.
- **Server-side data fetching.** The package has no `/server` entry; any
  server-side SDK wiring is consumer code.
- **Secrets.** The package neither reads nor stores API keys, tokens, or
  environment variables. Anything of that nature in a consuming app is the
  consumer's concern.

If you are auditing a full storefront, the GraphQL proxy, auth flow, and
environment configuration live in the consumer application (e.g.
`propeller-next`), not here.

## Dependency hygiene

The package keeps its bundled dependency surface small. Run `npm audit` in
the package repo to check the current state; report anything that `npm audit`
flags as `high` or `critical` and is reachable from package code through the
private channel above.
