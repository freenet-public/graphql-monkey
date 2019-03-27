// tslint:disable:no-console
import { TestOptions } from './options';
import chalk from 'chalk';
import { format } from 'prettier';
import { TestResult } from './result';

// TODO tranform into class with methods computing/returning aggregates
export interface TestReport {
  options: TestOptions;
  results: TestResult[];
  requestCount: number;
  failedCount: number;
  statusCodes: Map<number, number>;
  errorCount: number;
  errorMessages: Map<string, number>;
  errorCodes: Map<string, number>;
  unexpectedErrorCount: number;
  unexpectedErrorMessages: Map<string, number>;
  unexpectedErrorCodes: Map<string, number>;
  requestErrorCount: number;
  responseTimes: {
    avg: number;
    min: number;
    max: number;
    total: number;
  };
}

export function createReport(results: TestResult[], options: TestOptions) {
  const r = results.reduce<TestReport>(
    (report: TestReport, result: TestResult) => {
      ++report.requestCount;

      if (result.failed) {
        ++report.failedCount;
      }

      if (result.requestError) {
        ++report.requestErrorCount;
      }

      report.statusCodes.set(
        result.statusCode,
        (report.statusCodes.get(result.statusCode) || 0) + 1
      );

      if (result.errors) {
        for (const error of result.errors) {
          ++report.errorCount;
          report.errorMessages.set(
            error.message,
            (report.errorMessages.get(error.message) || 0) + 1
          );
          if (error.extensions && error.extensions.code) {
            report.errorCodes.set(
              error.extensions.code,
              (report.errorCodes.get(error.extensions.code) || 0) + 1
            );
          }
        }
      }

      for (const error of result.unexpectedErrors) {
        ++report.unexpectedErrorCount;
        report.unexpectedErrorMessages.set(
          error.message,
          (report.unexpectedErrorMessages.get(error.message) || 0) + 1
        );
        if (error.extensions && error.extensions.code) {
          report.unexpectedErrorCodes.set(
            error.extensions.code,
            (report.unexpectedErrorCodes.get(error.extensions.code) || 0) + 1
          );
        }
      }

      report.responseTimes.total += result.responseTime;
      report.responseTimes.avg =
        report.responseTimes.total / report.requestCount;
      report.responseTimes.min = Math.min(
        report.responseTimes.min,
        result.responseTime
      );
      report.responseTimes.max = Math.max(
        report.responseTimes.max,
        result.responseTime
      );

      return report;
    },
    {
      options,
      results,
      requestCount: 0,
      failedCount: 0,
      statusCodes: new Map<number, number>(),
      errorCount: 0,
      errorMessages: new Map<string, number>(),
      errorCodes: new Map<string, number>(),
      unexpectedErrorCount: 0,
      unexpectedErrorMessages: new Map<string, number>(),
      unexpectedErrorCodes: new Map<string, number>(),
      requestErrorCount: 0,
      responseTimes: {
        avg: 0,
        min: 999999,
        max: 0,
        total: 0
      }
    }
  );

  return r;
}

export function printResultToConsole(result: TestResult) {
  if (result.failed) {
    console.log(chalk.yellow(format(result.query, { parser: 'graphql' })));
    if (result.requestError) {
      console.log(
        chalk.red(
          indent(
            result.requestError.message ||
              result.requestError.stack ||
              'Request Error',
            4
          )
        )
      );
      console.log('');
    }
    for (const error of result.unexpectedErrors) {
      console.log(chalk.red(indent(JSON.stringify(error, null, 2), 4)));
      console.log('');
    }
  } else if (result.options.verbose) {
    console.log(chalk.green(format(result.query, { parser: 'graphql' })));
    if (result.requestError) {
      console.log(
        chalk.gray(
          indent(
            result.requestError.message ||
              result.requestError.stack ||
              'Request Error',
            4
          )
        )
      );
      console.log('');
    }
    if (result.data) {
      console.log(chalk.gray(indent(JSON.stringify(result.data, null, 2), 4)));
      console.log('');
    }
    if (result.errors) {
      for (const error of result.errors) {
        console.log(chalk.gray(indent(JSON.stringify(error, null, 2), 8)));
        console.log('');
      }
    }
  }
  if (result.options.verbose) {
    console.log(`    ${result.responseTime} ms`);
    console.log('');
  }
}

export function printReportToConsole(report: TestReport) {
  console.log('STATS');
  console.log(`    Request Count:          ${report.requestCount}`);

  if (report.failedCount > 0) {
    console.log(
      `    Failed Requests:        ${chalk.red(`${report.failedCount}`)}`
    );
  } else {
    console.log(
      `    Failed Requests:        ${chalk.green(`${report.failedCount}`)}`
    );
  }

  if (report.unexpectedErrorCount > 0) {
    console.log(
      `    Unexpected Error Count: ${chalk.red(
        `${report.unexpectedErrorCount}`
      )}`
    );
  } else {
    console.log(
      `    Unexpected Error Count: ${chalk.green(
        `${report.unexpectedErrorCount}`
      )}`
    );
  }

  console.log(
    `    Total Error Count:      ${chalk.gray(`${report.errorCount}`)}`
  );
  console.log(`    Status Codes:`);
  report.statusCodes.forEach((count, statusCode) => {
    if (statusCode === 0 || statusCode >= 500) {
      console.log(chalk.red(`        ${count}x ${statusCode}`));
    } else if (statusCode >= 400) {
      console.log(chalk.yellow(`        ${count}x ${statusCode}`));
    } else {
      console.log(chalk.green(`        ${count}x ${statusCode}`));
    }
  });

  if (report.unexpectedErrorMessages.size > 0) {
    console.log(`    Unexpected Error Messages:`);
    report.unexpectedErrorMessages.forEach((count, message) => {
      console.log(`        ${count}x ${chalk.red(message)}`);
    });
  }

  if (report.unexpectedErrorCodes.size > 0) {
    console.log(`    Unexpected Error Codes:`);
    report.unexpectedErrorCodes.forEach((count, code) => {
      console.log(`        ${count}x ${chalk.red(code)}`);
    });
  }

  if (report.errorMessages.size > 0) {
    console.log(`    All Error Messages:`);
    report.errorMessages.forEach((count, message) => {
      console.log(`        ${count}x ${chalk.gray(message)}`);
    });
  }

  if (report.errorCodes.size > 0) {
    console.log(`    All Error Codes:`);
    report.errorCodes.forEach((count, code) => {
      console.log(`        ${count}x ${chalk.gray(code)}`);
    });
  }

  console.log(`    Response Times:`);
  console.log(`        avg: ${report.responseTimes.avg.toFixed(0)} ms`);
  console.log(`        min: ${report.responseTimes.min.toFixed(0)} ms`);
  console.log(`        max: ${report.responseTimes.max.toFixed(0)} ms`);

  console.log('');
  console.log(`Seed was ${report.options.seed}`);
}

export function indent(text: string, size: number) {
  let spaces = '';

  while (size > 0) {
    spaces += ' ';
    --size;
  }

  return text
    .split(/\n/g)
    .map(it => spaces + it)
    .join('\n');
}
