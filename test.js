import test from 'ava'
const _Needs = require('./index.js')

test('test success w/o strict', t => {
    let needs = _Needs({ strict: false })
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
        }
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
    let needs = _Needs({ strict: false })
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
        }
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
    let needs = _Needs({})
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
        }
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
    let needs = _Needs({ onError: options => { return 'Successful Error Test' } })
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
        }
    }, null, err =>{
        if (!err || err.expected) {
            console.log('testStrictIncorrect', err)
            t.fail()
        } else {
            t.pass()
        }
    })
})