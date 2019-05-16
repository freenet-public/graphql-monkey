#!/usr/bin/env node
// tslint:disable:no-console
import { cli, HELP } from './cli';

cli(process.argv.slice(2))
  .then(exitCode => process.exit(exitCode))
  .catch(err => {
    console.error(err.stack);
    console.log(HELP);
    process.exit(1);
  });
