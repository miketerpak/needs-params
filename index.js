'use strict'

const _ = require('lodash')

const CLASS_FUNCTION = Symbol('needs-params-function')
const FIELD_SCHEME = Symbol('scheme')

const REGEX_INT = new RegExp(/^[-]?\d*$/)
const REGEX_FLOAT = new RegExp(/^[-]?\d*[\.]?\d*$/)

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
const bodyParser = require("body-parser")
const parseUrlencodedBody = bodyParser.urlencoded({extended: true})
const parseJSONBody = bodyParser.json({strict: true})

let errors = {
    'missing-required': 'Missing required parameter',
    'invalid-value': expected => `Invalid parameter value${expected ? `, expected ${expected}` : ''}`,
    'param-unexpected': 'Unexpected parameter(s)',
    'header-unexpected': 'Unexpected header(s)',
    'param-missing': 'Missing expected parameter',
    'invalid-arr-len': len => `Array length must be ${len}`,
    'invalid-str-len': len => `String too long, max length is ${len}`
}
let mutators = { // Mutators return undefined when values are invalid
    int: v => {
        return REGEX_INT.test(v) ? [parseInt(v, 10)] : [, { msg: errors['invalid-value']('integer') }]
    },
    bool: v => {
        v = String(v).toLowerCase()
        switch (v) {
            case 't':
            case 'true':
            case '1':
                return [true]
            case 'f':
            case 'false':
            case '0':
            case '-1':
                return [false]
            default:
                return [, { msg: errors['invalid-value']('boolean') }]
        }
    },
    str: (v, l) => {
        let result = _.isObject(v) ? undefined : String(v)
        if (result === undefined) return [, { code: 'invalid-str-len', msg: errors['invalid-value']('string') }]
        else if (!isNaN(l)) return result.length > l ? [, { code: 'invalid-str-len', msg: errors['invalid-str-len'](l) }] : [result]
        else return [v]
    },
    float: v => {
        return REGEX_FLOAT.test(v) ? [parseFloat(v)] : [, { msg: errors['invalid-value']('float') }]
    },
    null: v => {
        if (v === null) return [null]
        return ['%00', 'null', ''].includes(String(v).toLowerCase()) ? [null] : [, { msg: errors['invalid-type']('null') }]
    },
    datetime: v => {
        if (REGEX_INT.test(v)) {
            return [new Date(parseInt(v, 10))]
        } else if (_.isString(v)) {
            v = Date.parse(v)
            if (_.isNaN(v)) return [, { msg: errors['invalid-type']('datetime') }]
            return [new Date(v)]
        } else if (_.isDate(v)) {
            return [v]
        } else {
            return [, { msg: errors['invalid-type']('datetime') }]
        }
    },
}
// Aliases
mutators.integer = mutators.int
mutators.boolean = mutators.bool
mutators.string = mutators.str
mutators.number = mutators.numeric = mutators.num = mutators.float
mutators.date = mutators.time = mutators.timestamp = mutators.datetime

// Builds the scheme object that is used by needs to validate and format incoming parameters
function buildScheme(_scheme, _parent) {
    let scheme = {}
    
    for (let key in _scheme) {
        let current_key = _parent ? _parent + '['+key+']' : key
        let definition = _scheme[key]
        let options = { type: null, mutator: null, is_arr: false, length: null,  required: true }
        let lastCharIndex = definition.length - 1
        
        if (_.isFunction(definition)) {
            // If the object is a scheme middleware, just use that scheme
            if (definition.__class === CLASS_FUNCTION) {
                options.type = definition[FIELD_SCHEME]
            } else {
                // NOTE Custom mutators must return UNDEFINED on invalid value
                options.type = 'mutator'
                options.mutator = definition
            }
        } else if (_.isArray(definition)) {
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
                    if (definition.indexOf(v) >= 0) return [v]
                    else {
                        let expecteds = definition.map(d => _.isString(d) ? `"${d}"` : String(d)).join('/')
                        return [, { msg: errors['invalid-value'](expecteds) }]
                    } 
                }
            }
        } else if (_.isObject(definition)) {
            options.type = buildScheme(definition, current_key)
        } else if (_.isString(definition)) {
            if (definition[lastCharIndex] === ']') {
                let arrBegin = definition.indexOf('[')
                options.is_arr = true
                
                if (lastCharIndex - arrBegin > 1) {
                    let arrlen = definition.substr(arrBegin+1, lastCharIndex - arrBegin - 1)
                    if (arrlen) {
                        if (isNaN(arrlen)) throw Error('Invalid route parameter array length')
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
                        throw Error('Invalid route parameter length on type ' + numRegex.input)
                    } else if (!mutators[definition]) {
                        throw Error('Invalid route parameter type ' + definition)
                    }
                }
            }
            
            if (!mutators[definition]) {
                throw Error('Invalid route parameter type ' + definition)
            }
        } else {
            throw Error('Invalid route parameter scheme on key ' + current_key)
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
function mergeSchemes(parent, child) {
    let result = parent //_.cloneDeep(parent)
    for (let key in child) {
        if (result[key] == null) {
            result[key] = child[key]
        } else if (_.isObject(result[key].type) && _.isObject(child[key].type)) {
            result[key].type = mergeSchemes(result[key].type, child[key].type)
        }
    }
    return result
}

function isEmpty(obj) {
    if (!obj) return true
    return Object.keys(obj).length === 0
}

function attachMetadata(scheme, func) {
    func.__class = CLASS_FUNCTION
    func[FIELD_SCHEME] = scheme
    func.including = other => {
        let _scheme = other.__class === CLASS_FUNCTION ? other[FIELD_SCHEME] : buildScheme(other)
        return attachMetadata(mergeSchemes(func[FIELD_SCHEME], _scheme), func.bind())
    }
    return func
}

/**
 * @param options
 * @param options.strict        fail if passed unexpected parameters (default true)
 * @param options.onError       error handler
 * 
 * 
 * onError error handler format:
 * @param options
 * @param options.request   the request object
 * @param options.message   the message generated by the error
 * @param options.parameter the parameter which caused the error
 * @param options.value     the value of the parameter causing the error
 * @param options.expected  boolean flag for if this parameter is not a part of the schema 
 * @returns                 An error object to be forwarded via "next"
 * 
 * NOTE         Errors can be ignored by passing a function to onError that returns undefined always.
 *              This allows for soft failing on invalid params. This function can also be used to log the errors.  
 */
class Needs {
    constructor(options) {
        options = options || {}
        this.strict = options.strict === undefined ? true : options.strict
        this.onError = (err = {}) => { //req, code, msg, key, value
            return _.isFunction(options.onError) ? options.onError(err) : err
        }
        
        this.no = {
            headers: (req, res, next) => {
                if (!req.headers) return next()
                let keys = Object.keys(req.headers)
                if (keys.length) return next(this.onError({ req: req,  code: 'header-unexpected', msg: errors['header-unexpected'], param: keys[0], value: req.headers[keys[0]] }))
                next()
            },
            params: (req, res, next) => {
                let data = req.body || req.query || {}
                let keys = Object.keys(data)
                if (keys.length) return next(this.onError({ req: req, code: 'param-unexpected', msg: errors['param-unexpected'], param: keys[0], value: data[keys[0]] }))
                next()
            }
        }
    }
    
    format(_scheme) {
        let scheme = buildScheme(_scheme)
        // NOTE doesn't actually generate middleware, only attaches necessary properties
        return attachMetadata(scheme, (obj, cb) => {
            if (!_.isFunction(cb)) throw new Error('Missing callback')
            let _obj = _.cloneDeep(obj)
            cb(this.validate(scheme, _obj), _obj)
        })
    }
    
    headers(_scheme) {
        let scheme = buildScheme(_scheme)
        return attachMetadata(scheme, (req, res, next) => {
            next(this.validate(scheme, req.headers || {}, req))
        })
    }

    params(_scheme) {
        let scheme = buildScheme(_scheme)
        return attachMetadata(scheme, (req, res, next) => {
            // Parse the body, if necessary
            let checkUrlencoded = () => {
                if (req.body == null || isEmpty(req.body)) {
                    parseUrlencodedBody(req, res, checkJSON)
                } else {
                    process()
                }
            }
            let checkJSON = () => {
                if (req.body == null || isEmpty(req.body)) {
                    parseJSONBody(req, res, process)
                } else {
                    process()
                }
            }
            // Perform the actual validation
            let process = () => {
                let data = req.body
                if (!data || isEmpty(data)) data = req.query || {}
                next(this.validate(scheme, data, req))
            }
            
            if (isEmpty(req.query)) checkUrlencoded()
            else process()
        })
    }
    
    spat(_scheme) {
        let scheme = buildScheme(_scheme)
        return attachMetadata(scheme, (req, res, next) => {
            next(this.validate(scheme, req.params || {}, req))
        })
    }
    
    validate(scheme, data, req, _parent) {
        let count = 0 // Counter used to count processed fields and detect any extraneous fields
        for (let key in scheme) {
            // For returning correct parameter if errored
            let _current = _parent ? _parent+'['+key+']' : key
            
            if (data[key] !== undefined) {
                if (_.isObject(scheme[key].type)) {
                    if (!_.isObject(data[key])) {
                        return this.onError({ req: req, code: 'invalid-value', msg: errors['invalid-value']('object'), param: _current, value: data[key] })
                    }
                    
                    let err = this.validate(scheme[key].type, data[key], req, _current)
                    if (err) return err
                } else if (scheme[key].type === 'or') {
                    let err
                    for (let _scheme of scheme[key].subschemes) {
                        let _data = {}
                        _data[key] = data[key]
                        if ((err = this.validate(_scheme, _data, req, _parent)) === undefined) {
                            data[key] = _data[key]
                            break
                        }
                    }
                    if (err) return this.onError({ req: req, code: 'invalid-value', msg: errors['invalid-value'](), param: _current, value: data[key] })
                } else {
                    let func = (scheme[key].type === 'mutator' || scheme[key].type === 'set') ? scheme[key].mutator : mutators[scheme[key].type]

                    if (scheme[key].is_arr) {
                        if (!Array.isArray(data[key])) data[key] = [data[key]]
                        if (scheme[key].length && data[key].length !== scheme[key].length) {
                            return this.onError({ req: req, code: 'invalid-arr-len', msg: errors['invalid-arr-len'](scheme[key].length), param: _current, value: data[key].length })
                        }
                        for (let i = data[key].length - 1; i >= 0; --i) {
                            let [val, err] = func(data[key][i]);
                            if (err) {
                                delete err.req
                                let _err = {
                                    req: req,
                                    code: 'invalid-value',
                                    msg: errors['invalid-value'](),
                                    param: _current,
                                    value: data[key]
                                }
                                Object.assign(_err, err)
                                return this.onError(_err)
                            }
                            data[key][i] = val
                        }
                    } else {
                        let [val, err] = func(data[key], scheme[key].length)
                        if (err) {
                            delete err.req
                            let _err = {
                                req: req,
                                code: 'invalid-value',
                                msg: errors['invalid-value'](),
                                param: _current,
                                value: data[key]
                            }
                            Object.assign(_err, err)
                            return this.onError(_err)
                        }
                        data[key] = val
                    }
                }
                
                ++count
            } else if (scheme[key].required) {
                return this.onError({ req: req, code: 'param-missing', msg: errors['param-missing'], param: _current })
            }
        }
        
        if (this.strict && count !== Object.keys(data).length) {
            // get the first unexpected parameter and report as unexpected
            let u_params = []
            for (let key in data) {
                if (!scheme[key]) u_params.push(_parent ? _parent+'['+key+']' : key)
            }
            this.onError({ req: req, code: 'param-unexpected', msg: errors['param-unexpected'], param: (u_params.length === 1 ? u_params[0] : u_params) })
        }
    }
}

module.exports = options => { return new Needs(options) }