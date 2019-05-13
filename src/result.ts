import { GraphQLError, DocumentNode } from 'graphql';

export interface TestResult {
  query: string;
  queryAst: DocumentNode;
  statusCode: number;
  responseTime: number;
  data: any;
  errors: GraphQLError[];
  unexpectedErrors: GraphQLError[];
  failed: boolean;
  requestError?: Error;
}
