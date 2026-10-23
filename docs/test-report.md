# Test summary report: Petstore contract (contract-testing-lab)

The structure follows ISO/IEC/IEEE 29119-3 (test completion report), shortened.

- **Period:** 17.10.2026 – 23.10.2026
- **Build:** `swaggerapi/petstore3:unstable` in a private container; latest nightly runs in GitHub Actions
- **Reports:** https://nailkarimov.github.io/contract-testing-lab/ (Allure), `…/fuzz/`, `…/contract/`

## 1. Summary

The Petstore meets the needs of its sample consumer (Pact 5/5), but it does not keep its own published contract.
Schemathesis found 83 violations, grouped into 8 defects. The image also serves an older spec than the approved
contract (CD-1).

## 2. Results

| Metric                    | Value                                                            |
| ------------------------- | ---------------------------------------------------------------- |
| Schemathesis              | 3 628 generated cases; 83 violations, all in the baseline; 0 new |
| oasdiff                   | drift against the approved contract: CD-1 accepted, nothing new  |
| Pact                      | 5 interactions; provider verification 5/5                        |
| Playwright tests (Allure) | 9 passed, 0 failed                                               |
| Self-tests                | 3 of 3 rejected as expected                                      |

## 3. Defects

| ID   | Severity         | Summary                                                              | Status                           |
| ---- | ---------------- | -------------------------------------------------------------------- | -------------------------------- |
| FZ-1 | major            | 500 on unexpected input instead of a 4xx                             | open (upstream), in the baseline |
| FZ-2 | minor            | undocumented status codes                                            | open, in the baseline            |
| FZ-3 | major            | responses break their schema (required `photoUrls` missing)          | open, in the baseline            |
| FZ-4 | minor            | schema-violating data accepted                                       | open, in the baseline            |
| FZ-5 | minor            | schema-valid requests rejected                                       | open, in the baseline            |
| FZ-6 | major (security) | declared `api_key` not enforced                                      | open, in the baseline            |
| FZ-7 | minor            | wrong status and missing `Allow` for undeclared methods              | open, in the baseline            |
| FZ-8 | trivial          | `X-Expires-After` not RFC 3339                                       | open, in the baseline            |
| CD-1 | major            | the image serves spec 1.0.17: 7 operations lost their `200` response | open, accepted drift             |

## 4. Deviations from the plan

None.

## 5. Recommendations

1. Report FZ-3 and FZ-6 upstream first: they break clients and the declared security.
2. When the image is updated, remove fixed entries from the baseline, because the build asks for that.
