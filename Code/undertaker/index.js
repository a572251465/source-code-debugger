'use strict';

let inherits = require("util").inherits;
let EventEmitter = require("events").EventEmitter;

let DefaultRegistry = require("./undertaker-registry");

let tree = require("./lib/tree");
let task = require("./lib/task");
let series = require("./lib/series");
let lastRun = require("./lib/last-run");
let parallel = require("./lib/parallel");
let registry = require("./lib/registry");
let _getTask = require("./lib/get-task");
let _setTask = require("./lib/set-task");

function Undertaker(customRegistry) {
  // 继承eventEmitter
  EventEmitter.call(this);

  // 挂载了get set tasks方法
  this._registry = new DefaultRegistry();
  if (customRegistry) {
    this.registry(customRegistry);
  }

  this._settle = process.env.UNDERTAKER_SETTLE === "true";
}

// 实现原型链的继承
inherits(Undertaker, EventEmitter);


Undertaker.prototype.tree = tree;

// task 任务
Undertaker.prototype.task = task;

Undertaker.prototype.series = series;

Undertaker.prototype.lastRun = lastRun;

Undertaker.prototype.parallel = parallel;

Undertaker.prototype.registry = registry;

Undertaker.prototype._getTask = _getTask;

Undertaker.prototype._setTask = _setTask;

module.exports = Undertaker;
