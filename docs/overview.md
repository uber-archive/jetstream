
```haskell
-- The JetStream module
-- Consists of:
--  - function to create a Model
--  - function to create a Scope
--  - function to create a Server
--  - function to create a Transport
--
-- JetStream consists of four concrete primitives.
--
--  - Model + Scope. Used to define your models and your
--      databases. These are the data structures and the
--      relationships
--  - Sync algorithm. There is an algorithm to sync changes
--      between two scopes across processes. This sync algorithm
--      is based around SyncFragment. The sync algorithm and
--      protocol can be IO agnostic.
--  - The transport layer. There is a WebSocket transport for
--      doing actual IO.
--  - The session server. There is a server that can make
--      connections with client and estabilish sessions
--
--  These four parts fit together. The session server uses the
--      websocket transport. The session server negotiates with
--      the client about which scope they want to replicate. 
--      They then take the Scope and the sync algorithm and
--      create a streaming version of the sync algorithm to
--      apply over the session which is backed by the websocket
--      transport.
--
type JetStream : {
    model: (name: String, fn: ModelDefiner) => Model,
    Scope: ({
        name: String
    }) => Scope,
    transport: {
        WebsocketTransport: {
            configure: ({
                port: Number
            }) => Transport
        }
    }
} & ({
    transports: Array<Transport>
}) => Server

jetstream : JetStream

--
-- Model
--

type ObjectUUID : String

type SyncFragmentType :
    "root" | "add" | "change" | "remove" | "movechange"

-- A SyncFragment is a data structure for a fragment of data
--      that you want to sync between server and client.
-- It's basically a patch / delta record to notify the client
--      that state has changed
type SyncFragment<T <: SyncFragmentType> : {
    type: T,
    objectUUID: ObjectUUID,
    clsName: String,
    properties: Object | null
}

-- A ModelObject can have properties that have a certain
--      PropertyType. Every property must be of this type.
type SinglePropertyType :
    global.String | global.Number | global.Boolean |
    global.Date | ModelObject
type PropertyType : SinglePropertyType | [SinglePropertyType]

-- A ModelObject can be customized by saying it has certain
--      named properties.
-- A ModelObject must be associated with a Scope and you can
--      create an add SyncFragment with it.
type ModelObject : {
    has: (propertyName: String, PropertyType) => void,
    setScope: (scope: Scope, Callback<Error, void>) => void,
    getValues: () => Object,
    getAddSyncFragment: () => SyncFragment<"add">
}

-- A Model instance inherits from ModelObject.
type Model : ModelObject & {
    typeName: String,
    uuid: ObjectUUID,
    scope: Scope | null
}
type ModelDefiner : (this: Model) => void

--
-- Scope
--

-- To persist the changes to the ModelObjects somewhere you
--      have to implement a persistance backend.
-- By default the `Scope` uses a memory implementation but it
--      should be swapped out with a production version one.
type PersistanceBackend : {
    addModelObject: () => void,
    removeModelObject: () => void,
    updateModelObject: () => void,
    containsModelObjectWithUUID: () => void
    getModelObjectByUUID: () => void,
    getModelObjectsByUUIDs: () => void
}

-- A scope contains a set of models. The scope is the chokepoint
--      to apply changes to the model objects.
-- The scope also has a persistance backend for fetching and
--      updating the concrete instances of model objects.
-- When we apply sync fragments to the scope, the scope will
--      use the persistance backend to find objects and then
--      mutates them in memory
-- A scope will emit changes when sync fragments are applied
type Scope : {
    uuid: String,
    name: String,
    persist: PersistanceBackend,

    addModelObject: (Model, Callback<Error>) => void,
    removeModelObject: (Model, Callback<Error>) => void,

    applySyncFragments: (
        Array<SyncFragment>,
        context?: Object,
        Callback<Error, Object>
    ) => void
} & EventEmitter<{
    "changes": (Array<SyncFragment>) => void
}>

--
-- Server
--

-- A client is a wrapper around a transport.
type Client : Object
type Token : String

-- A session represents a session for a Client.
--
-- When a Client requests to access a scope the session will
--      emit a fetch event and the application user can decide
--      to accept or deny the fetch request with the scope.
--
-- If a fetch request is accepted with a scope then the session
--      will bidirectionally sync this scope to the client
type Session : {
    uuid: String,
    client: null | Client,
    token: null | Token,
    accepted: Boolean
} & EventEmitter<{
    "accept": (Session, Client, resp: Object) => void,
    "deny": (Session, Client, resp: Object) => void,

    "fetch": (ScopeFetch) => void
}>

-- The ConnectionMessage type represents all the possible
--      messages that can be send down the connection.
-- It basically builds up the grammar for the protocol. The
--      client <-> server protocol consists of these message
--      types.
type ConnectionMessage : Object

-- A connection will emit one of the many "message" types that
--      can flow through the connection
type Connection : EventEmitter<{
    "message": (ConnectionMessage) => void,

    accept: () => void,
    deny: () => void
}>

-- A transport is responsible for doing IO and generating a
--      a connection object for every incoming socket.
type Transport : {
    listen: () => void
} & EventEmitter<{
    "connection": (Connection) => void
}>

-- A server contains a list of transports. You must manually
--      start it and it will start its transports
--
-- When a client connects the server will emit a session
--      event.
type Server : {
    transports: [Transport],

    start: () => void
} & EventEmitter<{
    "connection": (Connection) => void,
    "session": (Session) => void
}>
```
