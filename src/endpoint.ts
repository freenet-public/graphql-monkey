import { IntrospectionField } from 'graphql';
import { TestResult } from './result';
import { GraphQLError } from 'graphql';
import { dataIsDefinedAtPath } from './util';

// and endpoint represents a non-trivial field in a graphql schema
// non-trivial = has arguments or is an object field
// also holds data about test results
export class TestEndpoint {
  public readonly field: IntrospectionField;
  public readonly parent?: TestEndpoint;
  public readonly results: TestResult[] = [];
  public readonly workingArgs: Array<Map<string, any>> = [];

  constructor(field: IntrospectionField, parent?: TestEndpoint) {
    this.field = field;
    this.parent = parent;
  }

  public getSuccessfulResults() {
    return this.results.filter(result => !result.failed);
  }

  public getRequiredArgs() {
    return this.field.args.filter(arg => arg.type.kind === 'NON_NULL');
  }

  public getPath(): string[] {
    return this.parent
      ? this.parent.getPath().concat([this.field.name])
      : [this.field.name];
  }

  public getErrors() {
    return this.results.reduce<GraphQLError[]>(
      (errors, result) => errors.concat(result.errors || []),
      []
    );
  }

  public getSpecificErrors() {
    return this.getErrors().filter(
      error => (error.path || []).join('.') === this.getPath().join('.')
    );
  }

  public getNonNullResults() {
    const path = this.getPath();
    return this.results.filter(result =>
      dataIsDefinedAtPath(result.data, path)
    );
  }
}
