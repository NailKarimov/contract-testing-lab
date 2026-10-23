# Test plan: Petstore contract (contract-testing-lab)

The structure follows ISO/IEC/IEEE 29119-3 (test plan), shortened for one project.

## 1. Context

- **System under test:** Swagger Petstore v3, the reference implementation of its own OpenAPI document. It runs as
  a private Docker container, so fuzzing never touches a shared sandbox.
- **Goal:** answer three questions:
  - Does the server keep its published contract?
  - Does a new spec version break clients?
  - Does the server satisfy what one real client needs?
- **References:** OpenAPI 3.0, Pact specification v3, RFC 9110 (HTTP semantics), RFC 3339 (dates).

## 2. Scope

| In scope                                          | Out of scope                                               |
| ------------------------------------------------- | ---------------------------------------------------------- |
| every operation in the OpenAPI document (fuzzing) | functional business flows (covered in api-test-automation) |
| spec changes between versions (drift)             | performance                                                |
| the interactions of one sample consumer (Pact)    | authentication beyond the declared `api_key`               |

## 3. Quality characteristics (ISO/IEC 25010)

| Characteristic                          | Covered by                                                           |
| --------------------------------------- | -------------------------------------------------------------------- |
| Compatibility (interoperability)        | Pact; oasdiff breaking-change checks                                 |
| Functional correctness against the spec | Schemathesis checks: status codes, response schemas, data acceptance |
| Reliability (robustness)                | Schemathesis `not_a_server_error`                                    |

## 4. Approach

- **Schemathesis:** generated cases for every operation. Known failures are kept in `fuzz/baseline.json`, so only
  a new failure fails the build.
- **oasdiff:** the served spec is compared with the approved `contracts/petstore/openapi.yaml`, and accepted drift is
  listed in `known-drift.txt`.
- **Pact:** the consumer tests write the pact. The provider is verified against the container with provider
  states.
- **Self-tests:** each tool is also given an input it must reject. A green build therefore means the tool really
  checked something.

## 5. Risks

| Risk                                                             | Mitigation                                         |
| ---------------------------------------------------------------- | -------------------------------------------------- |
| Fuzzing a shared sandbox disturbs others and gives noisy results | a private container that starts clean              |
| Too many known failures hide new ones                            | a baseline: known failures accepted, new ones fail |
| A tool silently checks nothing                                   | a self-test per tool                               |

## 6. Entry and exit criteria

- **Entry:** the container is healthy, and the approved contract is present.
- **Exit:** no new Schemathesis failures beyond the baseline; no unapproved breaking drift; provider verification
  5/5; every self-test rejected as expected.

## 7. Deliverables

The three workflows and their reports on GitHub Pages, [`test-report.md`](test-report.md) and the guides.
