import { ActionTypes } from "./createStore"
import isPlainObject from "lodash/isPlainObject"
import warning from "./utils/warning"

function getUndefinedStateErrorMessage(key, action) {
  const actionType = action && action.type
  const actionName = (actionType && `"${actionType.toString()}"`) || "an action"

  return (
    `Given action ${actionName}, reducer "${key}" returned undefined. ` +
    `To ignore an action, you must explicitly return the previous state. ` +
    `If you want this reducer to hold no value, you can return null instead of undefined.`
  )
}

function getUnexpectedStateShapeWarningMessage(
  inputState,
  reducers,
  action,
  unexpectedKeyCache
) {
  // reducers是传入的已经处理过的finalReducers
  const reducerKeys = Object.keys(reducers)
  const argumentName =
    action && action.type === ActionTypes.INIT
      ? "preloadedState argument passed to createStore"
      : "previous state received by the reducer"
  // reducers数组不能为空
  if (reducerKeys.length === 0) {
    return (
      "Store does not have a valid reducer. Make sure the argument passed " +
      "to combineReducers is an object whose values are reducers."
    )
  }
  // 传入的state必须是个原生的对象
  if (!isPlainObject(inputState)) {
    return (
      `The ${argumentName} has unexpected type of "` +
      {}.toString.call(inputState).match(/\s([a-z|A-Z]+)/)[1] +
      `". Expected argument to be an object with the following ` +
      `keys: "${reducerKeys.join('", "')}"`
    )
  }
  // 去除state上面多余的key
  const unexpectedKeys = Object.keys(inputState).filter(
    key => !reducers.hasOwnProperty(key) && !unexpectedKeyCache[key]
  )

  unexpectedKeys.forEach(key => {
    unexpectedKeyCache[key] = true
  })

  if (unexpectedKeys.length > 0) {
    return (
      `Unexpected ${unexpectedKeys.length > 1 ? "keys" : "key"} ` +
      `"${unexpectedKeys.join('", "')}" found in ${argumentName}. ` +
      `Expected to find one of the known reducer keys instead: ` +
      `"${reducerKeys.join('", "')}". Unexpected keys will be ignored.`
    )
  }
}

function assertReducerShape(reducers) {
  // 循环reducers数组
  Object.keys(reducers).forEach(key => {
    const reducer = reducers[key]
    // 初始化判断每个reucer处理之后，返回的state是否存在
    // 给每个reducer传入一个默认的action
    const initialState = reducer(undefined, { type: ActionTypes.INIT })
    // 如何
    if (typeof initialState === "undefined") {
      throw new Error(
        `Reducer "${key}" returned undefined during initialization. ` +
          `If the state passed to the reducer is undefined, you must ` +
          `explicitly return the initial state. The initial state may ` +
          `not be undefined. If you don't want to set a value for this reducer, ` +
          `you can use null instead of undefined.`
      )
    }
    // 传入一个随机的action
    const type =
      "@@redux/PROBE_UNKNOWN_ACTION_" +
      Math.random()
        .toString(36)
        .substring(7)
        .split("")
        .join(".")
    if (typeof reducer(undefined, { type }) === "undefined") {
      throw new Error(
        `Reducer "${key}" returned undefined when probed with a random type. ` +
          `Don't try to handle ${
            ActionTypes.INIT
          } or other actions in "redux/*" ` +
          `namespace. They are considered private. Instead, you must return the ` +
          `current state for any unknown actions, unless it is undefined, ` +
          `in which case you must return the initial state, regardless of the ` +
          `action type. The initial state may not be undefined, but can be null.`
      )
    }
  })
}

/**
 * Turns an object whose values are different reducer functions, into a single
 * reducer function. It will call every child reducer, and gather their results
 * into a single state object, whose keys correspond to the keys of the passed
 * reducer functions.
 *
 * @param {Object} reducers An object whose values correspond to different
 * reducer functions that need to be combined into one. One handy way to obtain
 * it is to use ES6 `import * as reducers` syntax. The reducers may never return
 * undefined for any action. Instead, they should return their initial state
 * if the state passed to them was undefined, and the current state for any
 * unrecognized action.
 *
 * @returns {Function} A reducer function that invokes every reducer inside the
 * passed object, and builds a state object with the same shape.
 */
export default function combineReducers(reducers) {
  // 首先把所有的reducer的命名转换成数组
  const reducerKeys = Object.keys(reducers)
  // 用来存储最后合法的reducerKeys的对象
  const finalReducers = {}
  // 循环 reducerKeys ，筛出掉reduer没赋值的情况
  for (let i = 0; i < reducerKeys.length; i++) {
    const key = reducerKeys[i]
    // 非生产环境报警告
    if (process.env.NODE_ENV !== "production") {
      if (typeof reducers[key] === "undefined") {
        warning(`No reducer provided for key "${key}"`)
      }
    }

    if (typeof reducers[key] === "function") {
      finalReducers[key] = reducers[key]
    }
  }
  // 用来存储最后合法的reducerKeys的数组，
  const finalReducerKeys = Object.keys(finalReducers)
  // 用来存储不需要的
  let unexpectedKeyCache
  if (process.env.NODE_ENV !== "production") {
    unexpectedKeyCache = {}
  }

  let shapeAssertionError
  try {
    // 判断每个reducer是否符合规范
    assertReducerShape(finalReducers)
  } catch (e) {
    shapeAssertionError = e
  }

  return function combination(state = {}, action) {
    if (shapeAssertionError) {
      throw shapeAssertionError
    }

    if (process.env.NODE_ENV !== "production") {
      const warningMessage = getUnexpectedStateShapeWarningMessage(
        state,
        finalReducers,
        action,
        unexpectedKeyCache
      )
      if (warningMessage) {
        warning(warningMessage)
      }
    }
    // 标记state是否被改变
    let hasChanged = false
    // 存储被处理过的总的state
    const nextState = {}
    // 循环遍历 finalReducerKeys ,执行所有的 reducer, 所以大家一定不要有相同的 action.type ,否则你的状态一定会混乱的
    for (let i = 0; i < finalReducerKeys.length; i++) {
      // 取出当前的key
      const key = finalReducerKeys[i]
      // 取出reducer
      const reducer = finalReducers[key]
      // 获取当前key的state,
      const previousStateForKey = state[key]
      // 执行当前的reducer
      const nextStateForKey = reducer(previousStateForKey, action)
      // 如果当前的reduer处理之后state[key]返回undefined，就直接抛出错误，所以这里每个reducer必须要有返回一个默认值，且不能为空
      if (typeof nextStateForKey === "undefined") {
        const errorMessage = getUndefinedStateErrorMessage(key, action)
        throw new Error(errorMessage)
      }
      // 赋值到总state对应的key上面
      nextState[key] = nextStateForKey
      // 判断state是否已经经过reducer改变了
      hasChanged = hasChanged || nextStateForKey !== previousStateForKey
    }
    return hasChanged ? nextState : state
  }
}
