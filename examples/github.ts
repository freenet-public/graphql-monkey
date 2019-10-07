import { TestOptionsInput } from '../src/options';

export function gqlm(): TestOptionsInput {
  return {
    url: 'https://api.github.com/graphql',
    requestOptions: {
      url: 'ignored',
      headers: {
        authorization: 'Bearer <token>'
      }
    }
  };
}
