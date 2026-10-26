# contract-testing-lab

[![Tests](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/tests.yml/badge.svg)](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/tests.yml)
[![Fuzz](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/fuzz.yml/badge.svg)](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/fuzz.yml)
[![Contract](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/contract.yml/badge.svg)](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/contract.yml)
[![Allure report](https://img.shields.io/badge/report-Allure-orange)](https://nailkarimov.github.io/contract-testing-lab/)

### ▶ Open online

| Page                                                                                     | What it is          |
| ---------------------------------------------------------------------------------------- | ------------------- |
| **[Allure test report](https://nailkarimov.github.io/contract-testing-lab/)**            | latest CI run       |
| [Schemathesis report](https://nailkarimov.github.io/contract-testing-lab/fuzz/)          | latest CI run       |
| [Contract drift report](https://nailkarimov.github.io/contract-testing-lab/contract/)    | oasdiff, latest run |
| [Schemathesis](https://nailkarimov.github.io/contract-testing-lab/schemathesis.html)     | interactive guide   |
| [Contract drift](https://nailkarimov.github.io/contract-testing-lab/contract-drift.html) | interactive guide   |
| [Pact](https://nailkarimov.github.io/contract-testing-lab/pact.html)                     | interactive guide   |

Click these links: opening an `.html` file in the file list shows its source code, GitHub does not run it.

Three contract-testing tools on one system, the [Swagger Petstore](https://github.com/swagger-api/swagger-petstore),
which runs as a **private Docker container**. Each tool answers a different question about the API's contract.

|                        |                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **System under test**  | Swagger Petstore v3 (third-party, open source) in a private container (`infra/petstore`)                                                                                                                                                                                                                                      |
| **Language and tools** | TypeScript · Playwright Test · Pact JS · Schemathesis (Python) · oasdiff (Go) · Docker · Allure                                                                                                                                                                                                                               |
| **Types of testing**   | contract testing: property-based fuzzing from OpenAPI, contract drift, consumer-driven contracts                                                                                                                                                                                                                              |
| **Tests**              | 3 628 generated Schemathesis cases; oasdiff on 19 operations; 5 Pact interactions; 9 Playwright tests                                                                                                                                                                                                                         |
| **Test quality**       | each tool has a self-test: a contract or fixture that **must** be rejected                                                                                                                                                                                                                                                    |
| **Reports**            | [Allure (Pact)](https://nailkarimov.github.io/contract-testing-lab/) · [Schemathesis](https://nailkarimov.github.io/contract-testing-lab/fuzz/) · [oasdiff](https://nailkarimov.github.io/contract-testing-lab/contract/) · [pact file](https://nailkarimov.github.io/contract-testing-lab/pact/PetAdoptionWeb-Petstore.json) |

## What is tested

| Suite                      | Tool            | What it proves                                                                                                                                                                   |
| -------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fuzz/`                    | Schemathesis    | does the server do what its spec says, for any input? Property-based tests generated from the OpenAPI document; accepted failures are kept in a baseline, and only new ones fail |
| `contracts/petstore/`      | oasdiff         | does a new spec version break existing clients? The served spec is compared with the approved contract; accepted drift is listed                                                 |
| `tests/contract-consumer/` | Pact JS         | the sample client "Pet Adoption Web" records what it needs from the API                                                                                                          |
| `tests/contract-provider/` | Pact JS         | the pact is replayed against the container with provider states; the self-test proves an impossible contract fails                                                               |
| `tests/unit/`              | Playwright Test | the redaction of secrets in reports                                                                                                                                              |

## Findings

Each defect is also a bug report in [Issues](https://github.com/NailKarimov/contract-testing-lab/issues?q=is%3Aissue+label%3Abug), with steps, expected and actual results and severity.

| ID   | Found by     | Summary                                                                                                 |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------- |
| FZ-1 | Schemathesis | answers **500** to unexpected input (form-encoded bodies, `complete=0.5`, odd unicode) instead of a 4xx |
| FZ-2 | Schemathesis | status codes the spec does not list for the operation (400, 500, even 200 on `DELETE`)                  |
| FZ-3 | Schemathesis | responses break their schema: the required `photoUrls` is missing; an invalid `status` is echoed back   |
| FZ-4 | Schemathesis | schema-violating data accepted with 200 (`userStatus: "abc"`)                                           |
| FZ-5 | Schemathesis | schema-valid requests rejected with 400: the server is stricter than its documentation                  |
| FZ-6 | Schemathesis | `api_key` declared as required, but two operations work without it                                      |
| FZ-7 | Schemathesis | undeclared methods: `TRACE` → 403 instead of 405; 405 without `Allow` (RFC 9110)                        |
| FZ-8 | Schemathesis | `X-Expires-After` is not an RFC 3339 `date-time`                                                        |
| CD-1 | oasdiff      | the image serves the old spec 1.0.17: 7 operations lost their `200` response                            |

In total, 83 spec violations were found and grouped into 8 defects (FZ-1 to FZ-8). Pact provider verification
passes 5/5.

## Running it

Requirements: Node.js 22+, Docker, Python 3.12+ (Schemathesis), the oasdiff binary, Java 17+ for a local Allure
report.

```bash
npm ci
npm run petstore:up                                    # private Petstore on http://localhost:8090
npm run test:contract                                  # Pact: consumer, then provider verification
pip install -r fuzz/requirements.txt && npm run fuzz   # Schemathesis
npm run contract:check                                 # oasdiff
npm run petstore:down
```

## Project structure

```text
infra/petstore/          private Petstore (Docker Compose, port 8090)
fuzz/                    Schemathesis config and the baseline of accepted failures
contracts/petstore/      approved OpenAPI contract, accepted drift, self-test fixtures
src/consumers/           the sample consumer "Pet Adoption Web"
tests/contract-consumer/ Pact consumer tests (write pacts/*.json)
tests/contract-provider/ provider verification against the container, and the self-test
scripts/                 Allure preparation, Schemathesis summary
docs/                    test plan, test report, guides
```

## CI

Three workflows run on push, nightly and on demand:

- `tests.yml` at 03:00 UTC runs the Pact consumer and provider and publishes Allure;
- `fuzz.yml` at 03:30 UTC runs Schemathesis against the container and publishes the report under `fuzz/`;
- `contract.yml` at 03:45 UTC, and on every pull request, runs oasdiff and publishes the report under `contract/`.

## Documentation

| Document                                                                                                                              | What it is                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`docs/test-plan.md`](docs/test-plan.md)                                                                                              | test plan (ISO/IEC/IEEE 29119-3)                                    |
| [`docs/test-report.md`](docs/test-report.md)                                                                                          | test summary report: latest results, defects, recommendations       |
| [`docs/schemathesis.md`](docs/schemathesis.md) · [visual](https://nailkarimov.github.io/contract-testing-lab/schemathesis.html)       | property-based fuzzing from OpenAPI, the baseline, FZ-1…FZ-8        |
| [`docs/contract-drift.md`](docs/contract-drift.md) · [visual](https://nailkarimov.github.io/contract-testing-lab/contract-drift.html) | contract drift with oasdiff: breaking vs safe changes, CD-1         |
| [`docs/pact.md`](docs/pact.md) · [visual](https://nailkarimov.github.io/contract-testing-lab/pact.html)                               | consumer-driven contracts with Pact, provider states, the self-test |

## Part of a portfolio

One of 13 test automation projects by [Nail Karimov](https://github.com/NailKarimov):
[all projects](https://github.com/NailKarimov) ·
[testing map](https://nailkarimov.github.io/api-test-automation/testing-map.html) ·
[toolbox](https://nailkarimov.github.io/api-test-automation/toolbox.html).
