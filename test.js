'use strict'

const 
    Needs = require('./index.js'),

    needs = Needs({ strict: false }),
    needs_strict = Needs({ strict: true }),
        
    testScheme = {
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
        k: 'datetime[]',
        l: ['one', 2, 0x3, '4']
    },
    dataPass = {
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
        k: [ new Date(), new Date() ],
        l: 0x3
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
        l: 8
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
        format(dataFail, (err, result) => {console.log(err)
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
    let middleware = needs_strict.params(testScheme)
    
    test('Testing for success on GET...', t => {
        middleware({ query: dataPass }, null, err => {
            if (err) t.fail(new Error(JSON.stringify(err)))
            else t.pass()
        })
    })
    
    dataPass.unexpected_parameter = 'Nobody expects the Spanish inquisition!'
    test('Testing for failure on GET...', t => {
        middleware({ query: dataFail }, null, err => {
            if (err) t.pass()
            else t.fail(new Error('Test was unexpectedly successful'))
        })
    })
})