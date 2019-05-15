import * as assert from 'assert';
import { Session } from '../src/session';
import { gqlm as testOptions } from './options';
import { print } from 'graphql';
import { TestEndpoint } from '../src/endpoint';

describe('From the core module', () => {
  describe('the Session class', () => {
    const options = {
      ...testOptions(),
      data: {}
    };

    it('should be able to expand endpoints', async () => {
      const session = new Session(options);
      await session.init();

      assert.equal(session.endpoints.length, 5);

      session.expand(session.endpoints[0]);
      session.expand(session.endpoints[1]);
      session.expand(session.endpoints[2]);
      session.expand(session.endpoints[2]);

      assert.deepEqual(session.endpoints.map(it => it.getPath()), [
        ['hello'],
        ['customers'],
        ['customer'],
        ['login'],
        ['search'],
        ['customers', 'contracts'],
        ['customers', 'person'],
        ['customers', 'contracts'],
        ['customers', 'employees'],
        ['customer', 'contracts'],
        ['customer', 'person'],
        ['customer', 'contracts'],
        ['customer', 'employees']
      ]);
    });

    it('should be able to generate queries for endpoints', async () => {
      const session = new Session(options);
      await session.init();

      const endpoint = session.endpoints.find(
        it => it.field.name === 'customer'
      ) as TestEndpoint;

      assert.equal(
        print(session.generateEndpointQuery(endpoint)).trim(),
        `{
          customer(id: "8bkpFT9hVTJd9)c[fM") {
            ... on Individual {
              id
              type
              name
            }
            ... on Company {
              id
              type
              name
              form
            }
            __typename
          }
        }`.replace(/^ {8}/gm, '')
      );

      session.memory.write(['id'], '4');

      assert.equal(
        print(session.generateEndpointQuery(endpoint)).trim(),
        `{
          customer(id: "4") {
            ... on Individual {
              id
              type
              name
            }
            ... on Company {
              id
              type
              name
              form
            }
            __typename
          }
        }`.replace(/^ {8}/gm, '')
      );
    });

    it('should be able to generate queries for deep endpoints', async () => {
      const session = new Session(options);
      await session.init();

      session.expand(session.endpoints[0]);
      session.expand(session.endpoints[1]);
      session.expand(session.endpoints[2]);
      session.expand(session.endpoints[2]);

      const endpoint = session.endpoints.find(
        it => it.field.name === 'contracts'
      ) as TestEndpoint;

      assert.equal(
        print(session.generateEndpointQuery(endpoint)).trim(),
        `{
          customers {
            __typename
            ... on Individual {
              contracts {
                id
              }
            }
          }
        }`.replace(/^ {8}/gm, '')
      );
    });

    it('should be able to determine if an endpoint can be guessed', async () => {
      const session = new Session(options);
      await session.init();

      const endpoint = session.endpoints.find(
        it => it.field.name === 'login'
      ) as TestEndpoint;

      assert.equal(session.canGuessEndpoint(endpoint), false);

      session.memory.write([], { username: 'siegmeyer', password: 'catarina' });

      assert.equal(session.canGuessEndpoint(endpoint), true);
    });
  });
});
