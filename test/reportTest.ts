import * as assert from 'assert';
import { printReportToConsole, createReport } from '../src/report';
import { gqlm as testOptions } from './options';
import { Session } from '../src/session';

describe('From the report module', () => {
  describe('the printReportToConsole function', () => {
    it('should print a report', async () => {
      const options = {
        ...testOptions()
      };
      const session = new Session(options);
      await session.init();
      const results = await session.run();
      const report = createReport(results, options);
      printReportToConsole(report);
    });
  });
});
