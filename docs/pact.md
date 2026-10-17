# Consumer-driven contract tests with Pact

Visual version (step-by-step handshake, the five interactions, "what happens if…" simulator, RU/EN):
[`docs/pact.html`](https://nailkarimov.github.io/api-test-automation/pact.html).

## What it is

[Pact](https://docs.pact.io) turns the way a client uses an API into a contract and checks the provider against it.

1. **Consumer side.** The client's own tests call the real client code against a Pact **mock server**. Each test
   describes one interaction (request → expected response, with matching rules). When the tests pass, Pact writes
   them into a **pact file**.
2. **Provider side.** The pact file is replayed against the real provider. Before each interaction a **state
   handler** prepares the data it needs ("a pet exists"). If the provider no longer returns what the client
   relies on, verification fails before anything is deployed.

The contract contains only what the client really uses. A provider may add fields or endpoints freely; it may
not remove or change what this client reads.

## What is tested here

The consumer is **Pet Adoption Web** (`src/consumers/AdoptionClient.ts`), a small client of the Petstore API written
the way a front-end team would. The provider is **Petstore**, the private container from `infra/petstore`.

| Interaction                   | Request                                        | Provider state                   | The client reads             |
| ----------------------------- | ---------------------------------------------- | -------------------------------- | ---------------------------- |
| a request for available pets  | `GET /pet/findByStatus?status=available`       | there are available pets         | `id`, `name`, `photoUrls[0]` |
| a request for an existing pet | `GET /pet/2026101701`                          | a pet exists `{id, name: "Rex"}` | `id`, `name`, `status`       |
| a request for a missing pet   | `GET /pet/2026101799`                          | a pet does not exist `{id}`      | status `404` only            |
| a request to reserve a pet    | `POST /pet/2026101701?name=Rex&status=pending` | a pet exists                     | `status` = `pending`         |
| a request to register a pet   | `POST /pet` with JSON body                     | a pet does not exist `{id}`      | `id`                         |

Matchers fix the shape, not the data: `integer()`, `like()`, `eachLike()`, `regex('available|pending|sold')`.
Exact values are used only where the client depends on them (`status: "pending"` after reserving).

| Path                                                | Role                                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/consumers/AdoptionClient.ts`                   | the consumer                                                                                     |
| `src/consumers/pact.ts`                             | names, pact file location, fixed ids for provider states                                         |
| `tests/contract-consumer/adoption-web.pact.spec.ts` | consumer tests (Playwright project `contract-consumer`)                                          |
| `tests/contract-provider/petstore.verify.spec.ts`   | provider verification + self-test (project `contract-provider`, runs after the consumer project) |
| `pacts/PetAdoptionWeb-Petstore.json`                | generated pact file (git-ignored; published to Pages `/pact/`)                                   |

**Self-test.** A copy of the pact with one impossible expectation (the client supposedly reads `adoptedAt`, which
Petstore never returns) is verified too, and the test passes only if the Verifier **rejects** it. Same idea as the
oasdiff fixtures: a check that cannot fail proves nothing.

## Results of the first CI run (17.10.2026, @pact-foundation/pact 17.1.4)

The main `tests.yml` job starts the Petstore container next to the Sock Shop. 185 tests passed; 7 of them are Pact:
5 consumer interactions, provider verification **5/5**, and the self-test (the impossible contract was rejected).

Interesting detail: oasdiff reports that the container's spec (1.0.17) has no `200` response for
`POST /pet/{petId}` (CD-1), yet Pact shows the server does answer `200` with the updated pet and this client is
satisfied. A document and actual behaviour are different things; that is why the repository uses all three tools.

## Pact, oasdiff and Schemathesis

|             | Pact                                        | oasdiff                                       | Schemathesis                           |
| ----------- | ------------------------------------------- | --------------------------------------------- | -------------------------------------- |
| Truth       | a real client's expectations                | the approved OpenAPI document                 | the OpenAPI document                   |
| Question    | will the provider break **this** client?    | does a new spec version break clients at all? | does the server do what the spec says? |
| Scope       | only the fields and calls in use            | the whole document                            | every operation, thousands of requests |
| Our finding | 5/5 — the 1.0.17 image satisfies the client | CD-1                                          | FZ-1 … FZ-8                            |

## Running it

```bash
npm run fuzz:up          # private Petstore on http://localhost:8090
npm run test:contract    # consumer tests write the pact, then the provider is verified
npx playwright test --project=contract-consumer   # consumer side only, no network
```

Locally, without the container the provider tests are skipped; in CI (`REQUIRE_STACK=1`) they fail instead.
`PACT_PROVIDER_URL` points the verification at another Petstore.

## Next level: Pact Broker and can-i-deploy

Here consumer and provider live in one repository, so the pact file travels through a folder. In a company they
are separate teams: the consumer publishes the pact to a **Pact Broker** (or PactFlow), the provider build fetches
and verifies it and publishes the result, and `can-i-deploy` answers whether a given version can go to an
environment. Not set up in this repository yet.

## Terms

| Term                       | Meaning                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| Consumer-driven contract   | the client writes down what it needs; the provider must satisfy it                       |
| Consumer / provider        | the side that calls the API / the side that implements it                                |
| Interaction                | one request → expected response pair in the contract                                     |
| Provider state             | a precondition ("a pet exists") the provider prepares in a state handler                 |
| Matchers                   | matching rules instead of exact values: `integer()`, `like()`, `eachLike()`, `regex()`   |
| Mock server                | Pact's fake provider on the consumer side; answers per contract and records the requests |
| Provider verification      | replaying the pact file against the real provider                                        |
| Pact Broker / can-i-deploy | a contract store shared between teams / the "can this version ship?" check               |
