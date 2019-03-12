# GraphQL Monkey

:monkey: A test framework for running fully automated, randomized tests
against any GraphQL API.


## Installation

```sh
npm i graphql-monkey -g
```


## Usage

Testing a GraphQL API directly via command-line:

```sh
gqlm --url https://countries.trevorblades.com --verbose
```

See `gqlm --help` for more options.

Most use cases will need an options file with some preparation logic
(authentication etc., see below for a detailed reference).
For example:

```js
const request = require('request-promise-native');

module.exports = { gqlm };

async function gqlm() {
  return {
    url: 'https://graphql.example.com',
    count: 30,
    requestOptions: await login()
  };
}

async function login() {
  const response = await request({
    method: 'POST',
    url: 'https://oauth.example.com',
    body: {
      grant_type: 'password',
      client_id: 'xxxxx',
      client_secret: 'xxxxx',
      username: 'gibbon',
      password: 'bananas'
    },
    json: true
  });

  return {
    headers: {
      Authorization: `Bearer ${response.access_token}`
    }
  };
}
```

Run with `gqlm example.js`.


## Options

Options may be set using an *options file*.
An options file is a JavaScript file exporting
a default function or `gqlm` function
returning an object containing the options.
The exported function may be async.
For TypeScript there's a `TestOptionsInput` interface
which may be used as a return type.

Using the options file, you can implement preparation logic,
like authentication.

Additionally, some options may be set via command-line.

### Count (-n, --count, options.count: number)

Sets the number of queries to generate and test.

### Exit (-e, --exit, options.exit: boolean)

If set, GQLM will exit after the first failed request.
Useful to fix failures step-by-step.

### Require (-r, --require)

Requires a Node.js module on startup. May be specified multiple times.
Useful for transpilation, e.g when using TypeScript:
`gqlm foo.ts --require ts-node/register`

### Seed (-s, --seed, options.seed: string)

Sets the seed for random number generation.

Setting the seed yields a deterministic, reproducible run of tests.
Useful to reproduce failures during development.

The seed of the last run is printed at the end of every report.

### Data (options.data: any)

Sets the initially known data for argument generation.
The provided data may have any structure.

When generating arguments,
GQLM will match argument names to keys in its knowledge base,
and prefer using known values to guess arguments.

The knowledge is built from the given initial data
as well as from recorded response bodies.

For example, if the GraphQL API has arguments or inputs named `fruit` anywhere,
GQLM can be "helped" to guess input for these fields by providing:

```js
function gqlm() {
  return {
    // ...
    data: {
      fruit: ['banana', 'apple', '...'],
      // ...
    }
  }
}
```

### Aliases (options.aliases: string[][])

Defines aliasing for data. Often, different field names have the same semantics,
for example `Customer.id` may be equivalent to `Contract.customerId`.
GQLM will use aliases to match field names and known data more effectively.

```js
{
  aliases: [
    ["id", "customerId", "contractId"],
    /*...*/
  ]
}
```

### Request Options (options.requestOptions: request.Options)

Options for HTTP requests. See https://www.npmjs.com/package/request-promise

### Endpoint Callback (options.endpointCallback: (endpoint: TestEndpoint) => TestEndpoint | null))

An optional callback that allows transforming (return *endpoint*)
or omitting test endpoints (return *null*).

### Error Callback (options.errorCallback: (error: GraphQLError) => boolean))

An optional callback that determines whether an error is
an unexpected error (return *true*)
or not (return *false*).

Only unexpected errors will mark a test result as failed.

### Result Callback (options.resultCallback: (result: TestResult) => TestResult | null))

An optional callback that allows transforming (return *result*)
or omitting test results (return *null*).


## Contributors

- [Morris Brodersen](https://morrisbrodersen.de)
- [Frederik Priede](https://github.com/FrederikPriede)