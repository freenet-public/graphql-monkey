import { buildSchema } from 'graphql';
import express, { Application } from 'express';
import graphqlHTTP from 'express-graphql';
import { Server } from 'http';
import { readFileSync } from 'fs';

let app: Application;
let server: Server;

before(done => {
  const customers = [
    {
      id: '4',
      name: 'siegmeyer'
    },
    {
      id: '5',
      name: 'catarina'
    }
  ];

  const schema = buildSchema(readFileSync('test/schema.gql').toString('utf-8'));

  const rootValue = {
    hello: () => 'Hello world!',
    customers: () => [
      {
        id: '4',
        name: 'siegmeyer'
      },
      {
        id: '5',
        name: 'catarina'
      }
    ],
    customer: (args: { id: string }) => {
      return customers.filter(it => it.id === args.id)[0];
    }
  };

  app = express();

  app.use(
    '/graphql',
    graphqlHTTP({
      schema,
      rootValue
    })
  );

  server = app.listen(4000, () => done());
});

after(() => {
  server.close();
});