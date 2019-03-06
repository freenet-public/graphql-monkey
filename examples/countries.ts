import { TestOptionsInput } from '../src/options';

export function gqlm(): TestOptionsInput {
  return {
    url: 'https://countries.trevorblades.com',
    data: {
      currency: 'EUR',
      code: 'de'
    }
  };
}
