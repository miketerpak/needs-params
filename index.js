'use strict'

const _ = require('lodash')

const CLASS_FUNCTION = Symbol('needs-params-function')
const FIELD_SCHEME = Symbol('scheme')

const REGEX_INT = new RegExp(/^[-]?\d*$/) // regexp for identifying an integer
const REGEX_FLOAT = new RegExp(/^[-]?\d*[\.]?\d*$/) // regexp for identifying a floating point number

/**
 * TODO:
 *      Reintroduce needs.params ONLY for nested needs definitions?
 *      Separate classes out into their own files
 */

/** How to use:
 * 
 * Module takes in scheme, returns middleware for parameter validation
 * 
 * Scheme: { key_: type[4] }
 *  key         - field name
 *  _ after key - parameter is NOT required
 * type         - data type expected (int, bool, str, float, datetime)
 * []           - parameter is an array
 * [x]          - parameter is an array of fixed length x
 */

let ETYPES = {
    INVALID_VALUE: 'invalid-value',
    PARAM_UNEXPECTED: 'param-unexpected',
    PARAM_EXPECTED: 'param-expected',
    INVALID_LENGTH: 'invalid-length'
}
let mutators = { // Mutators return undefined when values are invalid
    bool: v => {
        let _v = String(v).toLowerCase()
        switch (_v) {
            case 't':
            case 'true':
            case '1':
                return true
            case 'f':
            case 'false':
            case '0':
            case '-1':
                return false
            default:
                let err = new NeedsError(`Invalid boolean: ${_v}`)
                err.name = ETYPES.INVALID_VALUE
                err.param_value = v
                return err
        }
    },
    datetime: v => {
        if (REGEX_INT.test(v)) {
            return new Date(parseInt(v, 10))
        } else if (_.isString(v)) {
            let _v = Date.parse(v)
            if (_.isNaN(_v)) {
                let err = new NeedsError(`Invalid datetime: ${v}`)
                err.name = ETYPES.INVALID_VALUE
                err.param_value = v
                return err
            } else {
                return new Date(_v)
            }
        } else if (_.isDate(v)) {
            return v
        } else {
            let err = new NeedsError(`Invalid datetime: ${v}`)
            err.name = ETYPES.INVALID_VALUE
            err.param_value = v
            return err
        }
    },
    float: v => {
        if (REGEX_FLOAT.test(v)) {
            return parseFloat(v)
        } else {
            let err = new NeedsError(`Invalid float: ${v}`)
            err.name = ETYPES.INVALID_VALUE
            err.param_value = v
            return err
        }
    },
    int: v => {
        if (REGEX_INT.test(v)) {
            return parseInt(v, 10)
        } else {
            let err = new NeedsError(`Invalid integer: ${v}`)
            err.name = ETYPES.INVALID_VALUE
            err.param_value = v
            return err
        }
    },
    null: v => {
        if (['%00', 'null', '', null].includes(String(v).toLowerCase())) {
            return null
        } else {
            let err = new NeedsError(`Invalid null value: ${v}`)
            err.name = ETYPES.INVALID_VALUE
            err.param_value = v
            return err
        }
    },
    object: o => {
        if (_.isObject(o)) {
            return o
        } else {
            let err = new NeedsError(`Invalid object: ${JSON.stringify(o)}`)
            err.name = ETYPES.INVALID_VALUE
            err.param_value = o
            return err
        }
    },
    str: (v, l) => {
        let _v = String(v);
        if (_.isObject(v)) {
            let err = new NeedsError(`Invalid string: ${JSON.stringify(v)}`)
            err.name = ETYPES.INVALID_VALUE
            err.param_value = v
            return err
        } else if (l && !isNaN(l)) {
            l = parseInt(l, 10)
            if (_v.length > l) {
                let err = new NeedsError(`String too long, maximum length is ${l}`)
                err.name = ETYPES.INVALID_LENGTH
                err.param_value = v
                return err
            } else {
                return _v;
            }
        } else {
            return v
        }
    },
}
// Aliases
mutators.boolean = mutators.bool
mutators.date = mutators.time = mutators.timestamp = mutators.datetime
mutators.integer = mutators.int
mutators.number = mutators.numeric = mutators.num = mutators.float
mutators.obj = mutators.object
mutators.string = mutators.str

/**
 * Builds a function containing the necessary metadata used by Needs to
 * allow scheme interoperability
 * 
 * @param {*} scheme the scheme object 
 * @param {*} func the middleware function
 * 
 * @returns {function} a function containing the necessary metadata
 */
function attachMetadata(scheme, func) {
    func.__class = CLASS_FUNCTION
    func[FIELD_SCHEME] = scheme
    // used to merge a scheme or needs middleware with the current middleware function
    func.including = other => {
        let _scheme = other.__class === CLASS_FUNCTION ? other[FIELD_SCHEME] : buildScheme(other)
        return attachMetadata(mergeSchemes(func[FIELD_SCHEME], _scheme), func.bind())
    }
    return func
}

/**
 * Builds the scheme object which Needs uses to validate and format object parameters.
 * The scheme is a formatted version of the user-defined format of the data.
 * 
 * @param {object} _scheme user-defined scheme to build
 * @param {object} [_parent] parent scheme object for the given subscheme (if one exists)
 * 
 * @returns {object} formatted scheme object
 */
function buildScheme(_scheme, _parent) {
    let scheme = {}
    
    for (let key in _scheme) {
        let current_key = _parent ? _parent + '['+key+']' : key
        let definition = _scheme[key]
        let options = { type: null, mutator: null, is_arr: false, length: null,  required: true }
        let lastCharIndex = definition.length - 1
        
        if (_.isFunction(definition)) { // functions are either custom mutators or existing needs schemes
            // If the object is a scheme middleware, just use that scheme
            if (definition.__class === CLASS_FUNCTION) {
                options.type = definition[FIELD_SCHEME]
            } else {
                // NOTE Custom mutators must return UNDEFINED on invalid value
                options.type = 'mutator'
                options.mutator = definition
            }
        } else if (_.isArray(definition)) {
            // double-arrays ([[]]) are OR statements, at least one scheme within must be satisfied
            // single arrays ([]) are sets of acceptable literal values for the field
            if (definition.length === 1 && _.isArray(definition[0])) {
                let _defs = definition[0]
                options.type = 'or'
                options.subschemes = []
                for (let _def of _defs) {
                    let __scheme = {}
                    __scheme[key] = _def
                    options.subschemes.push(buildScheme(__scheme, _parent))
                }
            } else {
                options.type = 'set'
                options.mutator = v => {
                    for (let d of definition) {
                        if (d == v) {
                            return d.constructor(v)
                        }
                    }
                    
                    let expecteds = definition.map(d => _.isString(d) ? `"${d}"` : String(d)).join('/')
                    let err = new NeedsError(`Invalid value. Expected one of the following: ${expecteds}`)
                    err.name = ETYPES.INVALID_VALUE
                    err.param_value = v
                    return err
                }
            }
        } else if (_.isRegExp(definition)) { // a regexp means any provided data must satisfy the provided regular expression
            options.type = 'mutator'
            options.mutator = val => {
                val = String(val)
                return definition.test(val)
                    ? val
                    : new NeedsError(`Invalid value: ${val}`);
            }
        } else if (_.isObject(definition)) { // objects are nested schemes, recur
            options.type = buildScheme(definition, current_key)
        } else if (_.isString(definition)) { // strings can have multiple meanings
            if (definition[0] === '[' || definition[0] === '(') { //  a string of format [X,Y], (X,Y), [X,Y) or (X,Y] represents a numeric range
                if (definition[lastCharIndex] !== ']' && definition[lastCharIndex] !== ')') {
                    throw new NeedsError('Invalid range. Range definitions must end in "]" or ")"')
                }

                // Substr because ranges are wrapped in brackets or parenthesis
                let [min = NaN, max = NaN] = definition.substr(1, definition.length - 2).split(',').map(parseFloat)
                let min_inclusive = definition[0] === '['
                let max_inclusive = definition[lastCharIndex] === ']'

                if (isNaN(min) || isNaN(max)) {
                    throw new NeedsError('Invalid value(s) in range')
                } else if (min >= max) {
                    throw new NeedsError('Invalid values in range. Minimum value must be less than maximum value.')
                }

                // use mutator function for checking if the provided value is within a given range
                options.type = 'mutator'
                options.mutator = val => {
                    val = parseFloat(val)
                    if (!isNaN(val) && (min_inclusive ? val >= min : val > min) && ( max_inclusive ? val <= max : val < max)) {
                        return val
                    } else {
                        return new NeedsError(`Invalid value "${val}" for range ${min_inclusive?'[':'('}${min},${max}${max_inclusive?']':')'}`)
                    }
                }
            } else if (definition[lastCharIndex] === ']') { // a string format of T[X] is an array of type T of optional max length X
                let arrBegin = definition.indexOf('[')
                options.is_arr = true
                
                if (lastCharIndex - arrBegin > 1) {
                    let arrlen = definition.substr(arrBegin+1, lastCharIndex - arrBegin - 1)
                    if (arrlen) {
                        if (isNaN(arrlen)) throw new NeedsError('Invalid route parameter array length')
                        options.length = parseInt(arrlen, 10)
                    }
                }
                
                definition = definition.substr(0, arrBegin)
            } else {
                let numRegex = definition.match(/[\d]+/)
                if (numRegex) {
                    options.length = parseInt(numRegex[0], 10)
                    definition = definition.replace(numRegex[0], '')

                    if (isNaN(options.length)) {
                        throw new NeedsError('Invalid route parameter length on type ' + numRegex.input)
                    } else if (!mutators[definition]) {
                        throw new NeedsError('Invalid route parameter type ' + definition)
                    }
                }
            }
            
            if (options.type !== 'mutator' && !mutators[definition]) {
                throw new NeedsError('Invalid route parameter type ' + definition)
            }
        } else {
            throw new NeedsError('Invalid route parameter scheme on key ' + current_key)
        }
        
        if (key[key.length-1] === '_') {
            key = key.substr(0, key.length-1)
            options.required = false
        }
        
        options.type = options.type || definition
        scheme[key] = options
    }
    
    return scheme
}

/**
 * Utility function for checking if object is empty, i.e. has no properties
 * 
 * @param {object} obj
 * 
 * @returns {boolean} true if object has no properties, else false 
 */
function isEmpty(obj) {
    if (!obj) return true
    return Object.keys(obj).length === 0
}

/**
 * Merges two seperate schemes together to form a single scheme object
 * 
 * @param {object} parent scheme being merged into
 * @param {object} child scheme being merged
 * 
 * @returns {object} merged scheme
 */
function mergeSchemes(parent, child) {
    let result = parent //_.cloneDeep(parent) TODO cloneDeep may give some issues w/ cloning functions & function metadata, test further
    for (let key in child) {
        if (result[key] == null) {
            result[key] = child[key]
        } else if (_.isObject(result[key].type) && _.isObject(child[key].type)) {
            result[key].type = mergeSchemes(result[key].type, child[key].type)
        }
    }
    return result
}

/**
 * Class which generates object scheme validator functions/middleware
 */
class Needs {
    /**
     * @param options
     * @param options.strict        fail if passed unexpected parameters (default true)
     */
    constructor({ strict = true } = {}) {
        this.strict = strict
        
        this.no = {
            headers: (req, res, next) => next(needsNothing(req.headers)),
            body: (req, res, next) => next(needsNothing(req.body)),
            querystring: (req, res, next) => next(needsNothing(req.query)),
            spat: (req, res, next) => next(needsNothing(req.params))
        }

        function needsNothing(data = {}) {
            if (!_.isEmpty(data)) {
                let err = new NeedsError(`Unexpected parameter(s)`)
                err.name = ETYPES.PARAM_UNEXPECTED
                err.param_names = Object.keys(data).join(',')
                return err
            }
        }
    }

    /**
     * Creates a formattor, or formats the given object if one is provided
     * 
     * NOTE: This function mutates the 
     * 
     * @param {object} scheme 
     * @param {*} [obj] optional data to format
     * 
     * @returns {(function|*)} if obj is given, returns fformatted result, else returns formatter function
     */
    format(scheme) {
        let _this = this;
        scheme = buildScheme(scheme);

        let func = function() {
            let clone = _.cloneDeep(arguments[0]);
            let err = _this.validate(scheme, clone);
            if (err) throw err;
            return clone;
        };

        if (arguments.length > 1) {
            return func(arguments[1]);
        } else {
            return func;
        }
    }

    /**
     * Generate middleware to validate the express request body using the provided scheme
     * 
     * @param {object} scheme
     * 
     * @returns {function} middleware 
     */
    body(scheme) {
        return this.__middleware(scheme, 'body')
    }
    
    /**
     * Generate middleware to validate the express request headers using the provided scheme
     * 
     * @param {object} scheme
     * 
     * @returns {function} middleware 
     */
    headers(scheme) {
        return this.__middleware(scheme, 'headers')
    }
    
    /**
     * Generate middleware to validate the express request query string using the provided scheme
     * 
     * @param {object} scheme
     * 
     * @returns {function} middleware 
     */
    querystring(scheme) {
        return this.__middleware(scheme, 'query')
    }
    
    /**
     * Generate middleware to validate the express request URL parameters (e.g. id in /user/:id/update) using the provided scheme
     * 
     * @param {object} scheme
     * 
     * @returns {function} middleware 
     */
    spat(scheme) {
        return this.__middleware(scheme, 'params')
    }
    
    /**
     * Validate that the given data follows the given scheme, else return an error
     * 
     * NOTE: This function will mutate the data parameter, not return a new object
     * 
     * @param {object} scheme scheme used for validation
     * @param {*} data data to validate
     * @param {*} _parent private, used for generating bracket-notation parameter names (e.g. user[name][first])
     * 
     * @returns {undefined|NeedsError} on failure, returns error. Else, returns nothing
     */
    validate(scheme, data = {}, _parent) {
        let count = 0 // Counter used to count processed fields and detect any extraneous fields
        
        if (this.strict) {
            let unexpected_params = _.difference(Object.keys(data), Object.keys(scheme))
            if (unexpected_params.length) {
                let err = new NeedsError(`Unexpected parameter(s)`)
                err.name = ETYPES.PARAM_UNEXPECTED
                err.param_names = unexpected_params.join(',')
                return err
            }
        }

        for (let key in scheme) {
            // For returning correct parameter if errored
            let _current = _parent ? `${_parent}[${key}]` : key
            
            if (data[key] !== undefined) {
                if (_.isObject(scheme[key].type)) {
                    if (!_.isObject(data[key])) {
                        let err = new NeedsError(`Invalid value. Expected object, got ${typeof data[key]}`)
                        err.name = ETYPES.INVALID_VALUE
                        err.param_names = _current
                        return err
                    }
                    
                    let err = this.validate(scheme[key].type, data[key], _current)
                    if (err) return err
                } else if (scheme[key].type === 'or') {
                    let err
                    for (let _scheme of scheme[key].subschemes) {
                        let _data = {}
                        _data[key] = data[key]
                        if ((err = this.validate(_scheme, _data, _parent)) === undefined) {
                            data[key] = _data[key]
                            break
                        }
                    }
                    if (err) return err
                } else {
                    // get the mutator function
                    // if a custom mutator was provided, use that, else, look up the mutator within `mutators` based on the type (e.g. str/string, int/integer, bool/boolean, etc)
                    let func = (scheme[key].type === 'mutator' || scheme[key].type === 'set') ? scheme[key].mutator : mutators[scheme[key].type]

                    // if the scheme requires an array of values that satisfy the provided mutator, apply the mutator to each object in the array and check for errors
                    if (scheme[key].is_arr) {
                        if (!Array.isArray(data[key])) data[key] = [data[key]]
                        if (scheme[key].length && data[key].length !== scheme[key].length) {
                            let err = new NeedsError(`Invalid array length. Expected ${schema[key].length}, got ${data[key].length}`)
                            err.name = ETYPES.INVALID_LENGTH
                            err.param_names = _current
                            err.param_value = `[${data[key]}]`
                            return err
                        }

                        for (let i = data[key].length - 1; i >= 0; --i) {
                            let result = func(data[key][i], scheme[key].length)
                            
                            if (result instanceof Error) {
                                result.param_names = `${_current}[${i}]`
                                return result
                            }

                            data[key][i] = result
                        }
                    } else { // if not an array, apply the mutator in `func` to the value at field `key`
                        let result = func(data[key], scheme[key].length)

                        if (result instanceof Error) {
                            result.param_names = _current
                            return result
                        }

                        data[key] = result
                    }
                }
                
                ++count
            } else if (scheme[key].required) { // if a key specified in the scheme does not appear in the data and is required by the scheme, fail
                let err = new NeedsError('Missing expected parameter')
                err.name = ETYPES.PARAM_EXPECTED
                err.param_names = _current
                return err
            }
        }
    }

    /**
     * Generates middleware for formatting request data
     * 
     * @param {object} scheme 
     * @param {string} data_key the location in the request object of the data (e.g. body, query, params, etc)
     * 
     * @returns {function} express middleware
     */
    __middleware(scheme, data_key = 'body') {
        scheme = buildScheme(scheme)
        return attachMetadata(scheme, (req, res, next) => {
            next(this.validate(scheme, req[data_key]))
        })
    }
}

// Custom needs error
class NeedsError extends Error { }

module.exports = options => { return new Needs(options) }
module.exports.error = NeedsError