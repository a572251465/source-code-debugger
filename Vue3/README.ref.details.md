<h1 align="center">以下是ref 源码中细节点</h1>

# 1. 经典面试题：

> 一般我们在面试中问到Vue2 以及Vue3的区别的时候，响应式必不可少。但是为什么说Vue3中，如果是对象的话使用了proxy。但是普通的值还是使用了Object.defineProperty呢。接下来给大家说下：

![在这里插入图片描述](https://img-blog.csdnimg.cn/5d05f0af4b3447f2ae8c65715b10b587.png)

- 我们可以看下上述babel转换内容。其实通过get/ set访问器模式就是Object.defineProperty的升级版
- 所以说到底`Ref` 就是Object.defineProperty来实现的

# 2. 使用Ref 定义对象

![在这里插入图片描述](https://img-blog.csdnimg.cn/e5fe945bc1554757a315498180281a0d.png)
![在这里插入图片描述](https://img-blog.csdnimg.cn/9bdcd56390534b32a27418c947d4b3a2.png)

通过上述的截图中，我们