import {
  IntrospectionQuery,
  IntrospectionType,
  IntrospectionObjectType,
  IntrospectionField,
  IntrospectionInputValue,
  GraphQLError,
  DocumentNode,
  print,
  FieldNode,
  ArgumentNode,
  ValueNode,
  IntrospectionTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionListTypeRef,
  OperationDefinitionNode,
  SelectionSetNode,
  IntrospectionInterfaceType,
  IntrospectionUnionType
} from 'graphql';
import {
  getNamedTypeRef,
  isLeafField,
  introspect,
  requireType,
  requireTypeFromRef,
  requireObjectType
} from './introspection';
import { Memory } from './memory';
import { TestOptions } from './options';
import {
  makeFieldNode,
  makeDocumentNode,
  makeArgumentNode,
  makeEnumValueNode,
  makeListValueNode,
  makeObjectFieldNode,
  makeObjectValueNode,
  makeNullValueNode,
  makeFloatValueNode,
  makeBooleanValueNode,
  makeStringValueNode,
  makeIntValueNode,
  makeInlineFragmentNode
} from './ast';
import Chance from 'chance';
import { generateString, generateInteger } from './generate';
import request from 'request-promise-native';
import { TestEndpoint } from './endpoint';
import { TestResult } from './result';
import { dataIsDefinedAtPath, isSimpleField, rewriteSelections } from './util';
import { SelectionNode } from 'graphql/language/ast';

export class Session {
  public readonly options: TestOptions;
  public readonly memory: Memory;
  public readonly endpoints: TestEndpoint[] = [];
  public readonly expanded = new Set<TestEndpoint>();
  public readonly chance: Chance.Chance;
  protected introspection?: IntrospectionQuery;
  protected typeMap = new Map<string, IntrospectionType>();

  public constructor(options: TestOptions) {
    this.options = options;

    this.memory = new Memory(options.aliases);
    this.memory.write([], options.data);
    this.chance = new Chance(options.seed);
  }

  public getResults() {
    return this.endpoints.reduce<TestResult[]>((results, endpoint) => {
      return results.concat(endpoint.results);
    }, []);
  }

  public async run() {
    if (this.endpoints.length === 0) {
      throw new Error('No endpoints found; not initialized or schema empty');
    }

    let count = 0;

    while (count < this.options.count) {
      this.endpoints.sort((a, b) => this.rank(a) - this.rank(b));
      const top = this.endpoints.slice(0, 5);
      const endpoint = this.chance.pickone(top);

      const query = this.generateEndpointQuery(endpoint);
      const result = await this.runQuery(query);

      ++count;

      if (result) {
        endpoint.results.push(result);
        if (result.failed) {
          if (this.options.exit) {
            break;
          }
        } else if (dataIsDefinedAtPath(result.data, endpoint.getPath())) {
          this.expand(endpoint);
        }
      }
    }

    return this.getResults();
  }

  public rank(endpoint: TestEndpoint) {
    let rank = 0;

    rank += this.canGuessEndpoint(endpoint) ? 0 : 15;
    rank += endpoint.getSpecificErrors().length * 4;
    rank += endpoint.getSuccessfulResults().length * 2;
    rank += endpoint.getNonNullResults().length * 5;
    rank += endpoint.getPath().length * 2;

    // TODO use size of result responses?

    return rank;
  }

  public async runQuery(queryAst: DocumentNode) {
    const {
      url,
      requestOptions,
      timeout,
      errorCallback,
      resultCallback
    } = this.options;

    const query = print(queryAst);
    const t = Date.now();
    let result: TestResult;

    try {
      const response = await request({
        ...requestOptions,
        url,
        method: 'POST',
        body: { query },
        json: true,
        resolveWithFullResponse: true,
        simple: false,
        timeout
      });

      const errors = response.body.errors || [];

      const unexpectedErrors: GraphQLError[] = errors.filter(
        (error: GraphQLError) =>
          !errorCallback || errorCallback(error, this.options)
      );

      this.memory.write([], response.body.data);

      result = {
        query,
        queryAst,
        statusCode: response.statusCode,
        data: response.body.data,
        errors,
        responseTime: Date.now() - t,
        unexpectedErrors,
        failed: unexpectedErrors.length > 0
      };
    } catch (err) {
      result = {
        query,
        queryAst,
        statusCode: 0,
        responseTime: Date.now() - t,
        data: undefined,
        errors: [],
        unexpectedErrors: [],
        requestError: err,
        failed: true
      };
    }

    return resultCallback ? resultCallback(result) : result;
  }

  public generateEndpointQuery(endpoint: TestEndpoint): DocumentNode {
    const type = this.requireTypeFromRef(endpoint.field.type);

    if (type.kind === 'INTERFACE' || type.kind === 'UNION') {
      return this.generatePathQuery(
        endpoint,
        this.generateUnionEndpointSelections(type)
      );
    }

    if (type.kind === 'OBJECT') {
      return this.generatePathQuery(
        endpoint,
        this.generateObjectEndpointSelections(type)
      );
    }

    return this.generatePathQuery(endpoint, []);
  }

  public generateUnionEndpointSelections(
    type: IntrospectionInterfaceType | IntrospectionUnionType
  ) {
    const possibleTypes = type.possibleTypes.map(it =>
      this.requireTypeFromRef(it)
    );
    const selections: SelectionNode[] = possibleTypes
      .map(possibleType => {
        if (possibleType.kind === 'OBJECT') {
          return makeInlineFragmentNode(
            possibleType.name,
            this.generateObjectEndpointSelections(possibleType)
          );
        }
      })
      .filter(it => !!it) as SelectionNode[];

    selections.push(makeFieldNode('__typename', [], []));

    return selections;
  }

  public generateObjectEndpointSelections(type: IntrospectionObjectType) {
    const selections = type.fields
      .filter(isSimpleField)
      .map(f => makeFieldNode(f.name, [], []));

    if (selections.length === 0) {
      // fall back to __typename if object has no simple fields
      selections.push(makeFieldNode('__typename', [], []));
    }

    return selections;
  }

  public generatePathQuery(
    endpoint: TestEndpoint,
    selections: SelectionNode[]
  ): DocumentNode {
    const args = this.generateArguments(endpoint);
    const fieldNode = makeFieldNode(endpoint.field.name, args, selections);
    const pathSelections = endpoint.on
      ? [
          makeFieldNode('__typename'),
          makeInlineFragmentNode(endpoint.on, [fieldNode])
        ]
      : [fieldNode];

    if (endpoint.parent) {
      const nonNullResults = endpoint.parent.getNonNullResults();

      // try using a working, non-null endpoint query of the parent as base
      if (nonNullResults.length > 0) {
        const parentQueryAst = this.chance.pickone(nonNullResults).queryAst;
        return rewriteSelections(
          parentQueryAst,
          endpoint.parent.getPath(),
          pathSelections
        ) as DocumentNode;
      }

      return this.generatePathQuery(endpoint.parent, pathSelections);
    }

    return makeDocumentNode(pathSelections);
  }

  public generateArguments(endpoint: TestEndpoint): ArgumentNode[] {
    return endpoint.field.args
      .map(arg => {
        return makeArgumentNode(
          arg.name,
          this.generateInput(arg.name, arg.type, true)
        );
      })
      .filter(node => node.value.kind !== 'NullValue');
  }

  public generateInput(
    name: string,
    typeRef: IntrospectionTypeRef,
    nullable = true
  ): ValueNode {
    switch (typeRef.kind) {
      case 'NON_NULL':
        return this.generateInput(name, typeRef.ofType, false);
      case 'INPUT_OBJECT':
        return this.generateInputObject(name, typeRef, nullable);
      case 'LIST':
        return this.generateInputList(name, typeRef, nullable);
      case 'ENUM':
        return this.generateInputEnum(name, typeRef, nullable);
      case 'SCALAR':
        return this.generateInputScalar(name, typeRef, nullable);
      // TODO INTERFACE, UNION?
      default:
        return makeNullValueNode();
    }
  }

  public generateInputObject(
    name: string,
    typeRef: IntrospectionNamedTypeRef,
    nullable: boolean
  ) {
    if (this.maybeNull(name, nullable)) {
      return makeNullValueNode();
    }

    const type = this.requireType(typeRef.name);

    if (type.kind !== 'INPUT_OBJECT') {
      throw new Error('Never happens');
    }

    const fields = type.inputFields.map(inputField =>
      makeObjectFieldNode(
        inputField.name,
        this.generateInput(inputField.name, inputField.type)
      )
    );

    return makeObjectValueNode(fields);
  }

  public generateInputList(
    name: string,
    typeRef: IntrospectionListTypeRef,
    nullable: boolean
  ) {
    if (this.maybeNull(name, nullable)) {
      return makeNullValueNode();
    }

    const size = this.chance.integer({ min: 0, max: 3 });
    const values = [];

    while (values.length < size) {
      values.push(this.generateInput(name, typeRef.ofType));
    }

    return makeListValueNode(values);
  }

  public generateInputEnum(
    name: string,
    typeRef: IntrospectionNamedTypeRef,
    nullable: boolean
  ) {
    if (this.maybeNull(name, nullable)) {
      return makeNullValueNode();
    }

    const type = this.requireType(typeRef.name);

    if (type.kind !== 'ENUM') {
      throw new Error('Never happens');
    }

    const candidates = Array.from(type.enumValues);

    return makeEnumValueNode(this.chance.pickone(candidates).name);
  }

  public generateInputScalar(
    name: string,
    typeRef: IntrospectionNamedTypeRef,
    nullable: boolean
  ): ValueNode {
    if (this.maybeNull(name, nullable)) {
      return makeNullValueNode();
    }

    const type = this.requireType(typeRef.name);

    switch (type.name) {
      case 'Float':
        return this.generateInputFloat(name, nullable);
      case 'Boolean':
        return makeBooleanValueNode(this.chance.bool());
      case 'ID':
        return this.generateInputId(name, nullable);
      case 'Int':
        return this.generateInputInt(name, nullable);
      case 'String':
        return this.generateInputString(name, nullable);
      default:
        return makeNullValueNode();
    }
  }

  public generateInputFloat(name: string, nullable: boolean) {
    const candidates = this.memory
      .read([name])
      .filter(it => typeof it === 'number');

    if (candidates.length === 0) {
      if (nullable) {
        return makeNullValueNode();
      }
      candidates.push(this.chance.floating());
    }

    return makeFloatValueNode(this.chance.pickone(candidates));
  }

  public generateInputId(name: string, nullable: boolean) {
    const candidates = this.memory
      .read([name])
      .filter(it => typeof it === 'string');

    if (candidates.length === 0) {
      if (nullable) {
        return makeNullValueNode();
      }
      candidates.push(generateString(name, this.chance));
    }

    return makeStringValueNode(this.chance.pickone(candidates));
  }

  public generateInputString(name: string, nullable: boolean) {
    const candidates = this.memory
      .read([name])
      .filter(it => typeof it === 'string');

    if (candidates.length === 0) {
      if (nullable) {
        return makeNullValueNode();
      }
      candidates.push(generateString(name, this.chance));
    }

    return makeStringValueNode(this.chance.pickone(candidates));
  }

  public generateInputInt(name: string, nullable: boolean) {
    const candidates = this.memory
      .read([name])
      .filter(it => typeof it === 'number');

    if (candidates.length === 0) {
      if (nullable) {
        return makeNullValueNode();
      }
      candidates.push(generateInteger(name, this.chance));
    }

    return makeIntValueNode(this.chance.pickone(candidates));
  }

  public maybeNull(name: string, nullable: boolean) {
    return nullable && this.chance.floating({ min: 0, max: 1 }) < 0.5;
  }

  public expand(endpoint: TestEndpoint) {
    if (this.expanded.has(endpoint)) {
      return;
    }

    this.expanded.add(endpoint);

    endpoint.expand(this.getIntrospection()).forEach(e => this.addEndpoint(e));
  }

  public addEndpoint(endpoint: TestEndpoint) {
    const { endpointCallback } = this.options;

    if (endpointCallback) {
      const e = endpointCallback(endpoint);
      if (e) {
        this.endpoints.push(e);
      }
    } else {
      this.endpoints.push(endpoint);
    }
  }

  public canGuessEndpoint(endpoint: TestEndpoint) {
    if (!this.canGuessField(endpoint.field)) {
      return false;
    }

    // if any parent is not guessable,
    // the endpoint is not guessable
    if (endpoint.parent && !this.canGuessEndpoint(endpoint.parent)) {
      return false;
    }

    return true;
  }

  public canGuessField(field: IntrospectionField): boolean {
    // if any argument is not guessable,
    // the field is not guessable
    for (const arg of field.args) {
      if (!this.canGuessInput(arg)) {
        return false;
      }
    }

    return true;
  }

  public canGuessInput(arg: IntrospectionInputValue): boolean {
    if (arg.defaultValue !== null || arg.type.kind !== 'NON_NULL') {
      return true;
    }

    const namedTypeRef = getNamedTypeRef(arg.type);
    const type = this.requireType(namedTypeRef.name);

    switch (type.kind) {
      case 'SCALAR':
        return (
          this.memory.read([arg.name]).length > 0 ||
          this.memory.read([type.name]).length > 0
        );
      case 'ENUM':
        return true;
      case 'INPUT_OBJECT':
        return type.inputFields.reduce(
          (g, f) => g && this.canGuessInput(f),
          true as boolean
        );
      case 'OBJECT':
        // generating query objects in inputs is not supported
        return false;
      // TODO UNION, INTERFACE?
      default:
        return false;
    }
  }

  public requireTypeFromRef(typeRef: IntrospectionTypeRef) {
    return requireTypeFromRef(this.getIntrospection(), typeRef);
  }

  public requireObjectType(name: string) {
    return requireObjectType(this.getIntrospection(), name);
  }

  public requireType(name: string) {
    return requireType(this.getIntrospection(), name);
  }

  public getTypeMap() {
    if (!this.typeMap) {
      throw new Error('Not initialized');
    }

    return this.typeMap;
  }

  public getIntrospection() {
    if (!this.introspection) {
      throw new Error('Not initialized');
    }

    return this.introspection;
  }

  public async init() {
    this.introspection = await introspect(
      this.options.url,
      this.options.requestOptions
    );

    for (const type of this.introspection.__schema.types) {
      this.typeMap.set(type.name, type);
    }

    const queryType = this.requireType(
      this.introspection.__schema.queryType.name
    ) as IntrospectionObjectType;

    const { endpointCallback } = this.options;

    for (const field of queryType.fields) {
      let e: TestEndpoint | null | undefined = new TestEndpoint(field);
      if (endpointCallback) {
        e = endpointCallback(e);
      }
      if (e) {
        this.endpoints.push(e);
      }
    }

    return this;
  }
}
