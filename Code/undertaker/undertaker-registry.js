'use strict';

function UndertakerRegistry() {
  // 返回 UndertakerRegistry 实例
  if (this instanceof UndertakerRegistry === false) {
    return new UndertakerRegistry();
  }

  // 表示task 对象
  // _tasks = {[name]: [fn]}
  this._tasks = {};
}

// init 方法中啥都没有
UndertakerRegistry.prototype.init = function init(taker) {};

// 根据name值 在tasks中 获取对应的方法
UndertakerRegistry.prototype.get = function get(name) {
  return this._tasks[name];
};

// 根据name fn 给tasks 设置值
UndertakerRegistry.prototype.set = function set(name, fn) {
  return this._tasks[name] = fn;
};

// tasks 方法
/**
 * tasks = {name: fn}
 */
UndertakerRegistry.prototype.tasks = function tasks() {
  var self = this;
  return Object.keys(this._tasks).reduce(function(tasks, name) {
    tasks[name] = self.get(name);
    return tasks;
  }, {});
};

module.exports = UndertakerRegistry;
