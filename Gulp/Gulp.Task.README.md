<h1 align="center">gulp task 实现过程</h1>

> 今天从源码的角度分析下 gulp 中 task 的实现过程。多个 task 是如何执行？？？ 等等

## gulp 插件分布图

![在这里插入图片描述](https://img-blog.csdnimg.cn/983a2473f0524ac2b8c11c8e9b3a626f.png)

其实通过上述截图可以看到，其实整个 gulp 内部什么逻辑都没有，都是由一个一个插件组成的。上述的截图绘制了重要的插件，更详细的插件可以观看源码。

## 简单实例

### default 以及默认回调

```js
function defaultTask(cb) {
  console.log("执行了默认的task 任务");
  cb();
}

exports.default = defaultTask;
```

### 串行 执行插件

```js
const { series } = require("gulp");

const clean = (cb) => {
  console.log("clean task");
  cb();
};

const build = (cb) => {
  console.log("build task");
  cb();
};

exports.default = series(clean, build);
```

### 通过 promise 表示完成

```js
const { series } = require("gulp");

const task1 = () => {
  return new Promise((resolve) => {
    console.log("task1 ...");
    resolve();
  });
};

const task2 = (done) => {
  console.log("task2 ...");
  done();
};

exports.default = series(task1, task2);
```

### API【task】注册

```js
const { task, series } = require("gulp");

task("build", function (done) {
  console.log("build exec success ...");
  done();
});

exports.default = series("build");
```

## 分析 task 注册过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/403d322c3e9a4aa8b28447d763fe813f.png)

> 上述 通过几段 js 代码来实现了 task 任务注册逻辑，接下来讲述下源码中是如何实现 task 的。实现 task 大体分为两种方式：

- 通过调用 task API 来实现任务注册
- 通过`gulpfile.js(exports.xxx = xx)` 中导出方法 来实现自动注册

### 手动注册 task 任务

- 首先我们是通过插件`gulp` 来导出 task。但是 task 本身从插件`undertaker`中继承过来的，所以我们移步看插件 undertaker 实现原理
  ```js
  let Undertaker = require("undertaker");
  Undertaker.call(this);
  // ......
  this.task = this.task.bind(this);
  ```
- 然后我们查看插件【undertaker】中 task.js, 这个导出的 task 方法，其实就是我们调用的真正 task 方法
- task 方法中 定义了`_setTask`, `_getTask` 方法。但是 task 的核心本质是，如下代码

  ```js
  this._tasks = {};

  UndertakerRegistry.prototype.get = fn;
  UndertakerRegistry.prototype.set = fn;
  ```

- 其实就是将 name, fn 存放到对象中。需要的时候从对象中获取。

### 通过 gulpfile.js 自动注册

- 通过脚手架【gulp-cli】来读取 gulpfile.js 文件
- 执行的位置【`gulp-cli/lib/versioned/^4.0.0/index.js`】
- 然后通过代码`registerExports(gulpInst, exported);` 注册到gulp实例上
  - `gulpInst` 其实就是 gulp 实例
  - `exported` 其实就是导出对象`exports`
- 执行对应注册 task 的 js。如：`register-exports.js`
- 注册详细步骤 跟 【`手动注册task任务`】 保持一致

## 一次执行`series` 的过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/7c8e2ff1fdeb49b1bcb1bf622befcac0.png#pic_center)

> 上述的截图中参照【series.js 实现方式】【一次 series 执行流程】

### series.js 实现方式

- 调用函数`series 函数` , 这个函数会返回真正要执行的函数，具体步骤如下：
  - 步骤 1：`const create = bach.series` 执行如左侧代码 create 函数就是为了执行内部的 next 以及 dispatch 方法
  - 步骤 2：`var args = normalizeArgs(this._registry, arguments);` 执行左侧代码。目的是为了将函数格式化。格式化的方式大致分为以下两种：
    - 第一种：如果参数是函数，直接返回函数
    - 第二种：如果参数是字符串，通过\_registry.tasks 找到对应名称的 函数，并且返回
  - 步骤 3：`var fn = create(args, extensions);` 将上述步骤 2 的参数给 create 方法，返回需要的函数
- 这里说下 函数`series` 返回 fn 函数后 具体的逻辑：
  - 上述【步骤 2】中会返回一个函数数组，数组会传递到mapSeries函数中。 如下图
  - ![在这里插入图片描述](https://img-blog.csdnimg.cn/c4868590274b4fbd8af84e651a26b0c5.png)
  - 然后会执行核心方法【mapSeries】(位置: `3.mapSeries.js` 内容)。
  - 既然 mapSeries 的第一个参数 args 是一个函数数组，那么首先以 index = 0 为条件，获取第一个函数
  - 第一个函数执行成功后，index 自增，再次执行 next 函数，一次类推实现串行执行

### 一次执行的过程

> 主要是看懂上述`series.js 实现方式` 原理。
> <br/> ![在这里插入图片描述](https://img-blog.csdnimg.cn/a54c278c878c4cb7865d5a1d306b2bb8.png)
> 上述截图中：`gulpInst` => gulp 实例， `runMethod` => 表示 series 参数。 `toRun` => 默认就是[default]. 此`gulpInst[runMethod](toRun)`函数 其实就是上述`series.js 实现方式` 返回的 fn 函数
