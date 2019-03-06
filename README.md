# GraphQL Monkey

A test framework for running fully automated, randomized tests
against any GraphQL-API.


## Installation

```sh
npm i graphql-monkey -g
```


## Usage

Try `gqlm --url https://countries.trevorblades.com --verbose`.
See `gqlm --help` for more options.

See `examples` for advanced testing using files to define options.
Run with `gqlm examples/countries.ts --verbose`, for example.


## Options

Options can be set via command-line arguments
or via `configure(options: TestOptions)`.
The `TestOptions` TypeScript interface is an exported member of GQLM.

### Count (-n, --count, options.count: number)

Sets the number of queries to generate and test.

### Exit (-e, --exit, options.exit: boolean)

If set, GQLM will exit after the first failed request.
This is useful to fix failures step-by-step.

### Require (-r, --require)

Requires a Node.js module on startup. May be specified multiple times.
Useful for transpilation, e.g when using TypeScript:
`gqlm foo.ts --require ts-node/register`

### Seed (-s, --seed, options.seed: string)

Sets the seed for random number generation.

Setting the seed yields a deterministic, reproducible run of tests.
This is useful to reproduce encountered failures during development.

The seed of the last run is printed at the end of every report.


## Options File

Options may be set using an options file.
An options file must export a default or `gqlm` function
returning an object containing the options.
The exported function may be async.

Using the options file, you can implement preparation logic,
like authentication.

In addition the options outlined above,
the following options may be set via options file.

### Data (options.data: any)

Sets the initially known data for argument generation.
The provided data may have any structure.

When generating arguments,
GQLM will match argument names to keys in its knowledge base,
and prefer using known values to guess arguments.

The knowledge is built from the given initial data
as well as from recorded response bodies.

### Aliases (options.data: string[][])

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

### Endpoint Callback (options.endpointCallback: (result: TestEndpoint) => TestEndpoint | null))

An optional callback that allows transforming (return endpoint)
or omitting test endpoints (return null).

### Error Callback (options.errorCallback: (error: GraphQLError) => boolean))

An optional callback that determines whether an error is
an unexpected error (return true)
or not (return false).

Only unexpected errors will mark a test result as failed.

### Result Callback (options.resultCallback: (result: TestResult) => TestResult | null))

An optional callback that allows transforming (return result)
or omitting test results (return null).
