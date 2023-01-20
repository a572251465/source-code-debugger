'use strict';

var bach = require('bach');

var metadata = require('./helpers/metadata');
var buildTree = require('./helpers/buildTree');
var normalizeArgs = require('./helpers/normalizeArgs');
var createExtensions = require('./helpers/createExtensions');

// 此方法将来是传递多个方法的
function series() {
  var create = this._settle ? bach.settleSeries : bach.series;

  // 格式化参数 [fn, fn, fn, fn]
  var args = normalizeArgs(this._registry, arguments);
  // 此时返回的是扩展 {create: ..., before: ..., after: ...}
  var extensions = createExtensions(this);
  var fn = create(args, extensions);
  var name = '<series>';

  metadata.set(fn, {
    name: name,
    branch: true,
    tree: {
      label: name,
      type: 'function',
      branch: true,
      nodes: buildTree(args),
    },
  });
  return fn;
}

module.exports = series;
