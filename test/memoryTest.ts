import * as assert from 'assert';
import { Memory } from '../src/memory';

describe('A memory object', () => {
  it('should read and write data', () => {
    const memory = new Memory([
      ['id', 'uuid', '_id'],
      ['name', 'title'],
      ['customer', 'goodCustomer']
    ]);

    assert.deepEqual(memory.read(['test']), []);
    assert.deepEqual(memory.read(['id']), []);

    memory.write(['customer', 'id'], 4);
    memory.write(['goodCustomer', 'name'], 'Siegmeyer');
    memory.write(['customer', 'name'], 'Patches');
    memory.write(['customer', 'name'], null);

    assert.deepEqual(memory.read(['id']), [4]);
    assert.deepEqual(memory.read(['customer', 'id']), [4]);
    assert.deepEqual(memory.read(['goodCustomer', 'uuid']), [4]);
    assert.deepEqual(memory.read(['contract', '_id']), [4]);
    assert.deepEqual(
      memory.read(['goodCustomer', 'name']).sort(),
      ['Siegmeyer', 'Patches'].sort()
    );
    assert.deepEqual(
      memory.read(['customer', 'Name']).sort(),
      ['Siegmeyer', 'Patches'].sort()
    );

    memory.write(['goodCustomer'], {
      id: 999,
      Name: 'Solaire'
    });

    assert.deepEqual(memory.read(['anything', 'id']), [4, 999]);
    assert.deepEqual(
      memory.read(['customer', 'name']).sort(),
      ['Siegmeyer', 'Patches', 'Solaire'].sort()
    );
  });
});
