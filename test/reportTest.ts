import * as assert from 'assert';
import { buildReport, TestReport } from '../src/report';
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { createTestSession, createIntrospectionHelper } from './testUtil';

describe('From the report module', () => {
  describe('the buildReport function', () => {
    it('should build a report', async () => {
      const session = await createTestSession();
      const introspection = await createIntrospectionHelper();
      const results = await session.run();
      const report = buildReport(results, introspection);

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
