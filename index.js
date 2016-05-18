'use strict'

/**
 * TODO test new onError setup
 *  Object literal for mappable values
 *  Ability to provide array meaning value can only be one in the set 
 *  
 * 
 * How to use:
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

let mutators = { // Mutators return undefined when values are invalid
    int: v => {
        if (isNaN(v)) return
        return parseInt(v, 10)
    },
    bool: v => {
        v = String(v).toLowerCase()
        switch (v) {
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
                return
        }
    },
    str: v => {
        if (typeof v === 'object') return
        return String(v)
    },
    float: v => {
        if (isNaN(v)) return
        return parseFloat(v)
    },
    datetime: v => {
        if (typeof v === 'string') {
            let result = Date.parse(v)
            if (isNaN(result)) return
            return result
        } else if (typeof v === 'number' && v >= 0) {
            return new Date(v)
        } else if (v && v.constructor.name === 'Date') {
            return v
        } else {
            return undefined
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
        let options = { type: null, mutator: null, is_arr: false, arr_len: null,  required: true }
        let lastCharIndex = definition.length - 1
        
        if (typeof definition === 'function') {
            // NOTE Custom mutators must return UNDEFINED on invalid value
            options.type = 'mutator'
            options.mutator = definition
        } else if (Array.isArray(definition)) {
            options.type = 'set'
            options.mutator = v => { return definition.indexOf(v) >= 0 ? v : undefined } // TODO move into mutators.set?
        } else if (typeof definition === 'object') {
            options.type = buildScheme(definition, current_key)
        } else if (typeof definition === 'string') {
            if (definition[lastCharIndex] === ']') {
                let arrBegin = definition.indexOf('[')
                options.is_arr = true
                
                if (lastCharIndex - arrBegin > 1) {
                    let arrlen = definition.substr(arrBegin+1, lastCharIndex - arrBegin - 1)
                    if (arrlen) {
                        if (isNaN(arrlen)) throw Error('Invalid route parameter array length')
                        options.arr_len = parseInt(arrlen, 10)
                    }
                }
                
                definition = definition.substr(0, arrBegin)
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
    for (let key in child) {
        if (parent[key] === undefined) {
            parent[key] = child[key]
        } else if (typeof parent[key].type === 'object') {
            parent[key].type = mergeSchemes(parent[key], child[key])
        }
    }
    return parent
}

function isEmpty(obj) {
    if (!obj) return true
    return Object.keys(obj).length === 0
}

function cloneObject(obj) {
    let _obj = {}
    
    for (let key in obj) {
        switch (typeof obj[key]) {
            case 'function':
                _obj[key] = obj[key].bind()
                break
            case 'object':
                if (Array.isArray(obj[key])) {
                    _obj[key] = Array(...obj[key])
                } else {
                    _obj[key] = cloneObject(obj[key])
                }
            default:
                _obj[key] = obj[key]
        }
    }
    
    return _obj
}

function attachMetadata(scheme, middleware) {
    middleware.scheme = scheme
    middleware.including = other => {
        if (!other.scheme) throw new Error('Object passed to .includes was not a needs middleware')
        middleware.scheme = mergeSchemes(middleware.scheme, other.scheme)
        return middleware
    }
    return middleware
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
        this.onError = (err) => { //req, msg, key, value, expected
            let errObj = {}
            
            if (err.req) errObj.request = err.req
            if (err.msg) errObj.message = err.msg
            if (err.param) errObj.param = err.param
            if (err.value) errObj.value = err.value
            if (err.expected !== undefined) errObj.expected = err.expected
            
            if (typeof options.onError === 'function') {
                return options.onError(errObj)
            } else {
                return errObj
            }
        }
        
        this.no = {
            headers: (req, res, next) => {
                if (!req.headers) return next()
                let keys = Object.keys(req.headers)
                if (keys.length) return next(this.onError({ req: req, msg: 'Unexpected header', param: keys[0], value: req.headers[keys[0]], expected: false }))
                next()
            },
            params: (req, res, next) => {
                let data = req.body || req.query || {}
                let keys = Object.keys(data)
                if (keys.length) return next(this.onError({ req: req, msg: 'Unexpected parameter', param: keys[0], value: data[keys[0]], expected: false }))
                next()
            }
        }
    }
    
    // TODO Should this clone+return or mutate?
    format(_scheme) {
        let scheme = buildScheme(_scheme)
        // NOTE doesn't actually generate middleware, only attaches necessary properties
        return attachMetadata(scheme, (obj, cb) => {
            if (typeof cb !== 'function') throw new Error('Missing callback')
            let _obj = cloneObject(obj)
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
                if (typeof scheme[key].type === 'object') {
                    if (typeof data[key] !== 'object') {
                        return this.onError({ req: req, msg: 'Invalid parameter type, object expected', param: _current, value: data[key], expected: true })
                    }
                    
                    let err = this.validate(scheme[key].type, data[key], req, _current)
                    if (err) return err
                } else {
                    let func = scheme[key].type === 'mutator' || scheme[key].type === 'set' ? scheme[key].mutator : mutators[scheme[key].type]
                    
                    if (scheme[key].is_arr) {
                        if (!Array.isArray(data[key])) data[key] = [data[key]]
                        if (scheme[key].arr_len && data[key].length !== scheme[key].arr_len) {
                            return this.onError({ req: req, msg: 'Array length must be ' + scheme[key].arr_len, param: _current, value: data[key].length, expected: true })
                        }
                        for (let i = data[key].length - 1; i >= 0; --i) {
                            let val = func(data[key][i])
                            if (val === undefined) {
                                return this.onError({ req: req, msg: 'Invalid parameter value', param: _current, value: data[key], expected: true })
                            }
                            data[key][i] = val
                        }
                    } else {
                        let val = func(data[key])
                        if (val === undefined) {
                            return this.onError({ req: req, msg: 'Invalid parameter value', param: _current, value: data[key], expected: true })
                        }
                        data[key] = val
                    }
                }
                
                ++count
            } else if (scheme[key].required) {
                if (typeof scheme[key].type === 'object') {
                    let _type = scheme[key].type
                    while (typeof _type === 'object') {
                        let _keys = Object.keys(_type)
                        _current += '['+_keys[0]+']'
                        _type = _type[_keys[0]].type
                    }
                }
                
                return this.onError({ req: req, msg: 'Missing expected parameter', param: _current, value: data[key], expected: true })
            }
        }
        
        if (this.strict && count !== Object.keys(data).length) {
            // get the first unexpected parameter and report as unexpected
            for (let key in data) {
                if (!scheme[key]) return this.onError({ req: req, msg: 'Unexpected parameter', param: (_parent ? _parent+'['+key+']' : key), value: data[key], expected: false })
            }
        }
    }
}

module.exports = options => { return new Needs(options) }