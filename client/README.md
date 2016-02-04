# Jetstream JS

Jetstream JS is a MVVM model framework. It includes support for the Jetstream Sync protocol to sync local and remote models.

## Install

- Browser
```html
<script src="jetstream.js"></script>
```
- AMD
```javascript
require(['jetstream'], function(Jetstream) { ... });
```
- CommonJS
```javascript
var Jetstream = require('jetstream');
```

## Usage

### Models

Jetstream models are defined by a name and definition function. There are two ways to define a model -

```javascript
var Shape = Jetstream.model({
  name: 'Shape',
  definition: function() {
    this.has('x', Number);
    this.has('y', Number);
    this.has('width', Number, { defaultValue: 100 });
    this.has('height', Number, { defaultValue: 100 });
    this.has('color', Number, { defaultValue: _hexToColor(_shapeColors[0]) });
  }
});

var Canvas = Jetstream.model('Canvas', function() {
  this.has('name', String);
  this.has('shapes', [Shape]);
});
```

### Enumeration

Jetstream enumerations are defined by a name, type, and definition. There are two ways to define an enumeration -

**Jetstream.enumeration(object)**
```javascript
var Day = Jetstream.enumeration({
  name: 'Day',
  type: String,
  values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
});
```

**Jetstream.enumeration(name, type, values)**
```javascript
var Color = Jetstream.enumeration('Color', Number, {
  'Red': 1,
  'Green': 2,
  'Blue': 4
});
```

Jetstream enumerations support two types with corresponding values -

- `String` - an array of strings
- `Number` - an object of strings to integers

#### Property Types

Jetstream supports a number of observable property types.

- `Boolean`
- `Date`
- `Number`
- `String`
- `ModelEnumeration`
- `ModelObject`
- Collections of property types, e.g. `[String]` or `[ModelObject]`

### Observation

Jetstream emits events to observe property changes on model objects. Model objects inherit the Node.js [EventEmitter](http://nodejs.org/api/events.html) module, so custom events can be used as well.

```javascript
model.on('change:width', function(...) { ... });
model.on('change:width change:height', function(...) { ... });
```

#### Events
- **change:[property]** -> (model, value, previousValue)
- **scope** -> (model, scope)
- **scopeDetach** -> (model, scope)
- **treeChange** -> (model)

Collection properties emit `add` and `remove` events as well -

- **add:[property]** -> (value)
- **remove:[property]** -> (value)

### Synchronization

```javascript
var transport = Jetstream.transport.WebSocket({ url: 'ws://localhost:3000' });
var scope = Jetstream.scope({ name: 'Canvas' });

// Initialize the client with the transport
var client = Jetstream({ transport: transport });
client.once('session', function(session) {
  session.fetch(scope, function(error) {
    if (!error) {
      // Registered to receive updates to the scope from the Jetstream server
    }
  });
});

client.connect();
```

## Tests

`npm test`
