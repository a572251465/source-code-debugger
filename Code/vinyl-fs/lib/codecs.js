'use strict';

/* eslint-disable new-cap */

var iconv = require('iconv-lite');
var through = require('through2');

var DEFAULT_ENCODING = require('./constants').DEFAULT_ENCODING;

function Codec(codec, encoding) {
  this.codec = codec;
  this.enc = codec.enc || encoding;
  this.bomAware = codec.bomAware || false;
}


function getEncoder(codec) {
  return new codec.encoder(null, codec);
}

Codec.prototype.encode = function(str) {
  var encoder = getEncoder(this.codec);
  var buf = encoder.write(str);
  var end = encoder.end();
  return end && end.length > 0 ? Buffer.concat(buf, end) : buf;
};

Codec.prototype.encodeStream = function() {
  var encoder = getEncoder(this.codec);
  return through(
    { decodeStrings: false },
    function(str, enc, cb) {
      var buf = encoder.write(str);
      if (buf && buf.length) {
        this.push(buf);
      }
      cb();
    },
    function(cb) {
      var buf = encoder.end();
      if (buf && buf.length) {
        this.push(buf);
      }
      cb();
    }
  );
};


function getDecoder(codec) {
  return new codec.decoder(null, codec);
}

Codec.prototype.decode = function(buf) {
  var decoder = getDecoder(this.codec);
  var str = decoder.write(buf);
  var end = decoder.end();
  return end ? str + end : str;
};

Codec.prototype.decodeStream = function() {
  var decoder = getDecoder(this.codec);
  return through(
    { encoding: DEFAULT_ENCODING },
    function(buf, enc, cb) {
      var str = decoder.write(buf);
      if (str && str.length) {
        this.push(str, DEFAULT_ENCODING);
      }
      cb();
    },
    function(cb) {
      var str = decoder.end();
      if (str && str.length) {
        this.push(str, DEFAULT_ENCODING);
      }
      cb();
    }
  );
};


var cache = {};

function getCodec(encoding) {
  var codec = cache[encoding];
  if (!!codec || !encoding || cache.hasOwnProperty(encoding)) {
    return codec;
  }

  try {
    codec = new Codec(iconv.getCodec(encoding), encoding);
  } catch (err) {
    // Unsupported codec
  }

  cache[encoding] = codec;
  return codec;
}


// Pre-load default encoding
getCodec(DEFAULT_ENCODING);

module.exports = getCodec;
