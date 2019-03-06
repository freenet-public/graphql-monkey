#!/usr/bin/env node
import { cli } from './cli';

cli(process.argv.slice(2)).then(exitCode => process.exit(exitCode));
