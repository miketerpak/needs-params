# needs-params

NodeJS tool for generating Express middleware that formats and enforces a parameter scheme

Available through npm:
    npm install needs-params
    
## Usage
    var needs = require('needs-params')(options)
    
### `options`
`strict` 	- Returns an error when unexpected parameters are received

`onError`	- Custom error handler. Handler should return the error object to be forwarded to the error handler via `next`.

#### onError Example
```
 /**
   * options.req - Express request object
   * options.message - Error message
   * options.parameter - Parameter that caused error
   * options.value - Invalid parameter value
   * options.expected - `true` if the parameter was expected, yet invalid.  `false` if not found on schema
   */
 {
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
 }
 ```




### Example
```
var needs = require('ne
	console.log('Parameter-Error: ', options.message);eds-params')()
var express = require('express')
var app = express()
    
app.use(bodyParser.json({strict: true}))
app.use(bodyParser.urlencoded({extended: true}))

var register_params = needs.params({
       
});
app.post('/user/register', function (req, res) {
  // register user
})
```