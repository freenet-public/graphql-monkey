// tslint:disable:no-console
import minimist from 'minimist';
import { TestOptionsInput, makeOptions } from './options';
import * as path from 'path';
import {
  printReportToConsole,
  printResultToConsole,
  createReport
} from './report';
import { firstOf, asArray } from './util';
import { Session } from './session';

const { version } = require('../package.json');

export interface CliArgs {
  count?: string;
  exit: boolean;
  help: boolean;
  randomization?: string;
  require: string[];
  seed?: string;
  timeout?: string;
  url?: string;
  verbose: boolean;
  version: boolean;
  _: string[];
}

export const HELP = `
graphql-monkey [options] [options file]
  -n, --count           Set number of tests (default: 5)
  -e, --exit            Exit on first error
  -h, --help            Print help
  -f, --randomization   Set randomization factor (default: 0.2)
  -r, --require         Require the given module
  -s, --seed            Set randomization seed
  -t, --timeout         Set timeout (ms) per request (default: 2000)
      --url             Set GraphQL endpoint URL
      --verbose         Enable verbose output
      --version         Print version
`;

export async function cli(argv: string[]): Promise<number> {
  try {
    const args = parseCliArgs(argv);

    // early exits
    if (args.version) {
      console.log(version);
      return 0;
    } else if (args.help) {
      console.log(HELP);
      return 0;
    }

    for (const m of args.require) {
      require(m);
    }

    let optionsFromFile: TestOptionsInput = {};

    if (args._.length === 1) {
      const loader = require(path.resolve(process.cwd(), args._[0]));
      if (typeof loader === 'function') {
        optionsFromFile = await loader();
      } else if (loader && typeof loader.gqlm === 'function') {
        optionsFromFile = await loader.gqlm();
      } else {
        console.error(
          'Invalid options file; must export function as default or "gqlm".'
        );
        return 1;
      }
    } else if (args._.length > 1) {
      console.error('Please provide at most one options file.');
      return 1;
    }

    const originalResultCallback = optionsFromFile.resultCallback;
    const options = makeOptions({
      ...optionsWithCliArgs(optionsFromFile, args),
      resultCallback: result => {
        const r = originalResultCallback
          ? originalResultCallback(result)
          : result;
        if (r) {
          printResultToConsole(r);
        }
        return r;
      }
    });

    const session = new Session(options);

    await session.init();
    await session.run();

    const report = createReport(session.getResults(), options);
    printReportToConsole(report);
    return report.failedCount > 0 ? 1 : 0;
  } catch (err) {
    console.error(err.stack);
    return 1;
  }
}

export function optionsWithCliArgs(options: TestOptionsInput, args_: CliArgs) {
  const result: TestOptionsInput = { ...options };

  if (args_.count) {
    result.count = parseInt(args_.count, 10);
  }
  if (args_.exit) {
    result.exit = true;
  }
  if (args_.timeout) {
    result.timeout = parseInt(args_.timeout, 10);
  }
  if (args_.randomization) {
    result.randomization = parseFloat(args_.randomization);
  }
  if (args_.seed) {
    result.seed = args_.seed;
  }
  if (args_.verbose) {
    result.verbose = true;
  }
  if (args_.url) {
    result.url = args_.url;
  }

  return result;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const parsed = minimist(argv, {
    string: ['count', 'randomization', 'require', 'seed', 'timeout', 'url'],
    boolean: ['exit', 'help', 'verbose', 'version'],
    alias: {
      count: 'n',
      exit: 'e',
      help: 'h',
      randomization: 'f',
      require: 'r',
      seed: 's',
      timeout: 't'
    }
  });

  return {
    ...parsed,
    count: firstOf(parsed.count),
    randomization: firstOf(parsed.randomization),
    require: asArray(parsed.require),
    seed: firstOf(parsed.seed),
    timeout: firstOf(parsed.timeout),
    url: firstOf(parsed.url)
  } as CliArgs;
}
