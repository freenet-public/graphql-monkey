import { TestOptionsInput } from '../src/options';

export function gqlm(): TestOptionsInput {
  return {
    url: 'https://metaphysics-production.artsy.net/',
    count: 50,
    timeout: 5000
  };
}
