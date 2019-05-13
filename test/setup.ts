import express, { Application } from 'express';
import graphqlHTTP from 'express-graphql';
import { Server } from 'http';
import { readFileSync } from 'fs';
import { makeExecutableSchema } from 'graphql-tools';

let app: Application;
let server: Server;

before(done => {
  const customers = [
    {
      type: 'INDIVIDUAL',
      id: '4',
      name: 'Siegmeyer of Catarina',
      person: {
        firstname: 'Siegmeyer',
        lastname: 'of Catarina',
        birthdate: '2011-09-22'
      }
    },
    {
      type: 'COMPANY',
      id: '5',
      name: 'Blades of the Darkmoon',
      employees: [
        {
          firstname: 'Dark Sun Gwyndolin',
          lastname: '?',
          birthdate: '2011-09-23'
        },
        {
          firstname: 'Darkmoon Knightess',
          lastname: '?',
          birthdate: '2011-09-24'
        }
      ]
    }
  ];

  const typeDefs = readFileSync('test/schema.gql').toString('utf-8');

  const resolvers = {
    Query: {
      hello() {
        return 'Hello world!';
      },
      customers() {
        return customers;
      },
      customer(root: {}, args: { id: string }) {
        const customer = customers.find(it => it.id === args.id);
        if (!customer) {
          throw new Error('Not found');
        }
        return customer;
      }
    },
    Customer: {
      __resolveType(customer: any) {
        switch (customer.type) {
          case 'INDIVIDUAL': return 'Individual';
          case 'COMPANY': return 'Company';
        }
      }
    }
  };

  const schema = makeExecutableSchema({
    typeDefs,
    resolvers
  });

  app = express();

  app.use('/graphql', graphqlHTTP({ schema }));

  server = app.listen(4000, () => done());
});

after(() => {
  server.close();
});
