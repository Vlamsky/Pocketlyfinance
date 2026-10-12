/**
 * POCKETLY APP LOCK & BIOMETRIC PRIVACY MODULE
 * Fintech-grade 4-Digit PIN Passcode, WebAuthn Biometrics & Account Recovery
 */
(function() {
    'use strict';

    const SALT = 'pocketly_fintech_vault_salt_v1';

    let currentUserId = null;
    let currentEnteredPin = '';
    let isCurrentlyLocked = false;
    let setupStep = 1; // 1: Enter new PIN, 2: Confirm new PIN
    let firstEnteredSetupPin = '';
    let currentSetupPin = '';
    let isChangingPin = false;
    let lastBackgroundTimestamp = 0;
    let bypassLockOnce = false;

    // Retrieve active user ID
    function getUid() {
        if (currentUserId) return currentUserId;
        if (window.PocketlyAuth && window.PocketlyAuth.currentUser) {
            return window.PocketlyAuth.currentUser.uid;
        }
        return null;
    }

    function getPinKey(uid = getUid()) {
        return uid ? `pocketly_app_lock_pin_${uid}` : 'pocketly_app_lock_pin_hash';
    }

    function getEnabledKey(uid = getUid()) {
        return uid ? `pocketly_app_lock_enabled_${uid}` : 'pocketly_app_lock_enabled';
    }

    function getBioKey(uid = getUid()) {
        return uid ? `pocketly_app_lock_bio_${uid}` : 'pocketly_app_lock_biometric';
    }

    function getBioCredKey(uid = getUid()) {
        return uid ? `pocketly_app_lock_bio_cred_${uid}` : 'pocketly_bio_cred_id';
    }

    function getTimeoutKey(uid = getUid()) {
        return uid ? `pocketly_app_lock_timeout_${uid}` : 'pocketly_app_lock_timeout';
    }

    function getAutoLockTimeout() {
        const uid = getUid();
        const stored = uid ? localStorage.getItem(getTimeoutKey(uid)) : localStorage.getItem('pocketly_app_lock_timeout');
        if (stored !== null && !isNaN(parseInt(stored, 10))) {
            return parseInt(stored, 10);
        }
        return 60; // Default: 60 seconds (1 minute grace period)
    }

    function setAutoLockTimeout(seconds) {
        const uid = getUid();
        const sec = parseInt(seconds, 10);
        const val = isNaN(sec) ? 60 : sec;
        if (uid) localStorage.setItem(getTimeoutKey(uid), String(val));
        localStorage.setItem('pocketly_app_lock_timeout', String(val));
    }

    // Migrate any legacy un-namespaced keys to active user
    function migrateLegacyKeys(uid) {
        if (!uid) return;
        const legacyPin = localStorage.getItem('pocketly_app_lock_pin_hash');
        const legacyEnabled = localStorage.getItem('pocketly_app_lock_enabled');
        const legacyBio = localStorage.getItem('pocketly_app_lock_biometric');
        const legacyBioCred = localStorage.getItem('pocketly_bio_cred_id');

        if (legacyPin && !localStorage.getItem(getPinKey(uid))) {
            localStorage.setItem(getPinKey(uid), legacyPin);
        }
        if (legacyEnabled && !localStorage.getItem(getEnabledKey(uid))) {
            localStorage.setItem(getEnabledKey(uid), legacyEnabled);
        }
        if (legacyBio && !localStorage.getItem(getBioKey(uid))) {
            localStorage.setItem(getBioKey(uid), legacyBio);
        }
        if (legacyBioCred && !localStorage.getItem(getBioCredKey(uid))) {
            localStorage.setItem(getBioCredKey(uid), legacyBioCred);
        }

        // Clean up un-scoped keys so logged-out state is completely clean
        localStorage.removeItem('pocketly_app_lock_pin_hash');
        localStorage.removeItem('pocketly_app_lock_enabled');
        localStorage.removeItem('pocketly_app_lock_biometric');
        localStorage.removeItem('pocketly_bio_cred_id');
    }

    // SHA-256 PIN Hashing
    async function hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin + SALT);
        const hashBuf = await crypto.subtle.digest('SHA-256', data);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Is App Lock enabled for current account?
    function isLockEnabled() {
        const uid = getUid();
        if (!uid) return false; // Never enabled for unauthenticated / logged-out users
        return localStorage.getItem(getEnabledKey(uid)) === 'true' && Boolean(localStorage.getItem(getPinKey(uid)));
    }

    // Is Biometrics enabled for current account?
    function isBiometricEnabled() {
        const uid = getUid();
        if (!uid) return false;
        return localStorage.getItem(getBioKey(uid)) === 'true';
    }

    // Check if user is actively in authenticated app screen (not login/register)
    function isUserLoggedIn() {
        const uid = getUid();
        if (!uid) return false;
        const authScreen = document.getElementById('authScreen');
        const appScreen = document.getElementById('appScreen');
        if (authScreen && authScreen.style.display !== 'none' && authScreen.style.display !== '') {
            return false;
        }
        if (appScreen && appScreen.style.display === 'none') {
            return false;
        }
        return true;
    }

    // Wipe all PIN and biometric credentials for user
    function clearAllLockData(uid = getUid()) {
        if (uid) {
            localStorage.removeItem(getPinKey(uid));
            localStorage.removeItem(getEnabledKey(uid));
            localStorage.removeItem(getBioKey(uid));
            localStorage.removeItem(getBioCredKey(uid));
            localStorage.removeItem(getTimeoutKey(uid));
        }
        localStorage.removeItem('pocketly_app_lock_pin_hash');
        localStorage.removeItem('pocketly_app_lock_enabled');
        localStorage.removeItem('pocketly_app_lock_biometric');
        localStorage.removeItem('pocketly_bio_cred_id');
        localStorage.removeItem('pocketly_app_lock_timeout');
    }

    // Update PIN indicator dots on lock screen
    function updateLockDots() {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`pdot${i}`);
            if (dot) {
                dot.classList.toggle('filled', i < currentEnteredPin.length);
            }
        }
    }

    // Update PIN indicator dots on setup modal
    function updateSetupDots() {
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`sdot${i}`);
            if (dot) {
                dot.classList.toggle('filled', i < currentSetupPin.length);
            }
        }
    }

    // Immediately hide lock overlay
    function hideLockScreenImmediately() {
        const overlay = document.getElementById('appLockScreen');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.classList.remove('unlocking');
        }
        isCurrentlyLocked = false;
        currentEnteredPin = '';
        lastBackgroundTimestamp = 0;
        updateLockDots();
    }

    // Show Lock Screen
    function showLockScreen() {
        // Guard: App Lock should NEVER appear if user is logged out or viewing login/register
        if (!isUserLoggedIn() || !isLockEnabled()) {
            hideLockScreenImmediately();
            return;
        }

        const overlay = document.getElementById('appLockScreen');
        if (!overlay) return;

        currentEnteredPin = '';
        updateLockDots();

        const errMsg = document.getElementById('pinErrorMsg');
        if (errMsg) errMsg.style.display = 'none';

        const promptEl = document.getElementById('appLockPromptText');
        const forgotBtn = document.getElementById('btnForgotPin');
        const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;
        if (promptEl) promptEl.innerText = t('lock_enter_pin', 'Enter 4-Digit PIN to unlock');
        if (forgotBtn) forgotBtn.innerText = t('forgot_pin_title', 'Forgot PIN?');

        const bioBtn = document.getElementById('btnBiometricUnlock');
        if (bioBtn) {
            bioBtn.style.visibility = isBiometricEnabled() ? 'visible' : 'hidden';
        }

        overlay.style.display = 'flex';
        overlay.classList.remove('unlocking');
        isCurrentlyLocked = true;

        if (isBiometricEnabled()) {
            setTimeout(triggerBiometricAuth, 350);
        }
    }

    // Hide Lock Screen with smooth animation
    function unlockApp() {
        const overlay = document.getElementById('appLockScreen');
        if (!overlay) return;

        overlay.classList.add('unlocking');
        if (window.PocketlyAudio && typeof window.PocketlyAudio.playSuccessChime === 'function') {
            window.PocketlyAudio.playSuccessChime();
        }

        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.classList.remove('unlocking');
            isCurrentlyLocked = false;
            currentEnteredPin = '';
            lastBackgroundTimestamp = 0;
            updateLockDots();
        }, 280);
    }

    // Verify entered PIN
    async function verifyEnteredPin() {
        const uid = getUid();
        const storedHash = uid ? localStorage.getItem(getPinKey(uid)) : null;
        const enteredHash = await hashPin(currentEnteredPin);

        if (storedHash && enteredHash === storedHash) {
            unlockApp();
        } else {
            // Mismatch: Shake animation & error buzz
            const dotsContainer = document.getElementById('pinDotsContainer');
            const errMsg = document.getElementById('pinErrorMsg');

            if (dotsContainer) dotsContainer.classList.add('shake');
            if (errMsg) {
                const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;
                errMsg.innerText = t('lock_pin_incorrect', 'Incorrect PIN. Please try again.');
                errMsg.style.display = 'block';
            }

            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try { navigator.vibrate([60, 40, 60]); } catch (e) {}
            }

            setTimeout(() => {
                if (dotsContainer) dotsContainer.classList.remove('shake');
                currentEnteredPin = '';
                updateLockDots();
            }, 500);
        }
    }

    // Append digit to lock screen
    function handlePinInput(digit) {
        if (!isCurrentlyLocked || currentEnteredPin.length >= 4) return;

        currentEnteredPin += digit;
        updateLockDots();

        if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
            window.PocketlyAudio.playCardTap();
        }

        if (currentEnteredPin.length === 4) {
            setTimeout(verifyEnteredPin, 100);
        }
    }

    // Backspace on lock screen
    function handlePinBackspace() {
        if (!isCurrentlyLocked || currentEnteredPin.length === 0) return;

        currentEnteredPin = currentEnteredPin.slice(0, -1);
        updateLockDots();

        if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
            window.PocketlyAudio.playCardTap();
        }
    }

    // Helper: Prompt Native Android Biometric (Fingerprint / Face ID)
    function promptNativeBiometric(title, subtitle) {
        return new Promise((resolve) => {
            if (!window.AndroidNative || typeof window.AndroidNative.authenticateBiometric !== 'function') {
                resolve(false);
                return;
            }
            window.__pocketlyBioCallback = function(success, errorMsg) {
                delete window.__pocketlyBioCallback;
                resolve(Boolean(success));
            };
            window.AndroidNative.authenticateBiometric(
                title || 'Buka Pocketly',
                subtitle || 'Sentuh sensor sidik jari atau gunakan pengenalan wajah'
            );
        });
    }

    // WebAuthn / Android Biometric Authentication
    async function triggerBiometricAuth() {
        if (!isBiometricEnabled()) return;

        // 1. Android Native Biometric (Fingerprint / Face ID)
        if (window.AndroidNative && typeof window.AndroidNative.authenticateBiometric === 'function') {
            const success = await promptNativeBiometric(
                'Buka Pocketly',
                'Sentuh sensor sidik jari atau gunakan pengenalan wajah'
            );
            if (success) {
                unlockApp();
            }
            return;
        }

        // 2. WebAuthn Fallback (Browser)
        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);

            const options = {
                publicKey: {
                    challenge: challenge,
                    timeout: 60000,
                    userVerification: 'required'
                }
            };

            if (navigator.credentials && navigator.credentials.get) {
                const uid = getUid();
                const rawCredId = uid ? localStorage.getItem(getBioCredKey(uid)) : null;
                if (rawCredId) {
                    options.publicKey.allowCredentials = [{
                        id: Uint8Array.from(atob(rawCredId), c => c.charCodeAt(0)),
                        type: 'public-key',
                        transports: ['internal']
                    }];
                }
                const assertion = await navigator.credentials.get(options);
                if (assertion) {
                    unlockApp();
                }
            }
        } catch (err) {
            console.debug('[AppLock] Biometric fallback to PIN:', err.message);
        }
    }

    // Biometric Credential Registration
    async function registerBiometrics() {
        // 1. Android Native Biometric (Fingerprint / Face ID)
        if (window.AndroidNative && typeof window.AndroidNative.authenticateBiometric === 'function') {
            const success = await promptNativeBiometric(
                'Verifikasi Biometrik',
                'Sentuh sensor sidik jari atau gunakan pengenalan wajah untuk mengaktifkan'
            );
            if (success) {
                const uid = getUid();
                if (uid) {
                    localStorage.setItem(getBioKey(uid), 'true');
                }
                return true;
            }
            return false;
        }

        // 2. WebAuthn Fallback (Browser)
        if (!window.PublicKeyCredential) {
            if (window.showAlert) showAlert('Biometrics are not supported on this device/browser.', true);
            return false;
        }

        try {
            const challenge = new Uint8Array(32);
            window.crypto.getRandomValues(challenge);
            const userId = new Uint8Array(16);
            window.crypto.getRandomValues(userId);

            const createOptions = {
                publicKey: {
                    challenge: challenge,
                    rp: { name: 'Pocketly Finance', id: window.location.hostname },
                    user: {
                        id: userId,
                        name: 'pocketly-user',
                        displayName: 'Pocketly Owner'
                    },
                    pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required'
                    },
                    timeout: 60000
                }
            };

            const credential = await navigator.credentials.create(createOptions);
            if (credential) {
                const credIdBase64 = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
                const uid = getUid();
                if (uid) {
                    localStorage.setItem(getBioCredKey(uid), credIdBase64);
                    localStorage.setItem(getBioKey(uid), 'true');
                }
                return true;
            }
        } catch (e) {
            console.warn('[AppLock] Biometric registration canceled:', e);
            return false;
        }
        return false;
    }

    // --- SETUP MODAL LOGIC ---
    function openPinSetup(title = 'Set 4-Digit PIN') {
        setupStep = 1;
        isChangingPin = (title.includes('Change') || title.includes('Ganti') || title.includes('변경') || title.includes('変更'));
        firstEnteredSetupPin = '';
        currentSetupPin = '';
        updateSetupDots();

        const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;

        const titleEl = document.getElementById('pinSetupTitle');
        const descEl = document.getElementById('pinSetupDesc');
        const errEl = document.getElementById('setupPinErrorMsg');
        const modal = document.getElementById('pinSetupModal');
        const cancelBtn = document.getElementById('btnCancelPinSetup');

        if (titleEl) {
            titleEl.innerText = isChangingPin 
                ? t('pin_change_title', 'Change 4-Digit PIN') 
                : t('pin_setup_title', 'Create 4-Digit PIN');
        }
        if (descEl) descEl.innerText = t('pin_setup_sub', 'Enter 4 digits for your security PIN.');
        if (errEl) errEl.style.display = 'none';
        if (cancelBtn) cancelBtn.innerText = t('btn_cancel', 'Cancel');

        if (modal) modal.classList.add('show');
    }

    function closePinSetup() {
        const modal = document.getElementById('pinSetupModal');
        if (modal) modal.classList.remove('show');
        currentSetupPin = '';
        firstEnteredSetupPin = '';
        updateSetupDots();
        syncSettingsUI();
    }

    async function handleSetupPinInput(digit) {
        if (currentSetupPin.length >= 4) return;

        currentSetupPin += digit;
        updateSetupDots();

        if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
            window.PocketlyAudio.playCardTap();
        }

        if (currentSetupPin.length === 4) {
            if (setupStep === 1) {
                // Step 1 complete -> Confirm step
                firstEnteredSetupPin = currentSetupPin;
                setTimeout(() => {
                    setupStep = 2;
                    currentSetupPin = '';
                    updateSetupDots();
                    const descEl = document.getElementById('pinSetupDesc');
                    const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;
                    if (descEl) descEl.innerText = t('pin_confirm_sub', 'Re-enter your 4-digit PIN to confirm.');
                }, 200);
            } else if (setupStep === 2) {
                // Step 2 complete -> Match check
                if (currentSetupPin === firstEnteredSetupPin) {
                    const uid = getUid();
                    if (!uid) {
                        if (window.showAlert) showAlert('Please log in first to set up App Lock.', true);
                        closePinSetup();
                        return;
                    }

                    const hashed = await hashPin(currentSetupPin);
                    localStorage.setItem(getPinKey(uid), hashed);
                    localStorage.setItem(getEnabledKey(uid), 'true');

                    closePinSetup();
                    syncSettingsUI();

                    if (window.showAlert) {
                        const successMsg = isChangingPin 
                            ? 'PIN passcode has been updated successfully!' 
                            : 'App Lock PIN has been enabled successfully!';
                        showAlert(successMsg, false);
                    }
                } else {
                    const errEl = document.getElementById('setupPinErrorMsg');
                    const dots = document.getElementById('setupPinDotsContainer');
                    const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;
                    if (errEl) {
                        errEl.innerText = t('pin_mismatch_error', 'PIN confirmation does not match.');
                        errEl.style.display = 'block';
                    }
                    if (dots) dots.classList.add('shake');

                    setTimeout(() => {
                        if (dots) dots.classList.remove('shake');
                        currentSetupPin = '';
                        updateSetupDots();
                    }, 500);
                }
            }
        }
    }

    function handleSetupBackspace() {
        if (currentSetupPin.length === 0) return;
        currentSetupPin = currentSetupPin.slice(0, -1);
        updateSetupDots();
        if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
            window.PocketlyAudio.playCardTap();
        }
    }

    // --- FORGOT PIN MODAL LOGIC ---
    function openForgotPinModal() {
        const modal = document.getElementById('forgotPinModal');
        const passInput = document.getElementById('forgotPinPasswordInput');
        const errMsg = document.getElementById('forgotPinErrorMsg');
        const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;

        if (modal) {
            const titleEl = modal.querySelector('h2');
            const subEl = modal.querySelector('p');
            const btnVerify = document.getElementById('btnVerifyAndResetPin');
            const btnSignOut = document.getElementById('btnForgotPinSignOut');
            if (titleEl) titleEl.innerText = t('forgot_pin_title', 'Forgot PIN?');
            if (subEl) subEl.innerText = t('forgot_pin_sub', 'Verify your account password to reset your PIN, or sign out to log in again.');
            if (btnVerify) btnVerify.innerText = t('btn_verify_reset_pin', 'Verify & Reset PIN');
            if (btnSignOut) {
                btnSignOut.innerHTML = `<i class="fa-solid fa-arrow-right-from-bracket"></i> ${t('btn_signout_relogin', 'Sign Out & Re-login')}`;
            }
        }

        if (passInput) passInput.value = '';
        if (errMsg) {
            errMsg.innerText = '';
            errMsg.style.display = 'none';
        }

        if (modal) modal.classList.add('show');
        setTimeout(() => {
            if (passInput) passInput.focus();
        }, 150);
    }

    function closeForgotPinModal() {
        const modal = document.getElementById('forgotPinModal');
        if (modal) modal.classList.remove('show');
        const passInput = document.getElementById('forgotPinPasswordInput');
        if (passInput) passInput.value = '';
    }

    async function handleVerifyAndResetPin() {
        const passInput = document.getElementById('forgotPinPasswordInput');
        const errMsg = document.getElementById('forgotPinErrorMsg');
        const btnVerify = document.getElementById('btnVerifyAndResetPin');
        const password = passInput ? passInput.value.trim() : '';
        const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;
        const translate = (txt) => (window.PocketlyI18n && typeof window.PocketlyI18n.translateText === 'function') ? window.PocketlyI18n.translateText(txt) : txt;

        if (!password) {
            if (errMsg) {
                errMsg.innerText = translate('Please enter your account password.');
                errMsg.style.display = 'block';
            }
            return;
        }

        if (errMsg) errMsg.style.display = 'none';
        if (btnVerify) {
            btnVerify.disabled = true;
            btnVerify.innerText = translate('Verifying password...');
        }

        try {
            if (window.PocketlyAuth && typeof window.PocketlyAuth.verifyPassword === 'function') {
                await window.PocketlyAuth.verifyPassword(password);
                
                // Password confirmed: wipe PIN for this user
                clearAllLockData(getUid());
                closeForgotPinModal();
                unlockApp();
                syncSettingsUI();

                if (window.showAlert) {
                    showAlert('Identity verified! App Lock has been reset.', false);
                }
            } else {
                clearAllLockData(getUid());
                closeForgotPinModal();
                unlockApp();
                syncSettingsUI();
            }
        } catch (err) {
            console.error('[AppLock] Password verification failed:', err);
            if (errMsg) {
                if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    errMsg.innerText = translate('Incorrect password. Please try again.');
                } else if (err.message === 'NO_USER') {
                    errMsg.innerText = translate('Session expired. Please logout and login again.');
                } else {
                    errMsg.innerText = translate('Incorrect password. Please try again.');
                }
                errMsg.style.display = 'block';
            }
        } finally {
            if (btnVerify) {
                btnVerify.disabled = false;
                btnVerify.innerText = t('btn_verify_reset_pin', 'Verify & Reset PIN');
            }
        }
    }

    async function handleForgotPinSignOut() {
        const uid = getUid();
        clearAllLockData(uid);
        closeForgotPinModal();
        hideLockScreenImmediately();

        if (window.PocketlyAuth && typeof window.PocketlyAuth.signOut === 'function') {
            try {
                await window.PocketlyAuth.signOut();
            } catch (e) {
                console.warn('[AppLock] SignOut error:', e);
                window.location.reload();
            }
        } else {
            window.location.reload();
        }
    }

    // Sync Settings Page Toggles
    function syncSettingsUI() {
        const toggle = document.getElementById('appLockToggle');
        const rowChangePin = document.getElementById('rowChangePin');
        const rowBio = document.getElementById('rowBiometric');
        const bioToggle = document.getElementById('biometricLockToggle');

        const enabled = isLockEnabled();

        if (toggle) toggle.checked = enabled;
        if (rowChangePin) rowChangePin.style.display = enabled ? 'flex' : 'none';

        const hasNative = Boolean(window.AndroidNative);
        const hasNativeBio = Boolean(
            window.AndroidNative &&
            (typeof window.AndroidNative.isBiometricAvailable !== 'function' ||
             window.AndroidNative.isBiometricAvailable())
        );
        const hasWebAuthn = Boolean(window.PublicKeyCredential);
        const hasBiometricSupport = hasNative || hasNativeBio || hasWebAuthn;

        // Biometric Row in Settings: Always visible so user can discover and toggle it
        if (rowBio) rowBio.style.display = 'flex';
        if (bioToggle) bioToggle.checked = isBiometricEnabled();

        const rowTimeout = document.getElementById('rowAutoLockTimeout');
        const textTimeout = document.getElementById('currentAutoLockTimeoutText');
        if (rowTimeout) rowTimeout.style.display = enabled ? 'flex' : 'none';
        if (textTimeout) {
            textTimeout.innerText = getTimeoutLabel(getAutoLockTimeout());
        }
    }

    function getTimeoutLabel(seconds) {
        const sec = parseInt(seconds, 10);
        const t = (key, fallback) => (window.PocketlyI18n && typeof window.PocketlyI18n.t === 'function') ? window.PocketlyI18n.t(key, fallback) : fallback;
        switch (sec) {
            case 0: return t('timeout_immediately', 'Immediately');
            case 60: return t('timeout_1min', 'After 1 minute');
            case 300: return t('timeout_5min', 'After 5 minutes');
            case 900: return t('timeout_15min', 'After 15 minutes');
            case 1800: return t('timeout_30min', 'After 30 minutes');
            default: return `${sec}s`;
        }
    }

    function openAutoLockModal() {
        const modal = document.getElementById('autoLockTimeoutModal');
        if (!modal) return;
        const currentSec = getAutoLockTimeout();
        modal.querySelectorAll('.timeout-option-card').forEach(card => {
            const cardSec = parseInt(card.dataset.seconds, 10);
            card.classList.toggle('active', cardSec === currentSec);
        });
        modal.classList.add('show');
    }

    function closeAutoLockModal() {
        const modal = document.getElementById('autoLockTimeoutModal');
        if (modal) modal.classList.remove('show');
    }

    // External hooks for Firebase Auth state changes
    function onUserAuth(user) {
        if (!user) {
            onSignOut();
            return;
        }
        currentUserId = user.uid;
        migrateLegacyKeys(currentUserId);
        syncSettingsUI();

        // If biometric login already validated identity, skip PIN lock
        if (bypassLockOnce) {
            bypassLockOnce = false;
            hideLockScreenImmediately();
            return;
        }

        // If App Lock is enabled for this account, present the PIN lock now
        if (isLockEnabled()) {
            showLockScreen();
        } else {
            hideLockScreenImmediately();
        }
    }

    function onSignOut() {
        currentUserId = null;
        hideLockScreenImmediately();
        closePinSetup();
        closeForgotPinModal();
    }

    // Setup Event Listeners
    function initAppLock() {
        // Virtual Keypad buttons on Lock Screen
        document.querySelectorAll('.pin-key-btn[data-key]').forEach(btn => {
            btn.addEventListener('click', () => {
                handlePinInput(btn.getAttribute('data-key'));
            });
        });

        const btnBack = document.getElementById('btnPinBackspace');
        if (btnBack) btnBack.addEventListener('click', handlePinBackspace);

        const btnBio = document.getElementById('btnBiometricUnlock');
        if (btnBio) btnBio.addEventListener('click', triggerBiometricAuth);

        // Forgot PIN button on Lock Screen
        const btnForgot = document.getElementById('btnForgotPin');
        if (btnForgot) btnForgot.addEventListener('click', openForgotPinModal);

        // Physical Keyboard listeners
        window.addEventListener('keydown', (e) => {
            const forgotModal = document.getElementById('forgotPinModal');
            if (forgotModal && forgotModal.classList.contains('show')) {
                if (e.key === 'Escape') {
                    closeForgotPinModal();
                } else if (e.key === 'Enter') {
                    handleVerifyAndResetPin();
                }
                return;
            }

            if (isCurrentlyLocked) {
                if (e.key >= '0' && e.key <= '9') {
                    handlePinInput(e.key);
                } else if (e.key === 'Backspace') {
                    handlePinBackspace();
                }
            } else {
                const setupModal = document.getElementById('pinSetupModal');
                if (setupModal && setupModal.classList.contains('show')) {
                    if (e.key >= '0' && e.key <= '9') {
                        handleSetupPinInput(e.key);
                    } else if (e.key === 'Backspace') {
                        handleSetupBackspace();
                    } else if (e.key === 'Escape') {
                        closePinSetup();
                    }
                }
            }
        });

        // Setup modal buttons
        document.querySelectorAll('.pin-key-btn[data-skey]').forEach(btn => {
            btn.addEventListener('click', () => {
                handleSetupPinInput(btn.getAttribute('data-skey'));
            });
        });

        const btnSetupBack = document.getElementById('btnSetupBackspace');
        if (btnSetupBack) btnSetupBack.addEventListener('click', handleSetupBackspace);

        const btnCloseSetup = document.getElementById('btnClosePinSetup');
        if (btnCloseSetup) btnCloseSetup.addEventListener('click', closePinSetup);

        const btnCancelSetup = document.getElementById('btnCancelPinSetup');
        if (btnCancelSetup) btnCancelSetup.addEventListener('click', closePinSetup);

        // Forgot PIN Modal actions
        const btnCloseForgot = document.getElementById('btnCloseForgotPin');
        if (btnCloseForgot) btnCloseForgot.addEventListener('click', closeForgotPinModal);

        const btnVerifyReset = document.getElementById('btnVerifyAndResetPin');
        if (btnVerifyReset) btnVerifyReset.addEventListener('click', handleVerifyAndResetPin);

        const btnForgotSignOut = document.getElementById('btnForgotPinSignOut');
        if (btnForgotSignOut) btnForgotSignOut.addEventListener('click', handleForgotPinSignOut);

        const btnToggleForgotPass = document.getElementById('btnToggleForgotPassVisibility');
        if (btnToggleForgotPass) {
            btnToggleForgotPass.addEventListener('click', () => {
                const passInput = document.getElementById('forgotPinPasswordInput');
                const icon = btnToggleForgotPass.querySelector('i');
                if (!passInput) return;
                const isPass = passInput.type === 'password';
                passInput.type = isPass ? 'text' : 'password';
                if (icon) {
                    icon.className = isPass ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
                }
            });
        }

        // Settings: Toggle App Lock (Disabling always wipes PIN)
        const appLockToggle = document.getElementById('appLockToggle');
        if (appLockToggle) {
            appLockToggle.addEventListener('change', () => {
                if (appLockToggle.checked) {
                    appLockToggle.checked = false;
                    openPinSetup('Create 4-Digit PIN');
                } else {
                    clearAllLockData(getUid());
                    syncSettingsUI();
                    if (window.showAlert) {
                        showAlert('App Lock has been disabled and your PIN was cleared.', false);
                    }
                }
            });
        }

        // Settings: Change PIN
        const rowChangePin = document.getElementById('rowChangePin');
        if (rowChangePin) {
            rowChangePin.addEventListener('click', () => {
                openPinSetup('Change 4-Digit PIN');
            });
        }

        // Settings: Biometric Toggle
        const bioToggle = document.getElementById('biometricLockToggle');
        if (bioToggle) {
            bioToggle.addEventListener('change', async () => {
                if (bioToggle.checked) {
                    if (!isLockEnabled()) {
                        bioToggle.checked = false;
                        if (window.showAlert) {
                            showAlert(
                                (window.currentLocale === 'id-ID')
                                    ? 'Silakan aktifkan App Lock PIN terlebih dahulu sebelum mengaktifkan Biometrik.'
                                    : 'Please enable App Lock PIN first before enabling Biometrics.',
                                true
                            );
                        }
                        openPinSetup('Set 4-Digit PIN');
                        return;
                    }
                    const success = await registerBiometrics();
                    bioToggle.checked = success;
                    if (success) {
                        const uid = getUid();
                        if (uid) {
                            localStorage.setItem(getBioKey(uid), 'true');
                            localStorage.setItem('pocketly_biometric_enabled', 'true');
                        }
                        if (window.showAlert) {
                            showAlert(
                                (window.currentLocale === 'id-ID')
                                    ? 'Kunci Biometrik (Sidik Jari / Face ID) berhasil diaktifkan!'
                                    : 'Biometric Unlock (Face ID / Fingerprint) enabled!',
                                false
                            );
                        }
                        syncSettingsUI();
                    }
                } else {
                    const uid = getUid();
                    if (uid) {
                        localStorage.setItem(getBioKey(uid), 'false');
                        localStorage.setItem('pocketly_biometric_enabled', 'false');
                    }
                    if (window.showAlert) {
                        showAlert(
                            (window.currentLocale === 'id-ID')
                                ? 'Kunci Biometrik dinonaktifkan.'
                                : 'Biometric Unlock disabled.',
                            false
                        );
                    }
                    syncSettingsUI();
                }
            });
        }

        // Settings: Auto-Lock Delay Sheet Trigger
        const rowTimeout = document.getElementById('rowAutoLockTimeout');
        if (rowTimeout) {
            rowTimeout.addEventListener('click', openAutoLockModal);
        }

        const btnCloseTimeout = document.getElementById('btnCloseAutoLockModal');
        if (btnCloseTimeout) {
            btnCloseTimeout.addEventListener('click', closeAutoLockModal);
        }

        const timeoutModal = document.getElementById('autoLockTimeoutModal');
        if (timeoutModal) {
            timeoutModal.addEventListener('click', (e) => {
                if (e.target === timeoutModal) closeAutoLockModal();
            });

            timeoutModal.querySelectorAll('.timeout-option-card').forEach(card => {
                const onSelect = () => {
                    if (window.PocketlyAudio && typeof window.PocketlyAudio.playCardTap === 'function') {
                        window.PocketlyAudio.playCardTap();
                    }
                    const sec = parseInt(card.dataset.seconds, 10);
                    setAutoLockTimeout(sec);
                    syncSettingsUI();

                    timeoutModal.querySelectorAll('.timeout-option-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');

                    setTimeout(closeAutoLockModal, 180);
                };

                card.addEventListener('click', onSelect);
                card.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect();
                    }
                });
            });
        }

        // Auto-lock with Grace Period Timeout
        function recordBackgroundTime() {
            if (isLockEnabled() && isUserLoggedIn() && !isCurrentlyLocked) {
                lastBackgroundTimestamp = Date.now();
            }
        }

        function evaluateAutoLock() {
            if (!isLockEnabled() || !isUserLoggedIn() || isCurrentlyLocked) return;

            const timeoutSeconds = getAutoLockTimeout();
            if (timeoutSeconds === 0) {
                // Immediately relock
                showLockScreen();
            } else if (lastBackgroundTimestamp > 0) {
                const elapsedSeconds = (Date.now() - lastBackgroundTimestamp) / 1000;
                if (elapsedSeconds >= timeoutSeconds) {
                    showLockScreen();
                }
            }
        }

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                recordBackgroundTime();
            } else if (document.visibilityState === 'visible') {
                evaluateAutoLock();
            }
        });

        window.addEventListener('blur', recordBackgroundTime);
        window.addEventListener('focus', evaluateAutoLock);

        // Ensure lock screen starts hidden by default on boot until auth resolves
        hideLockScreenImmediately();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAppLock);
    } else {
        initAppLock();
    }

    // Public API
    window.PocketlyAppLock = {
        isLocked: () => isCurrentlyLocked,
        lockNow: showLockScreen,
        unlockNow: hideLockScreenImmediately,
        openSetup: openPinSetup,
        closeSetup: closePinSetup,
        openForgotModal: openForgotPinModal,
        closeForgotModal: closeForgotPinModal,
        isEnabled: isLockEnabled,
        clearLock: clearAllLockData,
        getTimeout: getAutoLockTimeout,
        setTimeout: setAutoLockTimeout,
        openTimeoutModal: openAutoLockModal,
        closeTimeoutModal: closeAutoLockModal,
        onUserAuth: onUserAuth,
        onSignOut: onSignOut,
        syncSettingsUI: syncSettingsUI,
        bypassNextLock: function() { bypassLockOnce = true; },
        unlockApp: unlockApp
    };
})();
