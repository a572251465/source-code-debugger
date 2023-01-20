'use strict';

var assert = require('assert');

var metadata = require('./helpers/metadata');

function set(name, fn) {
  assert(name, 'Task name must be specified');
  assert(typeof name === 'string', 'Task name must be a string');
  assert(typeof fn === 'function', 'Task function must be specified');

  // 此方法为fn 包裹函数
  function taskWrapper() {
    return fn.apply(this, arguments);
  }

  // 去除包裹 直接返回fn本身
  function unwrap() {
    return fn;
  }

  taskWrapper.unwrap = unwrap;
  // 从name 设置为 displayName
  taskWrapper.displayName = name;

  var meta = metadata.get(fn) || {};
  var nodes = [];
  if (meta.branch) {
    nodes.push(meta.tree);
  }

  var task = this._registry.set(name, taskWrapper) || taskWrapper;

  // 为了展示 tree task
  metadata.set(task, {
    name: name,
    orig: fn,
    tree: {
      label: name,
      type: 'task',
      nodes: nodes,
    },
  });
}

module.exports = set;
