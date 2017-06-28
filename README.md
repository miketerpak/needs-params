# needs-params

Express parameter formatting and validation

## Install

    npm install needs-params
    
### Initialization

    var needs = require('needs-params')(options)
    
## Usage

**needs-params** applies parameter formatting and validation on the body, query string, spat or headers of the request, using `needs.body`, `needs.querystring`, `needs.spat` and `needs.headers`, respectively.

**NOTE** needs-params does not parse request bodies, headers, querystrings or spat.  It relies on the Express.JS format of using `req.body`, `req.query`, `req.spat` and `req.headers` to store request information. 


#### `options`

`options.strict` 	- Returns an error when unexpected parameters are received, default `true`


#### Error Codes

These are the error codes build into needs-params.

Errors are returned in the form of a `NeedsError`, which is an extension of the regular `Error` object.

When creating custom mutators, you can use custom errors as seen in *Custom mutator example*.

Parameters:

param_names - Comma seperated array string of invalid parameters
param_value - The value of the invalid parameter
message - Text describing error
name - One of the following types:
* `invalid-value` - The value of the parameter is not valid
* `param-unexpected` - An unexpected parameter was sent
* `param-expected` - A required parameter is missing
* `invalid-length` - The object length (string, array, etc.) is invalid

### Generate parameter middleware

    var param_middleware = needs.body(scheme)

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
* `object` `obj`                    - Any valid JS object.  Note, when using `object`, there is no control over the content of the object. If this control is required, please use a nested `needs.params` scheme (see example).

A scheme value can also be one of the following special values:
* **a numerical range**             - A inclusive/exclusive range can be specified with `[min, max]`/`(min, max)` respectively. Exclusivity can be mixed (i.e. `(min, max]`)
* **a regular expression**          - Validates the parameter value against the provided regular expression
* **another needs middleware**      - Applies the passed scheme to the subobject in the master scheme. Function used to create the middleware does not matter. For example, you can use a `needs.querystring` middleware inside of a `needs.body` definition.
* **a function**                    - Custom mutator which takes 1 argument--the param value--and must return the parameter value on success, undefined on generic failure, or the following scheme for providing custom error fields: `[value,err]`.  see *Custom mutator example*
* **an array**                      - You can also provide an array of values. Only the contents of the array will be considered valid values
* **a double array ([[]])**         - An array is a double array if and only if the outer array contains a single inner array, and nothing more (e.g. `[[1, 2, 3]] or [[[1,2],[[3,4]],5]]`).
                                    Double arrays contain a set of schemes, of which at **at least 1** of the schemes must be satisfied.  They are tried in ascending order by index.

##### Custom mutator example

```javascript
needs.body({
    birthyear: year => {
        year = parseInt(year, 10)
        if (isNaN(year)) return new Error('Invalid value for year') // Return empty error object for default type and message
        if (year < 0) return new Error('A year must be positive') // Custom error message for negative numbers (default `invalid-value` error code)
        if (year > new Date().getFullYear()) return new Error('You cannot have been born in the future' ) // Custom error type and message for special case
        if (year < new Date().getFullYear() - 150) return new Error('You are not over 150 years old') // Custom error type and message for special case
        // NOTE you can also supply parameters other than `code` and `msg` that will be forwarded to `onError`

        return year // success!
        // NOTE the [value, error] scheme only has to be used when returning custom error messages.
        //      otherwise, return the value on success, or undefined for a generic `invalid parameter` failure
    }
})
```

##### scheme example
```javascript
{   // Scheme for user registration
    username: new RegExp('^[A-Za-z0-9_-]{5,16}$'), // Username regex
    email: 'str256',   // Required string
    password: utils.hashPassword,   // Custom mutator, returns null on invalid value, else mutated value
    country: [ 'us', 'ca' ], // Set of permitted countries
    age_: [[
        '(0, 120]', // Acceptable date range
        'date',
        { d: 'int', m: 'int', y: 'int' }
    ]], // Optional age, accepting an int, isodate, or the provided date schema
    location_: { // Optional object
        address_: 'str', // Optional string
        coordinates: 'float[2]' // Int array of size 2, required only if `location` is set
    },
    verified: 'bool', // Required boolean
    pagination_: needs.body({
        limit: 'int',
        last_: 'int'
    }) // Using middleware generated from needs. In real use, this would be created separately
}
```

### Combining middleware

```javascript
let pagination_middleware = needs.querystring(...)
...
let param_middleware = needs.querystring(...).including(pagination_middleware)
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

`needs.no.body` - Don't accept any parameters in the body

`needs.no.querystring` - Don't accept any parameters in the querystring

`needs.no.spat` - Don't accept any parameters in the URL

`needs.no.headers` - Don't accept any headers


### Full Example
```javascript
var needs = require('needs-params')()
var express = require('express')
var bodyParser = require('body-parser')
var bcrypt = require('bcrypt')
var app = express()
var needs_pagination = needs.querystring({
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

var register_params = needs.body({
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

app.post('/user/me', needs.no.body, function (req, res) {
  // return self
})

app.get('/user/find',
    needs.querystring({
        query: 'str',
        pagination_: needs_pagination
    }),
    function (req, res) {
        // search for users
    }
)

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

var pagination = needs.querystring({
    limit: 'int',
    last_: 'int',
    order_: ['asc', 'desc']
})
var search_query_params = needs.querystring({
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
    users_:         [['bool', search_query_params]], // false = don't return
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

## License
[MIT](https://raw.githubusercontent.com/miketerpak/needs-params/master/LICENSE)
