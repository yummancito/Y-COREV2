import { describe, expect, it } from 'vitest';
import { steamChannels } from './steam.js';

describe('steamChannels', () => {
  it('steam.importLibrary.input acepta un payload vacío', () => {
    expect(steamChannels['steam.importLibrary'].input.safeParse({}).success).toBe(true);
  });

  it('steam.importLibrary.output exige gamesFound como entero no negativo', () => {
    expect(steamChannels['steam.importLibrary'].output.safeParse({ gamesFound: 12 }).success).toBe(true);
    expect(steamChannels['steam.importLibrary'].output.safeParse({ gamesFound: 0 }).success).toBe(true);
    expect(steamChannels['steam.importLibrary'].output.safeParse({ gamesFound: -1 }).success).toBe(false);
    expect(steamChannels['steam.importLibrary'].output.safeParse({ gamesFound: 1.5 }).success).toBe(false);
  });
});
