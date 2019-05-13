import * as assert from 'assert';
import { buildReport, TestReport } from '../src/report';
import { gqlm as testOptions } from './options';
import { Session } from '../src/session';
import { writeFileSync } from 'fs';

describe('From the report module', () => {
  describe('the buildReport function', () => {
    it('should build a report', async () => {
      const session = new Session(testOptions());
      await session.init();
      const results = await session.run();
      const report = buildReport(results, session.getIntrospection());

      writeFileSync('test/report.actual.json', JSON.stringify(report, null, 2));

      assert.deepEqual(
        ignoreResponseTimes(report),
        ignoreResponseTimes(require('./report.json'))
      );
    });

    function ignoreResponseTimes(report: TestReport): TestReport {
      return {
        ...report,
        results: report.results.map(it => {
          return {
            ...it,
            responseTime: 0
          };
        }),
        responseTimes: {
          avg: 0,
          max: 0,
          min: 0,
          total: 0
        }
      };
    }
  });
});
