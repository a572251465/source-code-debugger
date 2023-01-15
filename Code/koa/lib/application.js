
'use strict'

/**
 * Module dependencies.
 */

const debug = require('debug')('koa:application')
const assert = require('assert')
const onFinished = require('on-finished')
const response = require('./response')
const compose = require('koa-compose')
const context = require('./context')
const request = require('./request')
const statuses = require('statuses')
const Emitter = require('events')
const util = require('util')
const Stream = require('stream')
const http = require('http')
const only = require('only')
const { HttpError } = require('http-errors')

// 此class  就是导出Koa。 new Koa 的过程 就是 new Application过程
// 继承Emitter  表示允许发布订阅
module.exports = class Application extends Emitter {
  constructor (options) {
    super()
    options = options || {}
    this.proxy = options.proxy || false
    this.subdomainOffset = options.subdomainOffset || 2
    this.proxyIpHeader = options.proxyIpHeader || 'X-Forwarded-For'
    this.maxIpsCount = options.maxIpsCount || 0
    this.env = options.env || process.env.NODE_ENV || 'development'
    // 表示compose 函数
    this.compose = options.compose || compose
    if (options.keys) this.keys = options.keys
    // 此数组就是为了收集中间件
    this.middleware = []

    /**
     * 使用Object.create的目的：
     * 避免程序中遇到多个new Koa 使用一个实例。
     * 所以每次执行new Koa的时候 都会重新Object.create一份。 但是他们通过原型共指一个目录
     */
    // 表示上下文
    this.context = Object.create(context)
    // 表示request请求。
    this.request = Object.create(request)
    // 表示response请求
    this.response = Object.create(response)
    // util.inspect.custom support for node 6+
    /* istanbul ignore else */
    if (util.inspect.custom) {
      this[util.inspect.custom] = this.inspect
    }
    if (options.asyncLocalStorage) {
      const { AsyncLocalStorage } = require('async_hooks')
      assert(AsyncLocalStorage, 'Requires node 12.17.0 or higher to enable asyncLocalStorage')
      this.ctxStorage = new AsyncLocalStorage()
      this.use(this.createAsyncCtxStorageMiddleware())
    }
  }

  // 此方法跟createServer 的listen方法保持一致
  listen (...args) {
    debug('listen')
    const server = http.createServer(this.callback())
    return server.listen(...args)
  }

  /**
   * Return JSON representation.
   * We only bother showing settings.
   *
   * @return {Object}
   * @api public
   */

  toJSON () {
    return only(this, [
      'subdomainOffset',
      'proxy',
      'env'
    ])
  }

  /**
   * Inspect implementation.
   *
   * @return {Object}
   * @api public
   */

  inspect () {
    return this.toJSON()
  }

  /**
   * Use the given middleware `fn`.
   *
   * Old-style middleware will be converted.
   *
   * @param {(context: Context) => Promise<any | void>} fn
   * @return {Application} self
   * @api public
   */

  // 此方法就是核心的use方法
  use (fn) {
    // fn 必须是一个函数。 反之就会保存
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!')
    debug('use %s', fn._name || fn.name || '-')
    // 添加到数组中。 返回this。 可以进行use链
    this.middleware.push(fn)
    return this
  }

  /**
   * Return a request handler callback
   * for node's native http server.
   *
   * @return {Function}
   * @api public
   */

  callback () {
    // 执行中间件
    const fn = this.compose(this.middleware)

    if (!this.listenerCount('error')) this.on('error', this.onerror)

    // 其实callback 返回的是此方法
    // todo 其实每次执行请求的时候  都会执行这个 因为此函数是http.createServer 回调函数
    const handleRequest = (req, res) => {
      // 所以 每次请求过来时，都会生成一个新的context
      const ctx = this.createContext(req, res)
      return this.handleRequest(ctx, fn)
    }

    return handleRequest
  }

  /**
   * return current context from async local storage
   */
  get currentContext () {
    if (this.ctxStorage) return this.ctxStorage.getStore()
  }

  /**
   * Handle request in callback.
   *
   * @api private
   */

  handleRequest (ctx, fnMiddleware) {
    const res = ctx.res
    // 默认状态就是404
    res.statusCode = 404
    const onerror = err => ctx.onerror(err)
    const handleResponse = () => respond(ctx)
    onFinished(res, onerror)
    return fnMiddleware(ctx).then(handleResponse).catch(onerror)
  }

  /**
   * Initialize a new context.
   *
   * @api private
   */

  // 此方法就是为了生成一个上下文对象
  /**
   * context 表示上下文ctx
   * ctx.req 是沿用http server 的req。 是http本身的。 那么res也是如此
   * ctx.request 是koa 独立构造的request， response也是如此
   */
  createContext (req, res) {
    // 为了每次请求都会有一个新上下文内容 所以每次请求都会进行Object.create
    const context = Object.create(this.context)
    const request = context.request = Object.create(this.request)
    const response = context.response = Object.create(this.response)

    // 下面赋值的目的在于 "你中有我，我中有你"
    context.app = request.app = response.app = this
    context.req = request.req = response.req = req
    context.res = request.res = response.res = res
    request.ctx = response.ctx = context
    request.response = response
    response.request = request
    context.originalUrl = request.originalUrl = req.url
    context.state = {}
    return context
  }

  /**
   * Default error handler.
   *
   * @param {Error} err
   * @api private
   */

  onerror (err) {
    // When dealing with cross-globals a normal `instanceof` check doesn't work properly.
    // See https://github.com/koajs/koa/issues/1466
    // We can probably remove it once jest fixes https://github.com/facebook/jest/issues/2549.
    const isNativeError =
      Object.prototype.toString.call(err) === '[object Error]' ||
      err instanceof Error
    if (!isNativeError) throw new TypeError(util.format('non-error thrown: %j', err))

    if (err.status === 404 || err.expose) return
    if (this.silent) return

    const msg = err.stack || err.toString()
    console.error(`\n${msg.replace(/^/gm, '  ')}\n`)
  }

  /**
   * Help TS users comply to CommonJS, ESM, bundler mismatch.
   * @see https://github.com/koajs/koa/issues/1513
   */

  static get default () {
    return Application
  }

  createAsyncCtxStorageMiddleware () {
    const app = this
    return async function asyncCtxStorage (ctx, next) {
      await app.ctxStorage.run(ctx, async () => {
        return await next()
      })
    }
  }
}

/**
 * Response helper.
 */

function respond (ctx) {
  // allow bypassing koa
  if (ctx.respond === false) return

  if (!ctx.writable) return

  const res = ctx.res
  // 表示返回值 以及返回状态
  let body = ctx.body
  const code = ctx.status

  // ignore body
  // 如果是指定的code  就会忽略body
  if (statuses.empty[code]) {
    // strip headers
    ctx.body = null
    return res.end()
  }

  // 判断是否是HEAD 请求
  if (ctx.method === 'HEAD') {
    if (!res.headersSent && !ctx.response.has('Content-Length')) {
      const { length } = ctx.response
      if (Number.isInteger(length)) ctx.length = length
    }
    return res.end()
  }

  // status body
  if (body == null) {
    if (ctx.response._explicitNullBody) {
      ctx.response.remove('Content-Type')
      ctx.response.remove('Transfer-Encoding')
      ctx.length = 0
      return res.end()
    }
    if (ctx.req.httpVersionMajor >= 2) {
      body = String(code)
    } else {
      body = ctx.message || String(code)
    }
    if (!res.headersSent) {
      ctx.type = 'text'
      ctx.length = Buffer.byteLength(body)
    }
    return res.end(body)
  }

  // responses
  if (Buffer.isBuffer(body)) return res.end(body)
  if (typeof body === 'string') return res.end(body)
  if (body instanceof Stream) return body.pipe(res)

  // body: json
  body = JSON.stringify(body)
  if (!res.headersSent) {
    ctx.length = Buffer.byteLength(body)
  }
  res.end(body)
}

/**
 * Make HttpError available to consumers of the library so that consumers don't
 * have a direct dependency upon `http-errors`
 */

module.exports.HttpError = HttpError
