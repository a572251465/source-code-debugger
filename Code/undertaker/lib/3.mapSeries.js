"use strict";

var once = require("once");

var helpers = require("./helpers");

function mapSeries(values, iterator, options, done) {
  // 判断options 是否是函数
  if (typeof options === "function") {
    done = options;
    options = {};
  }

  // done 必须是一个函数
  if (typeof done !== "function") {
    done = helpers.noop;
  }

  // 包裹done
  done = once(done);

  // 多个函数组成的values
  var keys = Object.keys(values);
  var length = keys.length;
  var idx = 0;
  // Return the same type as passed in
  var results = helpers.initializeResults(values);

  var extensions = helpers.defaultExtensions(options);

  // 如果length 为0 直接执行成功
  if (length === 0) {
    return done(null, results);
  }

  var key = keys[idx];
  next(key);

  function next(key) {
    // 此时value 是一个函数
    var value = values[key];

    var storage = extensions.create(value, key) || {};

    extensions.before(storage);
    // value 函数
    // key 索引
    // handler 回调方法
    iterator(value, key, once(handler));

    function handler(err, result) {
      // 此时表示异常
      if (err) {
        extensions.error(err, storage);
        return done(err, results);
      }

      extensions.after(result, storage);
      results[key] = result;

      // 如果说执行到了最后  直接执行done 表示执行结束
      if (++idx >= length) {
        done(err, results);
      } else {
        // 继续执行下一个
        next(keys[idx]);
      }
    }
  }
}

module.exports = mapSeries;
