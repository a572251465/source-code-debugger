## 3.2 Reactive 分析

### 3.2.1 标识

> 可以根据下面的标识来搜寻代码。代码中详细的写注释了，可以根据入口来寻找

- `TODO lihh Reactive entry` reactive 入口
- `TODO lihh overwrite array` reactive 数组函数重写
- `TODO lihh getter` reactive getter 实现部分
- `TODO lihh setter` reactive setter 实现部分

### 3.2.2 大致流程

![在这里插入图片描述](https://img-blog.csdnimg.cn/3e7f2921d5cd48b1bec7622b64e55d96.png)

### 3.2.3 内部细节点

- 判断是否是只读的

![在这里插入图片描述](https://img-blog.csdnimg.cn/940cce05b213420189c546059d9a6080.png)

- reactive 函数内的内容必须是对象

![在这里插入图片描述](https://img-blog.csdnimg.cn/934b5434312e4bae8b68b8c4f827e4bf.png)

- 是否已经被代理过

![在这里插入图片描述](https://img-blog.csdnimg.cn/cce74d5030834934b3406fe7bd1ec106.png)

- 将代理后的proxy 进行缓存

![在这里插入图片描述](https://img-blog.csdnimg.cn/9c445ce9790b49b399ff592a36f6102f.png)

- 代理元素是数组 && 使用includes API

> 如果存在一个数组：`const arr = reactive([1,2,3])`等。 在template模板中使用了`arr.includes(1)`
> 源码中会将每个元素都进行依赖收集，目的就是为了下次数组发生变化，再次进行includes判断

![在这里插入图片描述](https://img-blog.csdnimg.cn/4778087286b94e81be4ebfec33726365.png)

- 如果reactive中 嵌套ref的使用情况

> 如果我们在编写代码过程中出现了reactive嵌套ref的时候，我们其实不需要`obj.count.value`这么写的。
> 直接使用`obj.count`就可以了。内部会判断如果是ref的话，直接给我们.value了

![在这里插入图片描述](https://img-blog.csdnimg.cn/5002731c99924828bebdd7c4d9e707e3.png)

- reactive响应式 是具有惰性的

![在这里插入图片描述](https://img-blog.csdnimg.cn/3d8922b8103f41e68a731b15187f5344.png)

- 在setter方法中 如果判断是新增以及修改呢

![在这里插入图片描述](https://img-blog.csdnimg.cn/a4665f174a904ac0a6bd555e88a8378a.png)

## 3.3 Ref 分析

### 3.3.1 标识

- `TODO lihh ref entry` Ref 实现入口
- `TODO lihh ref impl method` Ref 实现方法

### 3.3.2 实现流程

![在这里插入图片描述](https://img-blog.csdnimg.cn/a1848b91367a464ab017ef9666460cc2.png#pic_center)

### 3.3.3 细节点

### 3.3.3.1 经典面试题：

> 一般我们在面试中问到Vue2 以及Vue3的区别的时候，响应式必不可少。但是为什么说Vue3中，如果是对象的话使用了proxy。但是普通的值还是使用了Object.defineProperty呢。接下来给大家说下：

![在这里插入图片描述](https://img-blog.csdnimg.cn/5d05f0af4b3447f2ae8c65715b10b587.png)

- 我们可以看下上述babel转换内容。其实通过get/ set访问器模式就是Object.defineProperty的升级版
- 所以说到底`Ref` 就是Object.defineProperty来实现的

### 3.3.3.2 使用Ref 定义对象

![在这里插入图片描述](https://img-blog.csdnimg.cn/e5fe945bc1554757a315498180281a0d.png)
![在这里插入图片描述](https://img-blog.csdnimg.cn/9bdcd56390534b32a27418c947d4b3a2.png)

通过上述的截图中，我们可以看到如果使用Ref来定义对象的话，其实最终还是调用了Reactive来进行转换