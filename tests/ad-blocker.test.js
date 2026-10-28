'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const YouTubeAdBlocker = require('../ad-blocker.js');

class FakePlayer {
    constructor() {
        this.listeners = new Map();
        this.adState = 0;
        this.volume = 80;
        this.muted = false;
        this.currentTime = 0;
        this.duration = 200;
        this.seekCalls = [];
        this.setVolumeCalls = [];
        this.loadCalls = [];
        this.playbackRate = 1;
        this.playbackRateCalls = [];
        this.availablePlaybackRates = [0.5, 1, 1.5, 2];
    }

    addEventListener(name, handler) {
        const handlers = this.listeners.get(name) || [];
        handlers.push(handler);
        this.listeners.set(name, handlers);
    }

    removeEventListener(name, handler) {
        const handlers = this.listeners.get(name) || [];
        this.listeners.set(name, handlers.filter((item) => item !== handler));
    }

    emit(name, data) {
        (this.listeners.get(name) || []).forEach((handler) => handler({ data }));
    }

    getAdState() { return this.adState; }
    getVolume() { return this.volume; }
    isMuted() { return this.muted; }
    getCurrentTime() { return this.currentTime; }
    getDuration() { return this.duration; }
    mute() { this.muted = true; }
    unMute() { this.muted = false; }
    setVolume(value) { this.volume = value; this.setVolumeCalls.push(value); }
    seekTo(value, allowSeekAhead) { this.seekCalls.push([value, allowSeekAhead]); }
    getPlaybackRate() { return this.playbackRate; }
    setPlaybackRate(value) { this.playbackRate = value; this.playbackRateCalls.push(value); }
    getAvailablePlaybackRates() { return this.availablePlaybackRates; }
    loadVideoById(options) { this.loadCalls.push(options); }
}

function createHarness(player = new FakePlayer()) {
    let now = 1000;
    let callback = null;
    let cleared = false;
    let timeoutId = 0;
    const timeouts = new Map();
    const events = [];
    const blocker = new YouTubeAdBlocker({
        now: () => now,
        setInterval: (fn) => { callback = fn; return 1; },
        clearInterval: () => { cleared = true; },
        setTimeout: (fn, delay) => {
            timeoutId += 1;
            timeouts.set(timeoutId, { fn, delay });
            return timeoutId;
        },
        clearTimeout: (id) => timeouts.delete(id),
        onAdStart: () => events.push('start'),
        onAdEnd: () => events.push('end'),
        onSkip: () => events.push('skip'),
        onResume: () => events.push('resume')
    });

    return {
        player,
        blocker,
        events,
        tick(ms = 250) { now += ms; callback?.(); },
        advance(ms) { now += ms; },
        runTimeouts() {
            const pending = [...timeouts.values()];
            timeouts.clear();
            pending.forEach(({ fn }) => fn());
        },
        get pendingTimeouts() { return [...timeouts.values()]; },
        get cleared() { return cleared; }
    };
}

test('mutes a detected ad, skips it and restores the previous volume', () => {
    const player = new FakePlayer();
    player.volume = 65;
    player.currentTime = 42;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');
    harness.blocker.check();

    player.adState = 1;
    player.duration = 15;
    player.emit('onAdStart', { duration: 15 });

    assert.equal(harness.blocker.isAdActive(), true);
    assert.equal(player.muted, true);
    assert.deepEqual(player.seekCalls, [[14.95, true]]);
    assert.deepEqual(harness.events, ['start', 'skip']);

    player.emit('onAdPlaybackProgress', { duration: 15 });
    assert.equal(harness.blocker.volumeBeforeAd, 65, 'repeated ad events must not overwrite saved settings');

    player.adState = 0;
    player.emit('onAdEnd');
    assert.equal(harness.blocker.isAdActive(), false);
    assert.equal(player.muted, false);
    assert.equal(player.volume, 65);
    assert.deepEqual(harness.events, ['start', 'skip', 'end']);
});

test('does not seek when YouTube still reports the content duration', () => {
    const player = new FakePlayer();
    player.duration = 95;
    player.currentTime = 20;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('short-song');
    harness.blocker.check();

    player.adState = 1;
    player.emit('onAdStart');
    assert.equal(player.muted, true);
    assert.equal(player.seekCalls.length, 0);
});

test('does not guess an ad duration before content metadata is available', () => {
    const player = new FakePlayer();
    player.duration = 95;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('short-song');

    player.adState = 1;
    player.emit('onAdStart');
    assert.equal(player.muted, true);
    assert.equal(player.seekCalls.length, 0);
});

test('uses ad progress metadata when generic duration is unsafe', () => {
    const player = new FakePlayer();
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');
    harness.blocker.check();

    player.adState = 1;
    player.emit('onAdPlaybackProgress', { adPlaybackProgress: { duration: 12 } });
    assert.deepEqual(player.seekCalls, [[11.95, true]]);
});

test('preserves an intentionally muted player after the ad', () => {
    const player = new FakePlayer();
    player.volume = 35;
    player.muted = true;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');

    player.adState = 1;
    player.emit('onAdStart');
    player.adState = 0;
    player.emit('onAdEnd');

    assert.equal(player.muted, true);
    assert.equal(player.volume, 35);
});

test('applies volume changes made during an ad after it ends', () => {
    const player = new FakePlayer();
    player.muted = true;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');

    player.adState = 1;
    player.emit('onAdStart');
    harness.blocker.setPreferredVolume(70);
    player.adState = 0;
    player.emit('onAdEnd');

    assert.equal(player.muted, false);
    assert.equal(player.volume, 70);
});

test('supports ad events on embeds without getAdState', () => {
    const player = new FakePlayer();
    player.getAdState = undefined;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');

    player.emit('onAdStart', { adDuration: 10 });
    assert.equal(harness.blocker.isAdActive(), true);
    assert.equal(player.muted, true);
    assert.deepEqual(player.seekCalls, [[9.95, true]]);

    player.emit('onAdComplete');
    assert.equal(harness.blocker.isAdActive(), false);
    assert.equal(player.muted, false);
});

test('polling detects an ad when no ad start event is emitted', () => {
    const player = new FakePlayer();
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');
    harness.blocker.check();

    player.adState = 1;
    player.duration = 8;
    harness.tick();

    assert.equal(harness.blocker.isAdActive(), true);
    assert.equal(player.muted, true);
    assert.deepEqual(player.seekCalls, [[7.95, true]]);
});

test('cancels fallback reload after a successful ad skip', () => {
    const player = new FakePlayer();
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');

    player.adState = 1;
    player.emit('onAdStart', { duration: 10 });
    assert.equal(harness.pendingTimeouts.length, 1);

    player.adState = 0;
    player.emit('onAdEnd');
    assert.equal(harness.pendingTimeouts.length, 0);
    harness.runTimeouts();
    assert.equal(player.loadCalls.length, 0);
    assert.equal(player.playbackRate, 1);
});

test('quickly resumes content from the saved position when an ad cannot be seeked', () => {
    const player = new FakePlayer();
    player.currentTime = 42;
    player.duration = 200;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');
    harness.blocker.check();

    player.adState = 1;
    player.emit('onAdStart');
    assert.equal(player.muted, true);
    assert.equal(player.playbackRate, 2, 'the ad should use the fastest supported rate');
    assert.equal(harness.pendingTimeouts[0].delay, 500);

    harness.advance(500);
    harness.runTimeouts();
    assert.deepEqual(player.loadCalls, [{ videoId: 'song-id', startSeconds: 42 }]);
    assert.equal(harness.blocker.isAdActive(), true, 'stay protected until YouTube confirms the ad ended');

    player.adState = 0;
    harness.blocker.check();
    assert.equal(harness.blocker.isAdActive(), false);
    assert.equal(player.muted, false);
    assert.equal(player.playbackRate, 1, 'content must return to its original speed');
    assert.deepEqual(harness.events, ['start', 'resume', 'end']);
});

test('recovers from a pre-roll without waiting for its duration', () => {
    const player = new FakePlayer();
    player.duration = 95;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('pre-roll-song');

    player.adState = 1;
    player.emit('onAdStart');
    assert.equal(player.seekCalls.length, 0, 'unknown duration must not cause a content seek');

    harness.advance(500);
    harness.runTimeouts();
    assert.deepEqual(player.loadCalls, [{ videoId: 'pre-roll-song', startSeconds: 0 }]);
});

test('does not enter a reload loop when YouTube repeats the ad', () => {
    const player = new FakePlayer();
    player.currentTime = 30;
    const harness = createHarness(player);
    harness.blocker.attach(player);
    harness.blocker.setVideo('song-id');
    harness.blocker.check();

    player.adState = 1;
    player.emit('onAdStart');
    harness.advance(500);
    harness.runTimeouts();
    assert.equal(player.loadCalls.length, 1);

    player.emit('onAdStart');
    harness.advance(500);
    harness.runTimeouts();
    assert.equal(player.loadCalls.length, 1, 'a repeated ad must not trigger another immediate reload');
    assert.equal(player.muted, true);
    assert.equal(player.playbackRate, 2);

    player.adState = 0;
    player.emit('onAdEnd');
    assert.equal(player.muted, false);
    assert.equal(player.playbackRate, 1);
});

test('detach removes listeners and stops polling', () => {
    const player = new FakePlayer();
    const harness = createHarness(player);
    harness.blocker.attach(player);
    assert.equal([...player.listeners.values()].every((handlers) => handlers.length === 1), true);

    harness.blocker.detach();
    assert.equal(harness.cleared, true);
    assert.equal([...player.listeners.values()].every((handlers) => handlers.length === 0), true);
});
