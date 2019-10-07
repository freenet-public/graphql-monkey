import request, { Options } from 'request-promise-native';
import {
  GraphQLError,
  getIntrospectionQuery,
  IntrospectionNamedTypeRef,
  IntrospectionTypeRef,
  IntrospectionQuery,
  IntrospectionObjectType,
  IntrospectionInterfaceType
} from 'graphql';
import { version } from '../package.json';

export async function introspect(
  url: string,
  requestOptions?: Options
): Promise<IntrospectionQuery> {
  try {
    const body = await request({
      ...requestOptions,
      headers: {
        'User-Agent': `graphql-monkey/${version}`,
        ...(requestOptions ? requestOptions.headers : undefined)
      },
      url,
      body: {
        query: getIntrospectionQuery({ descriptions: false })
      },
      json: true,
      method: 'POST'
    });

    if (body.errors && body.errors.length > 0) {
      throw new Error(
        `Introspection failed: ${body.errors
          .map((err: GraphQLError) => err.message)
          .join(', ')}`
      );
    }

    if (!body.data) {
      throw new Error('Introspection failed: No data');
    }

    return body.data;
  } catch (err) {
    err.message = `Introspection failed: ${err.message}`;
    throw err;
  }
}

export class IntrospectionHelper {
  public readonly data: IntrospectionQuery;

  constructor(data: IntrospectionQuery) {
    this.data = data;
  }

  public requireTypeFromRef(typeRef: IntrospectionTypeRef) {
    const namedTypeRef = this.getNamedTypeRef(typeRef);
    return this.requireType(namedTypeRef.name);
  }

  public getTypeFromRef(typeRef: IntrospectionTypeRef) {
    const namedTypeRef = this.getNamedTypeRef(typeRef);
    return this.getType(namedTypeRef.name);
  }

  public getNamedTypeRef(
    typeRef: IntrospectionTypeRef
  ): IntrospectionNamedTypeRef {
    return getNamedTypeRef(typeRef);
  }

  public requireQueryType() {
    return this.requireObjectType(this.requireOperationTypeName('query'));
  }

  public requireObjectType(name: string) {
    const type = this.requireType(name);

    if (type.kind !== 'OBJECT') {
      throw new Error(`${name} type is not of kind OBJECT`);
    }

    return type;
  }

  public requireInputObjectType(name: string) {
    const type = this.requireType(name);

    if (type.kind !== 'INPUT_OBJECT') {
      throw new Error(`${name} type is not of kind INPUT_OBJECT`);
    }

    return type;
  }

  public requireEnumType(name: string) {
    const type = this.requireType(name);

    if (type.kind !== 'ENUM') {
      throw new Error(`${name} type is not of kind ENUM`);
    }

    return type;
  }

  public requireType(name: string) {
    const type = this.getType(name);

    if (!type) {
      throw new Error(`Undefined type ${name}`);
    }

    return type;
  }

  public getType(name: string) {
    return this.data.__schema.types.find(it => it.name === name);
  }

  public requireField(
    type: IntrospectionObjectType | IntrospectionInterfaceType,
    name: string
  ) {
    const field = this.getField(type, name);

    if (!field) {
      throw new Error(`Undefined field ${type.name}.${name}`);
    }

    return field;
  }

  public getField(
    type: IntrospectionObjectType | IntrospectionInterfaceType,
    name: string
  ) {
    return type.fields.find(it => it.name === name);
  }

  public requireOperationTypeName(operation: string) {
    const t = this.getOperationTypeName(operation);

    if (!t) {
      throw new Error(`Undefined operation type for ${operation}`);
    }

    return t;
  }

  public getOperationTypeName(operation: string) {
    switch (operation) {
      case 'query':
        return this.data.__schema.queryType.name;
      case 'mutation':
        return this.data.__schema.mutationType
          ? this.data.__schema.mutationType.name
          : undefined;
      case 'subscription':
        return this.data.__schema.subscriptionType
          ? this.data.__schema.subscriptionType.name
          : undefined;
    }
  }
}

export function getNamedTypeRef(
  typeRef: IntrospectionTypeRef
): IntrospectionNamedTypeRef {
  switch (typeRef.kind) {
    case 'NON_NULL':
    case 'LIST':
      return getNamedTypeRef(typeRef.ofType);
    default:
      return typeRef;
  }
}
