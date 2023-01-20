'use strict';

// 注册exports 上的属性
function registerExports(gulpInst, tasks) {
  // 获取exports 的key值
  // ["default", "build"]
  var taskNames = Object.keys(tasks);

  // 如果taskNames 有值的话 通过循环挨个注册
  if (taskNames.length) {
    taskNames.forEach(register);
  }

  // 注册插件
  function register(taskName) {
    // 获取任务的方法
    var task = tasks[taskName];

    // 如果task不是函数的话 直接return
    if (typeof task !== 'function') {
      return;
    }

    // 通过gulp实例 来注册task
    gulpInst.task(task.displayName || taskName, task);
  }
}

module.exports = registerExports;
