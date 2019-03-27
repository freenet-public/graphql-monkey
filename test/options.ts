import { TestOptions } from '../src/options';

export function gqlm(): TestOptions {
  return {
    url: 'http://localhost:4000/graphql',
    count: 20,
    exit: false,
    aliases: [],
    seed: '4',
    timeout: 2000,
    requestOptions: {
      url: ''
    },
    data: {
      id: '6'
    }
  };
}
