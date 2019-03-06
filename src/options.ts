import { Options } from 'request-promise-native';
import { GraphQLError } from 'graphql';
import { Chance } from 'chance';
import { TestResult } from './result';
import { TestEndpoint } from './endpoint';

export interface TestOptionsInput {
  url?: string;
  count?: number;
  randomization?: number;
  exit?: boolean;
  timeout?: number;
  verbose?: boolean;
  seed?: string;
  requestOptions?: Options;
  aliases?: string[][];
  data?: any;
  endpointCallback?: (
    endpoint: TestEndpoint
  ) => TestEndpoint | null | undefined;
  errorCallback?: (error: GraphQLError, options: TestOptions) => boolean;
  resultCallback?: (result: TestResult) => TestResult | null | undefined;
}

export interface TestOptions {
  url: string;
  count: number;
  randomization: number;
  exit: boolean;
  timeout: number;
  verbose: boolean;
  seed: string;
  requestOptions: Options;
  aliases: string[][];
  data: any;
  endpointCallback?: (
    endpoint: TestEndpoint
  ) => TestEndpoint | null | undefined;
  errorCallback?: (error: GraphQLError, options: TestOptions) => boolean;
  resultCallback?: (result: TestResult) => TestResult | null | undefined;
}

export const BASE_OPTIONS: TestOptions = {
  url: '',
  count: 5,
  randomization: 0.2,
  exit: false,
  timeout: 2000,
  verbose: false,
  seed: new Chance().guid(),
  aliases: [],
  requestOptions: { url: '' },
  data: {}
};

export function makeOptions(optionsInput: TestOptionsInput) {
  const options: TestOptions = {
    ...BASE_OPTIONS,
    ...optionsInput
  };

  if (!options.url) {
    throw new Error('Missing URL');
  }

  return options;
}
