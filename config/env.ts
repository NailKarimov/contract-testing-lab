import 'dotenv/config';

/** Reads a variable from the environment (or .env) and falls back to a default. */
function read(name: string, fallback = ''): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value.trim() : fallback;
}

/** Test environment settings. Nothing here is secret. */
export const env = {
  /** Private Swagger Petstore container from infra/petstore (npm run petstore:up). */
  petstoreBaseUrl: read('PETSTORE_BASE_URL', 'http://localhost:8090/api/v3/'),
  /** In CI a missing Petstore container must fail the run instead of silently skipping its tests. */
  requireStack: read('REQUIRE_STACK') === '1',
};
