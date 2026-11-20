// ==========================================
// FocusPulse - Firebase email authentication and per-user Firestore sync.
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    updateProfile,
    deleteUser
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDocFromServer, runTransaction, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const defaultFirebaseConfig = {
    apiKey: "AIzaSyABJAHp1a-uSWSbEQR_82QbOExZH89tvyk",
    authDomain: "focusth3-182d0.firebaseapp.com",
    projectId: "focusth3-182d0",
    storageBucket: "focusth3-182d0.firebasestorage.app",
    messagingSenderId: "700986236401",
    appId: "1:700986236401:web:ddfcd372aef4f2bdbdb850",
    measurementId: "G-256Z6HNH75"
};

const firebaseConfig = (
    window.FP_PRIVATE_CONFIG &&
    window.FP_PRIVATE_CONFIG.firebaseConfig &&
    window.FP_PRIVATE_CONFIG.firebaseConfig.apiKey
)
    ? window.FP_PRIVATE_CONFIG.firebaseConfig
    : defaultFirebaseConfig;

let app = null;
let auth = null;
let db = null;

let signupName = null;
window._guestLoginWarningAcknowledged = false;

try {
    if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId) {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);

    }
} catch (initErr) {
    console.warn("Firebase initialization warning:", initErr);
}

window.currentFirebaseUser = null;

function showError(msg) {
    const errorMessage = msg || FPi18n.message("auth.genericError");
    const obErr = document.getElementById('ob-auth-error-banner');
    if (obErr) {
        obErr.className = "p-3.5 rounded-2xl text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-2 shadow-sm";
        obErr.innerHTML = `<i class="fa-solid fa-circle-exclamation shrink-0 text-sm"></i><span>${FPi18n.messageHtml(errorMessage)}</span>`;
        obErr.classList.remove('hidden');
        obErr.style.display = 'flex';
    }
    const modalErr = document.getElementById('auth-error-msg');
    if (modalErr) {
        modalErr.innerHTML = FPi18n.messageHtml(errorMessage);
        modalErr.classList.remove('hidden');
        modalErr.style.display = 'block';
    }
    if (typeof showNotification === 'function') {
        showNotification(FPi18n.message("auth.authentication"), errorMessage, "error");
    }
}
window.showError = showError;


// Remove only obsolete password fields left by earlier builds. Keep profile metadata and workspace caches.
try {
    const key = 'focuspulse_registered_accounts';
    const records = JSON.parse(localStorage.getItem(key) || '{}');
    let changed = false;
    for (const record of Object.values(records)) {
        if (record && Object.hasOwn(record, 'password')) {
            delete record.password;
            changed = true;
        }
    }
    if (changed) localStorage.setItem(key, JSON.stringify(records));
} catch { /* Storage may be disabled. */ }

// Helper to detect if user is currently on an already used profile or guest workspace with data
window.hasExistingGuestData = function() { return false; };

window.openGuestBackupPromptBeforeLogin = function(onProceedCallback) {
    if (typeof onProceedCallback === 'function') onProceedCallback();
};

window.closeGuestBackupPromptModal = function() {
    const modal = document.getElementById('guest-login-backup-modal');
    if (modal) modal.classList.add('hidden');
};

window.confirmProceedGuestToLogin = function() {
    window.closeGuestBackupPromptModal();
};

let session = null;
let opening = null;
let signedOutDefaults;
const cacheKey = uid => 'focuspulse_account_uid_' + uid;
const baselineKey = uid => 'focuspulse_cloud_base_' + firebaseConfig.projectId + '_' + uid;

function readCache(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}

function cloudState(state) {
    // Credentials and device-specific navigation are kept out of the Firestore document.
    const {geminiApiKey, activeSection, authUid, authEmail, userType, updatedAt, ...data} = state;
    return JSON.parse(JSON.stringify(data));
}

function isActive(s) {
    return Boolean(s && s === session && auth?.currentUser?.uid === s.uid && window.appState.authUid === s.uid);
}

function isMap(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function equalData(a, b) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && equalData(a[key], b[key]));
}

// Apply local edits to the latest server document. Lists of workspace records use their existing IDs.
function reconcile(base, local, remote) {
    if (equalData(local, base)) return remote;
    if (equalData(remote, base) || equalData(local, remote)) return local;
    if (isMap(local) && isMap(remote) && (isMap(base) || base === undefined)) {
        const entries = [];
        for (const key of new Set([...Object.keys(local), ...Object.keys(remote)])) {
            const value = reconcile(base?.[key], local[key], remote[key]);
            if (value !== undefined) entries.push([key, value]);
        }
        return Object.fromEntries(entries);
    }
    if (Array.isArray(base) && Array.isArray(local) && Array.isArray(remote) &&
        [base, local, remote].every(rows => rows.every(row => isMap(row) && row.id != null))) {
        const byId = rows => new Map(rows.map(row => [row.id, row]));
        const before = byId(base), here = byId(local), there = byId(remote);
        const result = [];
        for (const id of new Set([...here.keys(), ...there.keys()])) {
            const row = reconcile(before.get(id), here.get(id), there.get(id));
            if (row !== undefined) result.push(row);
        }
        return result;
    }
    return local;
}

async function syncWorkspace(refresh = false) {
    const s = session;
    if (!isActive(s) || s.closing) return false;
    const operation = s.queue.then(async () => {
        if (!isActive(s) || s.closing) return false;
        const local = cloudState(window.appState);
        if (!refresh && s.exists && equalData(local, s.base)) return true;
        const ref = doc(db, 'users', s.uid);
        const saved = await runTransaction(db, async tx => {
            const snap = await tx.get(ref);
            if (!isActive(s)) throw new Error('Session changed');
            const remote = snap.exists() ? cloudState(snap.data().focuspulse_data || {}) : {};
            const next = snap.exists() ? reconcile(s.base, local, remote) : local;
            if (!snap.exists() || !equalData(next, remote)) {
                tx.set(ref, {focuspulse_data: next, email: auth.currentUser.email, updatedAt: Date.now()}, {mergeFields: ['focuspulse_data', 'email', 'updatedAt']});
            }
            return next;
        });
        if (!isActive(s)) return false;
        // Keep edits made while the transaction was in flight.
        const current = cloudState(window.appState);
        const result = reconcile(local, current, saved);
        s.base = structuredClone(saved);
        s.exists = true;
        localStorage.setItem(baselineKey(s.uid), JSON.stringify(saved));
        if (!equalData(current, result)) {
            Object.assign(window.appState, result);
            saveState();
            window.updateUI?.();
        }
        s.warned = false;
        return true;
    });
    s.queue = operation.catch(() => false);
    try {
        return await operation;
    } catch (err) {
        if (isActive(s) && !s.warned && !refresh) {
            s.warned = true;
            showNotification(FPi18n.message('auth.syncNotice'), FPi18n.message('auth.cloudUnavailable'), 'warning');
        }
        console.warn('Firestore sync:', err.code || err.message);
        return false;
    }
}

window.firebaseSyncToCloud = () => syncWorkspace();


window.firebaseUpdateProfileName = async (newName, newSubjects) => {
    if (newName && newName.trim() && newName.trim() !== 'Guest' && newName.trim() !== 'Student Scholar') {
        try {
            localStorage.setItem('focuspulse_guest_name', newName.trim());
            localStorage.setItem('focuspulse_guest_profile_name', newName.trim());
            localStorage.setItem('focuspulse_custom_user', JSON.stringify({
                name: newName.trim(),
                subjects: newSubjects || '',
                avatarDataUrl: window.appState?.user?.avatarDataUrl || '',
                isCustomName: true
            }));
        } catch (e) {}
    }
    if (window.currentFirebaseUser && auth) {
        try {
            await updateProfile(window.currentFirebaseUser, { displayName: newName });
        } catch (e) {}
    }
    await window.firebaseSyncToCloud(window.appState);
};

window.firebaseUpdateProfileAvatar = async (avatarDataUrl) => {
    await window.firebaseSyncToCloud(window.appState);
};

const pageReady = document.readyState === 'complete' ? Promise.resolve()
    : new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, {once: true}));

function clearSession() {
    session = null;
    opening = null;
    window.currentFirebaseUser = null;
    clearTimeout(window.syncTimeout);
    if (signedOutDefaults) window.appState = structuredClone(signedOutDefaults);
    for (const key of ['focuspulse_has_authed_account', 'focuspulse_auth_uid', 'focuspulse_auth_email',
        'focuspulse_custom_user', 'focuspulse_guest_name', 'focuspulse_guest_profile_name', 'focuspulse_guest_avatar']) {
        localStorage.removeItem(key);
    }
    window.updateOnboardingAccountStatusUI?.();
    window.updateUI?.();
    window.openOnboardingAuthScreen?.('signin');
}

async function restoreSession(user, request) {
    await pageReady;
    signedOutDefaults ??= structuredClone(window.appState);
    const uid = user.uid;
    const cached = readCache(cacheKey(uid));
    const base = readCache(baselineKey(uid));
    let remote;
    try {
        const snap = await getDocFromServer(doc(db, 'users', uid));
        remote = snap.exists() ? cloudState(snap.data().focuspulse_data || {}) : null;
    } catch (err) {
        // Only a previously verified account on this device can resume during an outage.
        if (err.code !== 'unavailable' || !cached || !base) throw err;
        remote = base;
    }
    if (opening !== request || auth.currentUser?.uid !== uid) return false;
    const state = structuredClone(signedOutDefaults);
    if (cached?.authUid === uid) Object.assign(state, cached);
    if (remote) {
        const data = base && cached?.authUid === uid ? reconcile(base, cloudState(cached), remote) : remote;
        Object.assign(state, data);
    }
    state.authUid = uid;
    state.authEmail = user.email;
    state.userType = 'authenticated';
    if (!remote && !cached) {
        state.user = {...state.user, name: signupName || user.displayName || user.email.split('@')[0]};
        state.hasCompletedOnboarding = signupName === null;
        state.onboardingStep = state.hasCompletedOnboarding ? 'done' : 'step_a';
    }
    window.appState = state;
    window.currentFirebaseUser = user;
    session = {uid, base: structuredClone(remote || base || cloudState(state)), exists: Boolean(remote),
        queue: Promise.resolve(), closing: false, warned: false};
    localStorage.setItem(baselineKey(uid), JSON.stringify(session.base));
    localStorage.setItem('focuspulse_has_authed_account', 'true');
    localStorage.setItem('focuspulse_auth_uid', uid);
    localStorage.setItem('focuspulse_auth_email', user.email);
    saveState();
    if (typeof applyThemeVariables === 'function') applyThemeVariables();
    if (state.timer?.isRunning && typeof resumeRunningTimerFromState === 'function') resumeRunningTimerFromState();
    window.closeAccountModal?.();
    window.updateUI?.();
    window.handlePostAuthRouting?.(user, !state.hasCompletedOnboarding);
    return true;
}

function openSession(user) {
    if (isActive(session) && session.uid === user.uid) return Promise.resolve(true);
    if (opening?.uid === user.uid) return opening.promise;
    const request = {uid: user.uid};
    opening = request;
    request.promise = restoreSession(user, request).catch(() => {
        if (opening === request) {
            clearSession();
            showError(FPi18n.message('auth.cloudUnavailable'));
        }
        return false;
    }).finally(() => { if (opening === request) opening = null; });
    return request.promise;
}

if (auth) {
    onAuthStateChanged(auth, user => {
        if (session && user && session.uid !== user.uid) clearSession();
        if (user) openSession(user);
        else if (session || opening) clearSession();
    });
}

function authError(err) {
    const errors = {
        'auth/email-already-in-use': 'auth.emailInUse',
        'auth/invalid-email': 'auth.pleaseEnterAValidEmailAddress',
        'auth/weak-password': 'auth.providerWeakPassword',
        'auth/invalid-credential': 'auth.invalidCredentials',
        'auth/user-not-found': 'auth.invalidCredentials',
        'auth/wrong-password': 'auth.invalidCredentials',
        'auth/network-request-failed': 'auth.cloudUnavailable'
    };
    showError(FPi18n.message(errors[err.code] || 'auth.genericError'));
}

window.firebaseLoginEmail = async (emailArg, passArg) => {
    const email = (emailArg ?? document.getElementById('auth-email-input')?.value ?? '').trim();
    const password = passArg ?? document.getElementById('auth-password-input')?.value;
    if (!email || !password || !auth) {
        showError(FPi18n.message(auth ? 'auth.credentialsRequired' : 'auth.cloudUnavailable'));
        return false;
    }
    window.setOnboardingAuthLoading?.(true, FPi18n.message('auth.verifyingCredentialsRestoringData'));
    try {
        const {user} = await signInWithEmailAndPassword(auth, email, password);
        const ok = await openSession(user);
        if (ok) showNotification(FPi18n.message('auth.welcome', {name: window.appState.user.name}), FPi18n.message('auth.signedInBody'), 'success');
        return ok;
    } catch (err) { authError(err); return false; }
    finally { window.setOnboardingAuthLoading?.(false); }
};

window.firebaseSignupEmail = async (nameArg, emailArg, passArg) => {
    const email = (emailArg ?? document.getElementById('auth-email-input')?.value ?? '').trim();
    const password = passArg ?? document.getElementById('auth-password-input')?.value;
    if (!email || !password || !auth) {
        showError(FPi18n.message(auth ? 'auth.signUpCredentialsRequired' : 'auth.cloudUnavailable'));
        return false;
    }
    signupName = (nameArg ?? document.getElementById('auth-name-input')?.value ?? '').trim();
    window.setOnboardingAuthLoading?.(true, FPi18n.message('auth.settingUpYourSpace'));
    try {
        const {user} = await createUserWithEmailAndPassword(auth, email, password);
        if (signupName) await updateProfile(user, {displayName: signupName});
        return await openSession(user);
    } catch (err) { authError(err); return false; }
    finally { signupName = null; window.setOnboardingAuthLoading?.(false); }
};

window.firebaseResetPassword = async emailArg => {
    const email = (emailArg || '').trim();
    if (!auth || !email.includes('@')) {
        showError(FPi18n.message(auth ? 'auth.resetEmailRequired' : 'auth.cloudUnavailable'));
        return false;
    }
    try {
        auth.languageCode = FPi18n.getCurrentLanguage();
        await sendPasswordResetEmail(auth, email);
        return true;
    } catch (err) { authError(err); return false; }
};

window.firebaseLogout = async () => {
    try {
        if (isActive(session)) {
            saveState();
            await syncWorkspace();
        }
        if (auth) await signOut(auth);
        clearSession();
        showNotification(FPi18n.message('auth.loggedOut'), FPi18n.message('auth.signedOutBody'), 'info');
    } catch (err) { authError(err); }
};


window.switchToSignUpFromBackupModal = function() {
    window.closeGuestBackupPromptModal();
    if (typeof openOnboardingAuthScreen === 'function') {
        openOnboardingAuthScreen('signup');
    }
};

// =========================================================================
// DELETE ACCOUNT & RESET EMAIL REGISTRATION (Allows fresh re-registration)
// =========================================================================
window.promptDeleteAccountModal = function() {
    const modal = document.getElementById('delete-account-modal');
    const desc = document.getElementById('delete-account-modal-desc');
    const email = (window.appState && window.appState.authEmail) || (auth && auth.currentUser ? auth.currentUser.email : '') || '';
    if (desc && email) {
        desc.innerHTML = FPi18n.markup("auth.deleteWarningWithEmail", { email });
    }
    if (modal) modal.classList.remove('hidden');
};

window.closeDeleteAccountModal = function() {
    const modal = document.getElementById('delete-account-modal');
    if (modal) modal.classList.add('hidden');
};

window.executeDeleteAccountAction = async function() {
    const btn = document.getElementById('confirm-delete-account-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = "<i class=\"fa-solid fa-circle-notch fa-spin mr-1.5\"></i><span><span data-i18n=\"auth.deleting\">Deleting...</span></span>";
    }
    try {
        const user = auth?.currentUser;
        if (!user || !isActive(session)) throw new Error('No active session');
        const email = user.email;
        const closing = session;
        closing.closing = true;
        clearTimeout(window.syncTimeout);
        await closing.queue;
        const ref = doc(db, 'users', user.uid);
        const previous = await getDocFromServer(ref);
        if (previous.exists()) await deleteDoc(ref);
        try {
            await deleteUser(user);
        } catch (err) {
            // Both services are independent. Restore the workspace if Auth rejects deletion.
            if (previous.exists()) {
                await runTransaction(db, async tx => {
                    if (!(await tx.get(ref)).exists()) tx.set(ref, previous.data());
                });
            }
            throw err;
        }
        localStorage.removeItem(cacheKey(user.uid));
        localStorage.removeItem(baselineKey(user.uid));
        clearSession();
        window.closeDeleteAccountModal();
        if (typeof updateOnboardingAccountStatusUI === 'function') updateOnboardingAccountStatusUI();
        if (typeof window.updateUI === 'function') window.updateUI();

        showNotification(
            FPi18n.message("auth.accountDeletedReset"),
            FPi18n.message("auth.accountDeletedBody", { email: email || 'user' }),
            "info"
        );

        if (typeof switchAppView === 'function') {
            switchAppView('home', false);
        }
    } catch (err) {
        console.error("Account deletion failed:", err);
        showError(FPi18n.message(err.code === 'auth/requires-recent-login' ? 'auth.recentLogin' : 'auth.accountDeletionNote'));
    } finally {
        if (session) session.closing = false;
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = "<span><span data-i18n=\"account.yesDeleteAccount\">Yes, Delete Account</span></span>";
        }
    }
};


// Firebase Auth also delivers sign-out events from other tabs.
window.syncNowFromProfile = async function() {
    if (!isActive(session)) {
        showNotification(FPi18n.message('auth.syncNotice'), FPi18n.message('auth.syncRequiresSignIn'), 'info');
        return;
    }
    const button = document.getElementById('profile-sync-now-btn');
    const original = button?.innerHTML;
    if (button) {
        button.disabled = true;
        button.innerHTML = FPi18n.markup('auth.syncing');
    }
    try {
        const ok = await syncWorkspace(true);
        showNotification(FPi18n.message('auth.syncNotice'), FPi18n.message(ok ? 'auth.syncCompleteBody' : 'auth.cloudUnavailable'), ok ? 'success' : 'warning');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = original;
        }
    }
};

window.addEventListener('online', () => syncWorkspace(true));
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncWorkspace(true);
});
