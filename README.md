# needs-params

Express parameter formatting and validation

## Install

    npm install needs-params
    
### Initialization

    var needs = require('needs-params')(options)
    
## Usage

**needs-params** stores the processed bodies into `req.body` and `req.query` for the body and query string respectively, via the function `needs.params(...)`.

If **needs-params** receives a raw body, it is parsed with `body-parser`.  For parsing JSON bodies, `bodyParser.json({strict: true})` is used, while for url encoded form data, `bodyParser.urlencoded({extended: true})` is used.
If the body is already parsed (`req.body` is set), this step is ignored.

spat values (i.e. `/user/:id`) and header values can be formatted in the same way, using `needs.spat(...)` and `needs.headers(...)` respectively.


#### `options`

`options.strict` 	- Returns an error when unexpected parameters are received, default `true`

`options.onError`	- Custom error handler. Handler should return the error object to be forwarded to the error handler via `next`, default forwards `{ req, msg, code, param, value }` to `next` 

#### onError: Example
```javascript
/**
  * options.req - Express request object
  * options.message - Error message
  * options.parameter - Parameter that caused error
  * options.value - Invalid parameter value
  */
var needs = require('needs-params')({
    onError: function ({ req, code, msg, param, value } = {}) {
        console.log( // Log error info
            'Parameter-Error',
            '[IP: ' + req.connection.remoteAddress + ']',
            msg, param, value
        )

        // Return error data to be sent to `#next`.
        // Sending undefined will ignore the needs-params error and continue
        // the route normally.  This example ignores all unexected parameter issues
        if (code === 'param-unexpected') return
        else return Error(msg)
    }
})
```

#### onError: Error Codes

These are the error codes build into needs.params, and their corresponding default error messages.
They are found in the `onError` function, under the parameter `err.code` and `err.msg` respectively

When creating custom mutators, you can provide your own error codes and messages as seen [here](#Custom mutator example).

* `missing-required`: `Missing required parameter`,
* `invalid-value`: `Invalid parameter value` || `Invalid paramter value, expected ${expected_value}`,
* `param-unexpected`: `Unexpected parameter(s)`,
* `header-unexpected`: `Unexpected header(s)`,
* `param-missing`: `Missing expected parameter`,
* `invalid-arr-len`: `Array length must be ${len}`,
* `invalid-str-len`: `String too long, max length is ${maxlen}`

### Generate parameter middleware

    var param_middleware = needs.params(scheme)

#### `scheme`

Schemes with an underscore (`_`) at the end of the key mark parameters which are **not required** by the route (i.e. `age_: 'int'`)

Scheme values are strings which define the data type expected for a parameter, using existing mutators to validate
and format the value. Appending `[]` to the *type string* creates an array value, and placing a number within the
brackets requires all submitted arrays to be of the given size (i.e. `coordinates: 'float[2]')

The following are a list of the valid *type strings*:
* `int` `integer`                   - Whole number (takes floor if not whole)
* `bool` `boolean`                  - Boolean, acceptable values include `t`, `true`, `1` and `f`, `false`, `0`, `-1`
* `strX` `stringX`                  - String value.  X is an optional max length
* `null`                            - Null value, including `null`, `"null"` (case-insensitive), `"%00"`, `""`
* `float` `num` `numeric` `number`  - Floating point number
* `date` `time` `datetime`          - JS Date object, accepts millisecond timestamps and formatted datetime strings

A scheme value can also be one of the following special values:
* **another needs middleware**      - Applies the passed scheme to the subobject in the master scheme  
* **a function**                    - Custom mutator which takes 1 argument--the param value--and must return the following scheme: `[value,err]`.  [Example](#Custom mutator example)
* **an array**                      - You can also provide an array of values. Only the contents of the array will be considered valid values
* **a double array ([[]])**         - An array is a double array if and only if the outer array contains a single inner array, and nothing more (e.g. `[[1, 2, 3]] or [[[1,2],[[3,4]],5]]`).
                                    Double arrays contain a set of schemes, of which at **at least 1** of the schemes must be satisfied.  They are tried in ascending order by index.

##### Custom mutator example

```javascript
needs.params({
    birthyear: year => {
        year = parseInt(year, 10)
        if (isNaN(year)) return [, { }] // Return empty error object for default type and message
        if (year < 0) return [, { msg: 'Year must be positive' }] // Custom error message for negative numbers (default `invalid-value` error code)
        if (year > new Date().getFullYear()) return [, { code: 'dob-error', msg: 'You cannot have been born in the future' }] // Custom error type and message for special case
        if (year < new Date().getFullYear() - 150) return [, { code: 'dob-error', msg: 'You are not over 150 years old' }] // Custom error type and message for special case
        // NOTE you can also supply parameters other than `code` and `msg` that will be forwarded to `onError`

        return [year] // success!
    }
})
```

##### scheme example
```javascript
{   // Scheme for user registration
    email: 'str256',   // Required string
    password: utils.hashPassword,   // Custom mutator, returns null on invalid value, else mutated value
    country: [ 'us', 'ca' ], // Set of permitted countries
    age_: [[
        'int',
        'date',
        { d: 'int', m: 'int', y: 'int' }
    ]], // Optional age, accepting an int, isodate, or the provided date schema
    location_: { // Optional object
        address_: 'str', // Optional string
        coordinates: 'float[2]' // Int array of size 2, required only if `location` is set
    },
    verified: 'bool', // Required boolean
    pagination_: needs.params({
        limit: 'int',
        last_: 'int'
    }) // Using middleware generated from needs. In real use, this would be created separately
}
```

### Combining middleware

```javascript
let pagination_middleware = needs.params(...)
...
let param_middleware = needs.params(...).including(pagination_middleware)
```

You can merge the schemes of two middlewares together.  This is different from simply applying one middleware after
the other in that any included middlewares are recursively merged into the original middleware so that any scheme
applied in the original is not overwritten by any subsequent inclusions.

#### For example...
``` javascript
{ // pagination_scheme
    limit: 'int',
    last_: 'int'
}

{ // object_scheme
    objectParam: {
        field1: 'date',
        field3_: 'bool'
    }
}

{ // search_scheme
    query: 'str',
    sortBy: 'str',
    last_: 'str',
    
    objectParam: {
        field1_: 'date',
        field2: 'float'
    }
}

{ // search_scheme.including(pagination_scheme).including(object_scheme)
    query: 'str',
    sortBy: 'str',
    last_: 'str',
    limit: 'int',
    
    objectParam: {
        field1_: 'date',
        field2: 'float',
        field3_: 'bool'
    }
}
```

### Predefined middleware: `needs.no`

These preset middlewares are used to require that no values be sent 

`needs.no.params` - Don't accept any parameters through the body or query string

`needs.no.headers` - Don't accept any headers


### Full Example
```javascript
var needs = require('needs-params')()
var express = require('express')
var bodyParser = require('body-parser')
var bcrypt = require('bcrypt')
var app = express()
var needs_pagination = needs.params({
    limit: 'int',
    last_: 'int'  
})
    
app.use(bodyParser.json({strict: true}))
app.use(bodyParser.urlencoded({extended: true}))

// Custom mutator.  MUST take single param, return new value
function hashPassword(password) {
    password = String(password)
    if (password.length < 6) return
    return bcrypt.hashSync(password, 10)
}

var register_params = needs.params({
    email: 'str256',
    password: hashPassword,
    country: [ 'us', 'ca' ],
    age_: 'int',
    location_: {
        address_: 'str',
        coordinates: 'float[2]'
    },
    verified: 'bool'
})
app.post('/user/register', register_params, function (req, res) {
  // register user
})

app.post('/user/me', needs.no.params, function (req, res) {
  // return self
})

var search_params = needs.params({
    query: 'str',
    pagination_: needs_pagination
})
app.get('/user/find', search_params, function (req, res) {
    // search for users
})

// Error handler
app.use(function(err, req, res, next) {
    req.status(400).send(err)
})
```


### In-Depth Example

The following example uses a universal searching endpoint.  Users can query all objects based on
the base parameters.  You can also exclude object types by passing `[object_type]=false`, OR 
query that object seperately with a seperate set of query data passed in as an object to the
`object_type` parameter.

```javascript
var needs = require('needs-params')()
var express = require('express')
var bodyParser = require('body-parser')
var app = express()
    
app.use(bodyParser.json({strict: true}))
app.use(bodyParser.urlencoded({extended: true}))

var pagination = needs.params({
    limit: 'int',
    last_: 'int',
    order_: ['asc', 'desc']
})
var search_query_params = needs.params({
    query: 'str',
    location_: {
        street_: 'str',
        city_: 'str',
        county_: 'str',
        state_: 'str2',
        country_: 'str'
    },
    before_: 'datetime',
    after_: 'datetime'
}).including(pagination)
var search_params = search_query_params.including({
    users_:         [['bool', search_query_params]],
    cars_:          [['bool', search_query_params]],
    dealerships_:   [['bool', search_query_params]]
})
app.get('/search', search_params, function (req, res) {
    // search for users
})

// Error handler
app.use(function(err, req, res, next) {
    req.status(400).send(err)
})
```

The result is a scheme that allows querying by a querystring, location, or datetime for all objects, as well
as the optional excluding or seperate querying of each object type, with each subquery containing the same
parameters as the master query.

## License
[MIT](https://raw.githubusercontent.com/miketerpak/needs-params/master/LICENSE)
