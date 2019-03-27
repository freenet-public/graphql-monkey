import * as assert from 'assert';
import { cli } from '../src/cli';

describe('From the cli module', () => {
  describe('the cli function', () => {
    it('should run the cli', async () => {
      assert.equal(await cli(['test/options.ts']), 1);
    });

    it('should run the cli', async () => {
      assert.equal(
        await cli(['test/options.ts', '-p', 'failures', '-p', 'memory']),
        1
      );
    });
  });
});
