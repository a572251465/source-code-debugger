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
   <br />AtomicInteger 是基于CAS进行运算。可以保证数据的原子性。

2. `private static final int COUNT_BITS = Integer.SIZE - 3;`
   <br />Integer.SIZE 表示一个int类型对应的比特位的长度。 其实就是32，所以COUNT_BITS 就是29。

3. `private static final int CAPACITY   = (1 << COUNT_BITS) - 1;`
   <br />![在这里插入图片描述](https://img-blog.csdnimg.cn/8fbf1c27c8874d25b8a3ce6b27ad39bf.png)
   <br /> 其结果就是`00011111 11111111 11111111 11111111`

4. `RUNNING, SHUTDOWN, STOP, TIDYING, TERMINATED`
    <br/> 表示线程的几种状态
    ```java
    // 111：代表RUNNING状态，RUNNING可以处理任务，并且处理阻塞队列中的任务。
   private static final int RUNNING    = -1 << COUNT_BITS;
   
   // 000：代表SHUTDOWN状态，不会接收新任务，正在处理的任务正常进行，阻塞队列的任务也会做完。
   private static final int SHUTDOWN   =  0 << COUNT_BITS;
   
   // 001：代表STOP状态，不会接收新任务，正在处理任务的线程会被中断，阻塞队列的任务一个不管
   private static final int STOP       =  1 << COUNT_BITS;
   
   // 010：代表TIDYING状态，这个状态是否SHUTDOWN或者STOP转换过来的，代表当前线程池马上关闭，就是过渡状态。
   private static final int TIDYING    =  2 << COUNT_BITS;
   
   // 011：代表TERMINATED状态，这个状态是TIDYING状态转换过来的，转换过来只需要执行一个terminated方法。
   private static final int TERMINATED =  3 << COUNT_BITS;
    ```

5. `private static int runStateOf(int c)     { return c & ~CAPACITY; }`
    <br />  基于&运算的特点，保证只会拿到ctl高三位的值。

6. `private static int workerCountOf(int c)  { return c & CAPACITY; }`
   <br />  基于&运算的特点，保证只会拿到ctl低29位的值。

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

![在这里插入图片描述](https://img-blog.csdnimg.cn/184e3f232973404d9729cd1b3fb63297.png#pic_center)

```java
// 此方法表示执行线程的方法
public void execute(Runnable command) {
    // 首先命令 不能为空。 反之报空指针异常
    if (command == null)
        throw new NullPointerException();
    // 工作线程的值
    int c = ctl.get();
    // 如果工作者线程 < 核心者线程
    if (workerCountOf(c) < corePoolSize) {
        // 添加到工作者线程中 如果添加成功返回true 反之直接返回false
        // 如果第二个参数是true 表示核心工作者线程
        if (addWorker(command, true))
            return;
        // 如果执行到此处，表示上述判断没有添加成功。那么ctl一定是发生了某种变化，所以需要重新获取值
        c = ctl.get();
    }

    // 如果线程池状态是RUNNING && 将命令添加到阻塞队列中
    if (isRunning(c) && workQueue.offer(command)) {
        // 如果任务添加到阻塞队列成功，走if内部
        // 如果任务在扔到阻塞队列之前，线程池状态突然改变了。
        // 重新获取ctl
        int recheck = ctl.get();
        // 如果线程池的状态不是RUNNING，将任务从阻塞队列移除，
        if (! isRunning(recheck) && remove(command))
            reject(command);

        // 在这，说明阻塞队列有我刚刚放进去的任务
        // 查看一下工作线程数是不是0个
        // 如果工作线程为0个，需要添加一个非核心工作线程去处理阻塞队列中的任务
        else if (workerCountOf(recheck) == 0)
            // 为了避免阻塞队列中的任务饥饿，添加一个非核心工作线程去处理
            addWorker(null, false);
    }
    // 任务添加到阻塞队列失败
    // 构建一个非核心工作线程
    // 如果添加非核心工作线程成功，直接完事，告辞
    else if (!addWorker(command, false))
        // 添加失败，执行决绝策略
        reject(command);
}
```

### 方法addWorker 解析

```java
// 添加工作者线程的方法
// firstTask 添加的任务
// core 表示是否是核心线程
private boolean addWorker(Runnable firstTask, boolean core) {
    // 此处表示双向循环 退出标记
    retry:
    for (;;) {
        // 线程池标记数
        int c = ctl.get();
        // 获取高三位的值 其实就是获取的线程池状态。 其实高三位来表示线程池状态
        int rs = runStateOf(c);

        // 判断线程池的状态是否大于等于SHUTDOWN，如果满足，说明线程池不是RUNNING
        if (rs >= SHUTDOWN &&
            // 如果这三个条件都满足，就代表是要添加非核心工作线程去处理阻塞队列任务
            // 如果三个条件有一个没满足，返回false，配合!，就代表不需要添加
            ! (rs == SHUTDOWN &&
               firstTask == null &&
               ! workQueue.isEmpty()))
            return false;

        for (;;) {
            // 获取工作线程数
            int wc = workerCountOf(c);
            // 如果线程池的个数 比 最大值CAPACITY 还大的话 直接return false
            // 判断是否核心线程 如果比核心 或是 设置最大线程大的话 return false
            if (wc >= CAPACITY ||
                wc >= (core ? corePoolSize : maximumPoolSize))
                return false;
            // 针对ctl进行 + 1，采用CAS的方式
            if (compareAndIncrementWorkerCount(c))
                break retry;
            c = ctl.get();  // Re-read ctl
            // 判断重新获取到的ctl中，表示的线程池状态跟之前的是否有区别
            // 如果状态不一样，说明有变化，重新的去判断线程池状态
            if (runStateOf(c) != rs)
                continue retry;
            // else CAS failed due to workerCount change; retry inner loop
        }
    }

    // 工作者线程是否启动
    boolean workerStarted = false;
    // 工作者线程是否添加
    boolean workerAdded = false;
    // Worker 实例
    Worker w = null;
    try {
        // 实例化 一个工作实例
        w = new Worker(firstTask);
        // 获取实例化后的线程
        final Thread t = w.thread;
        // 线程 必须 不能为null
        if (t != null) {
            // 获取锁实例
            final ReentrantLock mainLock = this.mainLock;
            // 加锁
            mainLock.lock();
            try {
                // 通过高三位 获取线程池状态
                int rs = runStateOf(ctl.get());

                // rs < SHUTDOWN 满足的话 表示线程池是RUNNING 状态
                if (rs < SHUTDOWN ||
                    // 线程状态处于SHUTDOWN状态  && firstTask 为null
                    (rs == SHUTDOWN && firstTask == null)) {
                    // 如果线程池已经处于 激活状态 直接报异常
                    if (t.isAlive())
                        throw new IllegalThreadStateException();
                    // 添加工作者线程
                    workers.add(w);
                    int s = workers.size();
                    if (s > largestPoolSize)
                        largestPoolSize = s;
                    workerAdded = true;
                }
            } finally {
                mainLock.unlock();
            }

            // 如果工作者线程 添加成功后 启动线程
            if (workerAdded) {
                t.start();
                workerStarted = true;
            }
        }
    } finally {
        if (! workerStarted)
            addWorkerFailed(w);
    }
    return workerStarted;
}
```

### Worker 解析

```java
// 表示work 类
private final class Worker
    extends AbstractQueuedSynchronizer
    implements Runnable
{
    private static final long serialVersionUID = 6138294804551838833L;

    // 通过工厂创建的线程
    final Thread thread;
    // 表示第一个任务。其实就是构造函数传递的任务
    Runnable firstTask;
    // 统计work 执行的任务
    volatile long completedTasks;

    // 表示Worker 类的构造函数
    Worker(Runnable firstTask) {
        setState(-1);
        // task赋值
        this.firstTask = firstTask;
        // 线程赋值
        this.thread = getThreadFactory().newThread(this);
    }

    public void run() {
        runWorker(this);
    }
}
```

### 函数runWorker 解析

```java
// 表示运行工作worker
final void runWorker(Worker w) {
    // 表示当前线程
    Thread wt = Thread.currentThread();
    // 待执行的task 任务
    Runnable task = w.firstTask;
    // 任务置空
    w.firstTask = null;
    // 去锁
    w.unlock();
    // 是否异常结束
    boolean completedAbruptly = true;
    try {
        // task是否有任务 || 如果没有任务的话 获取最新的任务 而且不能为null
        while (task != null || (task = getTask()) != null) {
            // 加锁
            w.lock();

            // 比较ctl >= STOP,如果满足找个状态，说明线程池已经到了STOP状态甚至已经要凉凉了
            // 线程池到STOP状态，并且当前线程还没有中断，确保线程是中断的，进到if内部执行中断方法
            // if(runStateAtLeast(ctl.get(), STOP) && !wt.isInterrupted()) {中断线程}
            // 如果线程池状态不是STOP，确保线程不是中断的。
            // 如果发现线程中断标记位是true了，再次查看线程池状态是大于STOP了，再次中断线程
            // 这里其实就是做了一个事情，如果线程池状态 >= STOP，确保线程中断了。

            // 1. ctl >= stop && !wt.isInterrupted() 线程的状态已经属于STOP以上了。 而且没有打中断标记
            // 2. 如果发现线程中断标记位是true了，再次查看线程池状态是大于STOP了，再次中断线程
            if (
                (runStateAtLeast(ctl.get(), STOP) ||
                 (Thread.interrupted() &&
                  runStateAtLeast(ctl.get(), STOP))) && !wt.isInterrupted()
                )
                wt.interrupt();
            try {
                // 内部方法是空方法 属于自定义的方法
                beforeExecute(wt, task);
                Throwable thrown = null;
                try {
                    // 运行任务
                    task.run();
                } catch (RuntimeException x) {
                    thrown = x; throw x;
                } catch (Error x) {
                    thrown = x; throw x;
                } catch (Throwable x) {
                    thrown = x; throw new Error(x);
                } finally {
                    afterExecute(task, thrown);
                }
            } finally {
                task = null;
                // works 处理的统计任务 ++
                w.completedTasks++;
                w.unlock();
            }
        }
        completedAbruptly = false;
    } finally {
        processWorkerExit(w, completedAbruptly);
    }
}
```

### 方法getTask 解析

```java
private Runnable getTask() {
    // 延迟
    boolean timedOut = false; // Did the last poll() time out?

    for (;;) {
        // ctl 状态。 高三位表示线程池状态 低29位表示线程数
        int c = ctl.get();
        // 线程池状态
        int rs = runStateOf(c);

        // 如果状态 >= STOP || 工作队列是空的 就没必要获取任务了
        if (rs >= SHUTDOWN && (rs >= STOP || workQueue.isEmpty())) {
            // 将ctl - 1，扣掉一个工作线程
            decrementWorkerCount();
            return null;
        }

        // 基于ctl拿到工作线程个数
        int wc = workerCountOf(c);

        // allowCoreThreadTimeOut 字段表示是否开启了 核心线程延迟
        // wc > corePoolSize 表示工作线程数 > 核心线程数
        boolean timed = allowCoreThreadTimeOut || wc > corePoolSize;

        // 如果工作线程个数，大于最大线程数。（一般情况不会满足），把他看成false
        // 第二个判断代表，只要工作线程数小于等于核心线程数，必然为false
        // 即便工作线程个数大于核心线程数了，此时第一次循环也不会为true，因为timedOut默认值是false
        // 考虑第二次循环了，因为循环内部必然有修改timeOut的位置
        if ((wc > maximumPoolSize || (timed && timedOut))
            && (wc > 1 || workQueue.isEmpty())) {
            if (compareAndDecrementWorkerCount(c))
                return null;
            continue;
        }

        try {
            // 如果是核心线程，timed是false，如果是非核心线程，timed就是true
            Runnable r = timed ?
                // 如果是非核心，走poll方法，拿任务，等待一会
                workQueue.poll(keepAliveTime, TimeUnit.NANOSECONDS) :
                // 如果是核心，走take方法，死等。
                workQueue.take();
            if (r != null)
                return r;
            timedOut = true;
        } catch (InterruptedException retry) {
            timedOut = false;
        }
    }
}
```

### 一次核心工作者线程执行过程

![在这里插入图片描述](https://img-blog.csdnimg.cn/62f66770130741b4a3edd58e82946a6e.png#pic_center)