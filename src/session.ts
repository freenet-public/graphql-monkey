import {
  IntrospectionQuery,
  IntrospectionObjectType,
  IntrospectionField,
  IntrospectionInputValue,
  GraphQLError,
  DocumentNode,
  print,
  ArgumentNode,
  ValueNode,
  SelectionNode,
  IntrospectionTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionListTypeRef,
  IntrospectionInterfaceType,
  IntrospectionUnionType,
  IntrospectionType
} from 'graphql';
import { IntrospectionHelper } from './introspection';
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
import { isSimpleField, rewriteSelections, flatMap } from './util';
import { version } from '../package.json';

export class Session {
  public readonly options: TestOptions;
  public readonly chance: Chance.Chance;
  public readonly memory: Memory;
  public readonly endpoints: TestEndpoint[] = [];
  protected introspection: IntrospectionHelper;

  public constructor(options: TestOptions, introspection: IntrospectionQuery) {
    this.options = options;
    this.chance = new Chance(options.seed);
    this.memory = new Memory(options.aliases);
    this.memory.write([], options.data);
    this.introspection = new IntrospectionHelper(introspection);

    const queryType = this.introspection.requireQueryType();

    for (const field of queryType.fields) {
      this.addEndpoint(new TestEndpoint(field));
    }

    if (this.endpoints.length === 0) {
      throw new Error('No endpoints found; query root ignored or schema empty');
    }
  }

  public getResults() {
    return flatMap(this.endpoints, endpoint => endpoint.results);
  }

  public async run(count: number) {
    for (let i = 0; i < count; ++i) {
      const endpoint = this.chance.weighted(
        this.endpoints,
        this.endpoints.map(it => this.rank(it))
      );

      const query = this.generateEndpointQuery(endpoint);
      const result = await this.runQuery(query);

      if (!result) {
        continue;
      }

      endpoint.results.push(result);

      if (this.options.exit && result.failed) {
        break;
      }

      this.expand(endpoint);
    }

    return this.getResults();
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
        headers: {
          'User-Agent': `graphql-monkey/${version}`,
          ...requestOptions.headers
        },
        url,
        method: 'POST',
        body: { query },
        json: true,
        resolveWithFullResponse: true,
        simple: false,
        timeout
      });

      const data = response.body && response.body.data;
      const errors = response.body && response.body.errors || [];

      const unexpectedErrors: GraphQLError[] = errors.filter(
        (error: GraphQLError) =>
          !errorCallback || errorCallback(error, this.options)
      );

      if (data) {
        this.memory.write([], data);
      }

      result = {
        query,
        queryAst,
        statusCode: response.statusCode,
        data,
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

  public expand(endpoint: TestEndpoint) {
    for (const e of endpoint.expand(this.introspection)) {
      this.addEndpoint(e);
    }
  }

  public addEndpoint(endpoint: TestEndpoint) {
    const { endpointCallback } = this.options;
    const e = endpointCallback ? endpointCallback(endpoint) : endpoint;

    if (e && !this.endpoints.find(it => it.getId() === e.getId())) {
      this.endpoints.push(e);
    }
  }

  public rank(endpoint: TestEndpoint) {
    let rank = 0;

    rank += this.canGuessField(endpoint.field) ? 0 : 12;
    rank += endpoint.results.length * 4;
    rank += endpoint.getSpecificErrors().length * 4;
    rank += endpoint.getSuccessfulResults().length * 2;
    rank += endpoint.getNonNullResults().length * 8;
    rank += endpoint.getPath().length * 7;

    return 1 / rank;
  }

  //

  public generateEndpointQuery(endpoint: TestEndpoint): DocumentNode {
    const type = this.introspection.requireTypeFromRef(endpoint.field.type);
    const selections = this.generateEndpointSelections(type);
    const args = this.generateArguments(endpoint);
    const fieldNode = makeFieldNode(endpoint.field.name, args, selections);
    const pathSelections = endpoint.on
      ? [
          makeFieldNode('__typename'),
          makeInlineFragmentNode(endpoint.on, [fieldNode])
        ]
      : [fieldNode];

    if (endpoint.parent) {
      const nonNullResults = endpoint.on
        ? endpoint.parent.getNonNullResultsOfType(endpoint.on)
        : endpoint.parent.getNonNullResults();

      if (nonNullResults.length === 0) {
        throw new Error(
          'Trying to generate query without non-null parent results'
        );
      }

      const parentQueryAst = this.chance.pickone(nonNullResults).queryAst;

      return rewriteSelections(
        parentQueryAst,
        endpoint.parent.getPath(),
        pathSelections
      );
    }

    return makeDocumentNode(pathSelections);
  }

  public generateEndpointSelections(type: IntrospectionType): SelectionNode[] {
    switch (type.kind) {
      case 'INTERFACE':
      case 'UNION':
        return this.generateUnionEndpointSelections(type);
      case 'OBJECT':
        return this.generateObjectEndpointSelections(type);
      default:
        return [];
    }
  }

  public generateUnionEndpointSelections(
    type: IntrospectionInterfaceType | IntrospectionUnionType
  ) {
    const possibleTypes = type.possibleTypes.map(it =>
      this.introspection.requireTypeFromRef(it)
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

    selections.unshift(makeFieldNode('__typename'));

    return selections;
  }

  public generateObjectEndpointSelections(type: IntrospectionObjectType) {
    const selections = type.fields
      .filter(isSimpleField)
      .map(f => makeFieldNode(f.name));

    if (selections.length === 0) {
      // fall back to __typename if object has no simple fields
      selections.push(makeFieldNode('__typename'));
    }

    return selections;
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
    if (this.maybeNull(nullable)) {
      return makeNullValueNode();
    }

    const type = this.introspection.requireInputObjectType(typeRef.name);

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
    if (this.maybeNull(nullable)) {
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
    if (this.maybeNull(nullable)) {
      return makeNullValueNode();
    }

    const type = this.introspection.requireEnumType(typeRef.name);

    const candidates = Array.from(type.enumValues);

    return makeEnumValueNode(this.chance.pickone(candidates).name);
  }

  public generateInputScalar(
    name: string,
    typeRef: IntrospectionNamedTypeRef,
    nullable: boolean
  ): ValueNode {
    if (this.maybeNull(nullable)) {
      return makeNullValueNode();
    }

    const type = this.introspection.requireType(typeRef.name);

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

  public maybeNull(nullable: boolean) {
    return nullable && this.chance.floating({ min: 0, max: 1 }) < 0.5;
  }

  //

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

    const type = this.introspection.requireTypeFromRef(arg.type);

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
}
