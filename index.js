// Copyright (c) 2015. David M. Lee, II
'use strict';

var shimmer = require('shimmer');

// require mysql first; otherwise you can get some bizarre
// "object is not a function" errors if cls-mysql is loaded first.
require('mysql');
var Protocol = require('mysql/lib/protocol/Protocol');
var Pool = require('mysql/lib/Pool');

module.exports = function(ns) {
  shimmer.wrap(Protocol.prototype, '_enqueue', function(enqueue) {
    return function(sequence) {
      if (sequence._callback) {
        sequence._callback = ns.bind(sequence._callback);
      }

      return enqueue.call(this, sequence);
    };
  });

  shimmer.wrap(Pool.prototype, 'getConnection', function(getConnection) {
    return function(cb) {
      return getConnection.call(this, ns.bind(cb));
    };
  });
};
