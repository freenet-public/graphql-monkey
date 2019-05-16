import {
  DocumentNode,
  FieldNode,
  ArgumentNode,
  ValueNode,
  NullValueNode,
  EnumValueNode,
  StringValueNode,
  IntValueNode,
  ListValueNode,
  ObjectValueNode,
  ObjectFieldNode,
  FloatValueNode,
  BooleanValueNode,
  SelectionNode,
  InlineFragmentNode
} from 'graphql';

export function makeDocumentNode(
  selections: SelectionNode[] | ReadonlyArray<SelectionNode>
): DocumentNode {
  return {
    kind: 'Document',
    definitions: [
      {
        kind: 'OperationDefinition',
        operation: 'query',
        selectionSet: {
          kind: 'SelectionSet',
          selections
        }
      }
    ]
  };
}

export function makeFieldNode(
  name: string,
  args: ArgumentNode[] | ReadonlyArray<ArgumentNode> = [],
  selections: SelectionNode[] | ReadonlyArray<SelectionNode> = []
): FieldNode {
  return {
    kind: 'Field',
    name: {
      kind: 'Name',
      value: name
    },
    arguments: args,
    selectionSet: {
      kind: 'SelectionSet',
      selections
    }
  };
}

export function makeInlineFragmentNode(
  on: string,
  selections: SelectionNode[] | ReadonlyArray<SelectionNode>
): InlineFragmentNode {
  return {
    kind: 'InlineFragment',
    typeCondition: {
      kind: 'NamedType',
      name: {
        kind: 'Name',
        value: on
      }
    },
    selectionSet: {
      kind: 'SelectionSet',
      selections
    }
  };
}

export function makeArgumentNode(name: string, value: ValueNode): ArgumentNode {
  return {
    kind: 'Argument',
    name: {
      kind: 'Name',
      value: name
    },
    value
  };
}

export function makeObjectValueNode(
  fields: ObjectFieldNode[]
): ObjectValueNode {
  return {
    kind: 'ObjectValue',
    fields
  };
}

export function makeObjectFieldNode(
  name: string,
  value: ValueNode
): ObjectFieldNode {
  return {
    kind: 'ObjectField',
    name: {
      kind: 'Name',
      value: name
    },
    value
  };
}

export function makeListValueNode(values: ValueNode[]): ListValueNode {
  return {
    kind: 'ListValue',
    values
  };
}

export function makeStringValueNode(value: string): StringValueNode {
  return {
    kind: 'StringValue',
    value
  };
}

export function makeIntValueNode(value: number): IntValueNode {
  return {
    kind: 'IntValue',
    value: value.toString()
  };
}

export function makeFloatValueNode(value: number): FloatValueNode {
  return {
    kind: 'FloatValue',
    value: value.toString()
  };
}

export function makeBooleanValueNode(value: boolean): BooleanValueNode {
  return {
    kind: 'BooleanValue',
    value
  };
}

export function makeEnumValueNode(value: string): EnumValueNode {
  return {
    kind: 'EnumValue',
    value
  };
}

export function makeNullValueNode(): NullValueNode {
  return {
    kind: 'NullValue'
  };
}
