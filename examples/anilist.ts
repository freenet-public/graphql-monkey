import { TestOptionsInput } from '../src/options';

export function gqlm(): TestOptionsInput {
  return {
    url: 'https://graphql.anilist.co',
    count: 50,
    data: {
      name: 'Stryk3r117'
    }
  };
}
