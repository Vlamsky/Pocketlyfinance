/**
 * POCKETLY AUDIO & HAPTICS ENGINE
 * Ultra-lightweight Web Audio API synthesizer for tactile clicks, Apple-style chimes, and haptics.
 * Zero external audio files required. Zero latency.
 */
(function() {
    'use strict';

    let audioCtx = null;
    let isMuted = localStorage.getItem('pocketly_audio_muted') === 'true';

    function getAudioContext() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                audioCtx = new AudioContextClass();
            }
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    // Unlock Web Audio API on first user interaction
    function initAudioUnlock() {
        const unlock = () => {
            getAudioContext();
            ['click', 'touchstart', 'keydown'].forEach(evt => {
                window.removeEventListener(evt, unlock);
            });
        };
        ['click', 'touchstart', 'keydown'].forEach(evt => {
            window.addEventListener(evt, unlock, { once: true, passive: true });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAudioUnlock);
    } else {
        initAudioUnlock();
    }

    function playTone(freq, type, startTime, duration, startVol, endVol, filterFreq) {
        const ctx = getAudioContext();
        if (!ctx || isMuted) return;

        try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(filterFreq || 2800, startTime);

            gain.gain.setValueAtTime(startVol, startTime);
            gain.gain.exponentialRampToValueAtTime(Math.max(endVol, 0.0001), startTime + duration);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(startTime);
            osc.stop(startTime + duration);
        } catch (e) {
            // Silently fall back if browser restricts audio
        }
    }

    function triggerHaptic(pattern) {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) {
            try {
                window.Capacitor.Plugins.Haptics.impact({ style: 'LIGHT' });
                return;
            } catch (e) {}
        }
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            try {
                navigator.vibrate(pattern);
            } catch (e) {}
        }
    }

    const PocketlyAudio = {
        /**
         * 1. Success Chime
         * Triple-tone soft crystalline chime for saved transactions (E6 -> B6 -> E7).
         */
        playSuccessChime: function() {
            const ctx = getAudioContext();
            if (!ctx || isMuted) return;
            const now = ctx.currentTime;
            playTone(1318.5, 'sine', now, 0.18, 0.12, 0.0001, 3000);
            playTone(1975.5, 'sine', now + 0.07, 0.26, 0.14, 0.0001, 3400);
            playTone(2637.0, 'sine', now + 0.14, 0.38, 0.16, 0.0001, 3800);
            triggerHaptic([15, 40, 20]);
        },

        /**
         * 2. Goal Celebration
         * Ascending 4-tone celestial arpeggio for savings goal completion or top-up (C6 -> E6 -> G6 -> C7).
         */
        playGoalCelebration: function() {
            const ctx = getAudioContext();
            if (!ctx || isMuted) return;
            const now = ctx.currentTime;
            playTone(1046.5, 'sine', now, 0.14, 0.10, 0.001, 3000);
            playTone(1318.5, 'sine', now + 0.07, 0.16, 0.12, 0.001, 3200);
            playTone(1567.9, 'sine', now + 0.14, 0.20, 0.13, 0.001, 3500);
            playTone(2093.0, 'sine', now + 0.21, 0.45, 0.16, 0.0001, 4000);
            triggerHaptic([18, 30, 18, 30, 35]);
        },

        /**
         * 3. Card Tactile Tap
         * Velvet micro-click for swiping or selecting Apple Wallet cards.
         */
        playCardTap: function() {
            const ctx = getAudioContext();
            if (!ctx || isMuted) return;
            const now = ctx.currentTime;
            playTone(850, 'sine', now, 0.028, 0.045, 0.001, 1600);
            triggerHaptic(8);
        },

        /**
         * 4. Haptic Scrubbing & Micro Tick
         */
        playHapticTick: function() {
            triggerHaptic(6);
        },

        playHover: function() {
            const ctx = getAudioContext();
            if (!ctx || isMuted) return;
            const now = ctx.currentTime;
            playTone(1200, 'sine', now, 0.015, 0.025, 0.0001, 2200);
            triggerHaptic(5);
        },

        /**
         * 5. Toggle Mute
         */
        toggleMute: function() {
            isMuted = !isMuted;
            localStorage.setItem('pocketly_audio_muted', isMuted ? 'true' : 'false');
            return isMuted;
        },

        isMuted: function() {
            return isMuted;
        }
    };

    window.PocketlyAudio = PocketlyAudio;
})();
