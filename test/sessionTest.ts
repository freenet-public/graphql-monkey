import * as assert from 'assert';
import { print, parse } from 'graphql';
import { TestEndpoint } from '../src/endpoint';
import { createTestSession } from './testUtil';

describe('From the core module', () => {
  describe('the Session class', () => {
    const options = {
      data: {}
    };

    it('should be able to generate queries for endpoints', async () => {
      const session = await createTestSession(options);

      const endpoint = session.endpoints.find(
        it => it.field.name === 'customer'
      ) as TestEndpoint;

      assert.equal(
        print(session.generateEndpointQuery(endpoint)),
        print(
          parse(`{
          customer(id: "8bkpFT9hVTJd9)c[fM") {
            __typename
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
          }
        }`)
        )
      );

      session.memory.write(['id'], '4');

      assert.equal(
        print(session.generateEndpointQuery(endpoint)),
        print(
          parse(`{
          customer(id: "4") {
            __typename
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
          }
        }`)
        )
      );
    });

    it('should be able to determine if a field can be guessed', async () => {
      const session = await createTestSession(options);

      const endpoint = session.endpoints.find(
        it => it.field.name === 'login'
      ) as TestEndpoint;

      assert.equal(session.canGuessField(endpoint.field), false);

      session.memory.write([], { username: 'siegmeyer', password: 'catarina' });

      assert.equal(session.canGuessField(endpoint.field), true);
    });
  });
});
