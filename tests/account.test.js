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

const ALICE_TOKEN = 'alice_secret_tok_0123456789abcdef';
const BOB_TOKEN = 'bob_secret_token_fedcba9876543210';

function searchItem(id, title, channel = 'Wykonawca') {
    return {
        id: { videoId: id },
        snippet: {
            title,
            channelTitle: channel,
            thumbnails: { medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` } }
        }
    };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

function createAccountHarness(options = {}) {
    const dom = new JSDOM(html, {
        url: options.url || 'https://rejson59.github.io/Jakuplayer/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    const { window } = dom;

    Object.entries(options.localStorage || { isFirstVisit: 'false' })
        .forEach(([key, value]) => window.localStorage.setItem(key, value));
    Object.entries(options.sessionStorage || {})
        .forEach(([key, value]) => window.sessionStorage.setItem(key, value));

    window.prompt = () => options.playlistName || 'Chmurowa playlista';
    window.confirm = () => true;

    let currentSession = options.session !== undefined ? options.session : null;
    let getSessionOverride = options.getSession || null;
    let openCalls = 0;
    const subscribers = new Set();

    // Symulowany backend RPC z weryfikacją sesji po stronie serwera (izolacja per token).
    const serverDb = new Map();
    const tokenOwners = new Map([
        [ALICE_TOKEN, 'Alice'],
        [BOB_TOKEN, 'Bob']
    ]);
    if (options.initialServerData) {
        Object.entries(options.initialServerData).forEach(([owner, lib]) => {
            serverDb.set(owner, {
                liked_songs: structuredClone(lib.liked_songs || []),
                playlists: structuredClone(lib.playlists || []),
                history: structuredClone(lib.history || [])
            });
        });
    }

    const rpcCalls = [];
    let rpcOverride = options.rpcOverride || null;

    window.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.includes('/rest/v1/rpc/')) {
            const fnName = url.split('/rest/v1/rpc/')[1];
            const body = JSON.parse(init.body || '{}');
            rpcCalls.push({ fnName, body: structuredClone(body) });

            if (rpcOverride) {
                const custom = await rpcOverride(fnName, body);
                if (custom !== undefined) return custom;
            }

            const owner = tokenOwners.get(body.p_token);
            if (!owner) {
                return {
                    ok: false,
                    status: 401,
                    json: async () => ({ message: 'Sesja wygasła — zaloguj się ponownie.' })
                };
            }

            const existing = serverDb.get(owner) || { liked_songs: [], playlists: [], history: [] };
            if (fnName === 'jakuplayer_get_library') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => structuredClone(existing)
                };
            }
            if (fnName === 'jakuplayer_save_library') {
                const updated = {
                    liked_songs: body.p_liked_songs != null ? structuredClone(body.p_liked_songs) : existing.liked_songs,
                    playlists: body.p_playlists != null ? structuredClone(body.p_playlists) : existing.playlists,
                    history: body.p_history != null ? structuredClone(body.p_history) : existing.history
                };
                serverDb.set(owner, updated);
                return {
                    ok: true,
                    status: 200,
                    json: async () => structuredClone(updated)
                };
            }
            throw new Error(`Unexpected RPC: ${fnName}`);
        }

        return {
            ok: true,
            status: 200,
            json: async () => ({ items: options.youtubeItems || [] })
        };
    };

    if (options.withRejsonAccount !== false) {
        window.RejsonAccount = {
            getSession: () => (getSessionOverride ? getSessionOverride() : Promise.resolve(currentSession)),
            open: () => { openCalls += 1; },
            subscribe: (fn) => {
                subscribers.add(fn);
                return () => subscribers.delete(fn);
            }
        };
    }

    class FakePlayer {
        constructor(elementId, config) {
            this.events = config.events;
            this.listeners = new Map();
            this.loadCalls = [];
            window.setTimeout(() => this.events.onReady({ target: this }), 0);
        }
        addEventListener() {}
        removeEventListener() {}
        loadVideoById(id) {
            this.loadCalls.push(id);
            this.events.onStateChange({ target: this, data: 1 });
        }
        playVideo() {}
        pauseVideo() {}
        seekTo() {}
        getCurrentTime() { return 0; }
        getDuration() { return 180; }
        getAdState() { return 0; }
        getVolume() { return 80; }
        setVolume() {}
        isMuted() { return false; }
        mute() {}
        unMute() {}
    }

    window.YT = {
        Player: FakePlayer,
        PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 }
    };

    window.eval(adBlockerSource);
    window.eval(`${appSource}\n;window.__appTest = { displaySearchResults, searchYouTube };`);

    const settle = (ms = 15) => new Promise((resolve) => window.setTimeout(resolve, ms));

    return {
        window,
        document: window.document,
        api: window.__appTest,
        rpcCalls,
        serverDb,
        get openCalls() { return openCalls; },
        setSession(nextSession) { currentSession = nextSession; },
        setGetSession(fn) { getSessionOverride = fn; },
        setRpcOverride(fn) { rpcOverride = fn; },
        notifyAccountChange() { subscribers.forEach((fn) => fn()); },
        settle
    };
}

function closeHarness(t, harness) {
    t.after(() => harness.window.close());
}

test('includes explicit RejsonAccount script before app scripts and removes legacy username login', () => {
    const accountScriptIdx = html.indexOf('<script defer src="/js/rejson-account.js?v=1"></script>');
    const adBlockerIdx = html.indexOf('<script defer src="ad-blocker.js"></script>');
    const appIdx = html.indexOf('<script defer src="app.js"></script>');

    assert.ok(accountScriptIdx !== -1, 'index.html must explicitly load /js/rejson-account.js?v=1');
    assert.ok(accountScriptIdx < adBlockerIdx && adBlockerIdx < appIdx, 'rejson-account.js must precede project scripts');
    assert.equal(html.includes('id="login-modal"'), false, 'legacy mandatory login modal must be removed');
    assert.equal(html.includes('id="username"'), false, 'legacy unverified username input must be removed');
    assert.match(html, /Zaloguj się przez\s*(?:<strong>)?rejson59\.github\.io/);
});

test('allows optional guest usage without blocking and encourages cloud sync across devices', async (t) => {
    const h = createAccountHarness({
        localStorage: {}, // zupełnie pierwsza wizyta
        session: null
    });
    closeHarness(t, h);
    await h.settle();

    // Brak wymuszonego modalu logowania — strona powitalna i odtwarzacz są od razu dostępne.
    assert.equal(h.document.getElementById('account-modal').classList.contains('open'), false);
    assert.equal(h.document.getElementById('welcome-page').classList.contains('hidden'), false);
    assert.equal(h.document.getElementById('sync-promo-banner').classList.contains('hidden'), false);
    assert.match(h.document.getElementById('sync-promo-text').textContent, /polubione utwory, playlisty i historię/i);

    // Gość zaczyna słuchać bez logowania, polubia utwór i zamyka baner na czas wizyty.
    h.document.getElementById('start-listening-button').click();
    assert.equal(h.document.getElementById('home-page').classList.contains('hidden'), false);

    h.api.displaySearchResults([searchItem('guest-song-1', 'Gościnny utwór')]);
    h.document.querySelector('#search-results .song-card .like-button').click();
    assert.match(h.document.getElementById('sync-promo-text').textContent, /1 utwór w ulubionych/);

    h.document.getElementById('dismiss-sync-promo').click();
    assert.equal(h.document.getElementById('sync-promo-banner').classList.contains('hidden'), true);
});

test('verifies session via RejsonAccount, ignores fake localStorage username and never leaks token', async (t) => {
    const h = createAccountHarness({
        localStorage: { isFirstVisit: 'false', username: 'PodrobionyAdmin' },
        session: { username: 'Alice', token: ALICE_TOKEN },
        initialServerData: {
            Alice: {
                liked_songs: [{ id: 'a1', title: 'Piosenka Alice', artist: 'Artysta', thumbnail: '' }],
                playlists: [{ id: 'pl-a', name: 'Lista Alice', songs: [] }],
                history: [{ id: 'h1', title: 'Ostatnio Alice', artist: 'Artysta', thumbnail: '' }]
            }
        }
    });
    closeHarness(t, h);
    await h.settle();

    assert.equal(h.openCalls, 0);
    assert.equal(h.window.localStorage.getItem('username'), null);
    assert.equal(h.document.getElementById('desktop-username').textContent, 'Alice');
    assert.equal(h.document.getElementById('header-username').textContent, 'Alice');
    assert.equal(h.document.getElementById('favorites-count').textContent, '1 utwór');
    assert.equal(h.document.getElementById('history-count').textContent, '1 utwór');
    assert.equal(h.document.getElementById('sync-promo-banner').classList.contains('hidden'), true);

    // Token nie może trafić do localStorage, sessionStorage, URL ani drzewa DOM.
    assert.equal(JSON.stringify(h.window.localStorage).includes(ALICE_TOKEN), false);
    assert.equal(JSON.stringify(h.window.sessionStorage).includes(ALICE_TOKEN), false);
    assert.equal(h.window.location.href.includes(ALICE_TOKEN), false);
    assert.equal(h.document.documentElement.outerHTML.includes(ALICE_TOKEN), false);
});

test('handles login redirect intent marker and verifies session upon return without assuming success', async (t) => {
    // 1. Brak sesji -> kliknięcie zapisuje wyłącznie znacznik czasu w sessionStorage i wywołuje RejsonAccount.open().
    const h1 = createAccountHarness({ session: null });
    closeHarness(t, h1);
    await h1.settle();

    h1.document.getElementById('desktop-connect-button').click();
    await h1.settle();

    assert.equal(h1.openCalls, 1);
    const pendingValue = h1.window.sessionStorage.getItem('jakuplayer_login_pending_v1');
    assert.ok(Number(pendingValue) > 0, 'intent timestamp must be saved in sessionStorage');

    // 2. Powrót ze strony logowania BEZ zalogowania -> nie zakłada sukcesu, czyści znacznik i pokazuje komunikat.
    const h2 = createAccountHarness({
        session: null,
        sessionStorage: { jakuplayer_login_pending_v1: String(Date.now()) }
    });
    closeHarness(t, h2);
    await h2.settle();

    assert.equal(h2.window.sessionStorage.getItem('jakuplayer_login_pending_v1'), null);
    assert.equal(h2.document.getElementById('desktop-account-connected').classList.contains('hidden'), true);
    assert.match(h2.document.getElementById('desktop-account-status').textContent, /Nie dokończono logowania/);

    // 3. Powrót ze strony logowania Z potwierdzoną sesją -> łączy konto i czyści znacznik.
    const h3 = createAccountHarness({
        session: { username: 'Alice', token: ALICE_TOKEN },
        sessionStorage: { jakuplayer_login_pending_v1: String(Date.now()) }
    });
    closeHarness(t, h3);
    await h3.settle();

    assert.equal(h3.window.sessionStorage.getItem('jakuplayer_login_pending_v1'), null);
    assert.equal(h3.document.getElementById('desktop-username').textContent, 'Alice');
});

test('supports intentional project disconnect, external logout, account switching and delayed responses', async (t) => {
    const h = createAccountHarness({
        session: { username: 'Alice', token: ALICE_TOKEN },
        initialServerData: {
            Alice: {
                liked_songs: [{ id: 'alice-1', title: 'Sekret Alice', artist: 'A', thumbnail: '' }],
                playlists: [{ id: 'pl-alice', name: 'Prywatna Alice', songs: [] }],
                history: [{ id: 'alice-h', title: 'Historia Alice', artist: 'A', thumbnail: '' }]
            },
            Bob: {
                liked_songs: [{ id: 'bob-1', title: 'Utwór Boba', artist: 'B', thumbnail: '' }, { id: 'bob-2', title: 'Drugi Boba', artist: 'B', thumbnail: '' }],
                playlists: [],
                history: []
            }
        }
    });
    closeHarness(t, h);
    await h.settle();

    // Otwórz szczegóły playlisty Alice, po czym przełącz konto na Boba w innej karcie.
    h.document.querySelector('[data-page="playlists"]').click();
    h.document.querySelector('#playlists-results [role="button"]').click();
    assert.equal(h.document.getElementById('playlist-detail-modal').classList.contains('open'), true);

    h.setSession({ username: 'Bob', token: BOB_TOKEN });
    h.notifyAccountChange();
    await h.settle();

    // Dane i otwarte modale Alice muszą zostać wyczyszczone; widoczne są wyłącznie dane Boba.
    assert.equal(h.document.getElementById('playlist-detail-modal').classList.contains('open'), false);
    assert.equal(h.document.getElementById('desktop-username').textContent, 'Bob');
    assert.equal(h.document.getElementById('favorites-count').textContent, '2 utwory');
    assert.equal(h.document.getElementById('history-count').textContent, '0 utworów');
    assert.equal(h.document.getElementById('playlists-results').textContent.includes('Prywatna Alice'), false);
    assert.equal(h.window.localStorage.getItem('likedSongs'), null, 'account data must not leak into guest localStorage');

    // Świadome odłączenie projektu czyści dane konta i nie łączy ponownie bez kliknięcia użytkownika.
    h.document.getElementById('desktop-disconnect-button').click();
    await h.settle();

    assert.equal(h.document.getElementById('desktop-account-connected').classList.contains('hidden'), true);
    assert.equal(h.document.getElementById('desktop-guest-label').textContent, 'Odłączono w Jakuplayerze');
    assert.match(h.document.getElementById('desktop-account-status').textContent, /Nadal jesteś zalogowany na rejson59\.github\.io/);
    assert.equal(h.document.getElementById('favorites-count').textContent, '0 utworów');

    // Zdarzenie subscribe przy świadomym odłączeniu nie przywraca sesji wbrew decyzji użytkownika.
    h.notifyAccountChange();
    await h.settle();
    assert.equal(h.document.getElementById('desktop-account-connected').classList.contains('hidden'), true);

    // Ochrona przed opóźnioną odpowiedzią: kliknij połącz, rozłącz zanim getSession wróci, potem rozwiąż stare Promise.
    const slowSession = deferred();
    h.setGetSession(() => slowSession.promise);
    h.document.getElementById('desktop-connect-button').click();
    h.document.getElementById('desktop-disconnect-button').click();
    slowSession.resolve({ username: 'Alice', token: ALICE_TOKEN });
    await h.settle();

    assert.equal(h.document.getElementById('desktop-account-connected').classList.contains('hidden'), true);
    assert.equal(h.document.getElementById('favorites-count').textContent, '0 utworów');

    // Ponowne świadome kliknięcie „Zaloguj się przez rejson59.github.io” łączy istniejącą sesję bez przekierowania, a wylogowanie ze strony czyści stan.
    h.setGetSession(null);
    h.setSession({ username: 'Bob', token: BOB_TOKEN });
    h.document.getElementById('desktop-connect-button').click();
    await h.settle();
    assert.equal(h.document.getElementById('desktop-username').textContent, 'Bob');
    assert.equal(h.openCalls, 0);

    h.setSession(null);
    h.notifyAccountChange();
    await h.settle();
    assert.equal(h.document.getElementById('desktop-account-connected').classList.contains('hidden'), true);
    assert.equal(h.document.getElementById('favorites-count').textContent, '0 utworów');
});

test('handles network errors gracefully with retry for both session verification and library sync', async (t) => {
    let failSession = true;
    const h = createAccountHarness({
        getSession: () => (failSession
            ? Promise.reject(new Error('offline'))
            : Promise.resolve({ username: 'Alice', token: ALICE_TOKEN }))
    });
    closeHarness(t, h);
    await h.settle();

    assert.equal(h.document.getElementById('desktop-guest-label').textContent, 'Błąd połączenia z kontem');
    assert.equal(h.document.getElementById('desktop-retry-button').classList.contains('hidden'), false);

    failSession = false;
    h.document.getElementById('desktop-retry-button').click();
    await h.settle();

    assert.equal(h.document.getElementById('desktop-username').textContent, 'Alice');

    // Przetestuj błąd sieci podczas zapisu polubionego utworu i ręczne ponowienie synchronizacji.
    let failSave = true;
    h.setRpcOverride(async (fnName) => {
        if (fnName === 'jakuplayer_save_library' && failSave) {
            throw new Error('offline save');
        }
        return undefined;
    });

    h.api.displaySearchResults([searchItem('sync-song', 'Utwór do zapisu')]);
    h.document.querySelector('#search-results .song-card .like-button').click();
    await h.settle();

    assert.equal(h.document.getElementById('desktop-sync-badge').textContent, 'Błąd zapisu');
    assert.equal(h.document.getElementById('modal-sync-retry-button').classList.contains('hidden'), false);

    failSave = false;
    h.document.getElementById('modal-sync-retry-button').click();
    await h.settle();

    assert.equal(h.document.getElementById('desktop-sync-badge').textContent, 'W chmurze');
    assert.equal(h.serverDb.get('Alice').liked_songs.length, 1);
    assert.equal(h.serverDb.get('Alice').liked_songs[0].id, 'sync-song');
});

test('isolates guest data until explicit migration consent and clears guest storage after migration', async (t) => {
    const h = createAccountHarness({
        localStorage: {
            isFirstVisit: 'false',
            likedSongs: JSON.stringify([{ id: 'guest-fav', title: 'Lokalny hit', artist: 'Gość', thumbnail: '' }]),
            playlists: JSON.stringify([{ id: 'guest-pl', name: 'Lokalna playlista', songs: [{ id: 'guest-fav', title: 'Lokalny hit', artist: 'Gość', thumbnail: '' }] }]),
            recentlyPlayed: JSON.stringify([{ id: 'guest-hist', title: 'Lokalna historia', artist: 'Gość', thumbnail: '' }])
        },
        session: { username: 'Alice', token: ALICE_TOKEN },
        initialServerData: {
            Alice: {
                liked_songs: [{ id: 'cloud-fav', title: 'Chmurowy hit', artist: 'AliceBand', thumbnail: '' }],
                playlists: [{ id: 'cloud-pl', name: 'Chmurowa playlista', songs: [] }],
                history: []
            },
            Bob: { liked_songs: [], playlists: [], history: [] }
        }
    });
    closeHarness(t, h);
    await h.settle();

    // Przed wyrażeniem zgody lokalne dane gościa NIE są wysyłane na serwer i nie mieszają się z kontem.
    assert.equal(h.rpcCalls.some((c) => c.fnName === 'jakuplayer_save_library'), false);
    assert.equal(h.document.getElementById('favorites-count').textContent, '1 utwór');
    assert.equal(h.document.getElementById('guest-migration-banner').classList.contains('hidden'), false);
    assert.match(h.document.getElementById('guest-migration-text').textContent, /Alice/);

    // Kliknięcie „Zapisz na koncie” scala dane bez utraty istniejącej biblioteki chmurowej i czyści pamięć gościa.
    h.document.getElementById('migrate-guest-data-button').click();
    await h.settle();

    assert.equal(h.document.getElementById('guest-migration-banner').classList.contains('hidden'), true);
    assert.equal(h.document.getElementById('favorites-count').textContent, '2 utwory');
    assert.equal(h.document.getElementById('history-count').textContent, '1 utwór');
    assert.equal(h.serverDb.get('Alice').liked_songs.length, 2);
    assert.equal(h.serverDb.get('Alice').playlists.length, 2);
    assert.equal(h.serverDb.get('Alice').history.length, 1);
    assert.equal(h.window.localStorage.getItem('likedSongs'), null);
    assert.equal(h.window.localStorage.getItem('playlists'), null);
    assert.equal(h.window.localStorage.getItem('recentlyPlayed'), null);

    // Gdy później na tej samej przeglądarce zaloguje się Bob, nie widzi ani danych Alice, ani dawnych danych gościa.
    h.setSession({ username: 'Bob', token: BOB_TOKEN });
    h.notifyAccountChange();
    await h.settle();

    assert.equal(h.document.getElementById('desktop-username').textContent, 'Bob');
    assert.equal(h.document.getElementById('favorites-count').textContent, '0 utworów');
    assert.equal(h.document.getElementById('history-count').textContent, '0 utworów');
    assert.equal(h.document.getElementById('guest-migration-banner').classList.contains('hidden'), true);
});

test('prevents overwriting remote library when initial read fails and ignores delayed library reads after account switch', async (t) => {
    // 1. Błąd początkowego odczytu biblioteki musi zablokować nadpisanie chmury pustą listą.
    let blockRead = true;
    const h1 = createAccountHarness({
        session: { username: 'Alice', token: ALICE_TOKEN },
        initialServerData: {
            Alice: {
                liked_songs: [{ id: 'important-1', title: 'Ważny utwór', artist: 'A', thumbnail: '' }],
                playlists: [],
                history: []
            }
        },
        rpcOverride: async (fnName) => {
            if (fnName === 'jakuplayer_get_library' && blockRead) {
                throw new Error('temporary read failure');
            }
            return undefined;
        }
    });
    closeHarness(t, h1);
    await h1.settle();

    h1.api.displaySearchResults([searchItem('new-song', 'Nowy utwór')]);
    h1.document.querySelector('#search-results .song-card .like-button').click();
    await h1.settle();

    assert.equal(h1.rpcCalls.some((c) => c.fnName === 'jakuplayer_save_library'), false, 'must not overwrite unloaded remote library');
    assert.equal(h1.serverDb.get('Alice').liked_songs.length, 1);
    assert.equal(h1.serverDb.get('Alice').liked_songs[0].id, 'important-1');

    blockRead = false;
    h1.document.getElementById('modal-sync-retry-button').click();
    await h1.settle();
    assert.equal(h1.document.getElementById('favorites-count').textContent, '1 utwór');

    // 2. Opóźniona odpowiedź jakuplayer_get_library dla Alice po przełączeniu na Boba musi zostać odrzucona.
    const delayedAliceRead = deferred();
    const h2 = createAccountHarness({
        session: { username: 'Alice', token: ALICE_TOKEN },
        initialServerData: {
            Bob: {
                liked_songs: [{ id: 'bob-only', title: 'Tylko Bob', artist: 'B', thumbnail: '' }],
                playlists: [],
                history: []
            }
        },
        rpcOverride: async (fnName, body) => {
            if (fnName === 'jakuplayer_get_library' && body.p_token === ALICE_TOKEN) {
                return delayedAliceRead.promise;
            }
            return undefined;
        }
    });
    closeHarness(t, h2);
    await h2.settle();

    h2.setSession({ username: 'Bob', token: BOB_TOKEN });
    h2.notifyAccountChange();
    await h2.settle();

    delayedAliceRead.resolve({
        ok: true,
        status: 200,
        json: async () => ({
            liked_songs: [{ id: 'alice-late', title: 'Stare dane Alice', artist: 'A', thumbnail: '' }],
            playlists: [],
            history: []
        })
    });
    await h2.settle();

    assert.equal(h2.document.getElementById('desktop-username').textContent, 'Bob');
    assert.equal(h2.document.getElementById('favorites-count').textContent, '1 utwór');
    h2.document.querySelector('[data-page="favorites"]').click();
    assert.match(h2.document.getElementById('favorites-results').textContent, /Tylko Bob/);
    assert.equal(h2.document.getElementById('favorites-results').textContent.includes('Stare dane Alice'), false);
});

test('gracefully informs user on non-rejson59 origin when RejsonAccount is unavailable', async (t) => {
    const h = createAccountHarness({
        url: 'http://localhost:3000/',
        withRejsonAccount: false
    });
    closeHarness(t, h);
    await h.settle();

    h.document.getElementById('desktop-connect-button').click();
    await h.settle();

    assert.equal(h.document.getElementById('desktop-account-connected').classList.contains('hidden'), true);
    assert.match(h.document.getElementById('desktop-account-status').textContent, /rejson59\.github\.io\/Jakuplayer/);
});
