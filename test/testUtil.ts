import { TestOptionsInput, makeOptions } from '../src/options';
import { introspect, IntrospectionHelper } from '../src/introspection';
import { Session } from '../src/session';
import { gqlm as testOptions } from './options';

export async function createTestSession(options: TestOptionsInput = {}) {
  const o = getTestOptions(options);
  return new Session(o, await introspect(o.url, o.requestOptions));
}

export async function createIntrospectionHelper(
  options: TestOptionsInput = {}
) {
  const o = getTestOptions(options);
  return new IntrospectionHelper(await introspect(o.url, o.requestOptions));
}

export function getTestOptions(options: TestOptionsInput = {}) {
  return makeOptions({
    ...testOptions(),
    ...options,
    requestOptions: {
      ...testOptions().requestOptions,
      ...options.requestOptions
    }
  });
}
