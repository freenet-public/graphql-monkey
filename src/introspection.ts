import request, { Options } from 'request-promise-native';
import {
  GraphQLError,
  getIntrospectionQuery,
  IntrospectionNamedTypeRef,
  IntrospectionTypeRef,
  IntrospectionField,
  IntrospectionQuery
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
