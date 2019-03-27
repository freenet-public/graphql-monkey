import * as assert from 'assert';
import { Session, replaceLeafsInSelectionSet } from '../src/session';
import { gqlm as testOptions } from './options';
import { print, OperationDefinitionNode } from 'graphql';
import { TestEndpoint } from '../src/endpoint';
import { makeFieldNode, makeDocumentNode } from '../src/ast';

describe('From the core module', () => {
  describe('the Session class', () => {
    const options = {
      ...testOptions(),
      data: {}
    };

    it('should be able to expand endpoints', async () => {
      const session = new Session(options);
      await session.init();

      assert.equal(session.endpoints.length, 4);

      session.expand(session.endpoints[0]);
      session.expand(session.endpoints[1]);
      session.expand(session.endpoints[2]);
      session.expand(session.endpoints[2]);

      assert.deepEqual(session.endpoints.map(it => it.getPath()), [
        ['hello'],
        ['customers'],
        ['customer'],
        ['login'],
        ['customers', 'contracts'],
        ['customer', 'contracts']
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
            id
            name
          }
        }`.replace(/^ {8}/gm, '')
      );

      session.memory.write(['id'], '4');

      assert.equal(
        print(session.generateEndpointQuery(endpoint)).trim(),
        `{
          customer(id: "4") {
            id
            name
          }
        }`.replace(/^ {8}/gm, '')
      );
    });

    it('should be able determine if an endpoint can be guessed', async () => {
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

  describe('the replaceEndpointInSelectionSet', () => {
    it('should replace endpoints in selection sets', async () => {
      const queryAst = makeDocumentNode([
        makeFieldNode('customers', [], [makeFieldNode('contracts', [], [])])
      ]);
      const replacement = makeFieldNode(
        'customers',
        [],
        [
          makeFieldNode(
            'foo',
            [],
            [makeFieldNode('bar', [], []), makeFieldNode('baz', [], [])]
          )
        ]
      );

      const definition = queryAst.definitions[0] as OperationDefinitionNode;
      const selectionSet = replaceLeafsInSelectionSet(
        definition.selectionSet,
        replacement
      );

      assert.deepEqual(selectionSet, {
        kind: 'SelectionSet',
        selections: [makeFieldNode('customers', [], [replacement])]
      });
    });
  });
});
