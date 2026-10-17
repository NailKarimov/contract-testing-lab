import { PactV3, MatchersV3 } from '@pact-foundation/pact';
import { rmSync } from 'node:fs';
import { AdoptionClient } from '../../src/consumers/AdoptionClient';
import {
  CONSUMER,
  PROVIDER,
  PACT_DIR,
  PACT_FILE,
  KNOWN_PET,
  MISSING_PET_ID,
  NEW_PET,
} from '../../src/consumers/pact';
import { test, expect } from '../../src';

const { like, eachLike, integer, regex } = MatchersV3;

/**
 * Consumer side of the contract. Each test describes one interaction the Pet Adoption Web client relies on,
 * runs the real client against a Pact mock server, and on success Pact writes the interaction into
 * pacts/PetAdoptionWeb-Petstore.json. The file is then replayed against the real provider
 * (tests/contract-provider). Matchers say "any integer", "a string like this", so the contract fixes the
 * shape the client needs, not exact values.
 */
const pact = new PactV3({ consumer: CONSUMER, provider: PROVIDER, dir: PACT_DIR, logLevel: 'error' });
const STATUS = regex('available|pending|sold', 'available');

// One mock server at a time, and every interaction lands in the same pact file.
test.describe.configure({ mode: 'serial' });

// Start from an empty pact file, so an interaction removed from this spec also disappears from the contract.
test.beforeAll(() => rmSync(PACT_FILE, { force: true }));

test.describe('Pet Adoption Web → Petstore (consumer)', () => {
  test('lists adoptable pets with name and first photo', async () => {
    pact
      .given('there are available pets')
      .uponReceiving('a request for available pets')
      .withRequest({
        method: 'GET',
        path: '/pet/findByStatus',
        query: { status: 'available' },
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': regex('application/json.*', 'application/json') },
        body: eachLike({
          id: integer(1),
          name: like('doggie'),
          photoUrls: eachLike('https://example.com/a.png'),
        }),
      });

    await pact.executeTest(async (server) => {
      const pets = await new AdoptionClient(`${server.url}/`).listAdoptable();
      expect(pets[0]).toEqual({ id: 1, name: 'doggie', photo: 'https://example.com/a.png' });
    });
  });

  test('shows a pet page', async () => {
    pact
      .given('a pet exists', { id: KNOWN_PET.id, name: KNOWN_PET.name })
      .uponReceiving('a request for an existing pet')
      .withRequest({ method: 'GET', path: `/pet/${KNOWN_PET.id}`, headers: { Accept: 'application/json' } })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': regex('application/json.*', 'application/json') },
        body: { id: integer(KNOWN_PET.id), name: like(KNOWN_PET.name), status: STATUS },
      });

    await pact.executeTest(async (server) => {
      const pet = await new AdoptionClient(`${server.url}/`).getPet(KNOWN_PET.id);
      expect(pet).toEqual({ id: KNOWN_PET.id, name: KNOWN_PET.name, status: 'available' });
    });
  });

  test('shows "not found" for a pet that does not exist', async () => {
    pact
      .given('a pet does not exist', { id: MISSING_PET_ID })
      .uponReceiving('a request for a missing pet')
      .withRequest({ method: 'GET', path: `/pet/${MISSING_PET_ID}`, headers: { Accept: 'application/json' } })
      .willRespondWith({ status: 404 });

    await pact.executeTest(async (server) => {
      expect(await new AdoptionClient(`${server.url}/`).getPet(MISSING_PET_ID)).toBeUndefined();
    });
  });

  test('reserves a pet (status → pending)', async () => {
    pact
      .given('a pet exists', { id: KNOWN_PET.id, name: KNOWN_PET.name })
      .uponReceiving('a request to reserve a pet')
      .withRequest({
        method: 'POST',
        path: `/pet/${KNOWN_PET.id}`,
        query: { name: KNOWN_PET.name, status: 'pending' },
        headers: { Accept: 'application/json' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': regex('application/json.*', 'application/json') },
        body: { id: integer(KNOWN_PET.id), name: like(KNOWN_PET.name), status: 'pending' },
      });

    await pact.executeTest(async (server) => {
      const pet = await new AdoptionClient(`${server.url}/`).reserve(KNOWN_PET);
      expect(pet.status).toBe('pending');
    });
  });

  test('registers a new pet and reads back its id', async () => {
    pact
      .given('a pet does not exist', { id: NEW_PET.id })
      .uponReceiving('a request to register a pet')
      .withRequest({
        method: 'POST',
        path: '/pet',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: { id: NEW_PET.id, name: NEW_PET.name, photoUrls: [NEW_PET.photo], status: 'available' },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': regex('application/json.*', 'application/json') },
        body: like({ id: NEW_PET.id }),
      });

    await pact.executeTest(async (server) => {
      expect(await new AdoptionClient(`${server.url}/`).register(NEW_PET)).toBe(NEW_PET.id);
    });
  });
});
