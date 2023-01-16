<h1 align="center">ThreadPoolExecutor</h1>

![在这里插入图片描述](https://img-blog.csdnimg.cn/6459c95b94fb4ab7953ed15fc760e188.png#pic_center)

## JDK 中自带线程池
### newFixedThreadPool

- `newFixedThreadPool` 可以定义固定长度的线程池

```java
public static ExecutorService newFixedThreadPool(int nThreads) {
    return new ThreadPoolExecutor(nThreads, nThreads,
                                  0L, TimeUnit.MILLISECONDS,
                                  new LinkedBlockingQueue<Runnable>());
}
```

### newSingleThreadExecutor

- `newSingleThreadExecutor` 单例模式线程池，永远是只有一个线程在工作

```java
public static ExecutorService newSingleThreadExecutor() {
    return new FinalizableDelegatedExecutorService
        (new ThreadPoolExecutor(1, 1,
                                0L, TimeUnit.MILLISECONDS,
                                new LinkedBlockingQueue<Runnable>()));
}
```

### newCachedThreadPool

- `newCachedThreadPool`

当第一次提交任务到线程池时，会直接构建一个工作线程。这个工作线执行完之后，60秒没有任务可以执行后，会结束。

如果后续提交任务时，没有线程是空闲的。那么就构建工作线程去执行

`特点：任务只要提交到当前的newCachedThreadPool中，就必须有工作线程来处理`

```java
public static ExecutorService newCachedThreadPool() {
    return new ThreadPoolExecutor(0, Integer.MAX_VALUE,
                                  60L, TimeUnit.SECONDS,
                                  new SynchronousQueue<Runnable>());
}
```

### newScheduledThreadPool

- `newScheduledThreadPool` 定时任务线程池。可以控制一定周期以及延迟多久来执行任务。

```java
public static ScheduledExecutorService newScheduledThreadPool(
        int corePoolSize, ThreadFactory threadFactory) {
    return new ScheduledThreadPoolExecutor(corePoolSize, threadFactory);
}
```

### newWorkStealingPool

- `newWorkStealingPool` 工作窃取线程池，该线程池讲究`分而治之, 然后聚合`。 比较适合任务拆分
    - 当前JDK提供构建线程池的方式newWorkStealingPool和之前的线程池很非常大的区别
    - 之前定长，单例，缓存，定时任务都基于ThreadPoolExecutor去实现的
    - newWorkStealingPool是基于ForkJoinPool构建出来的


## JDK 自定义线程池详解

### 为什么需要自定义

首先ThreadPoolExecutor中，一共提供了7个参数，每个参数都是非常核心的属性，在线程池去执行任务时，每个参数都有决定性的作用

但是如果直接采用JDK提供的方式去构建，可以设置的核心参数最多就两个，这样就会导致对线程池的控制粒度很粗。所以在阿里规范中也推荐自己去自定义线程池。手动的去new ThreadPoolExecutor设置他的一些核心属性。

自定义构建线程池，可以细粒度的控制线程池，去管理内存的属性，并且针对一些参数的设置可能更好的在后期排查问题。

### 核心属性

```java
// AtomicInteger 是基于CAS进行运算。可以保证数据的原子性。
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
// Integer.SIZE 表示一个int类型对应的比特的长度。是32。所以COUNT_BITS 就是29。
private static final int COUNT_BITS = Integer.SIZE - 3;
private static final int CAPACITY   = (1 << COUNT_BITS) - 1;

private static final int RUNNING    = -1 << COUNT_BITS;
private static final int SHUTDOWN   =  0 << COUNT_BITS;
private static final int STOP       =  1 << COUNT_BITS;
private static final int TIDYING    =  2 << COUNT_BITS;
private static final int TERMINATED =  3 << COUNT_BITS;

private static int runStateOf(int c)     { return c & ~CAPACITY; }
private static int workerCountOf(int c)  { return c & CAPACITY; }
private static int ctlOf(int rs, int wc) { return rs | wc; }
```
如上图：
1. 当前的`ctl` 其实就是一个int类型的值，内部是基于AtomicInteger套了一层，进行运算时，是原子性的，也是为了保证数据的原子性
2. 线程池的状态：ctl的高3位，表示线程池状态
3. 工作线程的数量：ctl的低29位，表示工作线程的个数
4. 具体的分析 请看下面的解释部分。

<br />

1. `private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));`
   AtomicInteger 是基于CAS进行运算。可以保证数据的原子性。

2. `private static final int COUNT_BITS = Integer.SIZE - 3;`
   Integer.SIZE 表示一个int类型对应的比特位的长度。 其实就是32，所以COUNT_BITS 就是29。

3. `private static final int CAPACITY   = (1 << COUNT_BITS) - 1;`
   ![在这里插入图片描述](https://img-blog.csdnimg.cn/8fbf1c27c8874d25b8a3ce6b27ad39bf.png)

### 核心参数解析

```java
public ThreadPoolExecutor(
                           int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler) {
```

1. corePoolSize 核心工作线程。**当前任务执行结束后，不会被销毁**
2. maximumPoolSize 最大工作线程 **代表当前线程池中，一共可以有多少个工作线程**
3. keepAliveTime 非核心工作线程 在阻塞队列位置等待的时间
4. unit 非核心工作线程 在阻塞队列位置等待时间的单位
5. workQueue 任务在没有核心工作线程处理时，任务先扔到阻塞队列中
6. threadFactory 构建线程的线程工作，可以设置thread的一些信息
7. handler 当线程池无法处理投递过来的任务时，执行当前的拒绝策略

### 构造函数逻辑分析

```java
public ThreadPoolExecutor(int corePoolSize,
                          int maximumPoolSize,
                          long keepAliveTime,
                          TimeUnit unit,
                          BlockingQueue<Runnable> workQueue,
                          ThreadFactory threadFactory,
                          RejectedExecutionHandler handler) {
    // 核心工作线程 不能<0 最起码要>= 0 才行。也就是说核心工作线程其实是可以===0 的
    // 最大工作者线程 不能<=0
    // 最大工作者线程 不能 <= 核心工作者线程
    // 非工作者线程 在阻塞期间等待时间 必须>= 0
    if (corePoolSize < 0 ||
        maximumPoolSize <= 0 ||
        maximumPoolSize < corePoolSize ||
        keepAliveTime < 0)
        throw new IllegalArgumentException();

    // 阻塞队列 以及线程工厂 以及 拒绝策略都不能为空
    if (workQueue == null || threadFactory == null || handler == null)
        throw new NullPointerException();
    this.acc = System.getSecurityManager() == null ?
            null :
            AccessController.getContext();
    this.corePoolSize = corePoolSize;
    this.maximumPoolSize = maximumPoolSize;
    this.workQueue = workQueue;
    // 纳秒 转换
    this.keepAliveTime = unit.toNanos(keepAliveTime);
    this.threadFactory = threadFactory;
    this.handler = handler;
}
```

### 方法execute 解析

