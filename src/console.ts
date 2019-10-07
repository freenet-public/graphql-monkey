// tslint:disable:no-console
import { TestOptions } from './options';
import chalk from 'chalk';
import { format } from 'prettier';
import { TestResult } from './result';
import { Memory } from './memory';
import { PrintConfig } from './cli';
import {
  TestReport,
  TypeReport,
  ObjectTypeReport,
  FieldReport,
  EnumTypeReport,
  EnumValueReport,
  ScalarTypeReport
} from './report';

export class ConsoleReporter {
  public printSummary(report: TestReport, options: TestOptions) {
    this.print('SUMMARY');
    this.print('');

    this.print(`    ${report.requestCount} tests`);

    if (report.failedCount === 1) {
      this.printRed(`    ${report.failedCount} failed test`);
    } else if (report.failedCount > 0) {
      this.printRed(`    ${report.failedCount} failed tests`);
    } else {
      this.printGreen(`    ${report.failedCount} failed tests`);
    }

    this.printGray(`    ${report.errorCount} total GraphQL errors`);

    if (report.unexpectedErrorCount > 0) {
      this.printRed(
        `    ${report.unexpectedErrorCount} unexpected GraphQL errors`
      );
    } else {
      this.printGreen(
        `    ${report.unexpectedErrorCount} unexpected GraphQL errors`
      );
    }

    this.print(`    ${this.coverageString(report.coverage)} covered`);
    this.print('');

    this.print(`    Status codes:`);
    report.statusCodes.forEach(r => {
      if (r.key === 0 || r.key >= 500) {
        this.printRed(`        ${r.count}x ${r.key}`);
      } else if (r.key >= 400) {
        this.printYellow(`        ${r.count}x ${r.key}`);
      } else {
        this.printGreen(`        ${r.count}x ${r.key}`);
      }
    });

    if (report.errorMessages.length > 0) {
      this.printGray(`    All GraphQL error messages:`);
      report.errorMessages.forEach(r => {
        this.printGray(`        ${r.count}x ${r.key}`);
      });
    }

    if (report.errorCodes.length > 0) {
      this.print(`    All GraphQL error codes:`);
      report.errorCodes.forEach(r => {
        this.printGray(`        ${r.count}x ${r.key}`);
      });
    }

    if (report.unexpectedErrorMessages.length > 0) {
      this.print(`    Unexpected GraphQL error messages:`);
      report.unexpectedErrorMessages.forEach(r => {
        this.printRed(`        ${r.count}x ${r.key}`);
      });
    }

    if (report.unexpectedErrorCodes.length > 0) {
      this.print(`    Unexpected GraphQL error codes:`);
      report.unexpectedErrorCodes.forEach(r => {
        this.printRed(`        ${r.count}x ${r.key}`);
      });
    }

    this.printReponseTimes(report);
    this.printSeed(options.seed);
  }

  public printReponseTimes(report: TestReport) {
    this.print(`    Response times:
        avg: ${report.responseTimes.avg.toFixed(0)} ms
        min: ${report.responseTimes.min.toFixed(0)} ms
        max: ${report.responseTimes.max.toFixed(0)} ms`);
  }

  public printSeed(seed: string) {
    this.print('');
    this.print(`    Seed was ${seed}`);
    this.print('');
  }

  public printResult(result: TestResult, printConfig: PrintConfig) {
    if (result.failed) {
      if (printConfig.requests || printConfig.failures) {
        this.printYellow(format(result.query, { parser: 'graphql' }));

        if (result.requestError) {
          this.print(
            chalk.red(
              indent(
                result.requestError.stack ||
                  result.requestError.message ||
                  'Request Error',
                4
              )
            )
          );
          this.print('');
        }

        if (printConfig.responses && result.data) {
          this.print(
            chalk.gray(indent(JSON.stringify(result.data, null, 2), 4))
          );
          this.print('');
        }

        if ((printConfig.responses || printConfig.errors) && result.errors) {
          for (const error of result.errors) {
            this.print(chalk.gray(indent(JSON.stringify(error, null, 2), 4)));
            this.print('');
          }
        }

        for (const error of result.unexpectedErrors) {
          this.print(chalk.red(indent(JSON.stringify(error, null, 2), 4)));
          this.print('');
        }

        this.print(`    ${result.responseTime} ms`);
        this.print('');
      }
    } else if (printConfig.requests) {
      this.print(chalk.green(format(result.query, { parser: 'graphql' })));

      if (printConfig.responses && result.data) {
        this.print(chalk.gray(indent(JSON.stringify(result.data, null, 2), 4)));
        this.print('');
      }

      if ((printConfig.responses || printConfig.errors) && result.errors) {
        for (const error of result.errors) {
          this.print(chalk.gray(indent(JSON.stringify(error, null, 2), 8)));
          this.print('');
        }
      }

      this.print(`    ${result.responseTime} ms`);
      this.print('');
    }
  }

  public printMemory(memory: Memory) {
    this.print(`MEMORY`);
    this.print('');
    this.print(indent(JSON.stringify(memory.serialize(), null, 2), 4));
    this.print('');
  }

  public printTypes(report: TestReport) {
    this.print(`TYPES`);
    this.print('');

    for (const it of report.types) {
      this.printTypeReport(it);
    }
  }

  public printTypeReport(report: TypeReport) {
    switch (report.kind) {
      case 'OBJECT':
        this.printObjectTypeReport(report);
        break;
      case 'ENUM':
        this.printEnumTypeReport(report);
        break;
      case 'SCALAR':
        this.printScalarTypeReport(report);
        break;
    }
  }

  public printObjectTypeReport(report: ObjectTypeReport) {
    this.print(
      `    type ${report.name} ${this.coverageString(report.coverage)} {`
    );
    report.fields.forEach(it => this.printFieldReport(it));
    this.print('    }');
    this.print('');
  }

  public printFieldReport(report: FieldReport) {
    this.print(`      ${report.name} ${this.countString(report.count)}`);
  }

  public printEnumTypeReport(report: EnumTypeReport) {
    this.print(
      `    enum ${report.name} ${this.coverageString(report.coverage)} {`
    );
    report.values.forEach(it => this.printEnumValueReport(it));
    this.print('    }');
    this.print('');
  }

  public printEnumValueReport(report: EnumValueReport) {
    this.print(`      ${report.name} ${this.countString(report.count)}`);
  }

  public printScalarTypeReport(report: ScalarTypeReport) {
    this.print(`    scalar ${report.name} ${this.countString(report.count)}`);
    this.print('');
  }

  public coverageString(p: number) {
    const t = `${Math.floor(p * 100)}%`;
    if (p < 0.5) {
      return this.red(t);
    } else if (p < 0.8) {
      return this.yellow(t);
    } else {
      return this.green(t);
    }
  }

  public countString(c: number) {
    if (c > 0) {
      return this.green(`${c}x`);
    } else {
      return this.yellow(`${c}x`);
    }
  }

  public errorCountString(c: number) {
    if (c > 0) {
      return this.red(`${c}x`);
    } else {
      return this.green(`${c}x`);
    }
  }

  public printGreen(text: string) {
    this.print(this.green(text));
  }

  public printYellow(text: string) {
    this.print(this.yellow(text));
  }

  public printRed(text: string) {
    this.print(this.red(text));
  }

  public printGray(text: string) {
    this.print(this.gray(text));
  }

  public green(text: string) {
    return chalk.green(text);
  }

  public yellow(text: string) {
    return chalk.yellow(text);
  }

  public red(text: string) {
    return chalk.red(text);
  }

  public gray(text: string) {
    return chalk.gray(text);
  }

  public print(text: string) {
    console.log(text);
  }
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
