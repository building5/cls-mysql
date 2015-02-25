// Copyright (c) 2015. David M. Lee, II
'use strict';

var chai = require('chai');
var cls = require('continuation-local-storage');
var expect = chai.expect;

var ns = cls.createNamespace('test');
var counter = 0;

// chai config
chai.use(require('dirty-chai'));
chai.config.includeStack = true;

// load shim
require('..')(ns);

// Load mysql after cls-mysql, to ensure ordering bugs are caught.
var mysql = require('mysql');

describe('The shimmed MySQL driver', function() {
  var config;

  /**
   * Build a basic CLS test function for simple async behavior.
   *
   * @param {Function} test Async function to test.
   * @returns {Function} Function to pass back to it().
   */
  function asyncTestNamespace(test) {
    return function(done) {
      // bind done() to the root context, since it invokes the next test
      done = ns.bind(done);

      ns.run(function() {
        var expected = ++counter;
        ns.set('foo', expected);
        test(function() {
          expect(ns.get('foo'))
            .to.be.equal(expected, 'Got unexpected value from namespace');
          done();
        });
      });
    };
  }

  before(function() {
    try {
      config = require('./config');
    } catch (err) {
      // No config, or it failed to parse. Try defaults.
      config = {
        host: 'localhost',
        user: 'root'
      };
    }

    // Connection pool tests require just one connection
    config.connectionLimit = 1;
  });

  describe('using a single connection', function() {
    var connection;

    beforeEach(function() {
      connection = mysql.createConnection(config);
    });

    describe('.connect()', function() {
      // This passes without the shim
      it('should maintain context', asyncTestNamespace(function(done) {
        connection.connect(done);
      }));
    });

    describe('.end()', function() {
      beforeEach(function(done) {
        connection.connect(done);
      });

      it('should maintain context', asyncTestNamespace(function(done) {
        connection.end(done);
      }));
    });

    describe('when connected', function() {
      beforeEach(function(done) {
        connection.connect(done);
      });

      afterEach(function(done) {
        connection.end(done);
      });

      describe('.ping()', function() {
        it('should maintain context', asyncTestNamespace(function(done) {
          connection.ping(done);
        }));
      });

      describe('.query()', function() {
        it('should maintain context', asyncTestNamespace(function(done) {
          connection.query('select 1', done);
        }));
      });

      describe('.changeUser()', function() {
        it('should maintain context', asyncTestNamespace(function(done) {
          connection.changeUser(done);
        }));
      });

      describe('.beginTransaction()', function() {
        it('should maintain context', asyncTestNamespace(function(done) {
          connection.beginTransaction(done);
        }));
      });

      describe('within a transaction', function() {
        beforeEach(function(done) {
          connection.beginTransaction(done);
        });

        describe('.commit()', function() {
          it('should maintain context', asyncTestNamespace(function(done) {
            connection.commit(done);
          }));
        });

        describe('.rollback()', function() {
          it('should maintain context', asyncTestNamespace(function(done) {
            connection.rollback(done);
          }));
        });
      });

      describe('.statistics()', function() {
        it('should maintain context', asyncTestNamespace(function(done) {
          connection.statistics(done);
        }));
      });
    });
  });

  describe('using a connection pool', function() {
    var pool;

    beforeEach(function() {
      pool = mysql.createPool(config);
    });

    describe('using direct methods', function() {
      describe('.query()', function() {
        // This passes without the shim
        it('should maintain context', asyncTestNamespace(function(done) {
          pool.query('select 1', done);
        }));
      });
    });

    describe('.getConnection()', function() {
      // This passes without the shim
      it('should maintain context', asyncTestNamespace(function(done) {
        pool.getConnection(function(err, connection) {
          expect(err).to.not.exist();
          connection.release();
          done();
        });
      }));
    });

    describe('when the pool is exhausted', function() {
      var connection;
      beforeEach(function(done) {
        pool.getConnection(function(err, c) {
          expect(err).to.not.exist();
          connection = c;
          done();
        });
      });

      describe('.query()', function() {
        it('should maintain context', function(done) {
          var expected;

          // bind done() to the root context, since it invokes the next test
          done = ns.bind(done);

          // Free up the pool later, so the callback happens asynchronously
          ns.run(function() {
            process.nextTick(function() {
              connection.release();
            });
          });

          ns.run(function() {
            expected = ++counter;
            ns.set('foo', expected);
            pool.query('select 1', function() {
              expect(ns.get('foo'))
                .to.be.equal(expected, 'Unexpected value from namespace');
              done();
            });
          });
        });
      });

      describe('.getConnection()', function() {
        it('should maintain context', function(done) {
          var expected;

          // bind done() to the root context, since it invokes the next test
          done = ns.bind(done);

          // Free up the pool later, so the callback happens asynchronously
          ns.run(function() {
            process.nextTick(function() {
              connection.release();
            });
          });

          ns.run(function() {
            expected = ++counter;
            ns.set('foo', expected);
            pool.getConnection(function() {
              expect(ns.get('foo'))
                .to.be.equal(expected, 'Unexpected value from namespace');
              done();
            });
          });
        });
      });
    });
  });

  describe('using a pool cluster', function() {
    var poolCluster;
    beforeEach(function() {
      poolCluster = mysql.createPoolCluster();
      poolCluster.add(config);
    });

    afterEach(function() {
      poolCluster.end();
    });

    describe('.getConnection()', function() {
      it('should maintain context', asyncTestNamespace(function(done) {
        poolCluster.getConnection(done);
      }));
    });

    describe('when the pool is exhausted', function() {
      var connection;
      beforeEach(function(done) {
        poolCluster.getConnection(function(err, c) {
          expect(err).to.not.exist();
          connection = c;
          done();
        });
      });

      describe('.getConnection()', function() {
        it('should maintain context', function(done) {
          var expected;

          // bind done() to the root context, since it invokes the next test
          done = ns.bind(done);

          // Free up the pool later, so the callback happens asynchronously
          ns.run(function() {
            process.nextTick(function() {
              connection.release();
            });
          });

          ns.run(function() {
            expected = ++counter;
            ns.set('foo', expected);
            poolCluster.getConnection(function() {
              expect(ns.get('foo'))
                .to.be.equal(expected, 'Unexpected value from namespace');
              done();
            });
          });
        });
      });
    });
  });
});
