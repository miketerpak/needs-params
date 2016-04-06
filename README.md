# needs-params

NodeJS tool for generating Express middleware that formats and enforces a parameter scheme

## Install

    npm install needs-params
    
## Usage

### Initialization

var needs = require('needs-params')(options)

#### `options`
`strict` 	- Returns an error when unexpected parameters are received, default `true`

`onError`	- Custom error handler. Handler should return the error object to be forwarded to the error handler via `next`, default forwards `{ message, parameter, value, expected }` to `next` 

##### onError Example
```
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

Scheme values can also be a custom mutator function, which must take a single parameter (the parameter being passed in) and 
must return undefined if the value is unvalid, or the mutated value. 

The following are a list of the valid *type strings*:
* `int` `integer`                   - Whole number (takes floor if not whole)
* `bool` `boolean`                  - Boolean, acceptable values include `t`, `true`, `1` and `f`, `false`, `0`, `-1`
* `str` `string`                    - String value
* `float` `num` `numeric` `number`  - Floating point number
* `date` `time` `datetime`          - JS Date object, accepts millisecond timestamps and formatted datetime strings

##### scheme example
```
{   // Scheme for user registration
    email: 'str',   // Required string
    password: utils.hashPassword,   // Custom mutator, returns null on invalid value, else mutated value
    age_: 'int',    // Optional integer
    location_: {    // Optional object
        address_: 'str',        // Optional string
        coordinates: 'float[2]'   // Int array of size 2, required only if `location` is set
    },
    verified: 'bool'    // Required boolean
}
```

### Full Example
```
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

// Error handler
app.use(function(err, req, res, next) {
    req.status(400).send(err);
});
```