import test from 'ava'
const Needs = require('./index.js')

test('test success w/o strict', t => {
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
            b: 3.14,
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
        if (err) {
            console.log('testNonstrictCorrect', err)
            t.fail()
        } else {
            t.pass()
        }
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