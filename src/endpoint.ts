import { IntrospectionField } from 'graphql';
import { TestResult } from './result';
import { getPossibleValuesAtPath, isSimpleField, flatMap } from './util';
import { IntrospectionHelper } from './introspection';

// an endpoint represents a non-trivial field in a graphql schema
// non-trivial = has arguments or is an object field
// also holds data about test results
export class TestEndpoint {
  public readonly field: IntrospectionField;
  public readonly parent?: TestEndpoint;
  public readonly on?: string;
  public readonly results: TestResult[] = [];

  constructor(field: IntrospectionField, parent?: TestEndpoint, on?: string) {
    this.field = field;
    this.parent = parent;
    this.on = on;
  }

  public getId(): string {
    const suffix = this.on ? `${this.field.name}<${this.on}>` : this.field.name;
    return this.parent ? `${this.parent.getId()}.${suffix}` : suffix;
  }

  public expand(introspection: IntrospectionHelper): TestEndpoint[] {
    const type = introspection.requireTypeFromRef(this.field.type);

    if (type.kind === 'OBJECT' && this.getNonNullResults().length > 0) {
      return type.fields
        .filter(it => !isSimpleField(it))
        .map(field => new TestEndpoint(field, this));
    }

    if (type.kind === 'INTERFACE' || type.kind === 'UNION') {
      return flatMap(type.possibleTypes.slice(0), possibleTypeRef => {
        const possibleType = introspection.requireTypeFromRef(possibleTypeRef);

        if (
          possibleType.kind !== 'OBJECT' ||
          this.getNonNullResultsOfType(possibleType.name).length === 0
        ) {
          return [] as TestEndpoint[];
        }

        return possibleType.fields
          .filter(it => !isSimpleField(it))
          .map(field => new TestEndpoint(field, this, possibleType.name));
      });
    }

    return [];
  }

  public getSuccessfulResults() {
    return this.results.filter(result => !result.failed);
  }

  public getPath(): string[] {
    return this.parent
      ? this.parent.getPath().concat([this.field.name])
      : [this.field.name];
  }

  public getErrors() {
    return flatMap(this.results, result => result.errors || []);
  }

  public getSpecificErrors() {
    return this.getErrors().filter(
      error => (error.path || []).join('.') === this.getPath().join('.')
    );
  }

  public getNonNullResultsOfType(typename: string) {
    const path = this.getPath();
    return this.getNonNullResults().filter(result => {
      return (
        getPossibleValuesAtPath(result.data, path.concat('__typename')).indexOf(
          typename
        ) >= 0
      );
    });
  }

  public getNonNullResults() {
    const path = this.getPath();

    return this.results.filter(result => {
      if (!this.on) {
        return getPossibleValuesAtPath(result.data, path).length > 0;
      }

      const possibleParents = getPossibleValuesAtPath(
        result.data,
        path.slice(0, -1)
      ).filter(value => value.__typename === this.on);

      return (
        getPossibleValuesAtPath(possibleParents, path.slice(-1)).length > 0
      );
    });
  }
}
