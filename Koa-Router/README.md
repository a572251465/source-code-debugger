<h1 align="center">Koa-Router</h1>

> 之前分析过 Koa/ Koa-Bodyparser 的源码，今天让我们来分析下`koa-router`的源码，这个插件其实还是挺重要的。毕竟作为路由，我们还是要知道他的工作原理
>
> 这里会重申下 其实我是分析了 koa-router 主干流程。一些小众类的方法并没有看，因为意义不大，基本都用不到，等用到了再去分析不晚。

## 简单使用

> 简单列举下 API

```js
const Router = require("koa-router");
const Koa = new require("koa");

const router = new Router();
router.post("/user/login", async function (ctx, next) {
  // todo ..
  await next();
});

router.get("/user/list", async function (ctx, next) {
  // todo ...
  await next();
});

const app = new Koa();

app.use(router.routes()).use(router.allowedMethods());
```

## 内容分析

### `router.post(...)` 都做了什么

> 其实这种动作`router.post/ router.get`等 做的内容是非常简单的。就是将每个路由，以及中间件 收集起来。 如下图

![在这里插入图片描述](https://img-blog.csdnimg.cn/73780ef42623495cbf956b4c3b0f87e9.png)

但是具体的是如何 进行收集的呢？？？ 接下来会用绘图的方式 给大家描述下：

![在这里插入图片描述](https://img-blog.csdnimg.cn/a37689134ec34f209b3d05b09478ba28.png)

### `router.routes()` 都做了什么

> 在这个逻辑中做了什么呢？？？ 大体的逻辑就是通过方法`match` 依据 stack 以及 path 来判断出合适的 layers。 然后挨个执行

![在这里插入图片描述](https://img-blog.csdnimg.cn/40830f6510ed4a76af05f5118b3e974a.png)

- 看如下代码，通过`router.match`方法获取匹配的到的 layer。
  ```js
  // matched 结构
  const matched = {
    path: [],
    pathAndMethod: [],
    route: false,
  };

  // 如果是第一次的话 一定是ctx.path 表示请求path
  const path = router.opts.routerPath || ctx.routerPath || ctx.path;
  // 此时匹配path  以及method  此时会匹配到 相同的path  以及相同的method
  const matched = router.match(path, ctx.method);
  ```
- 使用 reduce 方法将每个中间件函数 串行。 中间会插入自己定义的函数

  ```js
  layerChain =
    // exclusive === true的话 执行匹配到的最后一个方法  反之 所有的方法
    (router.exclusive ? [mostSpecificLayer] : matchedLayers).reduce(function (
      memo,
      layer
    ) {
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
    },
    []);
  ```

- 通过`koa-compose` 来串行执行。

  ```js
  compose(layerChain)(ctx, next);
  ```

### `router.allowedMethods()` 都做了什么

> 这个方法就不做太多的描述了。无非是对特定的返回值做特殊的处理。比如：如果是`options`请求 应该怎么办呢 等等

### QA

- **`问题：`** 会匹配到多个path，以及多个中间件吗？？？
- **`解答：`** 会的。因为path是允许是正则的，所以有可能会出现同一个ctx.path 符合多个router.path的。 同时也会将path对应的中间件函数收集起来。通过compose函数来执行，如果需要执行多个的话，每个中间件中调用next 即可