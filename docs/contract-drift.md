# Contract drift with oasdiff

Visual version (live diff of the four comparisons, "what breaks a client" grid, CI flow, glossary, RU/EN):
[`docs/contract-drift.html`](https://nailkarimov.github.io/api-test-automation/contract-drift.html).

## What it is

An API's OpenAPI document is a **contract**: clients are built against it. [oasdiff](https://www.oasdiff.com)
compares two versions of that document and classifies every difference by one question: _will an existing client
break?_

| Level   | Meaning                 | Examples                                                                      |
| ------- | ----------------------- | ----------------------------------------------------------------------------- |
| error   | breaks existing clients | path removed without deprecation, type changed, request field became required |
| warning | may break clients       | request field removed, new enum value in a response                           |
| info    | backward compatible     | new endpoint, new optional parameter or field                                 |

**Contract drift** is when the server, or a new version of the spec, no longer matches the approved contract.
oasdiff needs no running server for document-vs-document checks, so it takes seconds and fits every pull request.

## What breaks a client

The direction of the data decides. The client _writes_ the request and _reads_ the response, so a server may
become more lenient about what it accepts and more generous in what it returns, never the reverse (Postel's law).

| Change               | In the request (client writes)        | In the response (client reads)                             |
| -------------------- | ------------------------------------- | ---------------------------------------------------------- |
| add a field          | optional: safe · required: **breaks** | safe                                                       |
| remove a field       | warning                               | required: **breaks** · optional: oasdiff treats it as safe |
| change a type        | **breaks**                            | **breaks**                                                 |
| narrow an enum       | **breaks**                            | safe                                                       |
| widen an enum        | safe                                  | warning                                                    |
| remove a status code | —                                     | **breaks** when it was the success response                |

## How it is set up here

| File                                               | Role                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `contracts/petstore/openapi.yaml`                  | the approved contract: swagger-petstore `master`, version 1.0.29-SNAPSHOT              |
| `contracts/petstore/known-drift.txt`               | accepted breaking drift (`--err-ignore`), one line per change, with a `CD-n` id        |
| `contracts/petstore/fixtures/v2-breaking.yaml`     | five breaking changes, generated from the contract — must be rejected                  |
| `contracts/petstore/fixtures/v1.1-compatible.yaml` | three additive changes — must be accepted                                              |
| `.github/workflows/contract.yml`                   | the four checks below; nightly, on changes to `contracts/`, on pull requests, manually |

The workflow runs four checks:

1. **Self-test**: oasdiff must reject `v2-breaking.yaml` and accept `v1.1-compatible.yaml`. A check that never
   fails proves nothing, so the tool itself is tested first.
2. **PR check**: when a pull request edits the approved contract, oasdiff compares it with the base branch
   (`origin/main:contracts/petstore/openapi.yaml`). A breaking edit fails the PR.
3. **Gate (container)**: the spec served by the private Petstore container (`infra/petstore`, same one the
   Schemathesis run uses) against the approved contract, minus `known-drift.txt`. New breakage fails the job.
4. **Watch (public sandbox)**: the same comparison for `petstore3.swagger.io`, report only. A public service
   changes without us and must not fail our build.

The job summary shows both comparisons in Markdown; the HTML changelogs are published to
[`/contract/`](https://nailkarimov.github.io/api-test-automation/contract/) on GitHub Pages.

## Findings of the first run (17.10.2026, oasdiff v1.33.0)

| Comparison                                           | Versions                     | Changes | error | warning | info | Exit |
| ---------------------------------------------------- | ---------------------------- | ------- | ----- | ------- | ---- | ---- |
| approved → `fixtures/v2-breaking.yaml`               | 1.0.29-SNAPSHOT → 2.0.0      | 31      | 28    | 3       | 0    | 1    |
| approved → `fixtures/v1.1-compatible.yaml`           | 1.0.29-SNAPSHOT → 1.1.0      | 20      | 0     | 0       | 20   | 0    |
| approved → container `swaggerapi/petstore3:unstable` | 1.0.29-SNAPSHOT → **1.0.17** | 27      | 7     | 0       | 20   | 0 \* |
| approved → public `petstore3.swagger.io`             | 1.0.29-SNAPSHOT → 1.0.27     | 0       | 0     | 0       | 0    | 0    |

\* exit 0 because the 7 errors are accepted as **CD-1**.

**CD-1.** The `unstable` Docker image serves the old 1.0.17 spec. Compared with the approved contract, 7 operations
have lost their success response `200`: `PUT/DELETE /user/{username}`, `GET /user/logout`, `POST /user`,
`DELETE /store/order/{orderId}`, `POST/DELETE /pet/{petId}`. oasdiff also noticed that the version number went
_down_. We cannot fix a third-party image, so the drift is listed in `known-drift.txt`; anything new still fails.

Cross-check with Schemathesis: it found the same independently (FZ-2, the server answers `200` on `DELETE`
operations whose spec does not list it). Two tools, two methods, one finding.

The public sandbox runs 1.0.27; its spec differs from 1.0.29-SNAPSHOT only in descriptions and examples, which
oasdiff does not count as API changes ("no changes to report, but the specs are different").

## Running it

oasdiff is a single Go binary: `go install github.com/oasdiff/oasdiff@v1.33.0` (Go 1.26+), `brew install oasdiff`,
or the Docker image. `--lang ru` prints the report in Russian.

```bash
npm run contract:selftest                    # what oasdiff finds in the breaking fixture
npm run fuzz:up && npm run contract:check    # private container vs the approved contract
npm run contract:changelog                   # every change, safe ones included
oasdiff breaking origin/main:contracts/petstore/openapi.yaml contracts/petstore/openapi.yaml   # the PR check
```

To accept a new drift on purpose: copy the line from `oasdiff breaking … --format singleline` into
`known-drift.txt` with a new `CD-n` id and explain it in this document. Never add a line just to make a red build
green without understanding the change.

## Limits

- oasdiff compares documents. It cannot tell whether the server behaves as either document says; that is what
  Schemathesis checks.
- It knows nothing about a particular client. Pact (next on the roadmap) checks what each real consumer actually uses.
- Changes hidden in descriptions ("this field is now in cents") are invisible to it.

## Terms

| Term                 | Meaning                                                                               |
| -------------------- | ------------------------------------------------------------------------------------- |
| Contract             | the approved API description clients rely on                                          |
| Contract drift       | the server or a new spec version no longer matches the approved contract              |
| Breaking change      | a change after which an existing client stops working unless it changes too           |
| Backward compatible  | the new version accepts everything the old one did and returns everything it returned |
| Deprecation          | a "will be removed" marker; oasdiff expects it before a path is removed               |
| Semantic versioning  | MAJOR.MINOR.PATCH: a breaking change needs a new MAJOR version                        |
| Fixture              | prepared input for a test; here, two spec versions for the self-test                  |
| Robustness principle | Postel's law: be strict in what you send, lenient in what you accept                  |
