'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const adBlockerSource = fs.readFileSync(path.join(root, 'ad-blocker.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function searchItem(id, title, channel = 'Channel') {
    return {
        id: { videoId: id },
        snippet: {
            title,
            channelTitle: channel,
            thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } }
        }
    };
}

function createApp(options = {}) {
    const dom = new JSDOM(html, {
        url: 'https://jakuplayer.test/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const { window } = dom;
    const players = [];

    Object.entries(options.storage || { username: 'Test user', isFirstVisit: 'false' })
        .forEach(([key, value]) => window.localStorage.setItem(key, value));
    window.prompt = () => options.playlistName || 'Test playlist';
    window.confirm = () => true;
    window.fetch = options.fetch || (async () => ({
        ok: true,
        status: 200,
        json: async () => ({ items: [] })
    }));

    class FakePlayer {
        constructor(elementId, config) {
            this.elementId = elementId;
            this.config = config;
            this.events = config.events;
            this.listeners = new Map();
            this.readyCalled = false;
            this.loadCalls = [];
            this.playCalls = 0;
            this.pauseCalls = 0;
            this.seekCalls = [];
            this.volume = 80;
            this.muted = false;
            this.adState = 0;
            this.currentTime = 0;
            this.duration = 200;
            players.push(this);
            if (options.autoReady !== false) {
                window.setTimeout(() => this.ready(), 0);
            }
        }

        ready() {
            if (this.readyCalled) return;
            this.readyCalled = true;
            this.events.onReady({ target: this });
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

        emitAd(name, data) {
            (this.listeners.get(name) || []).forEach((handler) => handler({ data }));
        }

        emitState(data) {
            this.events.onStateChange({ target: this, data });
        }

        loadVideoById(id) {
            this.loadCalls.push(id);
            this.videoId = id;
            this.currentTime = 0;
            this.emitState(1);
        }

        playVideo() { this.playCalls += 1; this.emitState(1); }
        pauseVideo() { this.pauseCalls += 1; this.emitState(2); }
        seekTo(time) { this.currentTime = time; this.seekCalls.push(time); }
        getCurrentTime() { return this.currentTime; }
        getDuration() { return this.duration; }
        getAdState() { return this.adState; }
        getVolume() { return this.volume; }
        setVolume(value) { this.volume = value; }
        isMuted() { return this.muted; }
        mute() { this.muted = true; }
        unMute() { this.muted = false; }
    }

    window.YT = {
        Player: FakePlayer,
        PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
    };

    window.eval(adBlockerSource);
    window.eval(`${appSource}\n;window.__appTest = { displaySearchResults, searchYouTube };`);

    return {
        dom,
        window,
        players,
        api: window.__appTest,
        ready: () => new Promise((resolve) => window.setTimeout(resolve, 5))
    };
}

function closeApp(t, app) {
    t.after(() => app.window.close());
}

test('initializes safely with corrupted local storage', async (t) => {
    const app = createApp({
        storage: {
            username: 'Ala',
            isFirstVisit: 'false',
            likedSongs: '{not-json',
            recentlyPlayed: JSON.stringify([null, { id: '', title: 'bad' }]),
            playlists: JSON.stringify({ not: 'an-array' })
        }
    });
    closeApp(t, app);
    await app.ready();

    assert.equal(app.window.document.getElementById('login-modal').classList.contains('open'), false);
    assert.equal(app.window.document.getElementById('home-page').classList.contains('hidden'), false);
    assert.equal(app.window.document.getElementById('favorites-count').textContent, '0 utworów');
    assert.equal(app.window.document.getElementById('history-count').textContent, '0 utworów');
    assert.equal(app.players.length, 1);
    assert.equal(app.players[0].readyCalled, true);
});

test('queues a selected song until the YouTube player is ready', async (t) => {
    const app = createApp({ autoReady: false });
    closeApp(t, app);
    const { window } = app;

    app.api.displaySearchResults([searchItem('pending-id', 'Pending song')]);
    window.document.querySelector('.song-card').click();

    assert.equal(window.document.getElementById('current-song-title').textContent, 'Pending song');
    assert.equal(app.players[0].loadCalls.length, 0);

    app.players[0].ready();
    assert.deepEqual(app.players[0].loadCalls, ['pending-id']);
});

test('renders safe results, likes the clicked song and advances through the queue', async (t) => {
    const items = [
        searchItem('first-id', 'One &amp; Only', 'Artist &amp; One'),
        searchItem('second-id', '<img src=x onerror=alert(1)> &amp; Two', 'Second artist')
    ];
    const app = createApp({
        fetch: async () => ({ ok: true, status: 200, json: async () => ({ items }) })
    });
    closeApp(t, app);
    await app.ready();
    const { window } = app;

    await app.api.searchYouTube('test');
    const cards = window.document.querySelectorAll('#search-results .song-card');
    assert.equal(cards.length, 2);
    assert.equal(cards[0].querySelector('h4').textContent, 'One & Only');
    assert.equal(cards[0].querySelector('p').textContent, 'Artist & One');
    assert.equal(cards[1].querySelector('h4').textContent, '<img src=x onerror=alert(1)> & Two');
    assert.equal(cards[1].querySelector('h4 img'), null);

    cards[0].click();
    assert.deepEqual(app.players[0].loadCalls, ['first-id']);

    cards[1].querySelector('.like-button').click();
    const liked = JSON.parse(window.localStorage.getItem('likedSongs'));
    assert.equal(liked.length, 1);
    assert.equal(liked[0].id, 'second-id');
    assert.equal(liked[0].artist, 'Second artist');
    assert.notEqual(liked[0].title, 'One & Only');

    window.document.getElementById('next-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['first-id', 'second-id']);
});

test('adds the current song rather than a click event to a new playlist', async (t) => {
    const app = createApp();
    closeApp(t, app);
    await app.ready();
    const { window } = app;

    app.api.displaySearchResults([searchItem('playlist-song', 'Playlist song')]);
    window.document.querySelector('#search-results .song-card').click();
    window.document.getElementById('add-to-playlist-button').click();
    assert.equal(window.document.getElementById('playlist-modal').classList.contains('open'), true);

    const loadCount = app.players[0].loadCalls.length;
    window.document.getElementById('create-new-playlist-button').click();
    const playlists = JSON.parse(window.localStorage.getItem('playlists'));
    assert.equal(playlists.length, 1);
    assert.equal(playlists[0].songs.length, 1);
    assert.equal(playlists[0].songs[0].id, 'playlist-song');
    assert.equal(playlists[0].songs[0].title, 'Playlist song');

    window.document.querySelector('#playlist-detail-content .song-card').click();
    assert.equal(app.players[0].loadCalls.length, loadCount + 1, 'one click must load a song only once');
});

test('space remains available in editable fields and only toggles playback outside them', async (t) => {
    const app = createApp();
    closeApp(t, app);
    await app.ready();
    const { window } = app;

    app.api.displaySearchResults([searchItem('keyboard-song', 'Keyboard song')]);
    window.document.querySelector('#search-results .song-card').click();
    const pauseCalls = app.players[0].pauseCalls;
    const input = window.document.getElementById('search-input');
    input.focus();
    input.value = 'rock';

    const searchSpace = new window.KeyboardEvent('keydown', {
        key: ' ', code: 'Space', bubbles: true, cancelable: true
    });
    input.dispatchEvent(searchSpace);

    assert.equal(searchSpace.defaultPrevented, false, 'the browser must be allowed to insert the space');
    assert.equal(app.players[0].pauseCalls, pauseCalls);
    if (!searchSpace.defaultPrevented) input.value += ' '; // jsdom has no native text-input default action.
    assert.equal(input.value, 'rock ');

    const editable = window.document.createElement('div');
    editable.setAttribute('contenteditable', 'plaintext-only');
    const editableChild = window.document.createElement('span');
    editable.appendChild(editableChild);
    window.document.body.appendChild(editable);
    const editableSpace = new window.KeyboardEvent('keydown', {
        key: ' ', code: 'Space', bubbles: true, cancelable: true
    });
    editableChild.dispatchEvent(editableSpace);
    assert.equal(editableSpace.defaultPrevented, false);
    assert.equal(app.players[0].pauseCalls, pauseCalls);

    input.blur();
    const playerSpace = new window.KeyboardEvent('keydown', {
        key: ' ', code: 'Space', bubbles: true, cancelable: true
    });
    window.document.body.dispatchEvent(playerSpace);
    assert.equal(playerSpace.defaultPrevented, true);
    assert.equal(app.players[0].pauseCalls, pauseCalls + 1);
});

test('ad breaks do not advance the queue or override intentional mute', async (t) => {
    const app = createApp();
    closeApp(t, app);
    await app.ready();
    const { window } = app;
    const player = app.players[0];

    app.api.displaySearchResults([
        searchItem('ad-song-one', 'First song'),
        searchItem('ad-song-two', 'Second song')
    ]);
    window.document.querySelector('#search-results .song-card').click();
    player.muted = true;
    player.adState = 1;
    player.duration = 10;
    player.emitAd('onAdStart', { duration: 10 });

    assert.equal(player.muted, true);
    assert.deepEqual(player.seekCalls, [9.95]);

    player.emitState(0);
    assert.deepEqual(player.loadCalls, ['ad-song-one'], 'an ad ENDED event must not select the next song');

    player.adState = 0;
    player.emitAd('onAdEnd');
    assert.equal(player.muted, true, 'the app must preserve the user’s mute setting');

    player.emitState(0);
    assert.deepEqual(player.loadCalls, ['ad-song-one', 'ad-song-two']);
});

test('shows a useful error instead of crashing on an API error response', async (t) => {
    const app = createApp({
        fetch: async () => ({
            ok: false,
            status: 403,
            json: async () => ({ error: { message: 'Quota exceeded' } })
        })
    });
    closeApp(t, app);
    await app.ready();

    await app.api.searchYouTube('test');
    assert.match(app.window.document.getElementById('search-results').textContent, /Wystąpił błąd podczas wyszukiwania/);
});
