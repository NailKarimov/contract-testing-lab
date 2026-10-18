# contract-testing-lab

[![Tests](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/tests.yml/badge.svg)](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/tests.yml)
[![Fuzz](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/fuzz.yml/badge.svg)](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/fuzz.yml)
[![Contract](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/contract.yml/badge.svg)](https://github.com/NailKarimov/contract-testing-lab/actions/workflows/contract.yml)
[![Allure report](https://img.shields.io/badge/report-Allure-orange)](https://nailkarimov.github.io/contract-testing-lab/)

Three contract-testing tools on one system, the [Swagger Petstore](https://github.com/swagger-api/swagger-petstore),
run as a **private Docker container** (`infra/petstore`). Each tool answers a different question:

| Tool                                                                                   | Question                                              | Finding                                                                                                         |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| [**Schemathesis**](docs/schemathesis.md) — property-based tests generated from OpenAPI | Does the server do what its spec says, for any input? | 3 628 generated cases, **83 spec violations → 8 defects FZ-1…FZ-8**, accepted in a baseline; only new ones fail |
| [**oasdiff**](docs/contract-drift.md) — contract drift                                 | Does a new spec version break existing clients?       | **CD-1**: the image serves the old spec 1.0.17, 7 operations lost their `200` response                          |
| [**Pact**](docs/pact.md) — consumer-driven contracts                                   | Will the provider break _this_ client?                | 5 interactions of a sample client "Pet Adoption Web", provider verification **5/5**                             |

Each tool has a self-test (a contract or fixture that **must** be rejected), so a green build proves something.

Visual guides (interactive, RU/EN): [Schemathesis](https://nailkarimov.github.io/contract-testing-lab/schemathesis.html) ·
[contract drift](https://nailkarimov.github.io/contract-testing-lab/contract-drift.html) ·
[Pact](https://nailkarimov.github.io/contract-testing-lab/pact.html). Reports: [Allure (Pact)](https://nailkarimov.github.io/contract-testing-lab/) ·
[Schemathesis](https://nailkarimov.github.io/contract-testing-lab/fuzz/) · [oasdiff](https://nailkarimov.github.io/contract-testing-lab/contract/) ·
[pact file](https://nailkarimov.github.io/contract-testing-lab/pact/PetAdoptionWeb-Petstore.json).

## Layout

```
infra/petstore/          private Petstore (docker compose, port 8090)
fuzz/                    Schemathesis config + baseline of accepted failures   → fuzz.yml (nightly)
contracts/petstore/      approved OpenAPI contract, accepted drift, self-test fixtures → contract.yml (nightly, PRs)
src/consumers/           the sample consumer "Pet Adoption Web"
tests/contract-consumer/ Pact consumer tests (write pacts/*.json)
tests/contract-provider/ provider verification against the container + self-test → tests.yml
```

## Running it

```bash
npm ci
npm run petstore:up                     # private Petstore on http://localhost:8090
npm run test:contract                   # Pact: consumer, then provider verification
pip install -r fuzz/requirements.txt && npm run fuzz        # Schemathesis
npm run contract:check                  # oasdiff (needs the oasdiff binary)
npm run petstore:down
```

## Part of a portfolio

Functional REST and GraphQL tests (including the hand-written Petstore suite) live in
[api-test-automation](https://github.com/NailKarimov/api-test-automation); microservices in
[microservices-testing](https://github.com/NailKarimov/microservices-testing); database testing in
[ledger-api-testing](https://github.com/NailKarimov/ledger-api-testing). Overview: [github.com/NailKarimov](https://github.com/NailKarimov).

**Stack:** TypeScript · Playwright Test · Pact JS · Schemathesis (Python) · oasdiff (Go) · Docker · Allure · GitHub Actions.
