'use strict'

import test from 'ava'
const Needs = require('./index.js')

/**
 * TODO tests:
 *  
 *  Plain object
 *  Headers
 *  POST urlencoded body
 *  POST JSON body
 *  POST form data
 *  GET query
 *  All schema possibilities
 *  Strict on
 *  needs.no
 */

const needs = Needs({ 
    strict: false
})
const testScheme = {
    a: 'int',
    b: 'boolean[3]',
    c_: 'str',
    d: {
        e: 'float',
        f_: 'num'
    },
    g_: {
        h: 'datetime',
        i: 'int',
        j_: 'float'
    },
    k: 'datetime[]'
}
const dataPass = {
    a: 55,
    b: [true, true, false],
    // c: 'test',
    d: {
        e: 34857.534,
        f: -300
    },
    g: {
        h: new Date(),
        i: 3.14159,
        // j: 34.34
    },
    k: [ new Date(), new Date() ]
}
const dataFail = {
    a: 55,
    b: [true, false, false],
    // c: 'test',
    d: {
        e: 34857.534,
        f: 'boop'
    },
    g: {
        h: new Date(),
        i: 3.14159,
        j: 34.34
    },
    k: [ new Date(), 7 ]
}

test('needs.format on plain object', t => {
    let test = needs.format(testScheme, (err, result) => {
        if (err) t.fail(err)
        else t.pass();
    })
})

test('test failure w/o strict', t => {
    let needs = Needs({ strict: false })
    let test = needs.params({
        a: 'int',
        b_: 'float',
        c: {
            d_: 'int[]',
            e: {
                f: 'str',
                g: 'datetime'
            }
        }
    })
    test({
        body: {
            a: 42,
            b: "this shouldn't work",
            c: {
                e: {
                    f: 'test',
                    g: Date.now()
                },
                f: 324
            }
        },
        query: {}
    }, null, (err)=>{
        if (!err || !err.expected) {
            console.log('testStrictIncorrect', err)
            t.fail()
        } else {
            t.pass()
        }
    })
})

test('test success w/ strict', t => {
    let needs = Needs({})
    let test = needs.params({
        a: 'int',
        b_: 'float',
        c: {
            d_: 'int[]',
            e: {
                f: 'str',
                g: 'datetime'
            }
        }
    })
    test({
        body: {
            a: 42,
            b: 3.14,
            c: {
                e: {
                    f: 'test',
                    g: Date.now()
                }
            }
        },
        query: {}
    }, null, (err)=>{
        if (err) {
            console.log('testStrictCorrect', err)
            t.fail()
        } else {
            t.pass()
        }
    })
})

test('test failure w/ strict', t => {
    let needs = Needs({ onError: options => { return 'Successful Error Test' } })
    let test = needs.params({
        a: 'int',
        b_: 'float',
        c: {
            d_: 'int[]',
            e: {
                f: 'str',
                g: 'datetime'
            }
        }
    })
    test({
        body: {
            a: 42,
            b: 3.14,
            c: {
                e: {
                    f: 'test',
                    g: Date.now()
                },
                f: 1
            }
        },
        query: {}
    }, null, err =>{
        if (!err || err.expected) {
            console.log('testStrictIncorrect', err)
            t.fail()
        } else {
            t.pass()
        }
    })
})