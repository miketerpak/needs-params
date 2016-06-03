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

`options.onError`	- Custom error handler. Handler should return the error object to be forwarded to the error handler via `next`, default forwards `{ message, parameter, value, expected }` to `next` 

##### onError Example
```javascript
/**
  * options.req - Express request object
  * options.message - Error message
  * options.parameter - Parameter that caused error
  * options.value - Invalid parameter value
  * options.expected - `true` if the parameter was expected, yet invalid.  `false` if not found on schema
  */
var needs = require('needs-params')({
    onError: function (options) {
        console.log( // Log error info
            'Parameter-Error',
            '[IP: ' + req.connection.remoteAddress + ']',
            options.message, options.parameter, options.value
        )

        // error object to be forwarded to `next`
        // NOTE: The handler can also return nothing or undefined, which does not forward
        // an error to `next`, and thus not failing on invalid data values
        return Error(options.message)
    }
})
```

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
* `str` `string`                    - String value
* `float` `num` `numeric` `number`  - Floating point number
* `date` `time` `datetime`          - JS Date object, accepts millisecond timestamps and formatted datetime strings

A scheme value can also be one of the following special values:
* **a function**                    - Custom mutator which takes 1 argument--the param value--and must return the new mutated value, or `undefined` to trigger an error  
* **an array**                      - You can also provide an array of values. Only the contents of the array will be considered valid values
* **a double array ([[]])**         - An array is a double array if and only if the outer array contains a single inner array, and nothing more (e.g. `[[1, 2, 3]] or [[[1,2],[[3,4]],5]]`).
                                    Double arrays contain a set of schemes, of which at **at least 1** of the schemes must be satisfied.  They are tried in ascending order by index.

##### scheme example
```javascript
{   // Scheme for user registration
    email: 'str',   // Required string
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
    verified: 'bool' // Required boolean
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
    
app.use(bodyParser.json({strict: true}))
app.use(bodyParser.urlencoded({extended: true}))

// Custom mutator.  MUST take single param, return new value
function hashPassword(password) {
    password = String(password)
    if (password.length < 6) return
    return bcrypt.hashSync(password, 10)
}

var register_params = needs.params({
    email: 'str',
    password: hashPassword,
    country: [ 'us', 'ca' ],
    age_: 'int',
    location_: {
        address_: 'str',
        coordinates: 'float[2]'
    },
    verified: 'bool'
});
app.post('/user/register', register_params, function (req, res) {
  // register user
})

app.post('/user/me', needs.no.params, function (req, res) {
  // return self
})

// Error handler
app.use(function(err, req, res, next) {
    req.status(400).send(err);
});
```

## License
[MIT](https://raw.githubusercontent.com/miketerpak/needs-params/master/LICENSE)
