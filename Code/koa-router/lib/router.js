/**
 * RESTful resource routing middleware for koa.
 *
 * @author Alex Mingoia <talk@alexmingoia.com>
 * @link https://github.com/alexmingoia/koa-router
 */

const { debuglog } = require("util");

const compose = require("koa-compose");
const HttpError = require("http-errors");
const methods = require("methods");
const { pathToRegexp } = require("path-to-regexp");
const Layer = require("./layer");

const debug = debuglog("koa-router");

module.exports = Router;

// koa-router 的入口
function Router(opts = {}) {
  // 如果this 不是Router的实例 直接返回一个实例
  if (!(this instanceof Router)) return new Router(opts);

  //默认传递的参数
  this.opts = opts;
  // 默认允许的方法
  this.methods = this.opts.methods || [
    "HEAD",
    "OPTIONS",
    "GET",
    "PUT",
    "PATCH",
    "POST",
    "DELETE",
  ];
  // 表示如果匹配多个路由的话 访问最后一个控制器
  this.exclusive = Boolean(this.opts.exclusive);

  this.params = {};
  this.stack = [];
  this.host = this.opts.host;
}

// methods 此插件会返回http 所允许的所有的方法
for (const method_ of methods) {
  function setMethodVerb(method) {
    // 给Router函数上 挂载http 方法的 实例函数
    /**
     * Router.prototype.get = ...
     * Router.prototype.post = ...
     * Router.prototype.delete = ...
     * ...
     */
    Router.prototype[method] = function (name, path, middleware) {
      // 下面的if 判断就是将参数格式化
      if (typeof path === "string" || path instanceof RegExp) {
        middleware = Array.prototype.slice.call(arguments, 2);
      } else {
        // 一般我们会走这个分支
        /**
         * router.get("/user/logout", (ctx) => {})
         * router.get("/user/login", (ctx) => {})
         */
        middleware = Array.prototype.slice.call(arguments, 1);
        path = name;
        name = null;
      }

      if (
        typeof path !== "string" &&
        !(path instanceof RegExp) &&
        (!Array.isArray(path) || path.length === 0)
      )
        throw new Error(
          `You have to provide a path when adding a ${method} handler`
        );

      // 进行注册的方法
      this.register(path, [method], middleware, { name });

      return this;
    };
  }

  setMethodVerb(method_);
}

// Alias for `router.delete()` because delete is a reserved word
// eslint-disable-next-line dot-notation
Router.prototype.del = Router.prototype["delete"];

/**
 * Use given middleware.
 *
 * Middleware run in the order they are defined by `.use()`. They are invoked
 * sequentially, requests start at the first middleware and work their way
 * "down" the middleware stack.
 *
 * @example
 *
 * ```javascript
 * // session middleware will run before authorize
 * router
 *   .use(session())
 *   .use(authorize());
 *
 * // use middleware only with given path
 * router.use('/users', userAuth());
 *
 * // or with an array of paths
 * router.use(['/users', '/admin'], userAuth());
 *
 * app.use(router.routes());
 * ```
 *
 * @param {String=} path
 * @param {Function} middleware
 * @param {Function=} ...
 * @returns {Router}
 */

Router.prototype.use = function () {
  const router = this;
  // 认为所有的参数都是中间件函数
  const middleware = Array.prototype.slice.call(arguments);
  let path;

  // support array of paths
  // 此if判断中 将数组中每个值 都重新调用下use方法 重新来一遍
  /**
   * router.use(['/users', '/admin'], userAuth());
   *
   * =>
   *
   * router.use('/users', userAuth());
   * router.use('/admin', userAuth());
   */
  if (Array.isArray(middleware[0]) && typeof middleware[0][0] === "string") {
    const arrPaths = middleware[0];
    for (const p of arrPaths) {
      router.use.apply(router, [p].concat(middleware.slice(1)));
    }

    return this;
  }

  const hasPath = typeof middleware[0] === "string";
  if (hasPath) path = middleware.shift();

  // 此时middleware  应该都是方法
  for (const m of middleware) {
    if (m.router) {
      const cloneRouter = Object.assign(
        Object.create(Router.prototype),
        m.router,
        {
          stack: [...m.router.stack],
        }
      );

      for (let j = 0; j < cloneRouter.stack.length; j++) {
        const nestedLayer = cloneRouter.stack[j];
        const cloneLayer = Object.assign(
          Object.create(Layer.prototype),
          nestedLayer
        );

        if (path) cloneLayer.setPrefix(path);
        if (router.opts.prefix) cloneLayer.setPrefix(router.opts.prefix);
        router.stack.push(cloneLayer);
        cloneRouter.stack[j] = cloneLayer;
      }

      if (router.params) {
        function setRouterParams(paramArr) {
          const routerParams = paramArr;
          for (const key of routerParams) {
            cloneRouter.param(key, router.params[key]);
          }
        }

        setRouterParams(Object.keys(router.params));
      }
    } else {
      const keys = [];
      pathToRegexp(router.opts.prefix || "", keys);
      const routerPrefixHasParam = router.opts.prefix && keys.length;
      router.register(path || "([^/]*)", [], m, {
        end: false,
        ignoreCaptures: !hasPath && !routerPrefixHasParam,
      });
    }
  }

  return this;
};

/**
 * Set the path prefix for a Router instance that was already initialized.
 *
 * @example
 *
 * ```javascript
 * router.prefix('/things/:thing_id')
 * ```
 *
 * @param {String} prefix
 * @returns {Router}
 */

// 此方法其实就是为了设置前缀
Router.prototype.prefix = function (prefix) {
  prefix = prefix.replace(/\/$/, "");

  this.opts.prefix = prefix;

  for (let i = 0; i < this.stack.length; i++) {
    const route = this.stack[i];
    route.setPrefix(prefix);
  }

  return this;
};

/**
 * Returns router middleware which dispatches a route matching the request.
 *
 * @returns {Function}
 */

// 使用核心方法
Router.prototype.routes = Router.prototype.middleware = function () {
  const router = this;

  // 这个方法就是koa中间件 需要执行的方法
  const dispatch = function dispatch(ctx, next) {
    debug("%s %s", ctx.method, ctx.path);

    const hostMatched = router.matchHost(ctx.host);

    // 如果连限定的host 都不对的话 直接返回
    if (!hostMatched) {
      return next();
    }

    // 如果是第一次的话 一定是ctx.path 表示请求path
    const path = router.opts.routerPath || ctx.routerPath || ctx.path;
    // 此时匹配path  以及method  此时会匹配到 相同的path  以及相同的method
    const matched = router.match(path, ctx.method);
    let layerChain;

    // ctx.matched 如果是第一次匹配 肯定不满足 直接走else
    if (ctx.matched) {
      ctx.matched.push.apply(ctx.matched, matched.path);
    } else {
      // 匹配到的所有的满足path 的layer
      ctx.matched = matched.path;
    }

    ctx.router = router;

    // 如果没有匹配到的话 直接走下一个中间件
    if (!matched.route) return next();

    // 满足方法的layer
    const matchedLayers = matched.pathAndMethod;
    // 表示函数数组中 最后一个元素
    const mostSpecificLayer = matchedLayers[matchedLayers.length - 1];
    // mostSpecificLayer.path 最后一个执行的方法
    ctx._matchedRoute = mostSpecificLayer.path;
    if (mostSpecificLayer.name) {
      ctx._matchedRouteName = mostSpecificLayer.name;
    }

    layerChain = (
      // exclusive === true的话 执行匹配到的最后一个方法  反之 所有的方法
      router.exclusive ? [mostSpecificLayer] : matchedLayers
    ).reduce(function (memo, layer) {
      memo.push(function (ctx, next) {
        // 表示前置中间件。 记录一些路由信息
        ctx.captures = layer.captures(path, ctx.captures);
        ctx.params = ctx.request.params = layer.params(
          path,
          ctx.captures,
          ctx.params
        );
        ctx.routerPath = layer.path;
        ctx.routerName = layer.name;
        ctx._matchedRoute = layer.path;
        if (layer.name) {
          ctx._matchedRouteName = layer.name;
        }

        return next();
      });
      return memo.concat(layer.stack);
    }, []);

    // layerChain [[前置][定义方法][前置][定义方法][前置][定义方法]]
    return compose(layerChain)(ctx, next);
  };

  dispatch.router = this;

  return dispatch;
};

/**
 * Returns separate middleware for responding to `OPTIONS` requests with
 * an `Allow` header containing the allowed methods, as well as responding
 * with `405 Method Not Allowed` and `501 Not Implemented` as appropriate.
 *
 * @example
 *
 * ```javascript
 * const Koa = require('koa');
 * const Router = require('@koa/router');
 *
 * const app = new Koa();
 * const router = new Router();
 *
 * app.use(router.routes());
 * app.use(router.allowedMethods());
 * ```
 *
 * **Example with [Boom](https://github.com/hapijs/boom)**
 *
 * ```javascript
 * const Koa = require('koa');
 * const Router = require('@koa/router');
 * const Boom = require('boom');
 *
 * const app = new Koa();
 * const router = new Router();
 *
 * app.use(router.routes());
 * app.use(router.allowedMethods({
 *   throw: true,
 *   notImplemented: () => new Boom.notImplemented(),
 *   methodNotAllowed: () => new Boom.methodNotAllowed()
 * }));
 * ```
 *
 * @param {Object=} options
 * @param {Boolean=} options.throw throw error instead of setting status and header
 * @param {Function=} options.notImplemented throw the returned value in place of the default NotImplemented error
 * @param {Function=} options.methodNotAllowed throw the returned value in place of the default MethodNotAllowed error
 * @returns {Function}
 */

// 外部使用的中间件 允许的所有的方法
Router.prototype.allowedMethods = function (options = {}) {
  const implemented = this.methods;

  // 中间件的核心方法
  return function allowedMethods(ctx, next) {
    // 执行下一个next 然后执行then
    return next().then(function () {
      const allowed = {};

      if (!ctx.status || ctx.status === 404) {
        for (let i = 0; i < ctx.matched.length; i++) {
          // 此时route 表示layer
          const route = ctx.matched[i];
          for (let j = 0; j < route.methods.length; j++) {
            const method = route.methods[j];
            // 表示允许的方法
            allowed[method] = method;
          }
        }

        const allowedArr = Object.keys(allowed);

        // 是否在基础方法内
        if (!~implemented.indexOf(ctx.method)) {
          if (options.throw) {
            const notImplementedThrowable =
              typeof options.notImplemented === "function"
                ? options.notImplemented() // set whatever the user returns from their function
                : new HttpError.NotImplemented();

            throw notImplementedThrowable;
          } else {
            // 如果不允许包错的话 会返回状态501
            ctx.status = 501;
            ctx.set("Allow", allowedArr.join(", "));
          }
        } else if (allowedArr.length > 0) {
          // 如果是options 预检请求会如何
          if (ctx.method === "OPTIONS") {
            ctx.status = 200;
            ctx.body = "";
            ctx.set("Allow", allowedArr.join(", "));
          } else if (!allowed[ctx.method]) {
            if (options.throw) {
              const notAllowedThrowable =
                typeof options.methodNotAllowed === "function"
                  ? options.methodNotAllowed() // set whatever the user returns from their function
                  : new HttpError.MethodNotAllowed();

              throw notAllowedThrowable;
            } else {
              ctx.status = 405;
              ctx.set("Allow", allowedArr.join(", "));
            }
          }
        }
      }
    });
  };
};

/**
 * Register route with all methods.
 *
 * @param {String} name Optional.
 * @param {String} path
 * @param {Function=} middleware You may also pass multiple middleware.
 * @param {Function} callback
 * @returns {Router}
 */

Router.prototype.all = function (name, path, middleware) {
  if (typeof path === "string") {
    middleware = Array.prototype.slice.call(arguments, 2);
  } else {
    middleware = Array.prototype.slice.call(arguments, 1);
    path = name;
    name = null;
  }

  // Sanity check to ensure we have a viable path candidate (eg: string|regex|non-empty array)
  if (
    typeof path !== "string" &&
    !(path instanceof RegExp) &&
    (!Array.isArray(path) || path.length === 0)
  )
    throw new Error("You have to provide a path when adding an all handler");

  this.register(path, methods, middleware, { name });

  return this;
};

/**
 * Redirect `source` to `destination` URL with optional 30x status `code`.
 *
 * Both `source` and `destination` can be route names.
 *
 * ```javascript
 * router.redirect('/login', 'sign-in');
 * ```
 *
 * This is equivalent to:
 *
 * ```javascript
 * router.all('/login', ctx => {
 *   ctx.redirect('/sign-in');
 *   ctx.status = 301;
 * });
 * ```
 *
 * @param {String} source URL or route name.
 * @param {String} destination URL or route name.
 * @param {Number=} code HTTP status code (default: 301).
 * @returns {Router}
 */

Router.prototype.redirect = function (source, destination, code) {
  // lookup source route by name
  if (typeof source === "symbol" || source[0] !== "/") {
    source = this.url(source);
    if (source instanceof Error) throw source;
  }

  // lookup destination route by name
  if (
    typeof destination === "symbol" ||
    (destination[0] !== "/" && !destination.includes("://"))
  ) {
    destination = this.url(destination);
    if (destination instanceof Error) throw destination;
  }

  return this.all(source, (ctx) => {
    ctx.redirect(destination);
    ctx.status = code || 301;
  });
};

/**
 * Create and register a route.
 *
 * @param {String} path Path string.
 * @param {Array.<String>} methods Array of HTTP verbs.
 * @param {Function} middleware Multiple middleware also accepted.
 * @returns {Layer}
 * @private
 */

Router.prototype.register = function (path, methods, middleware, opts = {}) {
  const router = this;
  const { stack } = this;

  // support array of paths
  if (Array.isArray(path)) {
    for (const curPath of path) {
      router.register.call(router, curPath, methods, middleware, opts);
    }

    return this;
  }

  // create route
  // 创建Layer 实例。 每一个路由都是一个Layer 实例。 因为每次都会调用该方法
  const route = new Layer(path, methods, middleware, {
    end: opts.end === false ? opts.end : true,
    name: opts.name,
    sensitive: opts.sensitive || this.opts.sensitive || false,
    strict: opts.strict || this.opts.strict || false,
    prefix: opts.prefix || this.opts.prefix || "",
    ignoreCaptures: opts.ignoreCaptures,
  });

  // 如果添加了共同的前缀 就设置共同前缀
  if (this.opts.prefix) {
    route.setPrefix(this.opts.prefix);
  }

  // add parameter middleware
  for (let i = 0; i < Object.keys(this.params).length; i++) {
    const param = Object.keys(this.params)[i];
    route.param(param, this.params[param]);
  }

  // 给实例属性stack 中 添加Layer实例
  stack.push(route);

  debug("defined route %s %s", route.methods, route.path);

  return route;
};

/**
 * Lookup route with given `name`.
 *
 * @param {String} name
 * @returns {Layer|false}
 */

Router.prototype.route = function (name) {
  const routes = this.stack;

  for (let len = routes.length, i = 0; i < len; i++) {
    if (routes[i].name && routes[i].name === name) return routes[i];
  }

  return false;
};

/**
 * Generate URL for route. Takes a route name and map of named `params`.
 *
 * @example
 *
 * ```javascript
 * router.get('user', '/users/:id', (ctx, next) => {
 *   // ...
 * });
 *
 * router.url('user', 3);
 * // => "/users/3"
 *
 * router.url('user', { id: 3 });
 * // => "/users/3"
 *
 * router.use((ctx, next) => {
 *   // redirect to named route
 *   ctx.redirect(ctx.router.url('sign-in'));
 * })
 *
 * router.url('user', { id: 3 }, { query: { limit: 1 } });
 * // => "/users/3?limit=1"
 *
 * router.url('user', { id: 3 }, { query: "limit=1" });
 * // => "/users/3?limit=1"
 * ```
 *
 * @param {String} name route name
 * @param {Object} params url parameters
 * @param {Object} [options] options parameter
 * @param {Object|String} [options.query] query options
 * @returns {String|Error}
 */

Router.prototype.url = function (name, params) {
  const route = this.route(name);

  if (route) {
    const args = Array.prototype.slice.call(arguments, 1);
    return route.url.apply(route, args);
  }

  return new Error(`No route found for name: ${String(name)}`);
};

/**
 * Match given `path` and return corresponding routes.
 *
 * @param {String} path
 * @param {String} method
 * @returns {Object.<path, pathAndMethod>} returns layers that matched path and
 * path and method.
 * @private
 */

// 此方法是匹配path  以及method的
Router.prototype.match = function (path, method) {
  // 通过router.post(...) router.get(...) router.use(...) 存入的stack中
  // 返回所有的待扫描的名称 以及方法
  const layers = this.stack;
  let layer;
  const matched = {
    path: [],
    pathAndMethod: [],
    route: false,
  };

  // 表示倒着循环
  for (let len = layers.length, i = 0; i < len; i++) {
    // 每个layer 实例
    layer = layers[i];

    debug("test %s %s", layer.path, layer.regexp);

    // eslint-disable-next-line unicorn/prefer-regexp-test
    // 匹配path 是否一致
    if (layer.match(path)) {
      // 如果一致的话 直接添加到数组
      matched.path.push(layer);

      if (layer.methods.length === 0 || ~layer.methods.indexOf(method)) {
        // method 保持一致的都添加到数组中
        matched.pathAndMethod.push(layer);
        if (layer.methods.length > 0) matched.route = true;
      }
    }
  }

  return matched;
};

/**
 * Match given `input` to allowed host
 * @param {String} input
 * @returns {boolean}
 */

Router.prototype.matchHost = function (input) {
  const { host } = this;

  if (!host) {
    return true;
  }

  if (!input) {
    return false;
  }

  if (typeof host === "string") {
    return input === host;
  }

  if (typeof host === "object" && host instanceof RegExp) {
    return host.test(input);
  }
};

/**
 * Run middleware for named route parameters. Useful for auto-loading or
 * validation.
 *
 * @example
 *
 * ```javascript
 * router
 *   .param('user', (id, ctx, next) => {
 *     ctx.user = users[id];
 *     if (!ctx.user) return ctx.status = 404;
 *     return next();
 *   })
 *   .get('/users/:user', ctx => {
 *     ctx.body = ctx.user;
 *   })
 *   .get('/users/:user/friends', ctx => {
 *     return ctx.user.getFriends().then(function(friends) {
 *       ctx.body = friends;
 *     });
 *   })
 *   // /users/3 => {"id": 3, "name": "Alex"}
 *   // /users/3/friends => [{"id": 4, "name": "TJ"}]
 * ```
 *
 * @param {String} param
 * @param {Function} middleware
 * @returns {Router}
 */

Router.prototype.param = function (param, middleware) {
  this.params[param] = middleware;
  for (let i = 0; i < this.stack.length; i++) {
    const route = this.stack[i];
    route.param(param, middleware);
  }

  return this;
};

/**
 * Generate URL from url pattern and given `params`.
 *
 * @example
 *
 * ```javascript
 * const url = Router.url('/users/:id', {id: 1});
 * // => "/users/1"
 * ```
 *
 * @param {String} path url pattern
 * @param {Object} params url parameters
 * @returns {String}
 */
Router.url = function (path) {
  const args = Array.prototype.slice.call(arguments, 1);
  return Layer.prototype.url.apply({ path }, args);
};
