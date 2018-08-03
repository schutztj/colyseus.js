"use strict";
/**
 * We do not assign 'storage' to window.localStorage immediatelly for React
 * Native compatibility. window.localStorage is not present when this module is
 * loaded.
 */
Object.defineProperty(exports, "__esModule", { value: true });
function getStorage() {
    return (typeof (cc) !== 'undefined' && cc.sys && cc.sys.localStorage)
        ? cc.sys.localStorage // compatibility with cocos creator
        : window.localStorage; // regular browser environment
}
function setItem(key, value) {
    getStorage().setItem(key, value);
}
exports.setItem = setItem;
function getItem(key, callback) {
    var value = getStorage().getItem(key);
    if (typeof (Promise) === 'undefined' || // old browsers
        !(value instanceof Promise)) {
        // browser has synchronous return
        callback(value);
    }
    else {
        // react-native is asynchronous
        value.then(function (id) { return callback(id); });
    }
}
exports.getItem = getItem;
