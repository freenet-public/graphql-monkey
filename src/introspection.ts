import request, { Options } from 'request-promise-native';
import {
  GraphQLError,
  getIntrospectionQuery,
  IntrospectionNamedTypeRef,
  IntrospectionTypeRef,
  IntrospectionField,
  IntrospectionQuery,
  IntrospectionObjectType,
  IntrospectionInterfaceType
} from 'graphql';

export type Path = string[];

export interface Endpoint {
  field: IntrospectionField;
  parent?: Endpoint;
  on?: string;
}

export async function introspect(
  url: string,
  requestOptions?: Options
): Promise<IntrospectionQuery> {
  const body = await request({
    ...requestOptions,
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
    throw new Error('Introspection failed; no data');
  }

  return body.data;
}

export function requireTypeFromRef(introspection: IntrospectionQuery, typeRef: IntrospectionTypeRef) {
  const namedTypeRef = getNamedTypeRef(typeRef);
  return requireType(introspection, namedTypeRef.name);
}

export function getTypeFromRef(introspection: IntrospectionQuery, typeRef: IntrospectionTypeRef) {
  const namedTypeRef = getNamedTypeRef(typeRef);
  return getType(introspection, namedTypeRef.name);
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

export function requireObjectType(introspection: IntrospectionQuery, name: string) {
  const type = requireType(introspection, name);

  if (type.kind !== 'OBJECT') {
    throw new Error(`${name} type is not of kind OBJECT`);
  }

  return type;
}

export function requireType(introspection: IntrospectionQuery, name: string) {
  const type = getType(introspection, name);

  if (!type) {
    throw new Error(`Undefined type ${name}`);
  }

  return type;
}

export function getType(introspection: IntrospectionQuery, name: string) {
  return introspection.__schema.types.find(it => it.name === name);
}

export function requireField(type: IntrospectionObjectType | IntrospectionInterfaceType, name: string) {
  const field = getField(type, name);

  if (!field) {
    throw new Error(`Undefined field ${type.name}.${name}`);
  }

  return field;
}

export function getField(
  type: IntrospectionObjectType | IntrospectionInterfaceType,
  name: string
) {
  return type.fields.find(it => it.name === name);
}

export function getOperationTypeName(introspection: IntrospectionQuery, operation: string) {
  switch (operation) {
    case 'query':
      return introspection.__schema.queryType.name;
    case 'mutation':
      return introspection.__schema.mutationType ? introspection.__schema.mutationType.name : undefined;
    case 'subscription':
      return introspection.__schema.subscriptionType ? introspection.__schema.subscriptionType.name : undefined;
  }
}

export function isLeafField(field: IntrospectionField) {
  const namedTypeRef = getNamedTypeRef(field.type);

  return namedTypeRef.kind === 'SCALAR' || namedTypeRef.kind === 'ENUM';
}
