'use strict';

var reduce = require('object.reduce');

var validateRegistry = require('./helpers/validateRegistry');

function setTasks(inst, task, name) {
  inst.set(name, task);
  return inst;
}

function registry(newRegistry) {
  if (!newRegistry) {
    return this._registry;
  }

  validateRegistry(newRegistry);

  var tasks = this._registry.tasks();

  // 此方法表示过渡值
  this._registry = reduce(tasks, setTasks, newRegistry);
  this._registry.init(this);
}

module.exports = registry;
