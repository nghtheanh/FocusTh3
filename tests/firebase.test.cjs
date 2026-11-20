const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/firebase.js'), 'utf8')
    .replace(/^import\s+[\s\S]*?from "[^"]+";$/gm, '');
const user = {uid: 'firebase-test-uid', email: 'owner@example.test'};

function device(db = new Map(), disk = new Map()) {
    const auth = {currentUser: null};
    let observer;
    const resets = [], notices = [];
    const snapshot = ref => ({exists: () => db.has(ref), data: () => structuredClone(db.get(ref))});
    const env = {
        structuredClone, clearTimeout, console: {warn() {}, error() {}},
        document: {readyState: 'complete', getElementById: () => null, addEventListener() {}},
        addEventListener() {},
        localStorage: {
            getItem: key => disk.get(key) ?? null, setItem: (key, value) => disk.set(key, value), removeItem: key => disk.delete(key)
        },
        FPi18n: {getCurrentLanguage: () => 'vi', message: key => key},
        showNotification: (...args) => notices.push(args),
        appState: {userType: null, user: {name: ''}, tasks: [], habits: [], timer: {}, geminiApiKey: 'device-only'},
        initializeApp(config) { assert.equal(config.projectId, 'focusth3-182d0'); return {}; },
        getAuth: () => auth, getFirestore: () => db, onAuthStateChanged: (_, fn) => { observer = fn; },
        async signInWithEmailAndPassword(_, email, password) {
            if (email !== user.email || password !== 'test-password') throw {code: 'auth/invalid-credential'};
            auth.currentUser = user;
            observer(user);
            return {user};
        },
        async signOut() { auth.currentUser = null; observer(null); },
        async sendPasswordResetEmail(_, email) { resets.push([email, auth.languageCode]); },
        doc(_, collection, id) {
            assert.equal(collection, 'users');
            assert.equal(id, auth.currentUser.uid);
            return collection + '/' + id;
        },
        getDocFromServer: async ref => snapshot(ref),
        runTransaction: async (_, fn) => fn({
            get: async ref => snapshot(ref),
            set: (ref, payload) => db.set(ref, structuredClone(payload))
        }),
        saveState() {
            if (env.appState.authUid) disk.set('focuspulse_account_uid_' + env.appState.authUid, JSON.stringify(env.appState));
        }
    };
    env.window = env;
    vm.runInNewContext(source, env, {filename: 'firebase.js'});
    return {env, disk, resets, notices, login: () => env.firebaseLoginEmail(user.email, 'test-password')};
}

test('only Firebase credentials unlock a workspace, and reset uses a localized email', async () => {
    const disk = new Map([['focuspulse_registered_accounts', JSON.stringify({owner: {password: 'old', name: 'An'}})]]);
    const {env, resets, login} = device(undefined, disk);
    assert.deepEqual(JSON.parse(disk.get('focuspulse_registered_accounts')), {owner: {name: 'An'}});
    assert.equal(await env.firebaseLoginEmail(user.email, 'old'), false);
    assert.equal(env.appState.userType, null);
    assert.equal(await login(), true);
    assert.equal(env.appState.authUid, user.uid);
    assert.equal(await env.firebaseResetPassword(user.email), true);
    assert.deepEqual(resets, [[user.email, 'vi']]);
    await env.firebaseLogout();
    assert.equal(env.appState.userType, null);
    assert.equal(await env.firebaseSyncToCloud(), false);
    assert.ok(![...disk.values()].join(' ').includes('test-password'));
});

test('independent devices keep concurrent record edits, deletes and local-only keys', async () => {
    const db = new Map();
    const pc = device(db), phone = device(db), laptop = device(db);
    assert.ok(await pc.login());
    pc.env.appState.tasks = [{id: 'one', title: 'Học', completed: false}];
    assert.ok(await pc.env.firebaseSyncToCloud());
    assert.ok(await phone.login());
    assert.equal(phone.env.appState.tasks[0].title, 'Học');
    pc.env.appState.tasks.push({id: 'two', title: 'Local task'});
    phone.env.appState.tasks[0].completed = true;
    assert.ok(await phone.env.firebaseSyncToCloud());
    assert.ok(await pc.env.firebaseSyncToCloud());
    assert.ok(await laptop.login());
    assert.equal(laptop.env.appState.tasks.length, 2);
    assert.equal(laptop.env.appState.tasks[0].completed, true);
    laptop.env.appState.tasks = laptop.env.appState.tasks.filter(t => t.id !== 'one');
    assert.ok(await laptop.env.firebaseSyncToCloud());
    await pc.env.syncNowFromProfile();
    assert.equal(pc.env.appState.tasks.length, 1);
    assert.equal(pc.env.appState.tasks[0].id, 'two');
    assert.ok(!JSON.stringify([...db.values()]).includes('device-only'));
    assert.deepEqual([...db.keys()], ['users/' + user.uid]);
});

test('denied access keeps the device cache intact and cannot report a successful sync', async () => {
    const key = 'focuspulse_account_uid_' + user.uid;
    const disk = new Map([[key, JSON.stringify({authUid: user.uid, tasks: [{id: 'old'}]})]]);
    const {env, login, notices} = device(undefined, disk);
    env.getDocFromServer = async () => { throw {code: 'permission-denied'}; };
    const backup = disk.get(key);
    assert.equal(await login(), false);
    assert.equal(env.appState.userType, null);
    assert.equal(disk.get(key), backup);
    assert.equal(await env.firebaseSyncToCloud(), false);
    assert.equal(notices.at(-1)[2], 'error');
});

test('an offline edit is retained on the device and synchronized after reconnecting', async () => {
    const db = new Map();
    const pc = device(db);
    assert.ok(await pc.login());
    assert.ok(await pc.env.firebaseSyncToCloud());
    pc.env.appState.tasks.push({id: 'offline', title: 'Offline draft'});
    pc.env.saveState();
    const disconnected = device(db, pc.disk);
    disconnected.env.getDocFromServer = async () => { throw {code: 'unavailable'}; };
    assert.ok(await disconnected.login());
    assert.equal(disconnected.env.appState.tasks[0].id, 'offline');
    assert.ok(await disconnected.env.firebaseSyncToCloud());
    assert.equal(db.get('users/' + user.uid).focuspulse_data.tasks[0].id, 'offline');
});

