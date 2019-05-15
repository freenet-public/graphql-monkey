import { IntrospectionField, SelectionNode, visit, ASTNode } from 'graphql';
import { isLeafField } from './introspection';

export function firstOf<T>(x: T[] | T): T {
  return Array.isArray(x) ? x[0] : x;
}

export function asArray<T>(x: T[] | T): T[] {
  if (x === null || typeof x === 'undefined') {
    return [];
  }

  return Array.isArray(x) ? x : [x];
}

export function dataIsDefinedAtPath(
  data: any,
  path: string[],
  typename?: string
): boolean {
  if (data === null || typeof data === 'undefined') {
    return false;
  } else if (Array.isArray(data)) {
    return (
      data.filter(it => dataIsDefinedAtPath(it, path, typename)).length > 0
    );
  } else if (path.length === 0) {
    if (data.__typename && typename && data.__typename !== typename) {
      return false;
    }
    return true;
  } else if (typeof data === 'object') {
    return dataIsDefinedAtPath(data[path[0]], path.slice(1), typename);
  } else {
    return false;
  }
}

export function isSimpleField(field: IntrospectionField) {
  return field.args.length === 0 && isLeafField(field);
}

export function rewriteSelections(
  op: ASTNode,
  path: string[],
  selections: SelectionNode[]
): ASTNode {
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
