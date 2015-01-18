![Jetstream](https://raw.githubusercontent.com/uber/jetstream/assets/jetstream.png)

Jetstream for Node is a server that brokers syncing Jetstream models over the Jetstream Sync protocol. Out of the box it has a single Websocket transport adapter with the ability to add custom transport adapters.

[![Build Status](https://img.shields.io/travis/uber/jetstream.svg?style=flat)](https://travis-ci.org/uber/jetstream)

## Features

- [x] Synchronize a shared set of models between many clients
- [x] Client and server message acknowledgement and resend capabilities
- [ ] Transactional application of changesets
- [ ] Synchronize and validate changesets with downstream services
- [x] Modular architecture
- [x] ~~Comprehensive Unit~~ Test Coverage

## Communication

- If you **found a bug**, fix it and submit a pull request, or open an issue.
- If you **have a feature request**, implement it and submit a pull request or open an issue.
- If you **want to contribute**, submit a pull request.
- For further details see `CONTRIBUTION.md`.

## Installation

`npm install jetstream`

## Run demo

`npm start`

## Tests

`npm test`

## Documentation

See the `docs` directory. A good start is with `docs/overview.md`.

# Usage

### Creating models

Jetstream works with two basic concepts: All your model objects extend from the superclass `ModelObject` and one of your ModelObject instances will be the root for your model tree encapsulated by a `Scope`.

Let's model a canvas of shapes:

```js
var createModel = require('jetstream').model;

var Shape = createModel('Shape', function() {
    this.has('x', Number);
    this.has('y', Number);
    this.has('width', Number);
    this.has('height', Number);
    this.has('type', Number);
});

var Canvas = createModel('Canvas', function() {
    this.has('name', String);
    this.has('shapes', [Shape]);
});
```

Supported types are `String`, `Number`, `Boolean`, `Date`, `ModelObject` and `[ModelObject]`

### Creating a server

```js
var createScope = require('jetstream').scope;
var createServer = require('jetstream');
var createWebsocketTransport = require('jetstream').transport.WebsocketTransport.configure;

// Example of connecting multiple clients to a shared scope
var canvas = new Canvas();
canvas.name = 'Shapes Demo';

var scope = createScope({name: 'Canvas'});
scope.setRoot(canvas);

// Start server with default transports
var websocketTransport = createWebsocketTransport({port: 3000});
var transports = [websocketTransport];
var server = createServer({transports: transports});
server.on('session', function(session, params, callback) {
    // Accept the session, no authentication or authorization in this example
    callback();

    session.on('fetch', function(name, params, callback) {
        // Verify fetching the scope 
        if (name !== scope.name) {
            return callback(new Error('No such scope'));
        }
        callback(null, scope);
    });
});

```
### Protocol

Jetstream uses JSON-based messages to create sessions, fetch scopes and synchronize changes. In case you want to build your own client or server, refer to the [protocol documentation](https://github.com/uber/jetstream/wiki/Protocol).

# License

Jetstream is available under the MIT license. See the LICENSE file for more info.
