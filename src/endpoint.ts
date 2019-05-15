import { IntrospectionField } from 'graphql';
import { TestResult } from './result';
import { GraphQLError } from 'graphql';
import { dataIsDefinedAtPath, isSimpleField } from './util';
import { IntrospectionHelper, getNamedTypeRef } from './introspection';

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

  public expand(introspection: IntrospectionHelper): TestEndpoint[] {
    const type = introspection.requireTypeFromRef(this.field.type);

    if (type.kind === 'OBJECT') {
      return type.fields
        .filter(it => !isSimpleField(it))
        .map(field => new TestEndpoint(field, this));
    }

    if (type.kind === 'INTERFACE' || type.kind === 'UNION') {
      return type.possibleTypes
        .map(possibleTypeRef => {
          const possibleType = introspection.requireTypeFromRef(
            possibleTypeRef
          );

          if (possibleType.kind !== 'OBJECT') {
            return [];
          }

          return possibleType.fields
            .filter(it => !isSimpleField(it))
            .map(field => new TestEndpoint(field, this, possibleType.name));
        })
        .reduce((l, ll) => l.concat(ll), []);
    }

    return [];
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
    const typeRef = this.field.type;
    const namedTypeRef = getNamedTypeRef(typeRef);
    const path = this.getPath();
    return this.results.filter(result =>
      dataIsDefinedAtPath(result.data, path, this.on || namedTypeRef.name)
    );
  }
}
