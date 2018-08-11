/// <reference types="node" />
import Clock = require('@gamestdio/clock');
import { Signal } from '@gamestdio/signals';
import { StateContainer } from '@gamestdio/state-listener';
import { Connection } from './Connection';
export interface RoomAvailable {
    roomId: string;
    clients: number;
    maxClients: number;
    metadata?: any;
}
export declare class Room<T = any> extends StateContainer<T & any> {
    id: string;
    sessionId: string;
    name: string;
    options: any;
    clock: Clock;
    remoteClock: Clock;
    onJoin: Signal;
    onStateChange: Signal;
    onMessage: Signal;
    onError: Signal;
    onLeave: Signal;
    connection: Connection;
    private _previousState;
    constructor(name: string, options?: any);
    connect(endpoint: string): void;
    leave(): void;
    send(data: any): void;
    removeAllListeners(): void;
    protected onMessageCallback(event: any): void;
    protected setState(encodedState: Buffer, remoteCurrentTime?: number, remoteElapsedTime?: number): void;
    protected patch(serverTimeStamp: number, binaryPatch: any): void;
}
