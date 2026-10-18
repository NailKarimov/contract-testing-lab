import { test as base, expect } from '@playwright/test';
import * as allure from 'allure-js-commons';

const OWNER = 'Nail Karimov';
const EPICS: Record<string, string> = {
  'contract-consumer': 'Contract tests (Pact)',
  'contract-provider': 'Contract tests (Pact)',
};

/** Labels every test in the Allure report. */
export const test = base.extend<{ allureLabels: void }>({
  allureLabels: [
    // Playwright requires a destructuring pattern for the fixtures argument.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      await allure.owner(OWNER);
      await allure.layer('api');
      const epic = EPICS[testInfo.project.name];
      if (epic) await allure.epic(epic);
      await use();
    },
    { auto: true },
  ],
});

export { expect };
