import { defineConfig } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 2,
  timeout: 30_000,
  reporter: [[isCI ? 'github' : 'list'], ['html', { open: 'never' }], ['allure-playwright']],
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    // Pact (docs/pact.md): the consumer tests write pacts/*.json, then the provider is verified against
    // the private Petstore container (infra/petstore, port 8090) using that file.
    { name: 'contract-consumer', testDir: './tests/contract-consumer' },
    { name: 'contract-provider', testDir: './tests/contract-provider', dependencies: ['contract-consumer'] },
  ],
});
