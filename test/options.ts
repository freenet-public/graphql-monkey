import { TestOptions } from '../src/options';

export function gqlm(): TestOptions {
  return {
    url: 'http://localhost:4000/graphql',
    count: 20,
    randomization: 0.2,
    exit: false,
    aliases: [],
    seed: '4',
    timeout: 2000,
    verbose: true,
    requestOptions: {
      url: ''
    },
    data: {}
  };
}
