import { TestEndpoint } from '../src/endpoint';
import { createIntrospectionHelper } from './testUtil';
import { TestResult } from '../src/result';
import * as assert from 'assert';

describe('Test Endpoints', async () => {
  it('should have IDs and be able to compute their non-null results', async () => {
    const introspection = await createIntrospectionHelper();
    const queryType = introspection.requireQueryType();
    const customersField = introspection.requireField(queryType, 'customers');
    const customersEndpoint = new TestEndpoint(customersField);
    const individualType = introspection.requireObjectType('Individual');
    const individualContractsField = introspection.requireField(
      individualType,
      'contracts'
    );
    const individualContractsEndpoint = new TestEndpoint(
      individualContractsField,
      customersEndpoint,
      'Individual'
    );
    const companyType = introspection.requireObjectType('Company');
    const companyContractsField = introspection.requireField(
      companyType,
      'contracts'
    );
    const companyContractsEndpoint = new TestEndpoint(
      companyContractsField,
      customersEndpoint,
      'Company'
    );

    assert.equal(customersEndpoint.getId(), 'customers');
    assert.equal(
      individualContractsEndpoint.getId(),
      'customers.contracts<Individual>'
    );
    assert.equal(
      companyContractsEndpoint.getId(),
      'customers.contracts<Company>'
    );

    const resultBoth = {
      data: {
        customers: [
          {
            __typename: 'Individual',
            contracts: [{ id: '4' }]
          },
          {
            __typename: 'Company',
            form: 'lol',
            contracts: [{ id: '5' }, { id: '6' }, { list: ['wut', null] }]
          }
        ]
      }
    } as TestResult;

    const resultIndividual = {
      data: {
        customers: [
          {
            __typename: 'Individual',
            contracts: [{ id: '4' }]
          }
        ]
      }
    } as TestResult;

    const resultCompany = {
      data: {
        customers: [
          {
            __typename: 'Company',
            form: 'lol',
            contracts: [{ id: '5' }, { id: '6' }, { list: ['wut', null] }]
          }
        ]
      }
    } as TestResult;

    customersEndpoint.results.push(resultBoth, resultIndividual, resultCompany);

    assert.deepEqual(customersEndpoint.getNonNullResults(), [
      resultBoth,
      resultIndividual,
      resultCompany
    ]);

    individualContractsEndpoint.results.push(
      resultBoth,
      resultIndividual,
      resultCompany
    );

    assert.deepEqual(individualContractsEndpoint.getNonNullResults(), [
      resultBoth,
      resultIndividual
    ]);

    companyContractsEndpoint.results.push(
      resultBoth,
      resultIndividual,
      resultCompany
    );

    assert.deepEqual(companyContractsEndpoint.getNonNullResults(), [
      resultBoth,
      resultCompany
    ]);
  });
});
