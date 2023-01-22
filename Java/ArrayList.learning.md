<h1 align="center">ArrayList 实现原理 以及扩容原理</h1>

![在这里插入图片描述](https://img-blog.csdnimg.cn/774bd84b50094d71b952c362f10a9bb1.png#pic_center)

> 今天从Java底层分析下ArrayList实现原理，还有ArrayList 的扩容机制。

## ArrayList 常用属性

```java
// 数组能设置的最大长度
private static final int MAX_ARRAY_SIZE = Integer.MAX_VALUE - 8;
// 表示存储数组的个数的长度
private int size;
// 空数组
transient Object[] elementData;
// 默认空数组
private static final Object[] DEFAULTCAPACITY_EMPTY_ELEMENTDATA = {};
// 空数组
private static final Object[] EMPTY_ELEMENTDATA = {};
// 默认的数组的长度 为10
private static final int DEFAULT_CAPACITY = 10;
```

## 构造函数实现
> 有参构造方法的实现方式。
```java
// 集合的构造方法
public ArrayList(int initialCapacity) {
    // 如果初始值 > 0 直接使用 new Object[]
    if (initialCapacity > 0) {
        this.elementData = new Object[initialCapacity];
        // 如果是 == 0， 默认就是初始数组 {}
    } else if (initialCapacity == 0) {
        this.elementData = EMPTY_ELEMENTDATA;
    } else {
        // 其余的场合 直接报异常
        throw new IllegalArgumentException("Illegal Capacity: "+
                                           initialCapacity);
    }
}
```

> 集合有参构造方法的实现方式

```java
// 集合参数的 ArrayList
public ArrayList(Collection<? extends E> c) {
    // 将集合c 通过toArray API 转换为数组
    elementData = c.toArray();
    // 如果长度不等于0, 通过将长度 复制给size
    if ((size = elementData.length) != 0) {
        // 判断elementData 的类型是否是Object
        if (elementData.getClass() != Object[].class)
            // 指定长度的值 复制 并 转换类型
            elementData = Arrays.copyOf(elementData, size, Object[].class);
    } else {
        // 空数组
        this.elementData = EMPTY_ELEMENTDATA;
    }
}
```

## add 实现方法 包括 内存扩展机制

```java
// 将元素 添加到数组的方法
public boolean add(E e) {
    ensureCapacityInternal(size + 1);  // Increments modCount!!
    // 给指定下标位置 设置值
    elementData[size++] = e;
    return true;
}


// 确保内存容量的方法
private void ensureCapacityInternal(int minCapacity) {
    ensureExplicitCapacity(calculateCapacity(elementData, minCapacity));
}


// 计算容量的方法
private static int calculateCapacity(Object[] elementData, int minCapacity) {
    // 判断elementData 是否是默认的空数组
    if (elementData == DEFAULTCAPACITY_EMPTY_ELEMENTDATA) {
        // 第一个 返回默认的长度 是10
        return Math.max(DEFAULT_CAPACITY, minCapacity);
    }
    // 直接返回最小长度
    return minCapacity;
}


// 确保显式的容量
private void ensureExplicitCapacity(int minCapacity) {
    modCount++;

    // 如果最小的容量 大于 数组的长度 开始扩容
    if (minCapacity - elementData.length > 0)
        // 表示扩容
        grow(minCapacity);
}


// 扩容方法
private void grow(int minCapacity) {
    // 旧数组的长度
    int oldCapacity = elementData.length;
    // 预计设置的数组的长度 旧数组的 * 1.5
    int newCapacity = oldCapacity + (oldCapacity >> 1);
    // 如果新的扩容长度 < 扩容的长度
    if (newCapacity - minCapacity < 0)
        // 以扩容的长度 为准
        newCapacity = minCapacity;
        // 如果比 最大的值 还大 进行特殊处理
    if (newCapacity - MAX_ARRAY_SIZE > 0)
        newCapacity = hugeCapacity(minCapacity);
    // 进行数组复制
    elementData = Arrays.copyOf(elementData, newCapacity);
}


// 设置巨大的容量
private static int hugeCapacity(int minCapacity) {
    // 如果小于0 表示溢出
    if (minCapacity < 0) // overflow
        throw new OutOfMemoryError();
        // 如果长度 > 最大长度 ? Integer最大值 : 数组的最大值
    return (minCapacity > MAX_ARRAY_SIZE) ?
        Integer.MAX_VALUE :
        MAX_ARRAY_SIZE;
}
```