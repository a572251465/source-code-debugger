<h1 align="center">koa-bodyparser 分析结果</h1>

![在这里插入图片描述](https://img-blog.csdnimg.cn/9efc60f2fe284d258c2a47c96d728906.png#pic_center)

> 在看这个源码分析的时候，最好是可以看下关于`Koa`源码分析。这样其实两者都可以串联起来的了。

# 使用方式

> 最为`koa`标准中间件的写法。应该是如下两种情况

```js
const bodyParser = async (ctx, next) => {
  // todo
  await next();
};

// 使用
new Koa().use(bodyParser);
```

```js
// 通过高级参数的形式，可以进行额外的参数传递
const bodyParer = () => {
  // todo ...
  return async (ctx, next) => {
    // todo ...
    await next();
  }
}

// 使用
new Koa().use(bodyParer({...}))
```

# 核心代码

![在这里插入图片描述](https://img-blog.csdnimg.cn/cb2a0c78494445a6810aa1c664d954d8.png)

其实核心代码就两句话，为了避免重复的使用`koa-bodyparser` , 需要判断下是否有值，同时 如果你并不想要解析 body 的话，可以使用变量【disableBodyParser】 来进行判断。

那核心的解析 body 的代码在哪呢??? 使用此插件`co-body` 进行内容解析，然后返回。所以`koa-bodyparser`的参数其实也是符合`co-body`的参数。 但是其实本质上无非是以下代码的实现：

```js
new Koa().use(async (ctx, next) => {
  // todo ... 判断对应的类型 以及是否需要解析body
  ctx.request.body = await new Promise((resolve) => {
    let arr = [];
    ctx.req.on("data", function(chunk) {
      arr.push(chunk);
    })
    ctx.req.on("end", function() {
      const body = Buffer.concat(arr).toString();
      resolve(body);
    });
  })
});
```


