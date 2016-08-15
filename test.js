'use strict'

const 
    Needs = require('./index.js'),

    needs = Needs({ strict: false }),
    needs_strict = Needs({ strict: true }),
        
    testScheme = {
        a: 'int',
        b: 'boolean[3]',
        c: 'str',
        d: {
            e: 'float',
            f_: 'num'
        },
        g_: {
            h: 'datetime',
            i: 'int',
            j_: 'float'
        },
        k: 'datetime[]',
        l: ['one', 2, 0x3, '4'],
        m: [['int', 'null']],
        n: [1, 2, 3, 4, 5],
    },
    dataPass = {
        a: 55,
        b: [true, true, false],
        c: 'test',
        d: {
            e: 34857.534,
            f: -300
        },
        g: {
            h: new Date(),
            i: 3,
            // j: 34.34
        },
        k: [ new Date(), new Date() ],
        l: 0x3,
        m: 'null',
        n: '3'
    },
    dataFail = {
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
        k: [ new Date(), 7 ],
        l: 8,
        m: 0,
        n: 3
    }


/**
 * README
 * 
 * Used to start a test (can be nested)
 * 
 * @param {string} msg  
 * @param {function} t  Test function, has 1 parameter with functions .pass and .fail
 */
function test(msg, t) {
    console.info(msg)
    t({
        pass: msg => console.info('\x1b[32m Passed \x1b[0m'),
        fail: err => { throw err || 'Failed' }
    })
}

test('Testing needs.format on plain object...', t => {
    let format = needs.format(testScheme)
    
    test('Testing successful format...', t => {
        format(dataPass, (err, result) => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    test('Testing unsuccessful format...', t => {
        format(dataFail, (err, result) => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing needs.headers...', t => {
    let check = needs.headers(testScheme)
        
    test('Testing for success...', t => {
        check({ headers: dataPass }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    test('Testing for failure...', t => {
        check({ headers: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing needs.params...', t => {
    let middleware = needs.params(testScheme)
    
    test('Testing for success on POST...', t => {
        middleware({ body: dataPass }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    test('Testing for success on GET...', t => {
        middleware({ query: dataPass }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    
    test('Testing for failure on POST...', t => {
        middleware({ body: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
    test('Testing for failure on GET...', t => {
        middleware({ query: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing needs.no.params...', t => {
    let middleware = needs.no.params
    
    test('Testing for success on POST...', t => {
        middleware({ body: {} }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    test('Testing for success on GET...', t => {
        middleware({ query: {} }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    
    test('Testing for failure on POST...', t => {
        middleware({ body: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
    test('Testing for failure on GET...', t => {
        middleware({ query: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing needs.no.headers', t => {
    let check = needs.no.headers
        
    test('Testing for success...', t => {
        check({ headers: {} }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    test('Testing for failure...', t => {
        check({ headers: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing strict mode', t => {
    let middleware = needs_strict.params({
        a: 'int'
    })
    
    test('Testing for success on GET...', t => {
        middleware({ query: { a: 1 } }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    
    test('Testing for failure on GET...', t => {
        middleware({ query: { rgekwufcerngcf: 4, a: 4 } }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing including', t => {
    let other_middleware = needs.params({
        required_parameter: 'int'
    })
    let middleware = needs.params({
        a: 'int',
        b: {
            c_: 'str',
            d: 'bool',
            e_: {
                f: 'int[5]'
            },
            g: {
                h: 'int[2]'
            } 
        }
    }).including(other_middleware).including({
        b: {
            g_: {
                h: 'str',
                z: 'int'
            },
            i: {
                x: 'bool',
                y_: 'bool'
            }
        }
    })
    let data = {
        a: 2,
        b: {
            d: false,
            g: {
                h: [1, 2],
                z: 0
            },
            i: {
                x: true
            }
        },
        required_parameter: 5
    }
    
    test('Testing chained inclusions...', t => {
        middleware({ query: data }, null, (req, res, err) => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
})
console.log('')
test('Testing multiple schemes per key (OR)', t => {
    let scheme = needs.params({
        a: 'int',
        b_: 'str[]',
        c: [['float', 'bool']],
        d: 'int[]',
        e: [1, 5, 9, 'test'],
        f: [['str', {
            a: 'int',
            b_: 'float'
        }]]
    })
    let d = {
        body: {
            a: 1,
            c: 'false',
            d: [1,2,3],
            e: 5,
            f: {
                a: 3
            }
        }
    }
    
    test('Testing successful OR statement...', t => {
        scheme(d, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    d.body.c = 'fail'
    test('Testing unsuccessful OR statement...', t => {
        scheme(d, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing using other needs functions on parameters', t => {
    let pagination = needs.params({
        limit: 'int',
        last_: 'int',
        order_: ['desc', 'asc']
    })
    let scheme = needs.params({
        a: 'int',
        b_: 'str[]',
        c: [['float', 'bool']],
        d: 'int[]',
        e: [1, 5, 9, 'test'],
        f: [['str', {
            a: 'int',
            b_: 'float'
        }]],
        page_: pagination
    })
    
    let d = {
        body: {
            a: 1,
            c: 'false',
            d: [1,2,3],
            e: 5,
            f: {
                a: 3
            },
            page: {
                limit: 3,
                last: 800
            }
        }
    }
    
    test('Testing for success...', t => {
        scheme(d, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    delete d.body.page.limit
    test('Testing for failure...', t => {
        scheme(d, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing string length limits', t => {
    let scheme = needs.params({
        str: 'string10'
    })
    
    let d = {
        body: {
            str: 'thisisten.'
        }
    }
    
    test('Testing for success...', t => {
        scheme(d, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    d.body.str += 'But this is more than 10.'
    test('Testing for failure...', t => {
        scheme(d, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing custom mutators', t => {
    let scheme = needs.params({
        mutator1_: val => val === "hi" ? val : undefined,
        mutator2_: val => val === "hi" ? [val] : [, { code: 'test-error', msg: "Don't panic!" }]
    })
    
    let d = {
        body: {
            mutator1: 'hi',
            mutator2: 'hi'
        }
    }
    
    test('Testing for success...', t => {
        scheme(d, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    d.body.mutator1 = 'bye'
    test('Testing for failure on mutator 1...', t => {
        scheme(d, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
    d.body.mutator1 = 'hi'
    d.body.mutator2 = 'bye'
    test('Testing for failure on mutator 2...', t => {
        scheme(d, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})