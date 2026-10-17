/**
 * "Pet Adoption Web" — a small, deliberately ordinary consumer of the Petstore API, the kind of code a
 * front-end team writes. It exists so the contract tests have a real consumer: Pact records what this
 * class actually sends and reads, and the provider (Petstore) is verified against exactly that.
 *
 * It reads only the fields it needs; anything else the provider returns is ignored, so the provider is
 * free to add fields without breaking it.
 */
export type AdoptablePet = { id: number; name: string; photo: string | undefined };
export type PetCard = { id: number; name: string; status: 'available' | 'pending' | 'sold' };

export class AdoptionClient {
  constructor(private readonly baseUrl: string) {}

  private async call(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(new URL(path, this.baseUrl), {
      ...init,
      headers: { Accept: 'application/json', ...(init.headers ?? {}) },
    });
  }

  /** Home page: pets that can be adopted right now. */
  async listAdoptable(): Promise<AdoptablePet[]> {
    const res = await this.call('pet/findByStatus?status=available');
    if (!res.ok) throw new Error(`findByStatus failed: ${res.status}`);
    const pets = (await res.json()) as { id: number; name: string; photoUrls: string[] }[];
    return pets.map((p) => ({ id: p.id, name: p.name, photo: p.photoUrls[0] }));
  }

  /** Pet page. `undefined` when the pet does not exist (the page shows "not found"). */
  async getPet(id: number): Promise<PetCard | undefined> {
    const res = await this.call(`pet/${id}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error(`getPet failed: ${res.status}`);
    const p = (await res.json()) as PetCard;
    return { id: p.id, name: p.name, status: p.status };
  }

  /** "Reserve" button: marks the pet as pending. Petstore needs the name together with the status (DEF-6). */
  async reserve(pet: { id: number; name: string }): Promise<PetCard> {
    const query = new URLSearchParams({ name: pet.name, status: 'pending' });
    const res = await this.call(`pet/${pet.id}?${query}`, { method: 'POST' });
    if (!res.ok) throw new Error(`reserve failed: ${res.status}`);
    const p = (await res.json()) as PetCard;
    return { id: p.id, name: p.name, status: p.status };
  }

  /** Shelter form: register a new pet; returns its id. */
  async register(pet: { id: number; name: string; photo: string }): Promise<number> {
    const res = await this.call('pet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pet.id, name: pet.name, photoUrls: [pet.photo], status: 'available' }),
    });
    if (!res.ok) throw new Error(`register failed: ${res.status}`);
    return ((await res.json()) as { id: number }).id;
  }
}
