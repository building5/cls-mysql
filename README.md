# cls-mysql

[cls-mysql][] provides a shim layer for [node-mysql][] so that it will
work with [continuation-local-storage][]. It does this by binding all
callbacks that are passed into node-mysql with a CLS namespace.

```js
var cls = require('continuation-local-storage');
var ns = cls.createNamespace('NODESPACE');

var mysql = require('mysql');

// load shim
require('cls-mysql')(ns);
```

## tests

The tests assume that a MySQL server is running on localhost, and the
user `root` can login without password. Alternate database config can
optionally be provided in `test/config.js`. See the
[node-mysql readme][] for config options for MySQL connections.

 [cls-mysql]: https://www.npmjs.com/package/cls-mysql
 [node-mysql]: https://www.npmjs.com/package/mysql
 [continuation-local-storage]: https://www.npmjs.com/package/continuation-local-storage
 [node-mysql readme]: https://github.com/felixge/node-mysql/#connection-options
