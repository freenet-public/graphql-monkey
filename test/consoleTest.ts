import { ConsoleReporter } from '../src/console';
import { buildReport } from '../src/report';
import {
  createTestSession,
  createIntrospectionHelper,
  getTestOptions
} from './testUtil';

describe('From the console module', () => {
  describe('the ConsoleReporter class', () => {
    it('should print reports', async () => {
      const session = await createTestSession();
      const introspection = await createIntrospectionHelper();
      const options = getTestOptions();
      const results = await session.run();
      const report = buildReport(results, introspection);
      const reporter = new ConsoleReporter();
      reporter.printMemory(session.memory);
      reporter.printTypes(report);
      reporter.printSummary(report, options);
    });
  });
});
