/**
 * POCKETLY APP LOCK & BIOMETRIC PRIVACY MODULE
 * Fintech-grade 4-Digit PIN Passcode, WebAuthn Biometrics & Account Recovery
 */
(function() {
    'use strict';

    const PIN_KEY = 'pocketly_app_lock_pin_hash';
    const ENABLED_KEY = 'pocketly_app_lock_enabled';
    const BIOMETRIC_KEY = 'pocketly_app_lock_biometric';
    const BIO_CRED_KEY = 'pocketly_bio_cred_id';
    const SALT = 'pocketly_fintech_vault_salt_v1';

    let currentEnteredPin = '';
    let isCurrentlyLocked = false;
    let setupStep = 1; // 1: Enter new PIN, 2: Confirm new PIN
    let firstEnteredSetupPin = '';
    let currentSetupPin = '';
    let isChangingPin = false;

    // SHA-256 PIN Hashing
    async function hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin + SALT);
        const hashBuf = await crypto.subtle.digest('SHA-256', data);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function isLockEnabled() {
        return localStorage.getItem(ENABLED_KEY) === 'true' && Boolean(localStorage.getItem(PIN_KEY));
    }

    function isBiometricEnabled() {
        return localStorage.getItem(BIOMETRIC_KEY) === 'true';
    }

    // Completely wipe PIN and biometric credentials from local storage
    function clearAllLockData() {
        localStorage.removeItem(PIN_KEY);
        localStorage.removeItem(ENABLED_KEY);
        localStorage.removeItem(BIOMETRIC_KEY);
        localStorage.removeItem(BIO_CRED_KEY);
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

    // Show Lock Screen
    function showLockScreen() {
        const overlay = document.getElementById('appLockScreen');
        if (!overlay) return;

        currentEnteredPin = '';
        updateLockDots();

        const errMsg = document.getElementById('pinErrorMsg');
        if (errMsg) errMsg.style.display = 'none';

        const bioBtn = document.getElementById('btnBiometricUnlock');
        if (bioBtn) {
            bioBtn.style.visibility = isBiometricEnabled() ? 'visible' : 'hidden';
        }

        overlay.style.display = 'flex';
        overlay.classList.remove('unlocking');
        isCurrentlyLocked = true;

        // Auto-prompt biometrics if enabled
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
            updateLockDots();
        }, 280);
    }

    // Verify entered PIN
    async function verifyEnteredPin() {
        const storedHash = localStorage.getItem(PIN_KEY);
        const enteredHash = await hashPin(currentEnteredPin);

        if (enteredHash === storedHash) {
            unlockApp();
        } else {
            // Mismatch: Shake animation & error buzz
            const dotsContainer = document.getElementById('pinDotsContainer');
            const errMsg = document.getElementById('pinErrorMsg');

            if (dotsContainer) dotsContainer.classList.add('shake');
            if (errMsg) {
                errMsg.innerText = 'Incorrect PIN. Please try again.';
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

    // WebAuthn Biometric Authentication
    async function triggerBiometricAuth() {
        if (!isBiometricEnabled()) return;

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
                const rawCredId = localStorage.getItem(BIO_CRED_KEY);
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
                localStorage.setItem(BIO_CRED_KEY, credIdBase64);
                localStorage.setItem(BIOMETRIC_KEY, 'true');
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
        isChangingPin = (title.includes('Change') || title.includes('Ganti'));
        firstEnteredSetupPin = '';
        currentSetupPin = '';
        updateSetupDots();

        const titleEl = document.getElementById('pinSetupTitle');
        const descEl = document.getElementById('pinSetupDesc');
        const errEl = document.getElementById('setupPinErrorMsg');
        const modal = document.getElementById('pinSetupModal');

        if (titleEl) titleEl.innerText = title;
        if (descEl) descEl.innerText = 'Enter 4 digits for your security PIN.';
        if (errEl) errEl.style.display = 'none';

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
                // Step 1 done -> Proceed to Step 2 (Confirm)
                firstEnteredSetupPin = currentSetupPin;
                setTimeout(() => {
                    setupStep = 2;
                    currentSetupPin = '';
                    updateSetupDots();
                    const descEl = document.getElementById('pinSetupDesc');
                    if (descEl) descEl.innerText = 'Re-enter your 4-digit PIN to confirm.';
                }, 200);
            } else if (setupStep === 2) {
                // Step 2 done -> Check if matches Step 1
                if (currentSetupPin === firstEnteredSetupPin) {
                    const hashed = await hashPin(currentSetupPin);
                    localStorage.setItem(PIN_KEY, hashed);
                    localStorage.setItem(ENABLED_KEY, 'true');

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
                    if (errEl) {
                        errEl.innerText = 'PIN confirmation does not match.';
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

        if (!password) {
            if (errMsg) {
                errMsg.innerText = 'Please enter your account password.';
                errMsg.style.display = 'block';
            }
            return;
        }

        if (errMsg) errMsg.style.display = 'none';
        if (btnVerify) {
            btnVerify.disabled = true;
            btnVerify.innerText = 'Verifying...';
        }

        try {
            if (window.PocketlyAuth && typeof window.PocketlyAuth.verifyPassword === 'function') {
                await window.PocketlyAuth.verifyPassword(password);
                
                // Success: remove PIN lock completely
                clearAllLockData();
                closeForgotPinModal();
                unlockApp();
                syncSettingsUI();

                if (window.showAlert) {
                    showAlert('Identity verified! App Lock has been reset.', false);
                }
            } else {
                // Fallback: clear lock
                clearAllLockData();
                closeForgotPinModal();
                unlockApp();
                syncSettingsUI();
            }
        } catch (err) {
            console.error('[AppLock] Password verification failed:', err);
            if (errMsg) {
                if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                    errMsg.innerText = 'Incorrect account password. Please try again.';
                } else if (err.message === 'NO_USER') {
                    errMsg.innerText = 'No active session found. Please sign out and log in again.';
                } else {
                    errMsg.innerText = 'Verification failed. You can sign out and log in again below.';
                }
                errMsg.style.display = 'block';
            }
        } finally {
            if (btnVerify) {
                btnVerify.disabled = false;
                btnVerify.innerText = 'Verify & Reset PIN';
            }
        }
    }

    async function handleForgotPinSignOut() {
        clearAllLockData();
        closeForgotPinModal();

        const lockOverlay = document.getElementById('appLockScreen');
        if (lockOverlay) {
            lockOverlay.style.display = 'none';
            isCurrentlyLocked = false;
        }

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

        // Check platform biometrics support
        const hasWebAuthn = Boolean(window.PublicKeyCredential);
        if (rowBio) rowBio.style.display = (enabled && hasWebAuthn) ? 'flex' : 'none';
        if (bioToggle) bioToggle.checked = enabled && isBiometricEnabled();
    }

    // Setup Event Listeners
    function initAppLock() {
        // 1. Check if app should start locked on boot
        if (isLockEnabled()) {
            showLockScreen();
        }

        // 2. Virtual Keypad buttons on Lock Screen
        document.querySelectorAll('.pin-key-btn[data-key]').forEach(btn => {
            btn.addEventListener('click', () => {
                handlePinInput(btn.getAttribute('data-key'));
            });
        });

        const btnBack = document.getElementById('btnPinBackspace');
        if (btnBack) btnBack.addEventListener('click', handlePinBackspace);

        const btnBio = document.getElementById('btnBiometricUnlock');
        if (btnBio) btnBio.addEventListener('click', triggerBiometricAuth);

        // 3. Forgot PIN button on Lock Screen
        const btnForgot = document.getElementById('btnForgotPin');
        if (btnForgot) btnForgot.addEventListener('click', openForgotPinModal);

        // 4. Physical Keyboard listeners
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

        // 5. Setup modal buttons
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

        // 6. Forgot PIN Modal actions
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

        // 7. Settings: Toggle App Lock (Fixed Flaw: Disabling always clears PIN)
        const appLockToggle = document.getElementById('appLockToggle');
        if (appLockToggle) {
            appLockToggle.addEventListener('change', () => {
                if (appLockToggle.checked) {
                    // Always require creating a new PIN when toggled ON
                    appLockToggle.checked = false;
                    openPinSetup('Create 4-Digit PIN');
                } else {
                    // When turned OFF: completely clear PIN & Biometrics
                    clearAllLockData();
                    syncSettingsUI();
                    if (window.showAlert) {
                        showAlert('App Lock has been disabled and your PIN was cleared.', false);
                    }
                }
            });
        }

        // 8. Settings: Change PIN
        const rowChangePin = document.getElementById('rowChangePin');
        if (rowChangePin) {
            rowChangePin.addEventListener('click', () => {
                openPinSetup('Change 4-Digit PIN');
            });
        }

        // 9. Settings: Biometric Toggle
        const bioToggle = document.getElementById('biometricLockToggle');
        if (bioToggle) {
            bioToggle.addEventListener('change', async () => {
                if (bioToggle.checked) {
                    const success = await registerBiometrics();
                    bioToggle.checked = success;
                    if (success && window.showAlert) {
                        showAlert('Biometric Unlock (Face ID / Fingerprint) enabled!', false);
                    }
                } else {
                    localStorage.setItem(BIOMETRIC_KEY, 'false');
                    if (window.showAlert) showAlert('Biometric Unlock disabled.', false);
                }
            });
        }

        // 10. Auto-lock on app minimize / tab switch
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                if (isLockEnabled()) {
                    showLockScreen();
                }
            }
        });

        syncSettingsUI();
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
        openSetup: openPinSetup,
        closeSetup: closePinSetup,
        openForgotModal: openForgotPinModal,
        closeForgotModal: closeForgotPinModal,
        isEnabled: isLockEnabled,
        clearLock: clearAllLockData
    };
})();
