import { IntrospectionField, SelectionNode, visit, ASTNode } from 'graphql';
import { getNamedTypeRef } from './introspection';

export function firstOf<T>(x: T[] | T): T {
  return Array.isArray(x) ? x[0] : x;
}

export function asArray<T>(x: T[] | T): T[] {
  if (x === null || typeof x === 'undefined') {
    return [];
  }

  return Array.isArray(x) ? x : [x];
}

export function flat<T>(array: T[]) {
  return array.reduce<T[]>((l, ll) => l.concat(ll), []);
}

export function flatMap<S, T>(
  array: S[],
  mapping: (item: S, index: number) => T
) {
  return flat(array.map(mapping));
}

export function getPossibleValuesAtPath(data: any, path: string[]): any[] {
  if (data === null || typeof data === 'undefined') {
    return [];
  } else if (Array.isArray(data)) {
    return flatMap(data, it => getPossibleValuesAtPath(it, path));
  } else if (path.length === 0) {
    return [data];
  }  else if (typeof data === 'object') {
    return getPossibleValuesAtPath(data[path[0]], path.slice(1));
  } else {
    return [];
  }
}

export function isSimpleField(field: IntrospectionField) {
  return field.args.length === 0 && isLeafField(field);
}

export function rewriteSelections<T extends ASTNode>(
  op: T,
  path: string[],
  selections: SelectionNode[]
): T {
  let index = 0;

  return visit(op, {
    Field: {
      enter(node) {
        if (node.name.value !== path[index]) {
          return false;
        }

        ++index;
      },
      leave(node) {
        --index;

        if (index === path.length - 1) {
          return {
            ...node,
            selectionSet: {
              kind: 'SelectionSet',
              selections
            }
          };
        }
      }
    }
  });
}

export function isLeafField(field: IntrospectionField) {
  const namedTypeRef = getNamedTypeRef(field.type);

  return namedTypeRef.kind === 'SCALAR' || namedTypeRef.kind === 'ENUM';
}
