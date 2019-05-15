import express, { Application } from 'express';
import graphqlHTTP from 'express-graphql';
import { Server } from 'http';
import { readFileSync } from 'fs';
import { makeExecutableSchema } from 'graphql-tools';

let app: Application;
let server: Server;

interface Contract {
  id: string;
}

interface Person {
  firstname: string;
  lastname: string;
  birthdate: string;
}

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
      },
      contracts: [
        { id: '41' },
        { id: '42' },
      ]
    },
    {
      type: 'COMPANY',
      id: '5',
      name: 'Blades of the Darkmoon',
      form: 'Covenant',
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
      ],
      contracts: [
        { id: '51' },
        { id: '52' },
        { id: '53' }
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
      },
      search(root: {}, args: { q: string }) {
        const a = customers.filter(it => {
          return it.id.match(args.q) || it.name.match(args.q);
        });

        const b = customers.reduce<Contract[]>((contracts, it) => {
          return contracts.concat(it.contracts);
        }, []).filter(it => {
          return it.id.match(args.q);
        }).map(it => {
          return { ...it, type: 'CONTRACT' };
        });

        const c = customers.reduce<Person[]>((persons, it) => {
          return persons
            .concat(it.person ? [it.person] : [])
            .concat(it.employees || []);
        }, []).filter(it => {
          return it.firstname.match(args.q) ||
            it.lastname.match(args.q) ||
            it.birthdate.match(args.q);
        }).map(it => {
          return { ...it, type: 'PERSON' };
        });

        return (a as any[]).concat(b).concat(c);
      }
    },
    Customer: {
      __resolveType(customer: any) {
        switch (customer.type) {
          case 'INDIVIDUAL': return 'Individual';
          case 'COMPANY': return 'Company';
        }
      }
    },
    Contract: {
      customer(contract: { id: string }) {
        return customers.find(it => it.contracts.map(c => c.id).indexOf(contract.id) >= 0);
      }
    },
    SearchResult: {
      __resolveType(data: any) {
        switch (data.type) {
          case 'INDIVIDUAL': return 'Individual';
          case 'COMPANY': return 'Company';
          case 'CONTRACT': return 'Contract';
          case 'PERSON': return 'Person';
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
