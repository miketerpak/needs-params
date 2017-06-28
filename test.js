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
        o: 'obj'
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
        n: '3',
        o: {
            random: {
                js: {
                    object: {
                        for: 'you'
                    }
                }
            }
        }
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
        n: 3,
        o: {}
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
        pass: () => console.info('\x1b[32m Passed \x1b[0m'),
        fail: err => { throw err || 'Failed' }
    })
}

test('Testing needs.headers...', t => {
    let check = needs.headers(testScheme)

    test('Testing for success...', t => {
        check({ headers: dataPass }, null, err => {
            if (err) t.fail(err)
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
test('Testing needs.spat...', t => {
    let check = needs.spat(testScheme)

    test('Testing for success...', t => {
        check({ params: dataPass }, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    test('Testing for failure...', t => {
        check({ params: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing needs.query...', t => {
    let check = needs.querystring(testScheme)
        
    test('Testing for success...', t => {
        check({ query: dataPass }, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    test('Testing for failure...', t => {
        check({ query: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing needs.body...', t => {
    let post_middleware = needs.body(testScheme)
    let get_middleware = needs.querystring(testScheme)
    
    test('Testing for success on POST...', t => {
        post_middleware({ body: dataPass }, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    test('Testing for success on GET...', t => {
        get_middleware({ query: dataPass }, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    
    test('Testing for failure on POST...', t => {
        post_middleware({ body: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
    test('Testing for failure on GET...', t => {
        get_middleware({ query: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})
console.log('')
test('Testing needs.no.params...', t => {
    test('Testing for success on POST...', t => {
        needs.no.body({ body: {} }, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    test('Testing for success on GET...', t => {
        needs.no.querystring({ query: {} }, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    
    test('Testing for failure on POST...', t => {
        needs.no.body({ body: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
    test('Testing for failure on GET...', t => {
        needs.no.querystring({ query: dataFail }, null, err => {
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
            if (err) t.fail(err)
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
    let middleware = needs_strict.querystring({
        a: 'int'
    })
    
    test('Testing for success on GET...', t => {
        middleware({ query: { a: 1 } }, null, err => {
            if (err) t.fail(err)
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
    let other_middleware = needs.body({
        required_parameter: 'int'
    })
    let middleware = needs.body({
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
            if (err) t.fail(err)
            else t.pass()
        })
    })
})
console.log('')
test('Testing multiple schemes per key (OR)', t => {
    let scheme = needs.body({
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
            if (err) t.fail(err)
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
    let pagination = needs.body({
        limit: 'int',
        last_: 'int',
        order_: ['desc', 'asc']
    })
    let scheme = needs.body({
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
            if (err) t.fail(err)
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
    let scheme = needs.body({
        str: 'string10'
    })
    
    let d = {
        body: {
            str: 'thisisten.'
        }
    }
    
    test('Testing for success...', t => {
        scheme(d, null, err => {
            if (err) t.fail(err)
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
    let scheme = needs.body({
        mutator1_: val => val === "hi" ? val : undefined,
        mutator2_: val => val === "hi" ? val : new Error('TEST')
    })
    
    let d = {
        body: {
            mutator1: 'hi',
            mutator2: 'hi'
        }
    }
    
    test('Testing for success...', t => {
        scheme(d, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    d.body.mutator2 = 'bye'
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

test('Testing processing RegExp validation', t => {
    let scheme = needs.body({
        string: /(test).*/
    })
    let d = {
        body: {
            string: 'test here'
        }
    }

    test('Testing for successful validation', t => {
        scheme(d, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    d.body.string = 'failure'
    test('Testing for successful validation', t => {
        scheme(d, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})

test('Testing processing ranges', t => {
    let scheme = needs.body({
        num1: '[10.5,11]',
        num2: '(10.5,11)',
        num3: '[10.5,11)',
        num4: '(10.5,11]'
    })
    let d = {
        body: {
            num1: 11,
            num2: 10.9999999,
            num3: 10.5,
            num4: 11
        }
    }

    test('Testing for successful validation', t => {
        scheme(d, null, err => {
            if (err) t.fail(err)
            else t.pass()
        })
    })
    d.body.num4 = 10.5
    test('Testing for successful validation', t => {
        scheme(d, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})