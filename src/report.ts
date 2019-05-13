import { TestResult } from './result';
import {
  GraphQLError,
  IntrospectionQuery,
  IntrospectionField,
  IntrospectionType,
  IntrospectionEnumValue,
  IntrospectionObjectType,
  visit
} from 'graphql';
import { getIntrospectionType, getIntrospectionOperationTypeName } from './introspection';

export interface TestReport {
  results: TestResult[];
  requestCount: number;
  failedCount: number;
  statusCodes: NumberCount[];
  errorCount: number;
  errorMessages: KeyCount[];
  errorCodes: KeyCount[];
  unexpectedErrorCount: number;
  unexpectedErrorMessages: KeyCount[];
  unexpectedErrorCodes: KeyCount[];
  requestErrorCount: number;
  responseTimes: {
    avg: number;
    min: number;
    max: number;
    total: number;
  };
  types: TypeReport[];
  coverage: number;
}

export interface NumberCount {
  key: number;
  count: number;
}

export interface KeyCount {
  key: string;
  count: number;
}

export type TypeReport =
  | ObjectTypeReport
  | InterfaceTypeReport
  | EnumTypeReport
  | ScalarTypeReport
  | InputObjectTypeReport
  | UnionTypeReport;

export interface ObjectTypeReport {
  name: string;
  kind: 'OBJECT';
  coverage: number;
  fields: FieldReport[];
}

export interface InterfaceTypeReport {
  name: string;
  kind: 'INTERFACE';
  coverage: number;
  fields: FieldReport[];
}

export interface FieldReport {
  name: string;
  count: number;
  expectedErrors: GraphQLError[];
  unexpectedErrors: GraphQLError[];
}

export interface EnumTypeReport {
  name: string;
  kind: 'ENUM';
  coverage: number;
  values: EnumValueReport[];
}

export interface EnumValueReport {
  name: string;
  count: number;
}

export interface ScalarTypeReport {
  name: string;
  kind: 'SCALAR';
  coverage: number;
  count: number;
}

export interface InputObjectTypeReport {
  name: string;
  kind: 'INPUT_OBJECT';
  coverage: number;
}

export interface UnionTypeReport {
  name: string;
  kind: 'UNION';
  coverage: number;
}

export function buildReport(
  results: TestResult[],
  introspection: IntrospectionQuery
) {
  return results.reduce<TestReport>(
    (report, it) => {
      updateReport(report, it, introspection);
      return report;
    },
    initReport(introspection)
  );
}

export function updateReport(report: TestReport, result: TestResult, introspection: IntrospectionQuery) {
  report.results.push(result);

  ++report.requestCount;

  if (result.failed) {
    ++report.failedCount;
  }

  if (result.requestError) {
    ++report.requestErrorCount;
  }

  const statusCodeCount = report.statusCodes.find(it => it.key === result.statusCode);
  if (statusCodeCount) {
      ++statusCodeCount.count;
    } else {
      report.statusCodes.push({
        key: result.statusCode,
        count: 1
      });
    }

  report.responseTimes.total += result.responseTime;
  report.responseTimes.avg = report.responseTimes.total / report.requestCount;
  report.responseTimes.min = Math.min(
    report.responseTimes.min,
    result.responseTime
  );
  report.responseTimes.max = Math.max(
    report.responseTimes.max,
    result.responseTime
  );

  updateErrorReports(report, result);
  updateTypeReports(report, result, introspection);

  report.coverage = report.types.reduce((c, t) => c + t.coverage, 0) / report.types.length;
}

export function updateErrorReports(report: TestReport, result: TestResult) {
  for (const error of result.errors) {
    ++report.errorCount;

    const messageCount = report.errorMessages.find(it => it.key === error.message);
    if (messageCount) {
      ++messageCount.count;
    } else {
      report.errorMessages.push({
        key: error.message,
        count: 1
      });
    }

    const code = error.extensions && error.extensions.code;

    if (code) {
      const codeCount = report.errorCodes.find(it => it.key === code);
      if (codeCount) {
        ++codeCount.count;
      } else {
        report.errorCodes.push({
          key: error.message,
          count: 1
        });
      }
    }
  }

  for (const error of result.unexpectedErrors) {
    ++report.unexpectedErrorCount;

    const messageCount = report.unexpectedErrorMessages.find(it => it.key === error.message);
    if (messageCount) {
      ++messageCount.count;
    } else {
      report.unexpectedErrorMessages.push({
        key: error.message,
        count: 1
      });
    }

    const code = error.extensions && error.extensions.code;

    if (code) {
      const codeCount = report.unexpectedErrorCodes.find(it => it.key === code);
      if (codeCount) {
        ++codeCount.count;
      } else {
        report.unexpectedErrorCodes.push({
          key: error.message,
          count: 1
        });
      }
    }
  }
}

export function updateTypeReports(report: TestReport, result: TestResult, introspection: IntrospectionQuery) {
  visit(result.queryAst, {
    OperationDefinition(opNode) {
      const operationTypeName = getIntrospectionOperationTypeName(introspection, opNode.operation);

      if (!operationTypeName) {
        throw new Error(`Bad operation ${opNode.operation}`);
      }

      const path: string[] = [];
      const stack: Array<IntrospectionType | undefined> = [];

      visit(opNode, {
        Field: {
          enter(node) {
            path.push(node.name.value);

            const parentType = stack.length > 0 ? stack[stack.length - 1] : getIntrospectionType(introspection, operationTypeName);
            if (!parentType) {
              throw new Error(`Undefined parent type at ${node.name.value}`);
            }
            if (
              parentType.kind !== 'OBJECT' &&
              parentType.kind !== 'INTERFACE'
            ) {
              throw new Error(`Bad parent type ${parentType.kind} at ${parentType.name}.${node.name}`);
            }

            if (node.name.value === '__typename') {
              stack.push(undefined);
              return;
            }

            const parentTypeReport = report.types.find(it => it.name === parentType.name) as ObjectTypeReport;
            if (!parentTypeReport) {
              throw new Error(`Undefined parent type report ${parentType.name}`);
            }

            const field = parentType.fields.find(it => it.name === node.name.value);
            if (!field) {
              throw new Error(`Undefined field ${parentType.name}.${node.name.value}`);
            }

            const fieldReport = parentTypeReport.fields.find(it => it.name === field.name);
            if (!fieldReport) {
              throw new Error(`Undefined field report ${parentType.name}.${field.name}`);
            }

            fieldReport.count++;
            parentTypeReport.coverage =
              parentTypeReport.fields.filter(it => it.count > 0).length / parentType.fields.length;

            let typeRef = field.type;
            while (typeRef.kind === 'LIST' || typeRef.kind === 'NON_NULL') {
              typeRef = typeRef.ofType;
            }

            const type = getIntrospectionType(introspection, typeRef.name);
            if (!type) {
              stack.push(undefined);
              return;
            }

            const typeReport = report.types.find(it => it.name === type.name);
            if (!typeReport) {
              throw new Error(`Undefined type report ${type.name}`);
            }

            if (type.kind === 'ENUM' && typeReport.kind === 'ENUM') {
              const values = getValuesAtPath(result.data, path);
              values.forEach(it => {
                typeReport.values.forEach(enumValueReport => {
                  if (enumValueReport.name === it) {
                    enumValueReport.count++;
                  }
                });
              });
              typeReport.coverage = typeReport.values
                .filter(it => it.count > 0).length /
                typeReport.values.length;
            }

            if (type.kind === 'SCALAR' && typeReport.kind === 'SCALAR') {
              typeReport.count++;
              typeReport.coverage = 1;
            }

            stack.push(type);
          },
          leave() {
            stack.pop();
            path.pop();
          }
        },
        InlineFragment: {
          enter(node) {
            if (!node.typeCondition) {
              throw new Error('Inline fragment without type condition?');
            }

            const type = getIntrospectionType(introspection, node.typeCondition.name.value) as IntrospectionObjectType;
            if (!type || type.kind !== 'OBJECT') {
              throw new Error(`Bad inline fragment ${ node.typeCondition.name.value}`);
            }

            stack.push(type);
          },
          leave() {
            stack.pop();
          }
        }
      });
    }
  });
}

export function initReport(introspection: IntrospectionQuery): TestReport {
  return {
    results: [],
    requestCount: 0,
    failedCount: 0,
    statusCodes: [],
    errorCount: 0,
    errorMessages: [],
    errorCodes: [],
    unexpectedErrorCount: 0,
    unexpectedErrorMessages: [],
    unexpectedErrorCodes: [],
    requestErrorCount: 0,
    responseTimes: {
      avg: 0,
      min: 999999,
      max: 0,
      total: 0
    },
    types: introspection.__schema.types
      .filter(it => !it.name.match(/^__/))
      .map(initTypeReport),
    coverage: 0
  };
}

function initTypeReport(type: IntrospectionType): TypeReport {
  switch (type.kind) {
    case 'OBJECT':
      return {
        name: type.name,
        kind: type.kind,
        coverage: 0,
        fields: type.fields.map(initFieldReport)
      };
    case 'INTERFACE':
      return {
        name: type.name,
        kind: type.kind,
        coverage: 0,
        fields: type.fields.map(initFieldReport)
      };
    case 'ENUM':
      return {
        name: type.name,
        kind: type.kind,
        coverage: 0,
        values: type.enumValues.map(initEnumValueReport)
      };
    case 'SCALAR':
      return {
        name: type.name,
        kind: type.kind,
        coverage: 0,
        count: 0
      };
    case 'INPUT_OBJECT':
      return {
        name: type.name,
        kind: type.kind,
        coverage: 0
      };
    case 'UNION':
      return {
        name: type.name,
        kind: type.kind,
        coverage: 0
      };
  }
}

function initFieldReport(field: IntrospectionField): FieldReport {
  return {
    name: field.name,
    count: 0,
    expectedErrors: [],
    unexpectedErrors: []
  };
}

function initEnumValueReport(
  enumValue: IntrospectionEnumValue
): EnumValueReport {
  return {
    name: enumValue.name,
    count: 0
  };
}

function getValuesAtPath(data: any, path: string[]): any[] {
  if (Array.isArray(data)) {
    return data
      .map(it => getValuesAtPath(it, path))
      .reduce((a, it) => a.concat(it), []);
  } else if (path.length === 0) {
    return [data];
  } else if (data) {
    return getValuesAtPath(data[path[0]], path.slice(1));
  } else {
    return [];
  }
}
