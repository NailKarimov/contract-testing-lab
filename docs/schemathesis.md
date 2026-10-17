# Property-based API testing with Schemathesis

Visual version of this page (diagrams, animation, glossary): [`docs/schemathesis.html`](schemathesis.html) —
open it in a browser or on [GitHub Pages](https://nailkarimov.github.io/api-test-automation/schemathesis.html).

## What it is

[Schemathesis](https://schemathesis.io) reads an API description (OpenAPI or GraphQL) and **generates the
tests itself**. Instead of writing examples by hand ("create a pet named Rex, expect 200"), you state
properties that must hold for _every_ request, and the tool tries hundreds of inputs per operation to break
them:

- the server never answers with a 5xx;
- every response matches the status codes, headers, content type and schema declared in the spec;
- an invalid request (wrong type, missing required field) is rejected, and a valid one is accepted;
- a deleted resource is really gone, an endpoint that requires a key does not work without it.

This is called **property-based testing**; applied to an API with partly invalid data it is also **fuzzing**.
It finds what hand-written tests rarely cover: odd unicode, huge numbers, empty bodies, unexpected HTTP
methods, and mismatches between the documentation and the real server (**contract drift**).

## Where it sits in this repository

|                   | Playwright tests (`tests/petstore`)                       | Schemathesis (`fuzz/`)                                |
| ----------------- | --------------------------------------------------------- | ----------------------------------------------------- |
| Who writes a case | an engineer, from requirements and test design techniques | the tool, from the OpenAPI document                   |
| Oracle            | exact expected values (this pet, this status)             | general properties (no 5xx, conforms to the schema)   |
| Number of cases   | tens                                                      | thousands per run                                     |
| Strong at         | business rules, scenarios, readable regression            | edge inputs, spec vs. server mismatches, unknown bugs |
| System under test | public sandbox `petstore3.swagger.io`                     | private container `swaggerapi/petstore3` on `:8090`   |

The two complement each other: Schemathesis has no idea what a "sold pet" means for the business, and a
person would never think of sending a `TRACE` request with a 10 KB unicode tag name.

**Why a private container.** A fuzz run sends thousands of requests, many deliberately broken. Doing that to a
public sandbox other people use is impolite and makes the results depend on their data. The container
(`infra/petstore/docker-compose.yml`) runs the same code as `petstore3.swagger.io`, starts clean on every run
and is thrown away afterwards.

## How a run works

1. **Load the spec** — `http://localhost:8090/api/v3/openapi.json` (19 operations).
2. **Generate and send requests** in four phases:
   - `examples` — requests built from the `example` values written in the spec;
   - `coverage` — boundary values and deliberate violations derived from the schema (min/max, empty
     strings, missing required fields, wrong types) — the automated form of boundary value analysis and
     equivalence partitioning;
   - `fuzzing` — random data that matches, or deliberately breaks, the schema;
   - `stateful` — chains of calls connected by OpenAPI links, e.g. `POST /pet` → `GET /pet/{id}` →
     `DELETE /pet/{id}` → `GET /pet/{id}` must be 404.
3. **Check every response** with all built-in checks (`[checks] enabled = true`): `not_a_server_error`,
   `status_code_conformance`, `content_type_conformance`, `response_headers_conformance`,
   `response_schema_conformance`, `negative_data_rejection`, `positive_data_acceptance`,
   `missing_required_header`, `unsupported_method`, `use_after_free`, `ensure_resource_availability`,
   `ignored_auth`, and others.
4. **Shrink** each failure to the smallest request that still reproduces it and print a ready `curl`.
5. **Compare with the baseline** (`fuzz/baseline.json`): known failures are accepted, new ones fail the job.

## Making it reliable in CI

Random generation is a bad fit for a gate: a run could fail one night and pass the next with no change to the
API. The configuration (`fuzz/schemathesis.toml`) removes that randomness:

| Setting                      | Why                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `deterministic = true`       | the same requests on every run — a new failure means the API changed, not that we got lucky |
| `workers = 1`                | stateful chains share server data; one worker keeps the order fixed                         |
| `continue-on-failure = true` | an operation keeps being tested after its first failure, so one run records everything      |
| `max-examples = 50`          | bounded run time (a few minutes on a GitHub runner)                                         |
| fresh container per run      | no data left over from a previous run                                                       |

I checked this locally before pushing: two runs against the same fresh server produced exactly the same set of
failure identities, and after recording the baseline the next two runs exited with 0.

## Baseline: known defects without a red build

The Petstore demo has real defects (see the findings below). Fixing them is not our job, but they must not hide
_new_ problems. Schemathesis solves this with a **baseline** file — the same idea as `test.fail()` with a
`DEF-n` id in the Playwright tests:

- every failure has an identity: operation + check + failure type + signature;
- a failure listed in `fuzz/baseline.json` is reported as _known_ and does not fail the run;
- a failure that is not listed is _new_ → exit code 1 → the CI job is red;
- an entry can have `expires: YYYY-MM-DD`, after which it counts as new again (a reminder to re-check);
- extra fields (`defect`, `note`) are kept untouched, so each entry links to a defect id in this document.

To update it on purpose: run the workflow manually with **record baseline** ticked, or locally
`npm run fuzz:baseline`, then review the diff before committing. Never record a baseline just to make a red
build green without reading what changed.

## Running it

In CI — `.github/workflows/fuzz.yml`: on every push that touches `fuzz/` or `infra/petstore/`, nightly at
03:30 UTC, and manually. The run page shows a summary table and an annotation per new failure with a `curl`
to reproduce it; the HTML report is published to
[`/fuzz/`](https://nailkarimov.github.io/api-test-automation/fuzz/) on GitHub Pages.

Locally (Docker Desktop and Python 3.10+):

```bash
pip install -r fuzz/requirements.txt   # once
npm run fuzz:up                        # private Petstore on http://localhost:8090
npm run fuzz                           # reports in schemathesis-report/ (html/index.html)
npm run fuzz:down
```

To reproduce one finding, copy the `curl` from the report or annotation and change the port to `8090`.

## Findings

First CI run (17.10.2026, Schemathesis 4.31.1, `swaggerapi/petstore3:unstable`): **19 of 19 operations,
3 628 generated test cases, 42 seconds, 83 unique failures**. None of them comes from a bug in the tests: every
one is a place where the server and its own OpenAPI document disagree. All 83 are recorded in
`fuzz/baseline.json`, grouped into eight defects; each entry carries its `defect` id.

| Id   | Check                                     | Entries | What the server does                                                                                    |
| ---- | ----------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| FZ-1 | `not_a_server_error`                      | 11      | answers **500** to unexpected input (form-encoded bodies, `complete=0.5`, odd unicode) instead of a 4xx |
| FZ-2 | `status_code_conformance`                 | 17      | returns status codes the spec does not list for the operation (400, 500, even 200 on `DELETE`)          |
| FZ-3 | `response_schema_conformance`             | 17      | response breaks its schema: `photoUrls` (required) missing, an invalid `status` value echoed back as is |
| FZ-4 | `negative_data_rejection`                 | 5       | accepts schema-violating data with 200 (`userStatus: "abc"`, `complete: "AAA"`)                         |
| FZ-5 | `positive_data_acceptance`                | 9       | rejects schema-valid requests with 400 — the server is stricter than its documentation                  |
| FZ-6 | `ignored_auth`, `missing_required_header` | 3       | `api_key` is declared as required, but `GET /store/inventory` and `GET /pet/{petId}` work without it    |
| FZ-7 | `unsupported_method`                      | 20      | undeclared methods: `TRACE` → 403 instead of 405; 405 without the `Allow` header required by RFC 9110   |
| FZ-8 | `response_headers_conformance`            | 1       | `X-Expires-After` on `/user/login` is `Sat Oct 17 19:55:31 GMT 2026`, not an RFC 3339 `date-time`       |

Example — FZ-1, reproduced from the report:

```bash
curl -X POST -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'id=10&petId=198772&quantity=7&shipDate=2000-01-01T00%3A00%3A00Z&status=approved&complete=0.5' \
  http://localhost:8090/api/v3/store/order
# → 500 {"code":500,"message":"There was an error processing your request. ..."}
```

What the hand-written suite already knew: the 500s on store and user writes (DEF-n in `test-report.md`) and the
security header findings (SEC-n). New from Schemathesis: FZ-2 … FZ-8 — mostly **contract drift**, which a
person rarely checks operation by operation.

## Limits

- The oracle is the spec. If the spec itself is wrong, Schemathesis reports the server as broken (or misses a
  bug the spec allows). Every finding needs a human decision: is it the server or the document?
- It does not know business rules: a price of `-5` that the schema allows is fine for Schemathesis.
- Stateful testing works only as far as the spec declares links between operations; Petstore declares few.
- `deterministic` mode trades breadth for repeatability. For a deeper one-off search run
  `st run … --max-time 600` without it (and without the baseline) and triage the results by hand.

## Terms

| Term                   | Meaning                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------- |
| Property-based testing | tests state rules that hold for all inputs; the framework generates the inputs          |
| Fuzzing                | sending large amounts of unexpected or invalid data to find crashes and unhandled cases |
| Oracle                 | the way a test decides pass or fail — here, the OpenAPI document                        |
| Shrinking              | reducing a failing input to the smallest one that still fails                           |
| Stateful testing       | testing sequences of calls where one response feeds the next request                    |
| Contract drift         | the server and its documentation no longer agree                                        |
| Baseline               | the list of accepted failures; only failures outside it count                           |
| Hypothesis             | the Python property-based testing library Schemathesis is built on                      |
