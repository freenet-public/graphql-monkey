import * as assert from 'assert';
import { ConsoleReporter } from '../src/console';
import { buildReport } from '../src/report';
import { gqlm as testOptions } from './options';
import { Session } from '../src/session';

describe('From the console module', () => {
  describe('the ConsoleReporter class', () => {
    it('should print reports', async () => {
      const options = {
        ...testOptions()
      };
      const session = new Session(options);
      await session.init();
      const results = await session.run();
      const report = buildReport(results, session.getIntrospection());
      const reporter = new ConsoleReporter();
      reporter.printMemory(session.memory);
      reporter.printTypes(report);
      reporter.printSummary(report, options);
    });
  });
});
