<h1 align="center">require 实现原理</h1>

![在这里插入图片描述](https://img-blog.csdnimg.cn/56666ed2ac634f17b2ea66c19026627b.png#pic_center)

## 流程概述

- 步骤1：尝试执行代码`require("./1")`.  开始调用方法`require`. 
- 步骤2：此时会得到filename，根据filename 会判断缓存中是否已经加载模块，如果加载完毕直接返回，反之继续执行
- 步骤3：调用方法`Module._resolveFilename` 来解析文件名称，其实包括匹配后缀，例如：`./1 => ./1.js`
- 步骤4：此时filename已经发生了变化，因为添加了后缀。根据最新的filename 重新在缓存中判断，如果缓存中有值 直接返回，反之继续执行
- 步骤5：开始实例化Module模块
- 步骤6：执行代码`Module_load` 开始加载模块。 读取filename的后缀，根据不同的后缀执行不同的方法，因为js 以及json的加载方式肯定是不同的
  - 执行后缀为`.json`的方法：直接读取文件内容，然后通过JSON.parse方法将结果赋值给module.exports
  - 执行后缀为`.js`的方法：设置`__dirname, __filename, module, reuire, exports`等，通过vm 模拟函数执行 将参数传递

## 源码解析：

### 模块的构造方法

```js
// 表示模块的构造方法
function Module(id = '', parent) {
  // 此时id 表示 module path
  this.id = id;
  // 相对文件的文件夹路径
  this.path = path.dirname(id);
  // 存放对应的exports
  this.exports = {};
  moduleParentCache.set(this, parent);
  updateChildren(parent, this, false);
  // 文件名称
  this.filename = null;
  // 模块是否加载完成
  this.loaded = false;
  // 包含的子类模块
  this.children = [];
}
```

### require本身的方法

```js
// 模块的require 导入方法
Module.prototype.require = function(id) {
  // id 有效性 check
  if (id === '') {
    throw new ERR_INVALID_ARG_VALUE('id', id,
                                    'must be a non-empty string');
  }
  // 此处表示递归的层次
  requireDepth++;
  try {
    // 执行load方法
    return Module._load(id, this, /* isMain */ false);
  } finally {
    // 无论是否报错 执行结束一个 减少一个
    requireDepth--;
  }
};
```

### Module._load 方法

```js
// 表示模块加载方法
// request 当前加载的模块 相对路径
// parent 表示父类的模块信息
// isMain 是否是主方法
Module._load = function(request, parent, isMain) {
  let relResolveCacheIdentifier;
  // 如果父类存在的话
  if (parent) {
    // 组成一个绝对路径
    relResolveCacheIdentifier = `${parent.path}\x00${request}`;
    // 从缓存中查询
    // relativeResolveCache 用来缓存路径
    const filename = relativeResolveCache[relResolveCacheIdentifier];
    if (filename !== undefined) {
      // 通过filename  来获取模块信息
      const cachedModule = Module._cache[filename];
      // 如果模块信息不为undefined的话
      if (cachedModule !== undefined) {
        // 更新信息
        updateChildren(parent, cachedModule, true);
        if (!cachedModule.loaded)
          return getExportsForCircularRequire(cachedModule);
        // 返回之前的模块
        return cachedModule.exports;
      }
      delete relativeResolveCache[relResolveCacheIdentifier];
    }
  }

  // 此方法可以尝试添加后缀  ./1 => ./1.js
  const filename = Module._resolveFilename(request, parent, isMain);
  // 判断是否是node模块 如果是node模块的话 直接返回模块内容
  if (StringPrototypeStartsWith(filename, 'node:')) {
    // Slice 'node:' prefix
    const id = StringPrototypeSlice(filename, 5);

    const module = loadNativeModule(id, request);
    if (!module?.canBeRequiredByUsers) {
      throw new ERR_UNKNOWN_BUILTIN_MODULE(filename);
    }

    return module.exports;
  }

  // 根据filename 在缓存中查询。 如果缓存中找到了 直接返回缓存中内容
  const cachedModule = Module._cache[filename];
  if (cachedModule !== undefined) {
    updateChildren(parent, cachedModule, true);
    if (!cachedModule.loaded) {
      const parseCachedModule = cjsParseCache.get(cachedModule);
      if (!parseCachedModule || parseCachedModule.loaded)
        return getExportsForCircularRequire(cachedModule);
      parseCachedModule.loaded = true;
    } else {
      return cachedModule.exports;
    }
  }

  const mod = loadNativeModule(filename, request);
  if (mod?.canBeRequiredByUsers) return mod.exports;

  // 此时实例化一个module 模块
  const module = cachedModule || new Module(filename, parent);

  // 如果是主方法的场合
  if (isMain) {
    process.mainModule = module;
    module.id = '.';
  }

  // 存放到缓存中
  Module._cache[filename] = module;
  if (parent !== undefined) {
    relativeResolveCache[relResolveCacheIdentifier] = filename;
  }

  let threw = true;
  try {
    // 此方法是根据路径 开始加载模块
    module.load(filename);
    threw = false;
  } finally {
    if (threw) {
      delete Module._cache[filename];
      if (parent !== undefined) {
        delete relativeResolveCache[relResolveCacheIdentifier];
        const children = parent?.children;
        if (ArrayIsArray(children)) {
          const index = ArrayPrototypeIndexOf(children, module);
          if (index !== -1) {
            ArrayPrototypeSplice(children, index, 1);
          }
        }
      }
    } else if (module.exports &&
               !isProxy(module.exports) &&
               ObjectGetPrototypeOf(module.exports) ===
                 CircularRequirePrototypeWarningProxy) {
      ObjectSetPrototypeOf(module.exports, ObjectPrototype);
    }
  }

  return module.exports;
};
```

### load 方法

```js
// 真正加载模块的方法
// filename 文件路径
Module.prototype.load = function(filename) {
  // 设置文件名称
  this.filename = filename;
  // 通过filename的路径 来依次查找node_modules
  this.paths = Module._nodeModulePaths(path.dirname(filename));

  // 获取文件后缀
  const extension = findLongestRegisteredExtension(filename);
  // allow .mjs to be overridden
  // 如果文件是.mjs 后缀的， 但是Module._extensions 不支持.mjs后缀 直接报错
  if (StringPrototypeEndsWith(filename, '.mjs') && !Module._extensions['.mjs'])
    throw new ERR_REQUIRE_ESM(filename, true);

  // 策略模式 执行对应的方法
  Module._extensions[extension](this, filename);
  this.loaded = true;
};
```

### 后缀为.js 待执行的方法

```js
// 依照 策略模式来执行后缀为.js 的方法
Module._extensions['.js'] = function(module, filename) {
  // 被缓存的信息
  const cached = cjsParseCache.get(module);
  let content;
  if (cached?.source) {
    content = cached.source;
    cached.source = undefined;
  } else {
    // 读取文件内容
    content = fs.readFileSync(filename, 'utf8');
  }

  // 执行compile 逻辑
  module._compile(content, filename);
};
```

### 后缀为.json 待执行的方法

```js
// 依照 策略模式来执行后缀为.json 的方法
Module._extensions['.json'] = function(module, filename) {
  // 开始读取文件内容
  const content = fs.readFileSync(filename, 'utf8');

  if (policy?.manifest) {
    const moduleURL = pathToFileURL(filename);
    policy.manifest.assertIntegrity(moduleURL, content);
  }

  try {
    // 直接将json 转换后 赋值给module.exports 
    module.exports = JSONParse(stripBOM(content));
  } catch (err) {
    err.message = filename + ': ' + err.message;
    throw err;
  }
};
```

### _compile执行的方法

```js
Module.prototype._compile = function(content, filename) {
  let moduleURL;
  let redirects;

  maybeCacheSourceMap(filename, content, this);
  // wrapSafe 表示代码包裹 function (exports, require, module, __filename, __dirname) {...}
  const compiledWrapper = wrapSafe(filename, content, this);

  let inspectorWrapper = null;
  // 获取目录 地址
  const dirname = path.dirname(filename);
  // 进行包裹require
  const require = makeRequireFunction(this, redirects);
  let result;
  // exports 其实就是module上 属性【exports】
  const exports = this.exports;
  const thisValue = exports;
  // module 就是this本身
  const module = this;
  if (requireDepth === 0) statCache = new SafeMap();
  if (inspectorWrapper) {
    result = inspectorWrapper(compiledWrapper, thisValue, exports,
                              require, module, filename, dirname);
  } else {
    result = ReflectApply(compiledWrapper, thisValue,
                          [exports, require, module, filename, dirname]);
  }
  hasLoadedAnyUserCJSModule = true;
  if (requireDepth === 0) statCache = null;
  return result;
};
```
