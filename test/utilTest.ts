import * as assert from 'assert';
import { rewriteSelections, getPossibleValuesAtPath } from '../src/util';
import { makeFieldNode, makeInlineFragmentNode } from '../src/ast';
import { parse, print } from 'graphql';

describe('From the util module', () => {
  describe('rewriteSelection', () => {
    it('should rewrite selections', () => {
      const input = parse(`{
        customers {
          contracts {
            id
          }
        }
      }`);

      const output = rewriteSelections(
        input,
        ['customers', 'contracts'],
        [
          makeFieldNode('foo'),
          makeInlineFragmentNode('Bar', [makeFieldNode('bar')])
        ]
      );

      const expected = parse(`{
        customers {
          contracts {
            foo
            ... on Bar {
              bar
            }
          }
        }
      }`);

      assert.equal(print(output), print(expected));
    });

    it('should rewrite selections in fragments', () => {
      const input = parse(`{
        customers {
          ... on Individual {
            contracts {
              id
            }
          }
          ... on Company {
            contracts {
              id
            }
          }
        }
      }`);

      const output = rewriteSelections(
        input,
        ['customers', 'contracts'],
        [
          makeFieldNode('foo'),
          makeInlineFragmentNode('Bar', [makeFieldNode('bar')])
        ]
      );

      const expected = parse(`{
        customers {
          ... on Individual {
            contracts {
              foo
              ... on Bar {
                bar
              }
            }
          }
          ... on Company {
            contracts {
              foo
              ... on Bar {
                bar
              }
            }
          }
        }
      }`);

      assert.equal(print(output), print(expected));
    });
  });

  describe('getPossibleValuesAtPath', () => {
    it('should list possible values at a path in JSON data', async () => {
      const data = {
        customers: [
          {
            __typename: 'Individual',
            contracts: [{ id: '4' }]
          },
          {
            __typename: 'Company',
            form: 'lol',
            contracts: [{ id: '5' }, { id: '6' }, { list: ['wut', null] }]
          }
        ]
      };

      assert.deepEqual(getPossibleValuesAtPath(data, []), [data]);

      assert.deepEqual(
        getPossibleValuesAtPath(data, ['customers']),
        data.customers
      );

      assert.deepEqual(
        getPossibleValuesAtPath(data, ['customers', 'contracts']),
        [{ id: '4' }, { id: '5' }, { id: '6' }, { list: ['wut', null] }]
      );

      assert.deepEqual(
        getPossibleValuesAtPath(data, ['customers', 'contracts', 'id']),
        ['4', '5', '6']
      );

      assert.deepEqual(getPossibleValuesAtPath(data, ['customers', 'form']), [
        'lol'
      ]);

      assert.deepEqual(
        getPossibleValuesAtPath(data, ['customers', 'contracts', 'list']),
        ['wut']
      );
    });
  });
});
