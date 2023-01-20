'use strict';

var assert = require('assert');

var map = require('arr-map');
var flatten = require('arr-flatten');
var levenshtein = require('fast-levenshtein');

// 格式化 参数
function normalizeArgs(registry, args) {
  // 此时task就是 normalizeArgs 传递的每一个值(task任务)
  function getFunction(task) {
    // 如果task 本身就是一个方法 直接返回
    if (typeof task === 'function') {
      return task;
    }

    // 如果不是方法的话，可以是字符串，从tasks获取对应的方法
    var fn = registry.get(task);
    if (!fn) {
      var similar = similarTasks(registry, task);
      if (similar.length > 0) {
        assert(false, 'Task never defined: ' + task + ' - did you mean? ' + similar.join(', '));
      } else {
        // 如果没有定义的task的话 会执行这个错误
        assert(false, 'Task never defined: ' + task);
      }
    }
    return fn;
  }

  // 将参数进行展平 例如: [fn, fn, fn, fn]
  var flattenArgs = flatten(args);
  assert(flattenArgs.length, 'One or more tasks should be combined using series or parallel');

  return map(flattenArgs, getFunction);
}

function similarTasks(registry, queryTask) {
  if (typeof queryTask !== 'string') {
    return [];
  }

  var tasks = registry.tasks();
  var similarTasks = [];
  for (var task in tasks) {
    if (tasks.hasOwnProperty(task)) {
      var distance = levenshtein.get(task, queryTask);
      var allowedDistance = Math.floor(0.4 * task.length) + 1;
      if (distance < allowedDistance) {
        similarTasks.push(task);
      }
    }
  }
  return similarTasks;
}

module.exports = normalizeArgs;
