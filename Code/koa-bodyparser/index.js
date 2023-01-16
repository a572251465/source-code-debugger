/** !
 * koa-body-parser - index.js
 * Copyright(c) 2014
 * MIT Licensed
 *
 * Authors:
 *   dead_horse <dead_horse@qq.com> (http://deadhorse.me)
 *   fengmk2 <m@fengmk2.com> (http://fengmk2.com)
 */

"use strict";

/**
 * Module dependencies.
 */

const parse = require("co-body");
const copy = require("copy-to");

/**
 * @param [Object] opts
 *   - {String} jsonLimit default '1mb'
 *   - {String} formLimit default '56kb'
 *   - {string} encoding default 'utf-8'
 *   - {Object} extendTypes
 */

module.exports = function (opts) {
  opts = opts || {};
  const { detectJSON } = opts;
  const { onerror } = opts;

  const enableTypes = opts.enableTypes || ["json", "form"];
  const enableForm = checkEnable(enableTypes, "form");
  const enableJson = checkEnable(enableTypes, "json");
  const enableText = checkEnable(enableTypes, "text");
  const enableXml = checkEnable(enableTypes, "xml");

  opts.detectJSON = undefined;
  opts.onerror = undefined; // eslint-disable-line unicorn/prefer-add-event-listener

  // force co-body return raw body
  opts.returnRawBody = true;

  // default json types
  const jsonTypes = [
    "application/json",
    "application/json-patch+json",
    "application/vnd.api+json",
    "application/csp-report",
  ];

  // default form types
  const formTypes = ["application/x-www-form-urlencoded"];

  // default text types
  const textTypes = ["text/plain"];

  // default xml types
  const xmlTypes = ["text/xml", "application/xml"];

  const jsonOpts = formatOptions(opts, "json");
  const formOpts = formatOptions(opts, "form");
  const textOpts = formatOptions(opts, "text");
  const xmlOpts = formatOptions(opts, "xml");

  const extendTypes = opts.extendTypes || {};

  extendType(jsonTypes, extendTypes.json);
  extendType(formTypes, extendTypes.form);
  extendType(textTypes, extendTypes.text);
  extendType(xmlTypes, extendTypes.xml);

  // eslint-disable-next-line func-names
  // 此处表示插件入口
  return async function bodyParser(ctx, next) {
    // 如果已经存在了ctx.request.body的话 直接执行接下来的事情
    // disableBodyParser 表示禁止解析body
    if (ctx.request.body !== undefined || ctx.disableBodyParser)
      return await next(); // eslint-disable-line no-return-await

    try {
      // 此方法是用来解析的
      const res = await parseBody(ctx);
      // 判断解析的数据中 是否存在属性parsed
      ctx.request.body = "parsed" in res ? res.parsed : {};
      if (ctx.request.rawBody === undefined) ctx.request.rawBody = res.raw;
    } catch (err) {
      if (onerror) {
        onerror(err, ctx);
      } else {
        throw err;
      }
    }

    await next();
  };

  async function parseBody(ctx) {
    if (
      enableJson &&
      ((detectJSON && detectJSON(ctx)) || ctx.request.is(jsonTypes))
    ) {
      return await parse.json(ctx, jsonOpts); // eslint-disable-line no-return-await
    }

    if (enableForm && ctx.request.is(formTypes)) {
      return await parse.form(ctx, formOpts); // eslint-disable-line no-return-await
    }

    if (enableText && ctx.request.is(textTypes)) {
      return (await parse.text(ctx, textOpts)) || "";
    }

    if (enableXml && ctx.request.is(xmlTypes)) {
      return (await parse.text(ctx, xmlOpts)) || "";
    }

    return {};
  }
};

function formatOptions(opts, type) {
  const res = {};
  copy(opts).to(res);
  res.limit = opts[type + "Limit"];
  return res;
}

function extendType(original, extend) {
  if (extend) {
    if (!Array.isArray(extend)) {
      extend = [extend];
    }

    extend.forEach(function (extend) {
      original.push(extend);
    });
  }
}

function checkEnable(types, type) {
  return types.includes(type);
}
