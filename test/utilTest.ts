import * as assert from 'assert';
import { rewriteSelections, dataIsDefinedAtPath } from '../src/util';
import { makeFieldNode, makeInlineFragmentNode } from '../src/ast';
import { parse, print } from 'graphql';
import request from 'request-promise-native';

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

  describe('dataIsDefinedAtPath', () => {
    it('should determine if data is defined at a given path', async () => {
      const r = await request({
        url: 'http://localhost:4000/graphql',
        json: true,
        body: {
          query: `{
            customer(id: "4") {
              __typename
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
          }`
        }
      });

      assert.ok(dataIsDefinedAtPath(r.data, []));
      assert.ok(dataIsDefinedAtPath(r.data, [], 'Any'));
      assert.ok(!dataIsDefinedAtPath(r.data, ['foo']));
      assert.ok(dataIsDefinedAtPath(r.data, ['customer']));
      assert.ok(dataIsDefinedAtPath(r.data, ['customer'], 'Individual'));
      assert.ok(!dataIsDefinedAtPath(r.data, ['customer'], 'Company'));
    });
  });
});
