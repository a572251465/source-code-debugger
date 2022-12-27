<h1 align="center">以下是reactive 源码中细节点</h1>

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
