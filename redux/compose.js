/**
 * Composes single-argument functions from right to left. The rightmost
 * function can take multiple arguments as it provides the signature for
 * the resulting composite function.
 *
 * @param {...Function} funcs The functions to compose.
 * @returns {Function} A function obtained by composing the argument functions
 * from right to left. For example, compose(f, g, h) is identical to doing
 * (...args) => f(g(h(...args))).
 */

export default function compose(...funcs) {
  if (funcs.length === 0) {
    return arg => arg
  }

  if (funcs.length === 1) {
    return funcs[0]
  }

  return funcs.reduce ((a, b) => (...args) => a (b (...args)))
}
/*

  这是js的函数式编程的写法。举例：
  f1,f2,f3都是函数
  compose(f1,f2,f3) 等价于 f1(f2(f3))
  相当于把传入compose函数的参数，组合成了一个蜈蚣，函数f3执行后的返回值是函数f2的参数，函数f2的返回值是f1的参数

  funcs.reduce ((a, b) => (...args) => a (b (...args)))
  转化成es5的写法就是

  funcs.reduce(function(a,b){
    return function(...args){
        return a(b(...args))
    }
  })
  理解这个函数首先要理解reduce函数的第一参数是个什么

  reduce的第一个参数为数组中的每一个元素依次执行callback函数，不包括数组中被删除或从未被赋值的元素，接受四个参数：
    accumulator
    currentValue
    currentIndex
    array

  回调函数第一次执行时，accumulator 和currentValue的取值有两种情况：
  调用reduce时提供initialValue，accumulator取值为initialValue，currentValue取数组中的第一个值；
  没有提供 initialValue，accumulator取数组中的第一个值，currentValue取数组中的第二个值。

  注意：如果没有提供initialValue，reduce 会从索引1的地方开始执行 callback 方法，
  跳过第一个索引。如果提供initialValue，从索引0开始。

  结合上面的例子就是
  第一步：
  accumulator = f1
  currentValue = f2
  返回函数 f1(f2(...args))

  第二步：
  注意：这里可以理解成f3将要去代替f2(...args)的中参数的位置
  accumulator = f1(f2(...args))
  currentValue = f3

  返回函数 f1(f2(f3(...args)))

 */

