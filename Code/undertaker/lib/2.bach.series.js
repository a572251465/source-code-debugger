"use strict";

var asyncDone = require("async-done");
const mapSeries = require("./3.mapSeries")

var helpers = require("./helpers");

function iterator(fn, key, cb) {
  return asyncDone(fn, cb);
}

function buildSeries() {
  var args = helpers.verifyArguments(arguments);

  var options = helpers.getOptions(args);

  if (options) {
    // 表示只要函数
    args = args.slice(0, -1);
  }

  function series(done) {
    // args [fn, fn, fn, fn]
    mapSeries(args, iterator, options, done);
  }

  return series;
}

module.exports = buildSeries;
