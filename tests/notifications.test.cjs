const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('a notification click focuses an existing window or opens FocusPulse', async () => {
    for (const hasWindow of [true, false]) {
        const events = {};
        const calls = [];
        const clients = {
            async matchAll(options) {
                assert.equal(options.type, 'window');
                assert.equal(options.includeUncontrolled, true);
                return hasWindow ? [{focus: () => calls.push('focus')}] : [];
            },
            openWindow: url => calls.push(url)
        };
        const self = {clients, addEventListener: (name, fn) => { events[name] = fn; }};
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../sw.js'), 'utf8'), {self});
        let completion;
        events.notificationclick({
            notification: {close: () => calls.push('close')},
            waitUntil: promise => { completion = promise; }
        });
        await completion;
        assert.deepEqual(calls, ['close', hasWindow ? 'focus' : './']);
    }
});
