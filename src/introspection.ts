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

export function isLeafField(field: IntrospectionField) {
  const namedTypeRef = getNamedTypeRef(field.type);

  return namedTypeRef.kind === 'SCALAR' || namedTypeRef.kind === 'ENUM';
}

export function getIntrospectionType(introspection: IntrospectionQuery, name: string) {
  return introspection.__schema.types.find(it => it.name === name);
}

export function getIntrospectionField(
  type: IntrospectionObjectType | IntrospectionInterfaceType,
  name: string
) {
  return type.fields.find(it => it.name === name);
}

export function getIntrospectionOperationTypeName(introspection: IntrospectionQuery, operation: string) {
  switch (operation) {
    case 'query':
      return introspection.__schema.queryType.name;
    case 'mutation':
      return introspection.__schema.mutationType ? introspection.__schema.mutationType.name : undefined;
    case 'subscription':
      return introspection.__schema.subscriptionType ? introspection.__schema.subscriptionType.name : undefined;
  }
}
