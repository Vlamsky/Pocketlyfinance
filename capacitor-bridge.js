/**
 * POCKETLY CAPACITOR & ANDROID NATIVE BRIDGE
 * Seamless bridge for:
 * - Native File Downloads (Downloads folder + Share)
 * - Microphone permission & Speech recognition helper
 * - Hardware back-button handling
 * - Status bar theming
 * - Splash screen smooth dismiss
 */
(function() {
    'use strict';

    // 1. Universal Native Downloader
    window.PocketlyDownloader = {
        isNative: function() {
            return !!(window.AndroidNative && typeof window.AndroidNative.saveBase64File === 'function');
        },
        saveBlob: function(blob, filename, mimeType) {
            const type = mimeType || blob.type || 'application/octet-stream';
            if (this.isNative()) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    const base64 = (reader.result || '').split(',')[1];
                    if (base64) {
                        window.AndroidNative.saveBase64File(base64, filename, type);
                    }
                };
                reader.readAsDataURL(blob);
                return true;
            }
            // Standard Web Fallback
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            return false;
        },
        saveText: function(text, filename, mimeType) {
            const type = mimeType || 'text/plain';
            const blob = new Blob([text], { type: type });
            return this.saveBlob(blob, filename, type);
        }
    };

    // 2. Native Microphone Helper
    window.PocketlyAudioHelper = {
        ensureMicrophonePermission: async function() {
            // First check if native Android interface can prompt
            if (window.AndroidNative && typeof window.AndroidNative.requestMicrophonePermission === 'function') {
                if (!window.AndroidNative.isMicrophoneGranted()) {
                    window.AndroidNative.requestMicrophonePermission();
                }
            }

            // Always request via getUserMedia to ensure WebView permission is granted
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    stream.getTracks().forEach(track => track.stop());
                    return true;
                } catch (e) {
                    console.warn('[PocketlyAudioHelper] Microphone permission denied:', e);
                    return false;
                }
            }
            return true;
        }
    };

    // 3. Dynamic System Bar Synchronizer (Status Bar & Navigation Bar)
    window.updateSystemBars = function(isDark) {
        if (typeof isDark === 'undefined') {
            isDark = document.body ? document.body.classList.contains('dark-mode') : (localStorage.getItem('theme') === 'dark');
        }
        const hexBg = isDark ? '#0b0f19' : '#f8fafc';

        // A. Direct Native Android Bridge (controls status bar AND navigation bar seamlessly)
        if (window.AndroidNative && typeof window.AndroidNative.setSystemBarTheme === 'function') {
            try {
                window.AndroidNative.setSystemBarTheme(isDark);
            } catch (e) {
                console.warn('[SystemBars] Native Android setSystemBarTheme error:', e);
            }
        }

        // B. Capacitor StatusBar Plugin Sync
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar) {
            const StatusBarPlugin = window.Capacitor.Plugins.StatusBar;
            try {
                StatusBarPlugin.setOverlaysWebView({ overlay: true }).catch(() => {});
                // In Capacitor StatusBar: Style.Dark = 'DARK' (light text for dark bg); Style.Light = 'LIGHT' (dark text for light bg)
                StatusBarPlugin.setStyle({ style: isDark ? 'DARK' : 'LIGHT' }).catch(() => {});
            } catch (e) {
                console.warn('[SystemBars] Capacitor StatusBar error:', e);
            }
        }

        // Sync native measured status bar height if available
        if (window.AndroidNative && typeof window.AndroidNative.getStatusBarHeightDp === 'function') {
            try {
                const sbH = window.AndroidNative.getStatusBarHeightDp();
                if (sbH && sbH > 0) {
                    document.documentElement.style.setProperty('--status-bar-height', sbH + 'px');
                }
            } catch (e) {}
        }

        // C. Web Meta Theme Color
        const metaTheme = document.getElementById('themeColorMeta');
        if (metaTheme) {
            metaTheme.setAttribute('content', hexBg);
        }
    };

    // Run initial system bar sync immediately
    try {
        const initialDark = (localStorage.getItem('theme') === 'dark');
        window.updateSystemBars(initialDark);
    } catch (e) {}

    // Setup DOM Ready sync & MutationObserver for automatic theme switching
    function initSystemBarObserver() {
        window.updateSystemBars();
        try {
            if (window.MutationObserver && document.body) {
                const themeObserver = new MutationObserver((mutations) => {
                    for (const m of mutations) {
                        if (m.attributeName === 'class') {
                            const isDarkNow = document.body.classList.contains('dark-mode');
                            window.updateSystemBars(isDarkNow);
                            break;
                        }
                    }
                });
                themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            }
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSystemBarObserver);
    } else {
        initSystemBarObserver();
    }

    if (!window.Capacitor) return;

    const plugins = window.Capacitor.Plugins || {};
    const App = plugins.App;
    const StatusBar = plugins.StatusBar;
    const SplashScreen = plugins.SplashScreen;

    // Trigger update once Capacitor plugins are ready
    window.updateSystemBars();

    // 4. Hide Splash Screen once App is ready
    function dismissSplash() {
        if (SplashScreen) {
            try {
                SplashScreen.hide().catch(() => {});
            } catch (e) {}
        }
    }

    if (window.__pocketlyAppReady) {
        dismissSplash();
    } else {
        const checkReady = setInterval(() => {
            if (window.__pocketlyAppReady) {
                clearInterval(checkReady);
                dismissSplash();
            }
        }, 150);
        setTimeout(() => {
            clearInterval(checkReady);
            dismissSplash();
        }, 3500);
    }

    // 5. Android Hardware Back Button Handler
    if (App) {
        try {
            App.addListener('backButton', () => {
                // A. App Lock screen active -> ignore back
                const lockScreen = document.getElementById('appLockScreen');
                if (lockScreen && lockScreen.style.display !== 'none') {
                    return;
                }

                // B. Close open popups or modals
                const openModals = document.querySelectorAll(
                    '.modal[style*="display: block"], .modal[style*="display: flex"], .modal-overlay[style*="display: flex"], .modal-overlay[style*="display: block"]'
                );
                for (const modal of openModals) {
                    const closeBtn = modal.querySelector('.btn-close, .modal-close, [data-dismiss], [onclick*="close"]');
                    if (closeBtn) {
                        closeBtn.click();
                        return;
                    }
                    modal.style.display = 'none';
                    return;
                }

                // C. Check subpages
                const currentHash = window.location.hash || '';
                if (currentHash === '#languageSettings' || currentHash === '#changePassword') {
                    if (typeof window.switchPage === 'function') {
                        window.switchPage('account');
                        return;
                    }
                }

                // D. If on non-dashboard tab, go back to dashboard
                if (currentHash && currentHash !== '#dashboard' && currentHash !== '#') {
                    if (typeof window.switchPage === 'function') {
                        window.switchPage('dashboard');
                        return;
                    }
                }

                // E. If on dashboard with no modal open, exit app
                App.exitApp();
            });
        } catch (e) {
            console.warn('[Capacitor Bridge] Failed to register backButton listener', e);
        }
    }
})();
