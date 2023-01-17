# 1. Reactive 分析

## 1.1 标识

> 可以根据下面的标识来搜寻代码。代码中详细的写注释了，可以根据入口来寻找

- `TODO lihh Reactive entry` reactive 入口
- `TODO lihh overwrite array` reactive 数组函数重写
- `TODO lihh getter` reactive getter 实现部分
- `TODO lihh setter` reactive setter 实现部分

## 1.2 大致流程

![在这里插入图片描述](https://img-blog.csdnimg.cn/3e7f2921d5cd48b1bec7622b64e55d96.png)

## 1.3 内部细节点
[参考](./README.reactive.details.md)

# 2. Ref 分析

## 2.1 标识

- `TODO lihh ref entry` Ref 实现入口
- `TODO lihh ref impl method` Ref 实现方法

## 2.2 实现流程

![在这里插入图片描述](https://img-blog.csdnimg.cn/a1848b91367a464ab017ef9666460cc2.png#pic_center)

## 2.3 细节点
[参考](./README.ref.details.md)

# 3. Effect 分析

## 3.1 标识

- `todo lihh effect entry` effect 核心入口
- `todo lihh effect core` effect 核心实现类

## 3.2 effect 大致实现过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/9120fe681cd846659877a34de60e82f1.png#pic_center)

# 4. Watch 分析

## 4.1 标识

- `todo lihh watch entry` watch 核心入口

## 4.2 watch 大致实现过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/306c8ddb226c4a6d98b9f75c6f401734.png#pic_center)

# 5. Computed 分析

## 5.1 标识

- `todo lihh computed entry` computed 实现入口
- `todo lihh computed impl` computed 核心类实现入口

## 5.2 computed 大致实现过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/f3003bef58e440008461977aa35f0936.png#pic_center)

# 6. Component 组件创建过程

## 6.1 标识

- `todo lihh createApp entry` 创建dom createApp 入口
- `todo lihh mount inner impl` 核心API【mount】的实现
- `todo lihh patch entry` path方法 入口
- `todo lihh render entry` render 方法入口

## 6.2 computed 大致实现过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/76251d6c43294c55be8fe0a0c7a4d720.png#pic_center)

# 7. AsyncComponent 组件创建过程

## 7.1 标识

- `todo lihh asyncComponenet impl` AsyncDefineComponent入口

## 7.2 AsyncComponent 大致实现过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/2e65c84dd1ca4ef2b2c0f2f1b4d7dffc.png#pic_center)

# 8. slot 创建过程

## 8.1 标识

- `todo lihh patch entry` 这里增加patch 渲染入口
- `todo lihh resolve slots` 将解析slots 赋值给组件的实例
- `todo lihh h entry` 表示渲染虚拟dom h函数的入口

## 8.2 slots 大致实现过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/85e1758a6fed47e888c1a4685212b47c.png#pic_center)
