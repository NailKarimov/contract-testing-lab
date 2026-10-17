import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Verifier } from '@pact-foundation/pact';
import type { StateHandlers } from '@pact-foundation/pact/src/dsl/verifier/proxy/types';
import { PROVIDER, PACT_FILE, KNOWN_PET } from '../../src/consumers/pact';
import { test, expect, env } from '../../src';

/**
 * Provider side of the contract: every interaction in pacts/PetAdoptionWeb-Petstore.json is replayed
 * against the private Petstore container, after a state handler has prepared the data it needs.
 * Runs after the consumer project (playwright.config.ts → dependencies).
 */
const BASE = process.env.PACT_PROVIDER_URL ?? 'http://localhost:8090/api/v3';

async function providerIsUp(): Promise<boolean> {
  try {
    return (await fetch(`${BASE}/openapi.json`, { signal: AbortSignal.timeout(3_000) })).ok;
  } catch {
    return false;
  }
}

const json = { 'Content-Type': 'application/json', Accept: 'application/json' };
async function createPet(id: number, name: string): Promise<void> {
  const res = await fetch(`${BASE}/pet`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ id, name, photoUrls: [`https://example.com/${id}.png`], status: 'available' }),
  });
  if (!res.ok) throw new Error(`state setup: POST /pet → ${res.status}`);
}

/** Provider states named in the pact ("given …") and how to make each one true. */
type Params = { id?: number; name?: string } | undefined;
const p = (x: unknown): Params => (x && typeof x === 'object' ? (x as Params) : undefined);
const stateHandlers: StateHandlers = {
  'there are available pets': () => createPet(KNOWN_PET.id + 10, 'available-for-pact'),
  'a pet exists': (params) => createPet(Number(p(params)?.id), String(p(params)?.name)),
  'a pet does not exist': async (params) => {
    await fetch(`${BASE}/pet/${Number(p(params)?.id)}`, { method: 'DELETE' }).catch(() => undefined);
  },
};

function verifier(pactFile: string): Verifier {
  return new Verifier({
    provider: PROVIDER,
    providerBaseUrl: BASE,
    pactUrls: [pactFile],
    stateHandlers,
    providerVersion: process.env.GITHUB_SHA?.slice(0, 7) ?? 'local',
    logLevel: 'error',
  });
}

test.describe.configure({ mode: 'serial', timeout: 120_000 });

test.describe('Petstore honours the Pet Adoption Web contract (provider)', () => {
  test.beforeAll(async () => {
    if (await providerIsUp()) return;
    if (env.requireStack) throw new Error(`Petstore container is not running at ${BASE} (npm run fuzz:up)`);
    test.skip(true, `Petstore container is not running at ${BASE}; start it with npm run fuzz:up`);
  });

  test('every interaction in the pact is satisfied', async () => {
    const pact = JSON.parse(readFileSync(PACT_FILE, 'utf8')) as { interactions: { description: string }[] };
    test.info().annotations.push({
      type: 'pact',
      description: `${pact.interactions.length} interactions: ${pact.interactions.map((i) => i.description).join('; ')}`,
    });
    await expect(verifier(PACT_FILE).verifyProvider()).resolves.toBeTruthy();
  });

  // Self-test, like the oasdiff fixtures: a contract the provider cannot satisfy must be rejected,
  // otherwise a green verification would prove nothing.
  test('a contract the provider cannot satisfy is rejected', async () => {
    const pact = JSON.parse(readFileSync(PACT_FILE, 'utf8'));
    const page = pact.interactions.find(
      (i: { description: string }) => i.description === 'a request for an existing pet',
    );
    page.response.body.adoptedAt = '2026-10-17';
    page.response.matchingRules.body['$.adoptedAt'] = { combine: 'AND', matchers: [{ match: 'type' }] };
    pact.consumer.name = 'BrokenExpectations';
    const file = path.join(mkdtempSync(path.join(tmpdir(), 'pact-')), 'BrokenExpectations-Petstore.json');
    writeFileSync(file, JSON.stringify(pact));

    await expect(verifier(file).verifyProvider()).rejects.toThrow();
  });
});
