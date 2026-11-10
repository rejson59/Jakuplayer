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
        url: options.url || 'https://jakuplayer.test/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const { window } = dom;
    const players = [];

    Object.entries(options.storage || { isFirstVisit: 'false' })
        .forEach(([key, value]) => window.localStorage.setItem(key, value));
    Object.entries(options.sessionStorage || {}).forEach(([key, value]) => window.sessionStorage.setItem(key, value));
    window.prompt = options.prompt || (() => options.playlistName || 'Test playlist');
    if (options.clipboard) Object.defineProperty(window.navigator, 'clipboard', { value: options.clipboard });
    window.confirm = options.confirm || (() => true);
    if (options.mediaSession) {
        Object.defineProperty(window.navigator, 'mediaSession', { value: options.mediaSession });
        window.MediaMetadata = class MediaMetadata { constructor(data) { Object.assign(this, data); } };
    }
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
    window.eval(`${appSource}\n;window.__appTest = { displaySearchResults, searchYouTube, checkSleepTimer, encodeSharedPlaylist, decodeSharedPlaylist };`);

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

    assert.equal(app.window.document.getElementById('account-modal').classList.contains('open'), false);
    assert.equal(app.window.localStorage.getItem('username'), null);
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

test('first-time guest can immediately play starter tracks without logging in', async (t) => {
    const app = createApp({ storage: {}, autoReady: false });
    closeApp(t, app);
    const doc = app.window.document;
    assert.equal(doc.querySelectorAll('#search-results .song-card').length, 6);
    assert.equal(doc.getElementById('welcome-page').classList.contains('hidden'), false);
    doc.getElementById('mobile-play-button').click();
    assert.equal(doc.getElementById('home-page').classList.contains('hidden'), false);
    assert.match(doc.getElementById('current-song-title').textContent, /lofi hip hop radio/i);
    assert.deepEqual(app.players[0].loadCalls, []);
    app.players[0].ready();
    assert.deepEqual(app.players[0].loadCalls, ['jfKfPfyJRdk']);
    assert.equal(doc.getElementById('account-modal').classList.contains('open'), false);
});

test('search form, quick categories and direct YouTube links work for guests', async (t) => {
    const urls = [];
    const app = createApp({ fetch: async (url) => {
        urls.push(url);
        return { ok: true, json: async () => ({ items: [searchItem('result-id', 'Search result')] }) };
    } });
    closeApp(t, app);
    await app.ready();
    const doc = app.window.document;
    const input = doc.getElementById('search-input');
    input.value = 'przykładowy utwór';
    doc.getElementById('search-button').click();
    await app.ready();
    assert.match(urls[0], /przyk%C5%82adowy%20utw%C3%B3r/);
    assert.equal(doc.querySelector('#search-results h4').textContent, 'Search result');
    doc.querySelector('[data-quick-search]').click();
    await app.ready();
    assert.match(urls[1], /Polskie%20hity/);
    input.value = 'https://youtu.be/K4DyBUG242c?t=1';
    doc.getElementById('search-button').click();
    assert.equal(urls.length, 2, 'direct link must not use the search API');
    assert.deepEqual(app.players[0].loadCalls, ['K4DyBUG242c']);
    assert.equal(doc.querySelectorAll('#search-results .song-card').length, 1);
    doc.getElementById('starter-tracks-button').click();
    assert.equal(doc.querySelectorAll('#search-results .song-card').length, 6);
});

test('late search results do not overwrite a direct link or restored starter tracks', async (t) => {
    let resolveFetch;
    const app = createApp({ fetch: () => new Promise((resolve) => { resolveFetch = resolve; }) });
    closeApp(t, app);
    await app.ready();
    const oldSearch = app.api.searchYouTube('old search');
    await app.api.searchYouTube('https://www.youtube.com/watch?v=K4DyBUG242c');
    resolveFetch({ ok: true, json: async () => ({ items: [searchItem('stale-id', 'Stale')] }) });
    await oldSearch;
    assert.match(app.window.document.querySelector('#search-results h4').textContent, /K4DyBUG242c/);
    const anotherSearch = app.api.searchYouTube('another search');
    app.window.document.getElementById('starter-tracks-button').click();
    resolveFetch({ ok: true, json: async () => ({ items: [searchItem('stale-id', 'Stale')] }) });
    await anotherSearch;
    assert.equal(app.window.document.querySelectorAll('#search-results .song-card').length, 6);
});

test('mobile player avoids widget overlap and playback controls stay in sync', async (t) => {
    const app = createApp();
    closeApp(t, app);
    await app.ready();
    const doc = app.window.document;
    assert.match(html, /--rj-mobile-ads-height:\s*92px/);
    doc.getElementById('mobile-song-info').click();
    assert.equal(doc.documentElement.style.getPropertyValue('--rj-mobile-ads-height'), '184px');
    doc.getElementById('mobile-shuffle-button').click();
    assert.equal(doc.getElementById('shuffle-button').getAttribute('aria-pressed'), 'true');
    assert.match(doc.getElementById('toast').textContent, /włączone/);
    doc.getElementById('repeat-button').click();
    assert.equal(doc.getElementById('mobile-repeat-button').getAttribute('aria-pressed'), 'true');
    doc.getElementById('mobile-song-info').click();
    assert.equal(doc.documentElement.style.getPropertyValue('--rj-mobile-ads-height'), '92px');
    doc.getElementById('mobile-prev-button').click();
    assert.match(doc.getElementById('toast').textContent, /wybierz utwór/);
    doc.getElementById('mobile-shuffle-button').click();
    doc.getElementById('mobile-next-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['jfKfPfyJRdk']);
    doc.getElementById('next-button').click();
    doc.getElementById('prev-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['jfKfPfyJRdk', '4xDzrJKXOOY', 'jfKfPfyJRdk']);
});

test('queue supports adding, reordering, duplicates, removal and clearing', async (t) => {
    const app = createApp();
    closeApp(t, app);
    await app.ready();
    const doc = app.window.document;
    app.api.displaySearchResults([searchItem('one', 'One'), searchItem('two', 'Two')]);
    const cards = doc.querySelectorAll('#search-results .song-card');
    cards[0].querySelector('.queue-add-button').click();
    cards[0].querySelector('.queue-add-button').click();
    cards[1].querySelector('.queue-add-button').click();
    assert.equal(app.players[0].loadCalls.length, 0, 'adding does not start playback');
    doc.querySelector('[data-page="queue"]').click();
    const queue = doc.getElementById('queue-results');
    assert.equal(queue.children.length, 3);
    queue.children[2].querySelector('.queue-up').click();
    assert.match(queue.children[1].textContent, /Two/);
    doc.getElementById('play-button').click();
    doc.getElementById('next-button').click();
    doc.getElementById('next-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['one', 'two', 'one'], 'duplicate IDs use their queue position');
    assert.equal(queue.children[2].querySelector('.queue-remove').disabled, true);
    queue.children[0].querySelector('.queue-remove').click();
    assert.equal(queue.children.length, 2);
    doc.getElementById('prev-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['one', 'two', 'one', 'two']);
    doc.getElementById('clear-queue-button').click();
    assert.equal(queue.children.length, 1);
    assert.match(queue.textContent, /Two/);
    assert.match(queue.textContent, /Teraz odtwarzane/);
});

test('favorites and playlist play buttons and confirmed history clearing work in guest mode', async (t) => {
    let confirmed = false;
    const song = { id: 'fav-id', title: 'Ulubiony', artist: 'Artysta', thumbnail: '' };
    const app = createApp({
        storage: { isFirstVisit: 'false', likedSongs: JSON.stringify([song]),
            playlists: JSON.stringify([{ id: 'p', name: 'Moja', songs: [song] }]),
            recentlyPlayed: JSON.stringify([song]) },
        confirm: () => confirmed
    });
    closeApp(t, app);
    await app.ready();
    const doc = app.window.document;
    doc.getElementById('play-favorites-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['fav-id']);
    doc.querySelector('#playlists-results [role="button"]').click();
    doc.getElementById('play-playlist-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['fav-id', 'fav-id']);
    assert.equal(doc.getElementById('playlist-detail-modal').classList.contains('open'), false);
    doc.getElementById('clear-history-button').click();
    assert.equal(JSON.parse(app.window.localStorage.getItem('recentlyPlayed')).length, 1);
    confirmed = true;
    doc.getElementById('clear-history-button').click();
    assert.deepEqual(JSON.parse(app.window.localStorage.getItem('recentlyPlayed')), []);
    assert.match(doc.getElementById('history-results').textContent, /Brak historii/);
});

test('media session exposes metadata and controls when supported', async (t) => {
    const handlers = {};
    const mediaSession = { setActionHandler(action, callback) { handlers[action] = callback; } };
    const app = createApp({ mediaSession });
    closeApp(t, app);
    await app.ready();
    const doc = app.window.document;
    app.api.displaySearchResults([searchItem('one', 'First'), searchItem('two', 'Second')]);
    doc.querySelector('#search-results .song-card').click();
    assert.equal(mediaSession.metadata.title, 'First');
    assert.equal(mediaSession.playbackState, 'playing');
    handlers.pause();
    assert.equal(mediaSession.playbackState, 'paused');
    handlers.play();
    handlers.nexttrack();
    assert.equal(mediaSession.metadata.title, 'Second');
    handlers.previoustrack();
    assert.deepEqual(app.players[0].loadCalls, ['one', 'two', 'one']);
});

test('restores queue and position on refresh without autoplay', async (t) => {
    const first = createApp();
    closeApp(t, first);
    await first.ready();
    const doc = first.window.document;
    doc.querySelector('#search-results .song-card').click();
    first.players[0].currentTime = 42;
    first.window.dispatchEvent(new first.window.Event('pagehide'));
    const saved = first.window.sessionStorage.getItem('jakuplayer_playback_session_v1');
    assert.equal(JSON.parse(saved).position, 42);
    const second = createApp({ sessionStorage: { jakuplayer_playback_session_v1: saved } });
    closeApp(t, second);
    await second.ready();
    assert.equal(second.players[0].loadCalls.length, 0);
    assert.match(second.window.document.getElementById('current-song-title').textContent, /lofi/i);
    assert.equal(second.window.document.querySelectorAll('#queue-results .queue-play').length, 6);
    second.window.document.getElementById('play-button').click();
    assert.equal(second.players[0].loadCalls[0].videoId, 'jfKfPfyJRdk');
    assert.equal(second.players[0].loadCalls[0].startSeconds, 42);
});

test('sleep timer pauses playback, can be cancelled and handles an unready player', async (t) => {
    const app = createApp();
    closeApp(t, app);
    await app.ready();
    const doc = app.window.document;
    let now = 1000;
    app.window.Date.now = () => now;
    doc.getElementById('play-button').click();
    const timer = doc.getElementById('sleep-timer');
    timer.value = '15'; timer.dispatchEvent(new app.window.Event('change'));
    now += 14 * 60000;
    app.api.checkSleepTimer();
    assert.equal(app.players[0].pauseCalls, 0);
    timer.value = '0'; timer.dispatchEvent(new app.window.Event('change'));
    now += 60000; app.api.checkSleepTimer();
    assert.equal(app.players[0].pauseCalls, 0);
    timer.value = '15'; timer.dispatchEvent(new app.window.Event('change'));
    now += 15 * 60000; app.api.checkSleepTimer();
    assert.equal(app.players[0].pauseCalls, 1);
    assert.equal(timer.value, '0');
    assert.match(doc.getElementById('sleep-timer-status').textContent, /zatrzymane/);

    const pending = createApp({ autoReady: false });
    closeApp(t, pending);
    let later = 1000;
    pending.window.Date.now = () => later;
    pending.window.document.getElementById('play-button').click();
    const pendingTimer = pending.window.document.getElementById('sleep-timer');
    pendingTimer.value = '15'; pendingTimer.dispatchEvent(new pending.window.Event('change'));
    later += 15 * 60000; pending.api.checkSleepTimer();
    pending.players[0].ready();
    assert.equal(pending.players[0].loadCalls.length, 0, 'timer must prevent deferred autoplay');
});

test('shares a playlist as a validated snapshot and imports only after consent', async (t) => {
    let copied = '';
    const song = { id: 'K4DyBUG242c', title: 'Piosenka <test>', artist: 'Łódź', thumbnail: '' };
    const app = createApp({
        storage: { isFirstVisit: 'false', playlists: JSON.stringify([{ id: 'p', name: 'Muzyka ❤️', songs: [song] }]) },
        clipboard: { async writeText(value) { copied = value; } }
    });
    closeApp(t, app);
    await app.ready();
    app.window.document.querySelector('#playlists-results [role="button"]').click();
    app.window.document.getElementById('share-playlist-button').click();
    await app.ready();
    assert.match(copied, /#playlist=/);
    const guest = createApp({ url: copied, storage: {} });
    closeApp(t, guest);
    await guest.ready();
    const doc = guest.window.document;
    assert.equal(doc.getElementById('home-page').classList.contains('hidden'), false);
    assert.match(doc.getElementById('shared-playlist-title').textContent, /Muzyka ❤️/);
    assert.match(doc.getElementById('shared-playlist-tracks').textContent, /Piosenka <test> — Łódź/);
    assert.equal(doc.querySelector('#shared-playlist-tracks test'), null);
    assert.equal(guest.window.localStorage.getItem('playlists'), null);
    doc.getElementById('import-shared-button').click();
    const imported = JSON.parse(guest.window.localStorage.getItem('playlists'));
    assert.equal(imported[0].songs[0].id, song.id);
    assert.equal(imported[0].songs[0].title, song.title);
    assert.equal(guest.window.location.hash, '');
    assert.equal(app.api.decodeSharedPlaylist('not-valid'), null);
});

test('filters and sorts favorites and playlists without changing stored order', async (t) => {
    const songs = [{ id: '1', title: 'Żaba', artist: 'Zulu' }, { id: '2', title: 'Ala', artist: 'Alfa' }];
    const playlists = [{ id: '1', name: 'Żółta', songs }, { id: '2', name: 'Alfa', songs: [] }];
    const app = createApp({ storage: { isFirstVisit: 'false', likedSongs: JSON.stringify(songs), playlists: JSON.stringify(playlists) } });
    closeApp(t, app);
    await app.ready();
    const doc = app.window.document;
    const sort = doc.getElementById('favorites-sort'); sort.value = 'title'; sort.dispatchEvent(new app.window.Event('change'));
    assert.equal(doc.querySelector('#favorites-results h4').textContent, 'Ala');
    const filter = doc.getElementById('favorites-filter'); filter.value = 'zulu'; filter.dispatchEvent(new app.window.Event('input'));
    assert.equal(doc.querySelectorAll('#favorites-results .song-card').length, 1);
    doc.getElementById('play-favorites-button').click();
    assert.deepEqual(app.players[0].loadCalls, ['1']);
    const psort = doc.getElementById('playlists-sort'); psort.value = 'name'; psort.dispatchEvent(new app.window.Event('change'));
    assert.equal(doc.querySelector('#playlists-results h3').textContent, 'Alfa');
    const pfilter = doc.getElementById('playlists-filter'); pfilter.value = 'żół'; pfilter.dispatchEvent(new app.window.Event('input'));
    assert.equal(doc.querySelectorAll('#playlists-results [role="button"]').length, 1);
    assert.equal(JSON.parse(app.window.localStorage.getItem('likedSongs'))[0].title, 'Żaba');
    assert.equal(JSON.parse(app.window.localStorage.getItem('playlists'))[0].name, 'Żółta');
});

test('recommendations are requested explicitly from the recent artist and omit history', async (t) => {
    const urls = [];
    const recent = { id: 'old-id', title: 'Old', artist: 'Mój Wykonawca', thumbnail: '' };
    const app = createApp({ storage: { isFirstVisit: 'false', recentlyPlayed: JSON.stringify([recent]) }, fetch: async (url) => {
        urls.push(url);
        return { ok: true, json: async () => ({ items: [searchItem('old-id', 'Old'), searchItem('new-id', 'New')] }) };
    } });
    closeApp(t, app);
    await app.ready();
    assert.equal(urls.length, 0);
    app.window.document.getElementById('recommendations-button').click();
    await app.ready();
    assert.match(urls[0], /M%C3%B3j%20Wykonawca/);
    assert.equal(app.window.document.querySelectorAll('#recommendations-results .song-card').length, 1);
    assert.equal(app.window.document.querySelector('#recommendations-results h4').textContent, 'New');
    app.window.document.querySelector('#recommendations-results .song-card').click();
    assert.deepEqual(app.players[0].loadCalls, ['new-id']);
});

test('resuming before player readiness waits for the player, and invalid snapshots are ignored', async (t) => {
    const saved = JSON.stringify({ version: 1, owner: null, queue: [{ id: 'K4DyBUG242c', title: 'Song', artist: 'Artist' }], index: 0, position: 31 });
    const app = createApp({ autoReady: false, sessionStorage: { jakuplayer_playback_session_v1: saved } });
    closeApp(t, app);
    app.window.document.getElementById('play-button').click();
    assert.equal(app.players[0].loadCalls.length, 0);
    app.players[0].ready();
    assert.equal(app.players[0].loadCalls[0].startSeconds, 31);
    const invalid = createApp({ sessionStorage: { jakuplayer_playback_session_v1: '{bad-json' } });
    closeApp(t, invalid);
    await invalid.ready();
    assert.match(invalid.window.document.getElementById('queue-results').textContent, /Kolejka jest pusta/);
});

test('large shared links safely fall back to IDs and reject malformed links', (t) => {
    const app = createApp();
    closeApp(t, app);
    const songs = Array.from({ length: 300 }, (_, i) => ({ id: String(i).padStart(11, '0'), title: 'Długi tytuł '.repeat(15), artist: 'Długi wykonawca '.repeat(10) }));
    const encoded = app.api.encodeSharedPlaylist({ name: 'Duża', songs });
    assert.ok(encoded.length <= 9000);
    const decoded = app.api.decodeSharedPlaylist(encoded);
    assert.equal(decoded.songs.length, 300);
    assert.match(decoded.songs[0].title, /Utwór YouTube/);
    assert.equal(app.api.decodeSharedPlaylist('a'.repeat(9001)), null);
    assert.equal(app.api.encodeSharedPlaylist({ name: 'Nieprawidłowa', songs: [{ id: 'bad' }] }), null);
});
