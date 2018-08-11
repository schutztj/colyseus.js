import Clock = require('@gamestdio/clock');
import { Signal } from '@gamestdio/signals';

import { StateContainer } from '@gamestdio/state-listener';
import * as fossilDelta from 'fossil-delta';
import * as msgpack from './msgpack';

import { Connection } from './Connection';
import { Protocol } from './Protocol';

export interface RoomAvailable {
    roomId: string;
    clients: number;
    maxClients: number;
    metadata?: any;
}

export class Room<T= any> extends StateContainer<T & any> {
    public id: string;
    public sessionId: string;

    public name: string;
    public options: any;

    public clock: Clock = new Clock(); // experimental
    public remoteClock: Clock = new Clock(); // experimental

    // Public signals
    public onJoin: Signal = new Signal();
    public onStateChange: Signal = new Signal();
    public onMessage: Signal = new Signal();
    public onError: Signal = new Signal();
    public onLeave: Signal = new Signal();

    public connection: Connection;
    private _previousState: any;

    constructor(name: string, options?: any) {
        super({});
        this.id = null;

        this.name = name;
        this.options = options;
        this.connection = new Connection(undefined, false);

        this.onLeave.add(() => this.removeAllListeners());
    }

    public connect(endpoint: string) {
        this.connection.url = endpoint;
        this.connection.reconnectEnabled = false;
        this.connection.onmessage = this.onMessageCallback.bind(this);
        this.connection.onclose = (e) => this.onLeave.dispatch(e);
        this.connection.onerror = (e) => {
            console.warn(`Possible causes: room's onAuth() failed or maxClients has been reached.`);
            this.onError.dispatch(e);
        };
        this.connection.open();
    }

    public leave(): void {
        if (this.connection) {
            this.connection.send([Protocol.LEAVE_ROOM]);

        } else {
            this.onLeave.dispatch();
        }
    }

    public send(data): void {
        this.connection.send([Protocol.ROOM_DATA, this.id, data]);
    }

    public removeAllListeners() {
        super.removeAllListeners();
        this.onJoin.removeAll();
        this.onStateChange.removeAll();
        this.onMessage.removeAll();
        this.onError.removeAll();
        this.onLeave.removeAll();
    }

    protected onMessageCallback(event) {
        const message = msgpack.decode(new Uint8Array(event.data));
        const code = message[0];

        if (code === Protocol.JOIN_ROOM) {
            this.sessionId = message[1];
            this.onJoin.dispatch();

        } else if (code === Protocol.JOIN_ERROR) {
            console.error(`Error: ${message[1]}`);
            this.onError.dispatch(message[1]);

        } else if (code === Protocol.ROOM_STATE) {
            const state = message[1];
            const remoteCurrentTime = message[2];
            const remoteElapsedTime = message[3];

            this.setState(state, remoteCurrentTime, remoteElapsedTime);

        } else if (code === Protocol.ROOM_STATE_PATCH) {
            this.patch(message[1], message[2]);

        } else if (code === Protocol.ROOM_DATA) {
            this.onMessage.dispatch(message[1]);

        } else if (code === Protocol.LEAVE_ROOM) {
            this.leave();
        }
    }

    protected setState(encodedState: Buffer, remoteCurrentTime?: number, remoteElapsedTime?: number): void {
        const state = msgpack.decode(encodedState);
        this.set(state);

        this._previousState = new Uint8Array(encodedState);

        // set remote clock properties
        if (remoteCurrentTime && remoteElapsedTime) {
            this.remoteClock.currentTime = remoteCurrentTime;
            this.remoteClock.elapsedTime = remoteElapsedTime;
        }

        this.clock.start();

        this.onStateChange.dispatch(remoteCurrentTime, Date.now(), state);
    }

    protected patch(serverTimeStamp: number, binaryPatch) {
        let clientReceiveTime: number = Date.now();

        // apply patch
        this._previousState = Buffer.from(fossilDelta.apply(this._previousState, binaryPatch));

        // trigger state callbacks
        this.set(msgpack.decode(this._previousState));

        this.onStateChange.dispatch(serverTimeStamp, clientReceiveTime, this.state);
    }

}
