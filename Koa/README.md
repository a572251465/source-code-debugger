# 1. 前言
> 昨天花费了比较多的时间将`Koa`的源码阅读了一遍，主要是项目中用到了Koa，为了做的更加得心应手所以先将源码看一下，总体上源码还是非常简单的，没啥难度。一方面为了总结另一方面也是为了不太看懂源码的同学们，今天我会好好的写总结下，供大家学习。

# 2. 基础用法
```js
const Koa = require("koa");
const app = new Koa();

app.use( (ctx) => {
  ctx.body = "hello wold"
});

app.listen(3001, () => {
  console.log("服务启动成功")
})
```

> 以上简单的代码就是基于Koa的web程序。
> 1. 其实大致的用法跟`http.createserver`保持一致的
> 2. `app.use`中的函数 其实就是我们核心处理的逻辑
> 3. `.listen` 表示端口监听
> 4. 其实内容很简单，所以源码也比较简单，让我们来一起分析下吧。

# 3. koa 分析
## 3.1 核心文件
![在这里插入图片描述](https://img-blog.csdnimg.cn/2b27317ced5042818f97eed3b005dbb5.png)
- `application` Koa框架 入口级文件
- `context` Koa context上下文 文件
- `request` Koa request 请求文件
- `response` Koa response 响应文件
- `koa-componse` Koa 实现中间件串行的文件(**我从别的源码中扒拉过来的**)
- `delegates` Koa 实现ctx 属性代理的文件(**我从别的源码中扒拉过来的**)

## 3.2 构造初期化
> 其实文件`application.js` 是我们应用的入口。我们在开发过程中导出`Koa`,其实就是导出这个文件。通过下图可以看出。

![在这里插入图片描述](https://img-blog.csdnimg.cn/5856306e35ec45dab31ab8b1936f5623.png)

其实在Koa初期化的过程中，还是做了一些特殊的处理，接下来让我们看下。

![在这里插入图片描述](https://img-blog.csdnimg.cn/64ea85616fa64690a9e67aa8280a7977.png)
[源码位置](https://github.com/a572251465/source-code-debugger/blob/main/Code/koa/lib/application.js)

上述代码的作用在于：解决多个应用存在的问题，如下代码
```js
const Koa = require("koa")
const app = new Koa();
const app1 = new Koa();
const app2 = new Koa();

app.context.test = 1;
```
如果给一个app实例上赋值，那么所有的实例都会存在相同的值，所以使用`Object.create` 用来进行属性隔离的。

## 3.3 ctx特有属性
> 在使用中间件的时候，我们一般都会在ctx上获取一些属性，但是你知道有哪些值的分类吗？？？
> 1. `ctx.req, ctx.res` 指的是原生的http的req以及res。
> 2. `ctx.request, ctx.response` 指的框架自定义的属性，都可以在上面获取
> 3. `ctx.xxx` 如果从ctx上获取某些属性的话，其实是通过代理的形式来从`ctx.request, ctx.response`上获取的。
> 4. 接下来我们看下源码实现

```js
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
```

上述代码中实现了`你中有我，我中有你`。 会将`context`, `req`, `res`, `request`, `response` 互相关联。

### 3.3.1 QA
- **`问题：`** 为什么在函数`createContext`中会有`Object.create`呢？？？
- **`解答：`** 每次请求过来，开始执行中间件的时候都会调用此方法，所以每次都会生成一个新的ctx。从Koa的角度来看，每个请求都应该是一个全新的，不应该跟之前的有关联。 所以如果在中间件运行过程中给ctx挂载一个属性，只能给后面的中间件使用，无法做到下次请求使用

## 3.4 中间件核心原理
> 首先我们看下 添加中间件的本质：

```js
  use (fn) {
    // fn 必须是一个函数。 反之就会保存
    if (typeof fn !== 'function') throw new TypeError('middleware must be a function!')
    // 添加到数组中。 返回this。 可以进行use链
    this.middleware.push(fn)
    return this
  }
```

其实中间件`use`的部分无非是 将中间件函数添加到数组中。 每次都会串行执行所有的函数。那就让我们看来下 是如何串行的

```js
return function (context, next) {
  let index = -1;
  return dispatch(0);
  function dispatch(i) {
    index = i;
    let fn = middleware[i];
    // 此处就是将返回结果包裹Promise
    return Promise.resolve(fn(context, dispatch.bind(null, i + 1)));
  }
};
```

- 通过上述的代码其实我们可以看到，源码中无非是通过递归调用函数，将每个函数串行。
- 函数`fn`中第二个参数dispatch，其实就是我们平常使用的`next`函数。 如果不手动调用next，就不会执行下一个函数。
- 而且函数外面 我们其实是用`Promise.reoslve`包裹，所以内部使用async await 是一定没有错误的。不然会出现意向不到的错误。

![在这里插入图片描述](https://img-blog.csdnimg.cn/ed2169797f4049d59c15210a5d5966db.png#pic_center)


### 3.4.1 正确以及错误的实例
- 正确实例

```js
app.use(async (ctx, next) => {
  console.log(1)
  await next();
  console.log(4)
})
app.use(async (ctx, next) => {
  console.log(2)
  await next();
  console.log(5)
})
app.use(async (ctx, next) => {
  console.log(3)
  await next();
  console.log(6)
})
// 1 2 3 6 5 4
```

- 错误实例

```js
app.use(async (ctx, next) => {
  console.log(1)
  await next();
  console.log(4)
})
app.use(async (ctx, next) => {
  console.log(2)
  next();
  console.log(5)
})
app.use(async (ctx, next) => {
  console.log(3)
  await next();
  console.log(6)
})
// 1 2 3 5 6 4
```

## 3.5 ctx代理

> 其实在使用中间件的过程中，我们可以通过`ctx.headers` 来获取值，那么ctx真的会定义此属性吗？？？ 源码我就不进行粘贴了。看下[分析源码](https://github.com/a572251465/source-code-debugger/blob/main/Code/koa/lib/context.js)

其实只要有一定js代码基础的知道，我们可以通过`proxy`, 'Object.defineProperty', '\_\_defineGetter\_\_' 来进行代理。

而从ctx上获取值的原理也很简单：通过代理的形式，在使用ctx.属性 的时候，从`request`, 'response' 来获取值 从而返回。设置值 是同样如此的。

# 4. 结论：
> `Koa`的源码部分就分析到这里，其实都很简单没啥难度的。如果大家有什么不懂的，或是 有什么新的建议，可以在评论区及时跟我留言啊。