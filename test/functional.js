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
   * @param {Function} done Test completion callback.
   */
  function asyncTestNamespace(test, done) {
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
      it('should maintain context', function(done) {
        asyncTestNamespace(function(cb) {
          connection.connect(cb);
        }, done);
      });
    });

    describe('.end()', function() {
      beforeEach(function(done) {
        connection.connect(done);
      });

      it('should maintain context', function(done) {
        asyncTestNamespace(function(cb) {
          connection.end(cb);
        }, done);
      });

      it('should maintain context even without the callback', function(done) {
        asyncTestNamespace(function(cb) {
          connection.end();
          cb();
        }, done);
      });
    });

    describe('when connected', function() {
      beforeEach(function(done) {
        connection.connect(done);
      });

      afterEach(function(done) {
        connection.end(done);
      });

      describe('.ping()', function() {
        it('should maintain context', function(done) {
          asyncTestNamespace(function(cb) {
            connection.ping(cb);
          }, done);
        });
      });

      describe('.query()', function() {
        it('should maintain context', function(done) {
          asyncTestNamespace(function(cb) {
            connection.query('select 1', cb);
          }, done);
        });
      });

      describe('.changeUser()', function() {
        it('should maintain context', function(done) {
          asyncTestNamespace(function(cb) {
            connection.changeUser(cb);
          }, done);
        });
      });

      describe('.beginTransaction()', function() {
        it('should maintain context', function(done) {
          asyncTestNamespace(function(cb) {
            connection.beginTransaction(cb);
          }, done);
        });
      });

      describe('within a transaction', function() {
        beforeEach(function(done) {
          connection.beginTransaction(done);
        });

        describe('.commit()', function() {
          it('should maintain context', function(done) {
            asyncTestNamespace(function(cb) {
              connection.commit(cb);
            }, done);
          });
        });

        describe('.rollback()', function() {
          it('should maintain context', function(done) {
            asyncTestNamespace(function(cb) {
              connection.rollback(cb);
            }, done);
          });
        });
      });

      describe('.statistics()', function() {
        it('should maintain context', function(done) {
          asyncTestNamespace(function(cb) {
            connection.statistics(cb);
          }, done);
        });
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
        it('should maintain context', function(done) {
          asyncTestNamespace(function(cb) {
            pool.query('select 1', cb);
          }, done);
        });
      });
    });

    describe('.getConnection()', function() {
      // This passes without the shim
      it('should maintain context', function(done) {
        asyncTestNamespace(function(cb) {
          pool.getConnection(function(err, connection) {
            expect(err).to.not.exist();
            connection.release();
            cb();
          });
        }, done);
      });
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
      it('should maintain context', function(done) {
        asyncTestNamespace(function(cb) {
          poolCluster.getConnection(cb);
        }, done);
      });
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
