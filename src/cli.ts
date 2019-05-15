// tslint:disable:no-console
import minimist from 'minimist';
import { TestOptionsInput, makeOptions } from './options';
import * as path from 'path';
import { ConsoleReporter } from './console';
import { firstOf, asArray } from './util';
import { Session } from './session';
import { buildReport } from './report';

const { version } = require('../package.json');

export interface CliArgs {
  count?: string;
  exit: boolean;
  help: boolean;
  print: PrintConfig;
  require: string[];
  seed?: string;
  timeout?: string;
  url?: string;
  version: boolean;
  _: string[];
}

export interface PrintConfig {
  requests: boolean;
  responses: boolean;
  errors: boolean;
  failures: boolean;
  memory: boolean;
  types: boolean;
}

export const HELP = `
graphql-monkey [options] [options file]
  -n, --count           Set number of tests (default: 5)
  -e, --exit            Exit on first error
  -h, --help            Print help
  -p, --print           Configure console output (default: requests, responses)
                        Possible values:
                          requests: Print requests
                          responses: Print responses
                          errors: Print errors
                          failures: Print requests and errors for failed tests
                          memory: Print memory
                          types: Print a report for each GraphQL type (with coverage)
  -r, --require         Require the given module
  -s, --seed            Set randomization seed
  -t, --timeout         Set timeout (ms) per request (default: 2000)
      --url             Set GraphQL endpoint URL
      --version         Print version
`;

export async function cli(argv: string[]): Promise<number> {
  const args = parseCliArgs(argv);

  // early exits
  if (args.version) {
    console.log(version);
    return 0;
  } else if (args.help || argv.length === 0) {
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

  const reporter = new ConsoleReporter();
  const originalResultCallback = optionsFromFile.resultCallback;
  const options = makeOptions({
    ...optionsWithCliArgs(optionsFromFile, args),
    resultCallback: result => {
      const r = originalResultCallback
        ? originalResultCallback(result)
        : result;
      if (r) {
        reporter.printResult(r, args.print);
      }
      return r;
    }
  });

  const session = new Session(options);

  await session.init();
  await session.run();

  const report = buildReport(session.getResults(), session.getIntrospection());

  if (args.print.memory) {
    reporter.printMemory(session.memory);
  }

  if (args.print.types) {
    reporter.printTypes(report);
  }

  reporter.printSummary(report, options);

  return report.failedCount > 0 ? 1 : 0;
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
  if (args_.seed) {
    result.seed = args_.seed;
  }
  if (args_.url) {
    result.url = args_.url;
  }

  return result;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const parsed = minimist(argv, {
    string: ['count', 'print', 'require', 'seed', 'timeout', 'url'],
    boolean: ['exit', 'help', 'version'],
    alias: {
      count: 'n',
      exit: 'e',
      help: 'h',
      print: 'p',
      require: 'r',
      seed: 's',
      timeout: 't'
    }
  });

  let print = asArray(parsed.print);
  if (print.length === 0) {
    print = ['requests', 'responses'];
  }

  return {
    ...parsed,
    count: firstOf(parsed.count),
    print: {
      requests: print.indexOf('requests') >= 0,
      responses: print.indexOf('responses') >= 0,
      errors: print.indexOf('errors') >= 0,
      failures: print.indexOf('failures') >= 0,
      memory: print.indexOf('memory') >= 0,
      types: print.indexOf('types') >= 0
    },
    require: asArray(parsed.require),
    seed: firstOf(parsed.seed),
    timeout: firstOf(parsed.timeout),
    url: firstOf(parsed.url)
  } as CliArgs;
}
