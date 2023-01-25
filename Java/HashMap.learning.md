<h1 align="center">HashMap 实现原理 以及扩容机制</h1>

![在这里插入图片描述](https://img-blog.csdnimg.cn/d026eff5f4d647a6921c19b5fc5807b7.png#pic_center)

## HashMap 的 put 以及扩容基本实现

### 数据结构

![在这里插入图片描述](https://img-blog.csdnimg.cn/3aae8f31cb3043d89b5d89222853ba0e.png)

> 上述截图是 HashMap 的内部存储的数据结构。大体上是通过 hash 值来获取到对应的下标。如果当前下标为 null 的话，直接创建并设置一个新的节点，反之就是添加到该链表的最后

### put 过程

- 第一步：执行 put 方法 顺便获取数组的长度

  ```java
  if ((tab = table) == null || (n = tab.length) == 0)
      n = (tab = resize()).length;
  ```

  - 如果是第一次执行，table 就是 null，那么一定会执行到 if 判断中 然后执行扩容方法，此时变量`n` 就会有一个数组长度

- 第二步：通过代码`(n - 1) & hash` 来计算出一个对应的下标，将对应下标的 tab 的值获取出来，判断是否为 null，如果是 null 的话，说明该节点没有任何值

  ```java
  if ((p = tab[i = (n - 1) & hash]) == null)
      tab[i] = newNode(hash, key, value, null);
  ```

- 第三步：通过 hash 得到对应的下标，获取到下标对应的链表。

  - 循环判断 每个链表的节点的 hash 以及 key 是否相同，如果相同更新节点
  - 如果执行到最后还是没有找到，直接添加到链表最后。

- 第四步：如果添加数组的 size > threshold 的话，调用方法`resize()` 进行扩容

### 扩容过程

- 第一步：变量的初始化

  - 获取对应的 table 数组 `oldTab`. 如果是第一次的话 一定是一个 null
  - 获取对应的 table 数组的长度，如果`oldTab === null` 的话，设置为 0， 反之就是 oldTab 长度

- 第二步：通过`if (oldCap > 0)` 来判断旧的数组中是否有值

  - 如果`if (oldCap >= MAXIMUM_CAPACITY)` 条件满足的话，说明长度已经是最大值了，无法扩容了。直接执行代码`threshold = Integer.MAX_VALUE;`, **返回旧的数组**
  - 如果 newCap < 最大容量 && 旧数组长度 >= 默认的容量 满足的话，将新的`newThr` 扩大 旧阀值`oldThr` 一倍

- 第三步：如果`if (oldThr > 0)` 满足的话，直接将老的阀值 赋值给 新数组长度

- 第四步：上述以外的场合，赋值新的数组长度 以及新的阀值。

  - 新的数组长度是：`newCap = DEFAULT_INITIAL_CAPACITY;`
  - 新的阀值是(加载因子 \* 默认长度)：`newThr = (int)(DEFAULT_LOAD_FACTOR _ DEFAULT_INITIAL_CAPACITY);`

- 第五步：如果满足`newThr == 0`的话，计算新的阀值。

  - ![在这里插入图片描述](https://img-blog.csdnimg.cn/1a93ffb9477a4f3e9a765b30751dccd3.png)

- 第六步：此时计算出新的数组长度 以及阀值。 根据新数组长度构建新的数组，然后将旧数组的值 逐个移动到 新的数组上

## HashMap 基本属性

```java
 // 默认的初期化的容量
 static final int DEFAULT_INITIAL_CAPACITY = 1 << 4;
 // 最大的容量
 static final int MAXIMUM_CAPACITY = 1 << 30;
 // 加载因子
 static final float DEFAULT_LOAD_FACTOR = 0.75f;
 // 树的阈值
 static final int TREEIFY_THRESHOLD = 8;
 // 不可恢复的阈值
 static final int UNTREEIFY_THRESHOLD = 6;
 static final int MIN_TREEIFY_CAPACITY = 64;
 // 表示节点元素
 static class Node<K,V> implements Map.Entry<K,V>
 // 判断扩容的阀值 根据此值来判断是否进行扩容
 int threshold;
```

## HashMap 构造方法

- 多参构造方法

```java
// hashMap 的多参构造方法
public HashMap(int initialCapacity, float loadFactor) {
    // 如果初始的容量长度 < 0的话 直接抛出异常
    if (initialCapacity < 0)
        throw new IllegalArgumentException("Illegal initial capacity: " +
                                           initialCapacity);
    // 如果初始容量 > 最大的容量的时候 直接赋值最大容量
    if (initialCapacity > MAXIMUM_CAPACITY)
        initialCapacity = MAXIMUM_CAPACITY;
    // 如果加载因子 <=0 或是 加载因子是NaN 的话 报异常
    if (loadFactor <= 0 || Float.isNaN(loadFactor))
        throw new IllegalArgumentException("Illegal load factor: " +
                                           loadFactor);
    // 赋值加载因子
    this.loadFactor = loadFactor;
    this.threshold = tableSizeFor(initialCapacity);
}
```

- 无参构造方法

```java
// 表示无参构造方法
public HashMap() {
    // 默认的初始加载因子
    this.loadFactor = DEFAULT_LOAD_FACTOR; // all other fields defaulted
}
```

## HashMap Put 方法

```java
// 添加元素的方法
final V putVal(int hash, K key, V value, boolean onlyIfAbsent,
               boolean evict) {
    // tab 整个存放hashMap的 tab
    // p 单个元素的Node节点
    Node<K,V>[] tab; Node<K,V> p; int n, i;

    // 此判断为table 为null || table数据为空 所以length == 0
    if ((tab = table) == null || (n = tab.length) == 0)
    	// 开始扩容 获取长度
        n = (tab = resize()).length;
    // 如果数组的指定位置(n - 1) & hash 为null的话 直接将新节点 赋值到这里
    // 通过公式(n - 1) & hash 根据hash 指定数组的位置
    if ((p = tab[i = (n - 1) & hash]) == null)
        // 如果此时的节点为null的话  表示没有节点 直接插入新的节点
        tab[i] = newNode(hash, key, value, null);
    else {
    	// 如果可以执行到这一步的话 表示p不为null  获取的就是tab 指定位置的值
    	// e
        Node<K,V> e; K k;
        // 表示同一个hash戳  && key 保持一致
        if (p.hash == hash &&
            (
            (k = p.key) == key || (key != null && key.equals(k))
            )
           )
            e = p;
        else if (p instanceof TreeNode)
            e = ((TreeNode<K,V>)p).putTreeVal(this, tab, hash, key, value);
        else {
        	// 此处是一个累加的循环
            for (int binCount = 0; ; ++binCount) {

            	// p 表示相同hash的节点 如果能执行到这里 表示p本身是一个链表节点
                if ((e = p.next) == null) {
                	// 构建下一个新的节点
                    p.next = newNode(hash, key, value, null);
                    if (binCount >= TREEIFY_THRESHOLD - 1) // -1 for 1st
                        treeifyBin(tab, hash);
                    break;
                }
                // 一直循环下一个节点 查看是否可以更新 (hash相同 key相同)
                if (e.hash == hash &&
                    ((k = e.key) == key || (key != null && key.equals(k))))
                    break;
                p = e;
            }
        }

        // 如果e 不为null 表示更新操作。
        if (e != null) { // existing mapping for key
            V oldValue = e.value;
            if (!onlyIfAbsent || oldValue == null)
            	// 更新值
                e.value = value;
            afterNodeAccess(e);
            return oldValue;
        }
    }
    ++modCount;
    if (++size > threshold)
        resize();
    afterNodeInsertion(evict);
    return null;
}
```

## HashMap Resize 扩容方式

```java
// 修改HashMap 的大小
final Node<K,V>[] resize() {
    // 旧的 table数组 就是存储数据的， 第一次肯定是null
    Node<K,V>[] oldTab = table;
    // 旧的tab oldTab == null ? 是0  : 反之就是oldTab 长度
    int oldCap = (oldTab == null) ? 0 : oldTab.length;
    // 阈值
    int oldThr = threshold;
    // 新的table  以及新的阀值
    int newCap, newThr = 0;
    // 如果旧的数组长度 > 0 说明旧table 中存在数据
    if (oldCap > 0) {
        // 旧数组长度 >= 最大值。 说明已经不能再次扩容了  设置阀值为最大值 然后返回旧table
        if (oldCap >= MAXIMUM_CAPACITY) {
            // 阀值设置为最大 说明已经没法扩容了 threshold
            threshold = Integer.MAX_VALUE;
            return oldTab;
        }
        // newCap 将旧数组长度 扩大 一倍
        // 如果newCap < 最大容量 && 旧数组长度 >= 默认的容量
        else if ((newCap = oldCap << 1) < MAXIMUM_CAPACITY &&
                 oldCap >= DEFAULT_INITIAL_CAPACITY)
            // 把阀值扩大一倍
            newThr = oldThr << 1; // double threshold
    }
    // 如果旧的阀值 > 0 的话 直接使用旧的阀值 取代 新的数组
    else if (oldThr > 0) // initial capacity was placed in threshold
        newCap = oldThr;
    else {               // zero initial threshold signifies using defaults
        // 其余的走默认值
        // newCap 表示新的数组长度
        newCap = DEFAULT_INITIAL_CAPACITY;
        // 阀值为 初始长度 * 加载因子
        newThr = (int)(DEFAULT_LOAD_FACTOR * DEFAULT_INITIAL_CAPACITY);
    }
    if (newThr == 0) {
        // 获取的浮动值
        float ft = (float)newCap * loadFactor;
        // 新的阀值
        newThr = (newCap < MAXIMUM_CAPACITY && ft < (float)MAXIMUM_CAPACITY ?
                  (int)ft : Integer.MAX_VALUE);
    }
    threshold = newThr;
    @SuppressWarnings({"rawtypes","unchecked"})
    // 表示一个新的tab
    Node<K,V>[] newTab = (Node<K,V>[])new Node[newCap];
    // 赋值table
    table = newTab;
    // 如果旧的table 不为 null
    if (oldTab != null) {
        // 通过for 循环oldCap 长度
        for (int j = 0; j < oldCap; ++j) {
            Node<K,V> e;
            // 如果不为null的话
            if ((e = oldTab[j]) != null) {
                // 将当前值设置为null
                oldTab[j] = null;
                // 如果e的next 是null
                if (e.next == null)
                    // 给newTab 赋值 e
                    newTab[e.hash & (newCap - 1)] = e;
                else if (e instanceof TreeNode)
                    ((TreeNode<K,V>)e).split(this, newTab, j, oldCap);
                else { // preserve order
                    Node<K,V> loHead = null, loTail = null;
                    Node<K,V> hiHead = null, hiTail = null;
                    Node<K,V> next;
                    do {
                        next = e.next;
                        if ((e.hash & oldCap) == 0) {
                            if (loTail == null)
                                loHead = e;
                            else
                                loTail.next = e;
                            loTail = e;
                        }
                        else {
                            if (hiTail == null)
                                hiHead = e;
                            else
                                hiTail.next = e;
                            hiTail = e;
                        }
                    } while ((e = next) != null);
                    if (loTail != null) {
                        loTail.next = null;
                        newTab[j] = loHead;
                    }
                    if (hiTail != null) {
                        hiTail.next = null;
                        newTab[j + oldCap] = hiHead;
                    }
                }
            }
        }
    }
    return newTab;
}
```
