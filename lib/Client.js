"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var signals_1 = require("@gamestdio/signals");
var msgpack = require("./msgpack");
var Connection_1 = require("./Connection");
var Protocol_1 = require("./Protocol");
var Room_1 = require("./Room");
var Storage_1 = require("./Storage");
var Client = /** @class */ (function () {
    function Client(url) {
        var _this = this;
        // signals
        this.onOpen = new signals_1.Signal();
        this.onMessage = new signals_1.Signal();
        this.onClose = new signals_1.Signal();
        this.onError = new signals_1.Signal();
        this.rooms = {};
        this.connectingRooms = {};
        this.requestId = 0;
        this.roomsAvailableRequests = {};
        this.hostname = url;
        Storage_1.getItem('colyseusid', function (colyseusid) { return _this.connect(colyseusid); });
    }
    Client.prototype.join = function (roomName, options) {
        var _this = this;
        if (options === void 0) { options = {}; }
        options.requestId = ++this.requestId;
        var room = this.createRoom(roomName, options);
        // remove references on leaving
        room.onLeave.addOnce(function () {
            delete _this.rooms[room.id];
            delete _this.connectingRooms[options.requestId];
        });
        this.connectingRooms[options.requestId] = room;
        this.connection.send([Protocol_1.Protocol.JOIN_ROOM, roomName, options]);
        return room;
    };
    Client.prototype.rejoin = function (roomName, sessionId) {
        return this.join(roomName, { sessionId: sessionId });
    };
    Client.prototype.getAvailableRooms = function (roomName, callback) {
        var _this = this;
        // reject this promise after 10 seconds.
        var requestId = ++this.requestId;
        var removeRequest = function () { return delete _this.roomsAvailableRequests[requestId]; };
        var rejectionTimeout = setTimeout(function () {
            removeRequest();
            callback([], 'timeout');
        }, 10000);
        // send the request to the server.
        this.connection.send([Protocol_1.Protocol.ROOM_LIST, requestId, roomName]);
        this.roomsAvailableRequests[requestId] = function (roomsAvailable) {
            removeRequest();
            clearTimeout(rejectionTimeout);
            callback(roomsAvailable);
        };
    };
    Client.prototype.close = function () {
        this.connection.close();
    };
    Client.prototype.createRoom = function (roomName, options) {
        if (options === void 0) { options = {}; }
        return new Room_1.Room(roomName, options);
    };
    Client.prototype.connect = function (colyseusid) {
        var _this = this;
        this.id = colyseusid || '';
        this.connection = new Connection_1.Connection(this.buildEndpoint());
        this.connection.onmessage = this.onMessageCallback.bind(this);
        this.connection.onclose = function (e) { return _this.onClose.dispatch(e); };
        this.connection.onerror = function (e) { return _this.onError.dispatch(e); };
        // check for id on cookie
        this.connection.onopen = function () {
            if (_this.id) {
                _this.onOpen.dispatch();
            }
        };
    };
    Client.prototype.buildEndpoint = function (path, options) {
        if (path === void 0) { path = ''; }
        if (options === void 0) { options = {}; }
        // append colyseusid to connection string.
        var params = ["colyseusid=" + this.id];
        for (var name_1 in options) {
            if (!options.hasOwnProperty(name_1)) {
                continue;
            }
            params.push(name_1 + "=" + options[name_1]);
        }
        return this.hostname + "/" + path + "?" + params.join('&');
    };
    /**
     * @override
     */
    Client.prototype.onMessageCallback = function (event) {
        var message = msgpack.decode(new Uint8Array(event.data));
        var code = message[0];
        if (code === Protocol_1.Protocol.USER_ID) {
            Storage_1.setItem('colyseusid', message[1]);
            this.id = message[1];
            this.onOpen.dispatch();
        }
        else if (code === Protocol_1.Protocol.JOIN_ROOM) {
            var requestId = message[2];
            var room = this.connectingRooms[requestId];
            if (!room) {
                console.warn('colyseus.js: client left room before receiving session id.');
                return;
            }
            room.id = message[1];
            this.rooms[room.id] = room;
            room.connect(this.buildEndpoint(room.id, room.options));
            delete this.connectingRooms[requestId];
        }
        else if (code === Protocol_1.Protocol.JOIN_ERROR) {
            console.error('colyseus.js: server error:', message[2]);
            // general error
            this.onError.dispatch(message[2]);
        }
        else if (code === Protocol_1.Protocol.ROOM_LIST) {
            if (this.roomsAvailableRequests[message[1]]) {
                this.roomsAvailableRequests[message[1]](message[2]);
            }
            else {
                console.warn('receiving ROOM_LIST after timeout:', message[2]);
            }
        }
        else {
            this.onMessage.dispatch(message);
        }
    };
    return Client;
}());
exports.Client = Client;
