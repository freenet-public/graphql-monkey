import * as assert from 'assert';
import { buildReport, TestReport } from '../src/report';
import { gqlm as testOptions } from './options';
import { Session } from '../src/session';
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';

describe('From the report module', () => {
  describe('the buildReport function', () => {
    it('should build a report', async () => {
      const session = new Session(testOptions());
      await session.init();
      const results = await session.run();
      const report = buildReport(results, session.getIntrospection());

      const actual = JSON.stringify(ignoreResponseTimes(report), null, 2);
      const expected = JSON.stringify(
        ignoreResponseTimes(require('./report.expected.json')),
        null,
        2
      );

      writeFileSync('test/report.actual.json', actual);

      assert.equal(
        createHash('sha256')
          .update(actual)
          .digest('hex'),
        createHash('sha256')
          .update(expected)
          .digest('hex'),
        'Report diff; compare test/report.actual.json with test/report.expected.json'
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
