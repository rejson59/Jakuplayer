'use strict';

// This is a browser-side YouTube Data API key. Restrict it by HTTP referrer
// and to the YouTube Data API in Google Cloud Console.
const API_KEY = 'AIzaSyBzEss-uFNFF-jl1kIY6jYswAnCDRN4eao';

// Wspólny backend Supabase dla rejson59.github.io; autoryzacja wyłącznie po stronie
// serwera na podstawie zweryfikowanego tokenu sesji (community_session_user).
const SUPABASE_RPC_BASE = 'https://hzbqzfimtroixnldzjeq.supabase.co/rest/v1/rpc/';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6YnF6ZmltdHJvaXhubGR6amVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTYzOTEsImV4cCI6MjEwODE3MjM5MX0.oeZWOaNd6p3wZBZQQu3QWjRHlrkxV_BFQRNSN-6YntE';

const LOGIN_PENDING_KEY = 'jakuplayer_login_pending_v1';
const ACCOUNT_DISCONNECTED_KEY = 'jakuplayer_account_disconnected_v1';
const PROMO_DISMISSED_KEY = 'jakuplayer_promo_dismissed_v1';
const MIGRATION_DISMISSED_KEY = 'jakuplayer_migration_dismissed_v1';
const LOGIN_PENDING_MAX_AGE_MS = 30 * 60 * 1000;
const HISTORY_LIMIT = 30;
const PLAYBACK_SESSION_KEY = 'jakuplayer_playback_session_v1';

// Gotowe utwory startowe (strumienie i klasyki z otwartym osadzaniem na YouTube),
// dzięki którym każdy użytkownik może słuchać muzyki natychmiast bez logowania.
const STARTER_SONGS = [
    {
        id: 'jfKfPfyJRdk',
        title: 'lofi hip hop radio — beats to relax/study to',
        artist: 'Lofi Girl',
        thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg'
    },
    {
        id: '4xDzrJKXOOY',
        title: 'synthwave radio — beats to chill/game to',
        artist: 'Lofi Girl',
        thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/mqdefault.jpg'
    },
    {
        id: 'K4DyBUG242c',
        title: 'Cartoon, Jéja - On & On (feat. Daniel Levi)',
        artist: 'NoCopyrightSounds',
        thumbnail: 'https://i.ytimg.com/vi/K4DyBUG242c/mqdefault.jpg'
    },
    {
        id: 'yJg-Y5byMMw',
        title: 'Warriyo - Mortals (feat. Laura Brehm)',
        artist: 'NoCopyrightSounds',
        thumbnail: 'https://i.ytimg.com/vi/yJg-Y5byMMw/mqdefault.jpg'
    },
    {
        id: 'J2X5mJ3HDYE',
        title: 'DEAF KEV - Invincible',
        artist: 'NoCopyrightSounds',
        thumbnail: 'https://i.ytimg.com/vi/J2X5mJ3HDYE/mqdefault.jpg'
    },
    {
        id: 'p7ZsBPK656s',
        title: 'Disfigure - Blank',
        artist: 'NoCopyrightSounds',
        thumbnail: 'https://i.ytimg.com/vi/p7ZsBPK656s/mqdefault.jpg'
    }
];

const byId = (id) => document.getElementById(id);

function on(target, eventName, handler, options) {
    if (target && typeof target.addEventListener === 'function') {
        target.addEventListener(eventName, handler, options);
    }
}

const dom = {
    searchForm: byId('search-form'),
    searchInput: byId('search-input'),
    searchButton: byId('search-button'),
    starterTracksButton: byId('starter-tracks-button'),
    quickSearchButtons: document.querySelectorAll('[data-quick-search]'),
    searchResults: byId('search-results'),
    favoritesResults: byId('favorites-results'),
    playlistsResults: byId('playlists-results'),
    historyResults: byId('history-results'),
    favoritesFilter: byId('favorites-filter'), favoritesSort: byId('favorites-sort'),
    playlistsFilter: byId('playlists-filter'), playlistsSort: byId('playlists-sort'),
    sleepTimer: byId('sleep-timer'), sleepTimerStatus: byId('sleep-timer-status'),
    sharePlaylistButton: byId('share-playlist-button'),
    sharedSection: byId('shared-playlist-section'), sharedTitle: byId('shared-playlist-title'),
    sharedDescription: byId('shared-playlist-description'), playSharedButton: byId('play-shared-button'),
    importSharedButton: byId('import-shared-button'), dismissSharedButton: byId('dismiss-shared-button'),
    recommendationsButton: byId('recommendations-button'), recommendationsResults: byId('recommendations-results'),
    recommendationsDescription: byId('recommendations-description'),
    queueResults: byId('queue-results'),
    queuePage: byId('queue-page'),
    clearQueueButton: byId('clear-queue-button'),
    playFavoritesButton: byId('play-favorites-button'),
    playPlaylistButton: byId('play-playlist-button'),
    clearHistoryButton: byId('clear-history-button'),
    playButton: byId('play-button'),
    mobilePlayButton: byId('mobile-play-button'),
    prevButton: byId('prev-button'),
    nextButton: byId('next-button'),
    mobilePrevButton: byId('mobile-prev-button'),
    mobileNextButton: byId('mobile-next-button'),
    progressBar: byId('progress-bar'),
    currentTime: byId('current-time'),
    duration: byId('duration'),
    currentSongTitle: byId('current-song-title'),
    currentSongArtist: byId('current-song-artist'),
    currentSongImage: byId('current-song-image'),
    mobileCurrentSongTitle: byId('mobile-current-song-title'),
    mobileCurrentSongArtist: byId('mobile-current-song-artist'),
    mobileCurrentSongImage: byId('mobile-current-song-image'),
    likeButton: byId('like-button'),
    mobileLikeButton: byId('mobile-like-button'),
    addToPlaylistButton: byId('add-to-playlist-button'),
    mobilePlaylistButton: byId('mobile-playlist-button'),
    volumeBar: byId('volume-bar'),
    volumeButton: byId('volume-button'),
    shuffleButton: byId('shuffle-button'),
    repeatButton: byId('repeat-button'),
    mobileShuffleButton: byId('mobile-shuffle-button'),
    mobileRepeatButton: byId('mobile-repeat-button'),
    createPlaylistButton: byId('create-playlist-button'),
    playlistModal: byId('playlist-modal'),
    closePlaylistModal: byId('close-playlist-modal'),
    playlistModalContent: byId('playlist-modal-content'),
    createNewPlaylistButton: byId('create-new-playlist-button'),
    favoritesCount: byId('favorites-count'),
    historyCount: byId('history-count'),
    playlistDetailModal: byId('playlist-detail-modal'),
    playlistDetailTitle: byId('playlist-detail-title'),
    playlistDetailContent: byId('playlist-detail-content'),
    closePlaylistDetailModal: byId('close-playlist-detail-modal'),
    deletePlaylistButton: byId('delete-playlist-button'),
    editPlaylistButton: byId('edit-playlist-button'),
    homePage: byId('home-page'),
    favoritesPage: byId('favorites-page'),
    playlistsPage: byId('playlists-page'),
    historyPage: byId('history-page'),
    welcomePage: byId('welcome-page'),
    menuLinks: document.querySelectorAll('.menu-link'),
    homeGreeting: byId('home-greeting'),
    startListeningButton: byId('start-listening-button'),
    welcomeConnectButton: byId('welcome-connect-button'),
    mobileMenuButton: byId('mobile-menu-button'),
    mobileMenu: byId('mobile-menu'),
    menuBackdrop: byId('menu-backdrop'),
    mobileSongInfo: byId('mobile-song-info'),
    mobilePlayerExpanded: byId('mobile-player-expanded'),
    mobileProgressBar: byId('mobile-progress-bar'),
    mobileProgressFill: byId('mobile-progress-fill'),
    mobileCurrentTime: byId('mobile-current-time'),
    mobileDuration: byId('mobile-duration'),
    mainContent: document.querySelector('.player-controls'),
    adBlockStatus: byId('ad-block-status'),
    adBlockStatusText: byId('ad-block-status-text'),
    toast: byId('toast'),

    // Wspólne konto rejson59.github.io i synchronizacja
    accountModal: byId('account-modal'),
    accountModalBackdrop: byId('account-modal-backdrop'),
    closeAccountModal: byId('close-account-modal'),
    modalAccountStateBadge: byId('modal-account-state-badge'),
    modalAccountStatus: byId('modal-account-status'),
    modalGuestSection: byId('modal-guest-section'),
    modalConnectButton: byId('modal-connect-button'),
    modalRetryButton: byId('modal-retry-button'),
    modalConnectedSection: byId('modal-connected-section'),
    modalConnectedUsername: byId('modal-connected-username'),
    modalSyncStatus: byId('modal-sync-status'),
    modalSyncRetryButton: byId('modal-sync-retry-button'),
    modalLikedCount: byId('modal-liked-count'),
    modalPlaylistsCount: byId('modal-playlists-count'),
    modalHistoryCount: byId('modal-history-count'),
    modalMigrationBox: byId('modal-migration-box'),
    modalMigrationText: byId('modal-migration-text'),
    modalMigrateButton: byId('modal-migrate-button'),
    modalSkipMigrationButton: byId('modal-skip-migration-button'),
    modalDisconnectButton: byId('modal-disconnect-button'),
    headerAccountButton: byId('header-account-button'),
    headerAccountDot: byId('header-account-dot'),
    headerUsername: byId('header-username'),
    headerUsernameInitial: byId('header-username-initial'),
    desktopAccountGuest: byId('desktop-account-guest'),
    desktopGuestLabel: byId('desktop-guest-label'),
    desktopRetryButton: byId('desktop-retry-button'),
    desktopAccountConnected: byId('desktop-account-connected'),
    desktopUsername: byId('desktop-username'),
    desktopSyncBadge: byId('desktop-sync-badge'),
    desktopAccountButton: byId('desktop-account-button'),
    desktopAccountStatus: byId('desktop-account-status'),
    mobileAccountGuest: byId('mobile-account-guest'),
    mobileGuestLabel: byId('mobile-guest-label'),
    mobileRetryButton: byId('mobile-retry-button'),
    mobileAccountConnected: byId('mobile-account-connected'),
    mobileUsername: byId('mobile-username'),
    mobileSyncBadge: byId('mobile-sync-badge'),
    mobileAccountButton: byId('mobile-account-button'),
    mobileAccountStatus: byId('mobile-account-status'),
    syncPromoBanner: byId('sync-promo-banner'),
    syncPromoText: byId('sync-promo-text'),
    dismissSyncPromo: byId('dismiss-sync-promo'),
    guestMigrationBanner: byId('guest-migration-banner'),
    guestMigrationText: byId('guest-migration-text'),
    migrateGuestDataButton: byId('migrate-guest-data-button'),
    skipGuestMigrationButton: byId('skip-guest-migration-button'),
    connectButtons: document.querySelectorAll('[data-account-connect]'),
    retryButtons: document.querySelectorAll('[data-account-retry]'),
    disconnectButtons: document.querySelectorAll('[data-account-disconnect]'),
    syncRetryButtons: document.querySelectorAll('[data-sync-retry]')
};

let player = null;
let playerReady = false;
let currentSong = null;
let isPlaying = false;
let isShuffleOn = false;
let isRepeatOn = false;
let currentVolume = Number(dom.volumeBar.value) || 80;
let lastNonZeroVolume = currentVolume || 80;
let selectedSongForPlaylist = null;
let selectedPlaylistForDetail = null;
let displayedHomeSongs = [];
let playbackQueue = [];
let currentQueueIndex = -1;
let resumePosition = null;
let lastKnownPosition = 0;
let resumeRequested = false;
let playbackRestoreAttempted = false;
let playbackTouched = false;
let sleepDeadline = 0;
let sleepTimeout = null;
let sharedPlaylist = null;
let recommendationsEpoch = 0;
let progressTimer = null;
let playbackSaveTimer = null;
let searchController = null;
let searchRequestId = 0;
let isSeeking = false;
let isTouching = false;
let toastTimer = null;
let playerLoadingToastShown = false;
let storageWarningShown = false;

// Stan konta wspólnego (token trzymany wyłącznie w pamięci, nigdy w URL/logach/storage projektu)
let accountState = 'no_session'; // 'checking' | 'connected' | 'no_session' | 'network_error' | 'disconnected'
let activeAccountSession = null; // { username, token } | null
let accountLibraryLoaded = false;
let accountStatusMessage = '';
let syncState = 'idle'; // 'idle' | 'loading' | 'saving' | 'synced' | 'error'
let syncErrorMessage = '';
let authEpoch = 0;
let accountSubscriptionCleanup = null;
let dirtySections = { liked: false, playlists: false, history: false };
let activeSavePromise = null;
let migrationInProgress = false;

function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (_) {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (_) {
        if (!storageWarningShown) {
            storageWarningShown = true;
            showToast('Przeglądarka zablokowała zapis danych. Zmiany mogą zniknąć po odświeżeniu.', true);
        }
        return false;
    }
}

function storageRemove(key) {
    try {
        localStorage.removeItem(key);
    } catch (_) {
        // The app can still work for the current session without storage.
    }
}

function sessionGet(key) {
    try {
        return sessionStorage.getItem(key);
    } catch (_) {
        return null;
    }
}

function sessionSet(key, value) {
    try {
        sessionStorage.setItem(key, value);
        return true;
    } catch (_) {
        return false;
    }
}

function sessionRemove(key) {
    try {
        sessionStorage.removeItem(key);
    } catch (_) {
        // Ignore unavailable sessionStorage.
    }
}

function readStoredArray(key) {
    try {
        const value = JSON.parse(storageGet(key) || '[]');
        return Array.isArray(value) ? value : [];
    } catch (_) {
        return [];
    }
}

function escapeHTML(value) {
    const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value ?? '');
    return textarea.value;
}

function normalizeThumbnail(value) {
    if (!value) return '';
    try {
        const url = new URL(String(value), window.location.href);
        return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
    } catch (_) {
        return '';
    }
}

function normalizeSong(song) {
    if (!song || typeof song !== 'object') return null;
    const id = String(song.id || '').trim();
    if (!id) return null;

    return {
        id,
        title: decodeHtmlEntities(String(song.title || 'Nieznany utwór')),
        artist: decodeHtmlEntities(String(song.artist || 'Nieznany wykonawca')),
        thumbnail: normalizeThumbnail(song.thumbnail)
    };
}

function normalizePlaylist(playlist) {
    if (!playlist || typeof playlist !== 'object' || !playlist.id) return null;
    const id = String(playlist.id).trim();
    if (!id) return null;
    const name = String(playlist.name || 'Playlista').trim().slice(0, 80) || 'Playlista';
    const seen = new Set();
    const songs = (Array.isArray(playlist.songs) ? playlist.songs : [])
        .map(normalizeSong)
        .filter((song) => {
            if (!song || seen.has(song.id)) return false;
            seen.add(song.id);
            return true;
        });
    return { id, name, songs };
}

function deduplicateSongs(items, limit = Infinity) {
    const seen = new Set();
    const result = [];
    for (const raw of Array.isArray(items) ? items : []) {
        const normalized = normalizeSong(raw);
        if (!normalized || seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        result.push(normalized);
        if (result.length >= limit) break;
    }
    return result;
}

function deduplicatePlaylists(items, limit = 100) {
    const seen = new Set();
    const result = [];
    for (const raw of Array.isArray(items) ? items : []) {
        const normalized = normalizePlaylist(raw);
        if (!normalized || seen.has(normalized.id)) continue;
        seen.add(normalized.id);
        result.push(normalized);
        if (result.length >= limit) break;
    }
    return result;
}

function readGuestLibrary() {
    return {
        likedSongs: deduplicateSongs(readStoredArray('likedSongs'), 500),
        playlists: deduplicatePlaylists(readStoredArray('playlists'), 100),
        recentlyPlayedSongs: deduplicateSongs(readStoredArray('recentlyPlayed'), HISTORY_LIMIT)
    };
}

function clearGuestLibraryStorage() {
    storageRemove('likedSongs');
    storageRemove('playlists');
    storageRemove('recentlyPlayed');
}

// Usuwamy przestarzałą, nieautoryzowaną nazwę lokalną ze starszej wersji aplikacji.
storageRemove('username');

const initialGuestLibrary = readGuestLibrary();
let likedSongs = initialGuestLibrary.likedSongs;
let recentlyPlayedSongs = initialGuestLibrary.recentlyPlayedSongs;
let playlists = initialGuestLibrary.playlists;
let isFirstVisit = storageGet('isFirstVisit') === null;

const adBlocker = new YouTubeAdBlocker({
    onAdStart: () => setAdBlockStatus(true),
    onAdEnd: () => {
        setAdBlockStatus(false);
        updateVolume();
    },
    onSkip: () => setAdBlockStatus(true, true)
});

function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.toggle('bg-red-600', isError);
    dom.toast.classList.toggle('bg-slate-700', !isError);
    dom.toast.classList.remove('hidden');
    toastTimer = window.setTimeout(() => dom.toast.classList.add('hidden'), isError ? 5000 : 2500);
}

function setAdBlockStatus(active, skipped = false) {
    dom.adBlockStatus.classList.toggle('text-emerald-400', !active);
    dom.adBlockStatus.classList.toggle('text-amber-300', active);
    dom.adBlockStatusText.textContent = active
        ? (skipped ? 'Reklama pominięta' : 'Blokowanie reklamy…')
        : 'Adblock aktywny';
}

function setIcon(button, iconClass) {
    const icon = button.querySelector('i');
    if (icon) icon.className = iconClass;
}

function formatSongCount(count) {
    if (count === 1) return '1 utwór';
    const lastTwo = count % 100;
    const last = count % 10;
    const suffix = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
        ? 'utwory'
        : 'utworów';
    return `${count} ${suffix}`;
}

function formatPlaylistCount(count) {
    if (count === 1) return '1 playlista';
    const lastTwo = count % 100;
    const last = count % 10;
    const suffix = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)
        ? 'playlisty'
        : 'playlist';
    return `${count} ${suffix}`;
}

function summarizeLibraryCounts(lib) {
    const parts = [];
    if (lib.likedSongs.length > 0) parts.push(`${formatSongCount(lib.likedSongs.length)} w ulubionych`);
    if (lib.playlists.length > 0) parts.push(formatPlaylistCount(lib.playlists.length));
    if (lib.recentlyPlayedSongs.length > 0) parts.push(`${formatSongCount(lib.recentlyPlayedSongs.length)} w historii`);
    return parts.join(', ');
}

function hasLibraryItems(lib) {
    return lib.likedSongs.length > 0 || lib.playlists.length > 0 || lib.recentlyPlayedSongs.length > 0;
}

function artworkMarkup(song, className) {
    if (!song.thumbnail) {
        return '<i class="fas fa-music text-slate-500" aria-hidden="true"></i>';
    }
    return `<img src="${escapeHTML(song.thumbnail)}" alt="${escapeHTML(song.title)}" class="${className}" loading="lazy" referrerpolicy="no-referrer">`;
}

function hasValidPendingLogin() {
    const raw = sessionGet(LOGIN_PENDING_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    const age = Date.now() - timestamp;
    if (!Number.isFinite(timestamp) || timestamp <= 0 || age < 0 || age >= LOGIN_PENDING_MAX_AGE_MS) {
        sessionRemove(LOGIN_PENDING_KEY);
        return false;
    }
    return true;
}

function clearPendingLogin() {
    sessionRemove(LOGIN_PENDING_KEY);
}

function isDisconnectedByChoice() {
    return storageGet(ACCOUNT_DISCONNECTED_KEY) === '1' || sessionGet(ACCOUNT_DISCONNECTED_KEY) === '1';
}

function setDisconnectedByChoice(disconnected) {
    if (disconnected) {
        if (!storageSet(ACCOUNT_DISCONNECTED_KEY, '1')) {
            sessionSet(ACCOUNT_DISCONNECTED_KEY, '1');
        }
    } else {
        storageRemove(ACCOUNT_DISCONNECTED_KEY);
        sessionRemove(ACCOUNT_DISCONNECTED_KEY);
    }
}

async function callJakuplayerRpc(fnName, params, token) {
    if (typeof token !== 'string' || token.length < 16) {
        throw new Error('Brak ważnej sesji konta.');
    }

    let response;
    try {
        response = await fetch(`${SUPABASE_RPC_BASE}${fnName}`, {
            method: 'POST',
            cache: 'no-store',
            keepalive: fnName === 'jakuplayer_save_library',
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ p_token: token, ...params })
        });
    } catch (_) {
        const networkError = new Error('Brak połączenia z serwerem konta. Sprawdź sieć i spróbuj ponownie.');
        networkError.isNetwork = true;
        throw networkError;
    }

    const body = await response.json().catch(() => null);
    if (!response.ok) {
        const message = body && typeof body.message === 'string' && body.message
            ? body.message
            : 'Serwer odrzucił żądanie biblioteki konta.';
        const rpcError = new Error(message);
        rpcError.status = response.status;
        throw rpcError;
    }
    return body;
}

function refreshAllRenderedLikeStates() {
    const likedIds = new Set(likedSongs.map((song) => song.id));
    document.querySelectorAll('.song-card').forEach((card) => {
        const button = card.querySelector('.like-button');
        if (!button) return;
        const liked = likedIds.has(card.dataset.songId);
        setIcon(button, `${liked ? 'fas' : 'far'} fa-heart`);
        button.classList.toggle('text-red-500', liked);
        button.classList.toggle('text-slate-400', !liked);
        button.setAttribute('aria-pressed', String(liked));
    });

    if (currentSong) {
        const currentLiked = likedIds.has(currentSong.id);
        setIcon(dom.likeButton, `${currentLiked ? 'fas text-red-500' : 'far'} fa-heart`);
        setIcon(dom.mobileLikeButton, `${currentLiked ? 'fas text-red-500' : 'far'} fa-heart text-xl`);
        dom.likeButton.setAttribute('aria-pressed', String(currentLiked));
        dom.mobileLikeButton.setAttribute('aria-pressed', String(currentLiked));
    } else {
        setIcon(dom.likeButton, 'far fa-heart');
        setIcon(dom.mobileLikeButton, 'far fa-heart text-xl');
        dom.likeButton.setAttribute('aria-pressed', 'false');
        dom.mobileLikeButton.setAttribute('aria-pressed', 'false');
    }
}

function applyLibraryToMemory(library) {
    invalidateRecommendations();
    likedSongs = deduplicateSongs(library.likedSongs, 500);
    playlists = deduplicatePlaylists(library.playlists, 100);
    recentlyPlayedSongs = deduplicateSongs(library.recentlyPlayedSongs, HISTORY_LIMIT);

    updateFavoritesCount();
    updateHistoryCount();
    refreshAllRenderedLikeStates();
    loadFavorites();
    loadPlaylists();
    loadHistory();
}

function clearConnectedAccountData() {
    // Nie ujawniaj kolejki z biblioteki poprzedniego konta po jego odłączeniu.
    // Aktualnie odtwarzany utwór pozostaje, aby nie przerywać muzyki.
    if (activeAccountSession) {
        sessionRemove(PLAYBACK_SESSION_KEY);
        playbackTouched = false;
        playbackRestoreAttempted = true;
        invalidateRecommendations();
        playbackQueue = currentSong ? [currentSong] : [];
        currentQueueIndex = currentSong ? 0 : -1;
        renderQueue();
    }
    activeAccountSession = null;
    accountLibraryLoaded = false;
    syncState = 'idle';
    syncErrorMessage = '';
    dirtySections = { liked: false, playlists: false, history: false };
    migrationInProgress = false;
    selectedPlaylistForDetail = null;
    selectedSongForPlaylist = null;
    dom.playlistModal.classList.remove('open');
    dom.playlistDetailModal.classList.remove('open');
    applyLibraryToMemory({ likedSongs: [], playlists: [], recentlyPlayedSongs: [] });
}

function loadGuestLibraryIntoMemory() {
    applyLibraryToMemory(readGuestLibrary());
}

function buildDirtyPayloadFromSnapshot(sections, snapshot) {
    const payload = {};
    if (sections.liked) payload.p_liked_songs = snapshot.likedSongs;
    if (sections.playlists) payload.p_playlists = snapshot.playlists;
    if (sections.history) payload.p_history = snapshot.recentlyPlayedSongs;
    return payload;
}

function hasAnyDirtySection(sections = dirtySections) {
    return Boolean(sections.liked || sections.playlists || sections.history);
}

async function flushAccountSave() {
    if (activeSavePromise) return activeSavePromise;
    if (!activeAccountSession || !accountLibraryLoaded || !hasAnyDirtySection()) return;

    const session = activeAccountSession;
    const epoch = authEpoch;
    const sectionsToSave = { ...dirtySections };
    const snapshot = {
        likedSongs: likedSongs.map((song) => ({ ...song })),
        playlists: playlists.map((pl) => ({ ...pl, songs: pl.songs.map((song) => ({ ...song })) })),
        recentlyPlayedSongs: recentlyPlayedSongs.map((song) => ({ ...song }))
    };
    dirtySections = { liked: false, playlists: false, history: false };
    syncState = 'saving';
    syncErrorMessage = '';
    updateAccountUI();

    const run = (async () => {
        try {
            const payload = buildDirtyPayloadFromSnapshot(sectionsToSave, snapshot);
            await callJakuplayerRpc('jakuplayer_save_library', payload, session.token);
            if (epoch !== authEpoch || !activeAccountSession || activeAccountSession.token !== session.token) return;
            syncState = hasAnyDirtySection() ? 'saving' : 'synced';
            syncErrorMessage = '';
            updateAccountUI();
        } catch (error) {
            if (epoch !== authEpoch || !activeAccountSession || activeAccountSession.token !== session.token) return;
            dirtySections = {
                liked: dirtySections.liked || sectionsToSave.liked,
                playlists: dirtySections.playlists || sectionsToSave.playlists,
                history: dirtySections.history || sectionsToSave.history
            };
            syncState = 'error';
            syncErrorMessage = error?.message || 'Nie udało się zapisać zmian na koncie.';
            updateAccountUI();

            if (error?.status === 401 || error?.status === 403 || /sesja wygasła|musisz być zalogowany/i.test(String(error?.message || ''))) {
                verifyAccountSession(false);
            }
        } finally {
            activeSavePromise = null;
            if (epoch === authEpoch && activeAccountSession && activeAccountSession.token === session.token && hasAnyDirtySection() && syncState !== 'error') {
                flushAccountSave();
            }
        }
    })();

    activeSavePromise = run;
    return run;
}

function canMutateLibrary() {
    if (!activeAccountSession) return true;
    if (accountLibraryLoaded) return true;
    if (syncState === 'loading') {
        showToast('Trwa wczytywanie biblioteki z konta — spróbuj za chwilę.');
    } else {
        showToast('Najpierw ponów wczytanie biblioteki konta, aby nie nadpisać zapisanych danych.', true);
    }
    return false;
}

function persistSection(section) {
    if (!activeAccountSession) {
        if (section === 'liked') storageSet('likedSongs', JSON.stringify(likedSongs));
        if (section === 'playlists') storageSet('playlists', JSON.stringify(playlists));
        if (section === 'history') storageSet('recentlyPlayed', JSON.stringify(recentlyPlayedSongs));
        updateAccountUI();
        return;
    }

    dirtySections[section] = true;
    flushAccountSave();
}

async function retrySync() {
    if (!activeAccountSession) {
        await verifyAccountSession(false);
        return;
    }
    if (!accountLibraryLoaded) {
        await loadConnectedAccountLibrary(activeAccountSession, authEpoch);
        return;
    }
    if (hasAnyDirtySection()) {
        syncState = 'saving';
        syncErrorMessage = '';
        updateAccountUI();
        await flushAccountSave();
    }
}

async function loadConnectedAccountLibrary(session, epoch) {
    syncState = 'loading';
    syncErrorMessage = '';
    updateAccountUI();

    try {
        const remote = await callJakuplayerRpc('jakuplayer_get_library', {}, session.token);
        if (epoch !== authEpoch || !activeAccountSession || activeAccountSession.token !== session.token) return;
        accountLibraryLoaded = true;
        applyLibraryToMemory({
            likedSongs: Array.isArray(remote?.liked_songs) ? remote.liked_songs : [],
            playlists: Array.isArray(remote?.playlists) ? remote.playlists : [],
            recentlyPlayedSongs: Array.isArray(remote?.history) ? remote.history : []
        });
        syncState = 'synced';
        syncErrorMessage = '';
        accountStatusMessage = '';
        updateAccountUI();
    } catch (error) {
        if (epoch !== authEpoch || !activeAccountSession || activeAccountSession.token !== session.token) return;
        accountLibraryLoaded = false;
        syncState = 'error';
        syncErrorMessage = error?.message || 'Nie udało się wczytać biblioteki z konta.';
        accountStatusMessage = syncErrorMessage;
        updateAccountUI();
    }
}

async function verifyAccountSession(fromClick = false) {
    const pendingBefore = hasValidPendingLogin();

    if (!fromClick && isDisconnectedByChoice() && !pendingBefore) {
        ++authEpoch;
        clearConnectedAccountData();
        loadGuestLibraryIntoMemory();
        accountState = 'disconnected';
        accountStatusMessage = 'Odłączono konto w Jakuplayerze. Nadal możesz być zalogowany na rejson59.github.io.';
        updateAccountUI();
        return;
    }

    if (!window.RejsonAccount || typeof window.RejsonAccount.getSession !== 'function') {
        clearPendingLogin();
        clearConnectedAccountData();
        loadGuestLibraryIntoMemory();
        accountState = 'no_session';
        accountStatusMessage = fromClick
            ? 'Wspólne logowanie działa pod adresem https://rejson59.github.io/Jakuplayer/ (ten sam origin).'
            : '';
        updateAccountUI();
        if (fromClick && accountStatusMessage) {
            showToast(accountStatusMessage, true);
        }
        return;
    }

    const epoch = ++authEpoch;
    const previousToken = activeAccountSession ? activeAccountSession.token : null;
    accountState = 'checking';
    accountStatusMessage = 'Sprawdzam konto rejson59.github.io…';
    updateAccountUI();

    let session = null;
    try {
        session = await window.RejsonAccount.getSession();
    } catch (_) {
        if (epoch !== authEpoch) return;
        clearConnectedAccountData();
        loadGuestLibraryIntoMemory();
        accountState = 'network_error';
        accountStatusMessage = 'Nie udało się sprawdzić konta rejson59.github.io. Sprawdź połączenie i spróbuj ponownie.';
        updateAccountUI();
        return;
    }

    if (epoch !== authEpoch) return;

    const validSession = session
        && typeof session.username === 'string'
        && session.username.trim().length > 0
        && typeof session.token === 'string'
        && session.token.length >= 16;

    if (!validSession) {
        const hadActiveAccount = Boolean(previousToken);
        clearPendingLogin();
        setDisconnectedByChoice(false);
        clearConnectedAccountData();
        loadGuestLibraryIntoMemory();
        accountState = 'no_session';

        if (fromClick) {
            if (!sessionSet(LOGIN_PENDING_KEY, String(Date.now()))) {
                accountStatusMessage = 'Przeglądarka blokuje pamięć sesji (sessionStorage). Nie można bezpiecznie wrócić po zalogowaniu.';
                updateAccountUI();
                return;
            }
            accountStatusMessage = 'Otwieram logowanie rejson59.github.io…';
            updateAccountUI();
            window.RejsonAccount.open();
            return;
        }

        if (pendingBefore) {
            accountStatusMessage = 'Nie dokończono logowania. Kliknij „Zaloguj się przez rejson59.github.io”, aby spróbować ponownie.';
        } else if (hadActiveAccount) {
            accountStatusMessage = 'Wylogowano z konta rejson59.github.io. Przywrócono tryb lokalny.';
        } else {
            accountStatusMessage = '';
        }
        updateAccountUI();
        return;
    }

    clearPendingLogin();
    setDisconnectedByChoice(false);

    // Jeśli token się zmienił lub wcześniej byliśmy w trybie gościa, czyścimy stan poprzedniej sesji przed wczytaniem nowej biblioteki.
    if (previousToken !== session.token) {
        clearConnectedAccountData();
        activeAccountSession = { username: session.username.trim(), token: session.token };
        accountState = 'connected';
        accountStatusMessage = '';
        await loadConnectedAccountLibrary(activeAccountSession, epoch);
        return;
    }

    activeAccountSession = { username: session.username.trim(), token: session.token };
    accountState = 'connected';
    accountStatusMessage = '';
    if (!accountLibraryLoaded) {
        await loadConnectedAccountLibrary(activeAccountSession, epoch);
    } else {
        updateAccountUI();
    }
}

function disconnectProjectAccount() {
    // Jeżeli przed rozłączeniem zostały niezapisane zmiany, wyślij ostatnią migawkę z dotychczasowym tokenem.
    if (activeAccountSession && accountLibraryLoaded && hasAnyDirtySection()) {
        const finalToken = activeAccountSession.token;
        const finalPayload = buildDirtyPayloadFromSnapshot(dirtySections, {
            likedSongs: likedSongs.map((song) => ({ ...song })),
            playlists: playlists.map((pl) => ({ ...pl, songs: pl.songs.map((song) => ({ ...song })) })),
            recentlyPlayedSongs: recentlyPlayedSongs.map((song) => ({ ...song }))
        });
        callJakuplayerRpc('jakuplayer_save_library', finalPayload, finalToken).catch(() => {});
    }

    ++authEpoch;
    clearPendingLogin();
    setDisconnectedByChoice(true);
    clearConnectedAccountData();
    loadGuestLibraryIntoMemory();
    accountState = 'disconnected';
    accountStatusMessage = 'Odłączono konto w Jakuplayerze. Nadal jesteś zalogowany na rejson59.github.io.';
    updateAccountUI();
    dom.mobileMenu.classList.remove('open');
    showToast('Odłączono konto w Jakuplayerze.');
}

async function migrateGuestDataToAccount() {
    if (!activeAccountSession || !accountLibraryLoaded || migrationInProgress) return;
    const guest = readGuestLibrary();
    if (!hasLibraryItems(guest)) {
        updateAccountUI();
        return;
    }

    const session = activeAccountSession;
    const epoch = authEpoch;
    migrationInProgress = true;
    syncState = 'saving';
    syncErrorMessage = '';
    updateAccountUI();

    const mergedLiked = deduplicateSongs([...likedSongs, ...guest.likedSongs], 500);
    const mergedHistory = deduplicateSongs([...guest.recentlyPlayedSongs, ...recentlyPlayedSongs], HISTORY_LIMIT);
    const playlistMap = new Map();
    playlists.forEach((pl) => {
        playlistMap.set(pl.id, { ...pl, songs: pl.songs.map((s) => ({ ...s })) });
    });
    guest.playlists.forEach((guestPl) => {
        if (playlistMap.has(guestPl.id)) {
            const existing = playlistMap.get(guestPl.id);
            existing.songs = deduplicateSongs([...existing.songs, ...guestPl.songs], 300);
        } else if (playlistMap.size < 100) {
            playlistMap.set(guestPl.id, { ...guestPl, songs: guestPl.songs.map((s) => ({ ...s })) });
        }
    });
    const mergedPlaylists = Array.from(playlistMap.values()).slice(0, 100);

    try {
        const saved = await callJakuplayerRpc('jakuplayer_save_library', {
            p_liked_songs: mergedLiked,
            p_playlists: mergedPlaylists,
            p_history: mergedHistory
        }, session.token);

        if (epoch !== authEpoch || !activeAccountSession || activeAccountSession.token !== session.token) return;

        clearGuestLibraryStorage();
        sessionRemove(MIGRATION_DISMISSED_KEY);
        migrationInProgress = false;
        applyLibraryToMemory({
            likedSongs: Array.isArray(saved?.liked_songs) ? saved.liked_songs : mergedLiked,
            playlists: Array.isArray(saved?.playlists) ? saved.playlists : mergedPlaylists,
            recentlyPlayedSongs: Array.isArray(saved?.history) ? saved.history : mergedHistory
        });
        syncState = 'synced';
        syncErrorMessage = '';
        updateAccountUI();
        showToast('Zapisano lokalne utwory, playlisty i historię na koncie!');
    } catch (error) {
        if (epoch !== authEpoch || !activeAccountSession || activeAccountSession.token !== session.token) return;
        migrationInProgress = false;
        syncState = 'error';
        syncErrorMessage = error?.message || 'Nie udało się przenieść lokalnych danych na konto.';
        updateAccountUI();
        showToast(syncErrorMessage, true);
    }
}

function skipGuestMigration() {
    if (!activeAccountSession) return;
    sessionSet(MIGRATION_DISMISSED_KEY, activeAccountSession.username);
    updateAccountUI();
}

function updateAccountUI() {
    const isConnected = accountState === 'connected' && Boolean(activeAccountSession);
    const isChecking = accountState === 'checking';
    const isNetworkError = accountState === 'network_error';
    const isDisconnected = accountState === 'disconnected';
    const confirmedName = isConnected ? activeAccountSession.username : '';

    // Stan przycisków logowania / ponawiania
    dom.connectButtons.forEach((btn) => {
        btn.disabled = isChecking;
        if (isChecking) btn.setAttribute('aria-busy', 'true');
        else btn.removeAttribute('aria-busy');
    });
    dom.retryButtons.forEach((btn) => {
        btn.classList.toggle('hidden', !isNetworkError);
        btn.disabled = isChecking;
    });

    // Nagłówek i strona główna
    if (isConnected) {
        dom.headerUsername.textContent = confirmedName;
        dom.headerUsernameInitial.textContent = confirmedName.charAt(0).toUpperCase();
        dom.headerAccountDot.classList.remove('hidden');
        dom.homeGreeting.textContent = `Witaj, ${confirmedName}!`;
        if (dom.welcomeConnectButton) {
            dom.welcomeConnectButton.classList.add('hidden');
            dom.welcomeConnectButton.classList.remove('inline-flex');
        }
    } else {
        dom.headerUsername.textContent = isChecking ? 'Sprawdzam…' : 'Zapisz w chmurze';
        dom.headerUsernameInitial.innerHTML = '<i class="fas fa-cloud text-[11px]" aria-hidden="true"></i>';
        dom.headerAccountDot.classList.add('hidden');
        dom.homeGreeting.textContent = 'Czego dziś słuchamy?';
        if (dom.welcomeConnectButton) {
            dom.welcomeConnectButton.classList.remove('hidden');
            dom.welcomeConnectButton.classList.add('inline-flex');
        }
    }

    // Etykieta stanu dla gościa / odłączenia / błędu
    const guestLabel = isChecking
        ? 'Sprawdzanie konta…'
        : isDisconnected
            ? 'Odłączono w Jakuplayerze'
            : isNetworkError
                ? 'Błąd połączenia z kontem'
                : 'Tryb bez logowania';
    dom.desktopGuestLabel.textContent = guestLabel;
    dom.mobileGuestLabel.textContent = guestLabel;

    dom.desktopAccountGuest.classList.toggle('hidden', isConnected);
    dom.desktopAccountConnected.classList.toggle('hidden', !isConnected);
    dom.mobileAccountGuest.classList.toggle('hidden', isConnected);
    dom.mobileAccountConnected.classList.toggle('hidden', !isConnected);

    if (isConnected) {
        dom.desktopUsername.textContent = confirmedName;
        dom.mobileUsername.textContent = confirmedName;
        dom.modalConnectedUsername.textContent = confirmedName;
    } else {
        dom.desktopUsername.textContent = '';
        dom.mobileUsername.textContent = '';
        dom.modalConnectedUsername.textContent = '';
    }

    // Status synchronizacji dla połączonego konta
    let syncBadgeText = 'W chmurze';
    let syncDetailText = 'Polubione utwory, playlisty i historia są zapisane na koncie.';
    if (syncState === 'loading') {
        syncBadgeText = 'Wczytywanie…';
        syncDetailText = 'Pobieranie biblioteki z konta…';
    } else if (syncState === 'saving') {
        syncBadgeText = 'Zapisywanie…';
        syncDetailText = 'Zapisywanie zmian w chmurze…';
    } else if (syncState === 'error') {
        syncBadgeText = 'Błąd zapisu';
        syncDetailText = syncErrorMessage || 'Nie udało się zsynchronizować zmian.';
    }
    dom.desktopSyncBadge.textContent = syncBadgeText;
    dom.mobileSyncBadge.textContent = syncBadgeText;
    dom.desktopSyncBadge.classList.toggle('text-amber-300', syncState === 'error' || syncState === 'saving' || syncState === 'loading');
    dom.desktopSyncBadge.classList.toggle('text-emerald-400', syncState === 'synced' || syncState === 'idle');
    dom.mobileSyncBadge.classList.toggle('text-amber-300', syncState === 'error' || syncState === 'saving' || syncState === 'loading');
    dom.mobileSyncBadge.classList.toggle('text-emerald-400', syncState === 'synced' || syncState === 'idle');

    // Okno konta i synchronizacji
    dom.modalGuestSection.classList.toggle('hidden', isConnected);
    dom.modalConnectedSection.classList.toggle('hidden', !isConnected);
    dom.modalAccountStateBadge.textContent = isConnected ? 'Połączone konto' : guestLabel;
    dom.modalAccountStateBadge.className = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        isConnected
            ? 'bg-emerald-900/70 text-emerald-300 border border-emerald-700/60'
            : isNetworkError
                ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                : 'bg-slate-700 text-slate-200'
    }`;
    dom.modalSyncStatus.textContent = syncDetailText;
    dom.modalLikedCount.textContent = String(likedSongs.length);
    dom.modalPlaylistsCount.textContent = String(playlists.length);
    dom.modalHistoryCount.textContent = String(recentlyPlayedSongs.length);
    dom.syncRetryButtons.forEach((btn) => {
        btn.classList.toggle('hidden', !(isConnected && syncState === 'error'));
    });

    // Komunikaty statusu
    const statusText = accountStatusMessage || (isConnected && syncState === 'error' ? syncErrorMessage : '');
    dom.desktopAccountStatus.textContent = statusText;
    dom.mobileAccountStatus.textContent = statusText;
    dom.modalAccountStatus.textContent = statusText;

    // Baner zachęcający dla niezalogowanych (opcjonalny, można zamknąć na czas wizyty)
    const promoDismissed = sessionGet(PROMO_DISMISSED_KEY) === '1';
    dom.syncPromoBanner.classList.toggle('hidden', isConnected || promoDismissed);
    if (!isConnected) {
        const currentGuestCounts = summarizeLibraryCounts({ likedSongs, playlists, recentlyPlayedSongs });
        dom.syncPromoText.textContent = currentGuestCounts
            ? `Masz teraz lokalnie: ${currentGuestCounts}. Zaloguj się przez rejson59.github.io, aby zapisać swoje polubione utwory, playlisty i historię oraz przenosić je na inne urządzenia.`
            : 'Możesz słuchać bez logowania. Zaloguj się przez rejson59.github.io, aby zapisać swoje polubione utwory, playlisty i historię oraz przenosić je na inne urządzenia.';
    }

    // Propozycja bezpiecznego przeniesienia danych gościa na konto po zalogowaniu
    const guestOnDisk = isConnected && accountLibraryLoaded ? readGuestLibrary() : { likedSongs: [], playlists: [], recentlyPlayedSongs: [] };
    const migrationDismissedForUser = isConnected && sessionGet(MIGRATION_DISMISSED_KEY) === confirmedName;
    const showMigration = isConnected && accountLibraryLoaded && hasLibraryItems(guestOnDisk) && !migrationDismissedForUser;

    dom.guestMigrationBanner.classList.toggle('hidden', !showMigration);
    dom.modalMigrationBox.classList.toggle('hidden', !showMigration);
    if (showMigration) {
        const summary = summarizeLibraryCounts(guestOnDisk);
        const promptText = `Na tym urządzeniu zapisano wcześniej lokalne dane (${summary}). Czy chcesz zapisać je na koncie ${confirmedName}, aby mieć do nich dostęp na innych urządzeniach?`;
        dom.guestMigrationText.textContent = promptText;
        dom.modalMigrationText.textContent = promptText;
        dom.migrateGuestDataButton.disabled = migrationInProgress;
        dom.modalMigrateButton.disabled = migrationInProgress;
    }
    restorePlaybackIfEligible();
}

function openAccountModal() {
    dom.accountModal.classList.add('open');
    dom.mobileMenu.classList.remove('open');
}

function closeAccountModal() {
    dom.accountModal.classList.remove('open');
}

function bindRejsonAccountBridge() {
    if (!window.RejsonAccount || accountSubscriptionCleanup) return;
    if (typeof window.RejsonAccount.subscribe === 'function') {
        accountSubscriptionCleanup = window.RejsonAccount.subscribe(() => {
            verifyAccountSession(false);
        });
    }
    verifyAccountSession(false);
}

function showWelcomePage() {
    [dom.homePage, dom.favoritesPage, dom.playlistsPage, dom.historyPage, dom.queuePage]
        .forEach((page) => page.classList.add('hidden'));
    dom.welcomePage.classList.remove('hidden');
}

function showPage(pageName) {
    const pages = {
        home: dom.homePage,
        favorites: dom.favoritesPage,
        playlists: dom.playlistsPage,
        history: dom.historyPage,
        queue: dom.queuePage
    };
    if (!pages[pageName]) return;

    dom.welcomePage.classList.add('hidden');
    Object.values(pages).forEach((page) => page.classList.add('hidden'));
    pages[pageName].classList.remove('hidden');

    if (pageName === 'favorites') loadFavorites();
    if (pageName === 'playlists') loadPlaylists();
    if (pageName === 'history') loadHistory();
    if (pageName === 'queue') renderQueue();

    dom.menuLinks.forEach((link) => {
        const active = link.dataset.page === pageName;
        link.classList.toggle('bg-blue-900', active);
        link.classList.toggle('text-white', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

function createYouTubePlayer() {
    if (player || !window.YT || typeof window.YT.Player !== 'function') return;

    const playerVars = {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        playsinline: 1,
        rel: 0
    };
    if (/^https?:$/.test(window.location.protocol) && window.location.origin !== 'null') {
        playerVars.origin = window.location.origin;
    }

    try {
        player = new YT.Player('youtube-player', {
            width: '200',
            height: '200',
            playerVars,
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: onPlayerError,
                onAutoplayBlocked: () => showToast('Naciśnij przycisk odtwarzania, aby rozpocząć.', true)
            }
        });
    } catch (error) {
        console.error('Nie udało się utworzyć odtwarzacza YouTube:', error);
        showToast('Nie udało się uruchomić odtwarzacza YouTube.', true);
    }
}

function loadYouTubeAPI() {
    window.onYouTubeIframeAPIReady = createYouTubePlayer;
    if (window.YT && typeof window.YT.Player === 'function') {
        createYouTubePlayer();
        return;
    }
    if (byId('youtube-iframe-api')) return;

    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => showToast('Nie można połączyć się z odtwarzaczem YouTube.', true);
    document.head.appendChild(tag);
}

function onPlayerReady(event) {
    player = event.target;
    playerReady = true;
    adBlocker.attach(player);
    updateVolume();

    if (currentSong && resumePosition === null) {
        loadCurrentSong();
    } else if (currentSong && resumeRequested) {
        startResumedSong();
    }
}

function onPlayerError(event) {
    const messages = {
        2: 'Nieprawidłowy identyfikator filmu.',
        5: 'Ten film nie może być odtworzony w tej przeglądarce.',
        100: 'Film został usunięty lub jest prywatny.',
        101: 'Właściciel filmu zablokował osadzanie.',
        150: 'Właściciel filmu zablokował osadzanie.'
    };
    isPlaying = false;
    updatePlayButtons();
    showToast(messages[event.data] || 'Wystąpił błąd odtwarzania. Spróbuj innego utworu.', true);
}

function onPlayerStateChange(event) {
    const wasAdActive = adBlocker.isAdActive();
    adBlocker.check();

    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        updatePlayButtons();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        updatePlayButtons();
    } else if (event.data === YT.PlayerState.ENDED) {
        // Some embeds emit ENDED for an ad break. It must not advance the queue.
        if (wasAdActive) {
            adBlocker.endAd();
            return;
        }

        isPlaying = false;
        updatePlayButtons();
        if (isRepeatOn && currentSong) {
            restartCurrentSong();
        } else {
            playNext(true);
        }
    }
}

function loadCurrentSong() {
    if (!playerReady || !currentSong) return;
    try {
        player.loadVideoById(currentSong.id);
    } catch (error) {
        console.error('Błąd ładowania filmu:', error);
        showToast('Nie udało się załadować wybranego utworu.', true);
    }
}

function playFromQueue(songs, index) {
    const queue = songs.map(normalizeSong).filter(Boolean);
    if (!queue.length) return;

    playbackQueue = queue;
    currentQueueIndex = Math.max(0, Math.min(index, queue.length - 1));
    playSong(playbackQueue[currentQueueIndex]);
}

function playQueueIndex(index) {
    if (index < 0 || index >= playbackQueue.length) return;
    currentQueueIndex = index;
    playSong(playbackQueue[index]);
}

function playSong(song) {
    const normalized = normalizeSong(song);
    if (!normalized) return;

    currentSong = normalized;
    resumePosition = null;
    resumeRequested = false;
    lastKnownPosition = 0;
    playbackTouched = true;
    isPlaying = false;
    adBlocker.setVideo(normalized.id);
    resetProgress();
    updateCurrentSongUI();
    updatePlayButtons();
    updateActiveCards();
    renderQueue();
    updateMediaSession();
    addToRecentlyPlayed(normalized);
    savePlayback(0);

    if (playerReady) {
        loadCurrentSong();
    } else if (!playerLoadingToastShown) {
        playerLoadingToastShown = true;
        showToast('Odtwarzacz jest ładowany. Odtwarzanie rozpocznie się automatycznie.');
    }
}

function updateCurrentSongUI() {
    if (!currentSong) return;
    dom.currentSongTitle.textContent = currentSong.title;
    dom.currentSongArtist.textContent = currentSong.artist;
    dom.mobileCurrentSongTitle.textContent = currentSong.title;
    dom.mobileCurrentSongArtist.textContent = currentSong.artist;
    dom.currentSongImage.innerHTML = artworkMarkup(currentSong, 'w-full h-full rounded-lg object-cover');
    dom.mobileCurrentSongImage.innerHTML = artworkMarkup(currentSong, 'w-full h-full rounded-lg object-cover');
    updateLikeButtons(currentSong.id);
}

function updatePlayButtons() {
    const icon = isPlaying ? 'fas fa-pause' : 'fas fa-play';
    setIcon(dom.playButton, icon);
    setIcon(dom.mobilePlayButton, icon);
    dom.playButton.setAttribute('aria-label', isPlaying ? 'Wstrzymaj' : 'Odtwarzaj');
    dom.mobilePlayButton.setAttribute('aria-label', isPlaying ? 'Wstrzymaj' : 'Odtwarzaj');
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

function pickFallbackSongsForPlay() {
    if (dom.favoritesPage && !dom.favoritesPage.classList.contains('hidden') && likedSongs.length) {
        return likedSongs;
    }
    if (dom.historyPage && !dom.historyPage.classList.contains('hidden') && recentlyPlayedSongs.length) {
        return recentlyPlayedSongs;
    }
    if (displayedHomeSongs.length) {
        return displayedHomeSongs;
    }
    return [];
}

function togglePlay() {
    if (!currentSong) {
        if (playbackQueue.length) {
            playQueueIndex(0);
            return;
        }
        const fallbackSongs = pickFallbackSongsForPlay();
        if (fallbackSongs.length) {
            if (dom.welcomePage && !dom.welcomePage.classList.contains('hidden')) {
                showPage('home');
            }
            playFromQueue(fallbackSongs, 0);
            return;
        }
        showToast('Najpierw wybierz utwór.');
        return;
    }
    if (!playerReady) {
        if (resumePosition !== null) resumeRequested = true;
        showToast('Odtwarzacz jest jeszcze ładowany.');
        return;
    }

    try {
        playbackTouched = true;
        if (resumePosition !== null) startResumedSong();
        else if (isPlaying) player.pauseVideo();
        else player.playVideo();
    } catch (_) {
        showToast('Nie udało się zmienić stanu odtwarzania.', true);
    }
}

function startResumedSong() {
    if (!playerReady || !currentSong || resumePosition === null) return;
    const position = resumePosition;
    try {
        player.loadVideoById({ videoId: currentSong.id, startSeconds: position });
        resumePosition = null;
        resumeRequested = false;
        lastKnownPosition = position;
        playbackTouched = true;
        savePlayback(position);
    } catch (_) {
        showToast('Nie udało się wznowić utworu.', true);
    }
}

function restartCurrentSong() {
    if (!playerReady || !currentSong || adBlocker.isAdActive()) return;
    try {
        player.seekTo(0, true);
        player.playVideo();
    } catch (_) {
        showToast('Nie udało się rozpocząć utworu ponownie.', true);
    }
}

function playPrevious() {
    if (!currentSong) {
        showToast('Najpierw wybierz utwór.');
        return;
    }
    if (playerReady) {
        const elapsed = Number(player.getCurrentTime()) || 0;
        if (elapsed > 3) {
            restartCurrentSong();
            return;
        }
    }

    const index = currentQueueIndex;
    if (index > 0) playQueueIndex(index - 1);
    else if (playerReady) restartCurrentSong();
    else showToast('Odtwarzacz jest jeszcze ładowany.');
}

function playNext(fromEnded = false) {
    if (!currentSong) {
        if (!fromEnded) {
            if (playbackQueue.length) {
                playQueueIndex(0);
                return;
            }
            const fallbackSongs = pickFallbackSongsForPlay();
            if (fallbackSongs.length) {
                if (dom.welcomePage && !dom.welcomePage.classList.contains('hidden')) {
                    showPage('home');
                }
                const startIndex = isShuffleOn && fallbackSongs.length > 1
                    ? Math.floor(Math.random() * fallbackSongs.length)
                    : 0;
                playFromQueue(fallbackSongs, startIndex);
                return;
            }
            showToast('Najpierw wybierz utwór.');
        }
        return;
    }

    if (!playbackQueue.length && isShuffleOn && likedSongs.length) {
        playbackQueue = likedSongs.map(normalizeSong).filter(Boolean);
    }
    if (!playbackQueue.length) {
        if (!fromEnded) restartCurrentSong();
        return;
    }

    const currentIndex = currentQueueIndex;
    let nextIndex;

    if (isShuffleOn && playbackQueue.length > 1) {
        do {
            nextIndex = Math.floor(Math.random() * playbackQueue.length);
        } while (nextIndex === currentIndex);
    } else {
        nextIndex = currentIndex + 1;
    }

    if (nextIndex < 0 || nextIndex >= playbackQueue.length) {
        if (fromEnded) return;
        nextIndex = 0;
    }
    playQueueIndex(nextIndex);
}

// Stan odtwarzania nie zawiera tokenów i jest przechowywany tylko w tej karcie.
function savePlayback(positionOverride) {
    if (accountState === 'checking' || accountState === 'network_error') return;
    if (!playbackTouched) return;
    let position = Number.isFinite(positionOverride) ? positionOverride : (resumePosition ?? lastKnownPosition);
    if (!Number.isFinite(positionOverride) && resumePosition === null && playerReady && currentSong && !adBlocker.isAdActive()) {
        try { position = Number(player.getCurrentTime()) || 0; } catch (_) { /* API może być niedostępne. */ }
    }
    sessionSet(PLAYBACK_SESSION_KEY, JSON.stringify({
        version: 1, owner: activeAccountSession ? activeAccountSession.username : null,
        queue: playbackQueue.slice(0, 500), index: currentQueueIndex,
        position: Math.max(0, Math.min(position, 86400))
    }));
}

function restorePlaybackIfEligible() {
    if (playbackRestoreAttempted || playbackTouched || accountState === 'checking' || accountState === 'network_error') return;
    playbackRestoreAttempted = true;
    try {
        const saved = JSON.parse(sessionGet(PLAYBACK_SESSION_KEY) || 'null');
        const owner = activeAccountSession ? activeAccountSession.username : null;
        if (!saved || saved.version !== 1 || saved.owner !== owner || !Array.isArray(saved.queue) || saved.queue.length > 500) return;
        const queue = saved.queue.map(normalizeSong);
        if (queue.some((song) => !song)) return;
        const index = Number(saved.index);
        if (!Number.isInteger(index) || index < -1 || index >= queue.length) return;
        playbackQueue = queue;
        currentQueueIndex = index;
        if (index >= 0) {
            currentSong = queue[index];
            resumePosition = Math.max(0, Math.min(Number(saved.position) || 0, 86400));
            lastKnownPosition = resumePosition;
            adBlocker.setVideo(currentSong.id);
            updateCurrentSongUI();
            updatePlayButtons();
            updateActiveCards();
            updateMediaSession();
            dom.currentTime.textContent = formatTime(resumePosition);
            dom.mobileCurrentTime.textContent = formatTime(resumePosition);
        }
        playbackTouched = true;
        renderQueue();
    } catch (_) { /* Uszkodzony zapis nie blokuje aplikacji. */ }
}

function setSleepTimer() {
    const minutes = Number(dom.sleepTimer.value);
    window.clearTimeout(sleepTimeout);
    sleepDeadline = minutes > 0 ? Date.now() + minutes * 60000 : 0;
    dom.sleepTimerStatus.textContent = minutes > 0 ? `Ustawiono na ${minutes} min` : 'Timer wyłączony';
    if (sleepDeadline) sleepTimeout = window.setTimeout(checkSleepTimer, minutes * 60000);
}

function checkSleepTimer() {
    if (!sleepDeadline || Date.now() < sleepDeadline) return;
    sleepDeadline = 0;
    window.clearTimeout(sleepTimeout);
    dom.sleepTimer.value = '0';
    dom.sleepTimerStatus.textContent = 'Timer zakończony — odtwarzanie zatrzymane';
    resumeRequested = false;
    if (currentSong && !playerReady) resumePosition = 0;
    if (playerReady && currentSong) {
        try { player.pauseVideo(); } catch (_) { /* Odtwarzacz może być niedostępny. */ }
    }
    isPlaying = false;
    updatePlayButtons();
    savePlayback();
    showToast('Timer snu zatrzymał odtwarzanie.');
}

function encodeSharedPlaylist(playlist) {
    const ids = playlist.songs.map((song) => song.id);
    if (!ids.length || ids.length > 300 || ids.some((id) => !/^[A-Za-z0-9_-]{11}$/.test(id))) return null;
    const encode = (data) => btoa(unescape(encodeURIComponent(JSON.stringify(data))))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const data = { v: 1, n: playlist.name.slice(0, 80), ids,
        meta: playlist.songs.map((song) => [song.title.slice(0, 150), song.artist.slice(0, 150)]) };
    let encoded = encode(data);
    if (encoded.length > 9000) {
        delete data.meta;
        encoded = encode(data);
    }
    return encoded.length <= 9000 ? encoded : null;
}

function decodeSharedPlaylist(encoded) {
    if (!encoded || encoded.length > 9000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
    try {
        const json = decodeURIComponent(escape(atob(encoded.replace(/-/g, '+').replace(/_/g, '/'))));
        const data = JSON.parse(json);
        if (data.v !== 1 || typeof data.n !== 'string' || !data.n.trim() || data.n.length > 80 ||
            !Array.isArray(data.ids) || !data.ids.length || data.ids.length > 300 ||
            data.ids.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(id))) return null;
        if (data.meta !== undefined && (!Array.isArray(data.meta) || data.meta.length !== data.ids.length ||
            data.meta.some((entry) => !Array.isArray(entry) || entry.length !== 2 || entry.some((x) => typeof x !== 'string' || x.length > 150)))) return null;
        return makePlaylist(data.n, data.ids.map((id, index) => ({ id,
            title: data.meta?.[index][0] || `Utwór YouTube (${id})`,
            artist: data.meta?.[index][1] || 'YouTube', thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` })));
    } catch (_) { return null; }
}

async function shareCurrentPlaylist() {
    if (!selectedPlaylistForDetail) return;
    let encoded;
    try { encoded = encodeSharedPlaylist(selectedPlaylistForDetail); } catch (_) { encoded = null; }
    if (!encoded) return showToast('Link wymaga niepustej playlisty z prawidłowymi filmami YouTube.', true);
    const url = new URL(window.location.href);
    url.hash = `playlist=${encoded}`;
    try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
        await navigator.clipboard.writeText(url.href);
        showToast('Link skopiowany. Każdy z linkiem może zobaczyć playlistę.');
    } catch (_) {
        window.prompt('Skopiuj link do playlisty (każdy z linkiem może ją zobaczyć):', url.href);
    }
}

function openSharedPlaylistFromLink() {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (!hash.has('playlist')) return;
    sharedPlaylist = decodeSharedPlaylist(hash.get('playlist'));
    if (!sharedPlaylist) return showToast('Nieprawidłowy lub zbyt długi link do playlisty.', true);
    dom.sharedTitle.textContent = `Udostępniona playlista: ${sharedPlaylist.name}`;
    dom.sharedDescription.textContent = `${formatSongCount(sharedPlaylist.songs.length)}. Link jest kopią — późniejsze zmiany autora nie są synchronizowane.`;
    const list = byId('shared-playlist-tracks');
    list.replaceChildren();
    sharedPlaylist.songs.forEach((song) => {
        const item = document.createElement('li');
        item.textContent = `${song.title} — ${song.artist}`;
        list.appendChild(item);
    });
    dom.sharedSection.classList.remove('hidden');
    showPage('home');
}

function dismissSharedPlaylist() {
    sharedPlaylist = null;
    dom.sharedSection.classList.add('hidden');
    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.hash.slice(1));
    params.delete('playlist');
    url.hash = params.toString();
    window.history.replaceState(null, '', url.href);
}

function importSharedPlaylist() {
    if (!sharedPlaylist || !canMutateLibrary()) return;
    if (playlists.length >= 100) return showToast('Osiągnięto limit 100 playlist.', true);
    playlists.push(makePlaylist(sharedPlaylist.name, sharedPlaylist.songs));
    persistSection('playlists');
    loadPlaylists();
    dismissSharedPlaylist();
    showToast('Zapisano kopię playlisty.');
}

function invalidateRecommendations() {
    recommendationsEpoch += 1;
    if (dom.recommendationsResults) dom.recommendationsResults.replaceChildren();
    if (dom.recommendationsDescription) dom.recommendationsDescription.textContent = 'Wyszukaj propozycje podobne do ostatnio słuchanego wykonawcy.';
    if (dom.recommendationsButton) dom.recommendationsButton.disabled = false;
}

async function loadRecommendations() {
    const source = recentlyPlayedSongs.find((song) => song.artist && !['YouTube', 'Nieznany wykonawca'].includes(song.artist));
    if (!source) return showToast('Posłuchaj najpierw kilku utworów z wyszukiwarki.', true);
    const request = ++recommendationsEpoch;
    dom.recommendationsButton.disabled = true;
    dom.recommendationsDescription.textContent = `Szukam propozycji na podstawie: ${source.artist}…`;
    dom.recommendationsResults.replaceChildren();
    try {
        const query = `${source.artist} muzyka`;
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(query)}&type=video&key=${API_KEY}`);
        const data = await response.json();
        if (!response.ok || data.error) throw new Error('search failed');
        if (request !== recommendationsEpoch) return;
        const seen = new Set(recentlyPlayedSongs.map((song) => song.id));
        const songs = (Array.isArray(data.items) ? data.items : []).map((item) => normalizeSong({
            id: item?.id?.videoId, title: item?.snippet?.title, artist: item?.snippet?.channelTitle,
            thumbnail: item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url
        })).filter((song) => {
            if (!song || seen.has(song.id)) return false;
            seen.add(song.id);
            return true;
        }).slice(0, 6);
        dom.recommendationsDescription.textContent = `Na podstawie ostatnio słuchanego wykonawcy: ${source.artist}`;
        renderSongCollection(dom.recommendationsResults, songs, 'Nie znaleziono nowych propozycji.');
    } catch (_) {
        if (request !== recommendationsEpoch) return;
        dom.recommendationsDescription.textContent = 'Nie udało się pobrać propozycji. Sprawdź połączenie lub spróbuj później.';
    } finally {
        if (request === recommendationsEpoch) dom.recommendationsButton.disabled = false;
    }
}

// Kolejka jest osobna od zapisanej biblioteki i pozostaje w bieżącej karcie.

function addSongToQueue(song) {
    const normalized = normalizeSong(song);
    if (!normalized) return;
    if (playbackQueue.length >= 500) return showToast('Kolejka może zawierać maksymalnie 500 utworów.', true);
    playbackQueue.push(normalized);
    playbackTouched = true;
    renderQueue();
    savePlayback();
    showToast('Dodano do kolejki.');
}

function clearQueue() {
    if (!playbackQueue.length) return showToast('Kolejka jest już pusta.');
    if (currentSong && currentQueueIndex >= 0) {
        playbackQueue = [playbackQueue[currentQueueIndex]];
        currentQueueIndex = 0;
    } else {
        playbackQueue = [];
        currentQueueIndex = -1;
    }
    playbackTouched = true;
    renderQueue();
    savePlayback();
    showToast('Wyczyszczono kolejkę.');
}

function renderQueue() {
    if (!dom.queueResults) return;
    if (!playbackQueue.length) {
        dom.queueResults.innerHTML = '<p class="text-slate-400">Kolejka jest pusta. Dodaj utwór lub rozpocznij odtwarzanie.</p>';
        return;
    }
    const fragment = document.createDocumentFragment();
    playbackQueue.forEach((song, index) => {
        const row = document.createElement('div');
        const current = index === currentQueueIndex && Boolean(currentSong);
        row.className = `flex items-center gap-2 rounded-xl border p-3 ${current ? 'border-blue-500 bg-blue-900/30' : 'border-slate-700 bg-slate-800/60'}`;
        row.innerHTML = `
            <button type="button" class="queue-play flex-1 min-w-0 text-left" aria-label="Odtwórz ${escapeHTML(song.title)}">
                <span class="block truncate font-medium">${escapeHTML(song.title)}</span>
                <span class="block truncate text-slate-400 text-sm">${current ? 'Teraz odtwarzane · ' : ''}${escapeHTML(song.artist)}</span>
            </button>
            <button type="button" class="queue-up p-2 text-slate-300 hover:text-white disabled:opacity-30" aria-label="Przesuń w górę" ${index === 0 ? 'disabled' : ''}><i class="fas fa-chevron-up" aria-hidden="true"></i></button>
            <button type="button" class="queue-down p-2 text-slate-300 hover:text-white disabled:opacity-30" aria-label="Przesuń w dół" ${index === playbackQueue.length - 1 ? 'disabled' : ''}><i class="fas fa-chevron-down" aria-hidden="true"></i></button>
            <button type="button" class="queue-remove p-2 text-slate-300 hover:text-red-400 disabled:opacity-30" aria-label="Usuń z kolejki" ${current ? 'disabled' : ''}><i class="fas fa-times" aria-hidden="true"></i></button>`;
        row.querySelector('.queue-play').addEventListener('click', () => playQueueIndex(index));
        const move = (to) => {
            [playbackQueue[index], playbackQueue[to]] = [playbackQueue[to], playbackQueue[index]];
            if (currentQueueIndex === index) currentQueueIndex = to;
            else if (currentQueueIndex === to) currentQueueIndex = index;
            playbackTouched = true;
            renderQueue();
            savePlayback();
            const movedRow = dom.queueResults.children[to];
            const direction = to < index ? '.queue-up' : '.queue-down';
            const control = movedRow.querySelector(direction);
            (control.disabled ? movedRow.querySelector('.queue-play') : control).focus();
        };
        row.querySelector('.queue-up').addEventListener('click', () => move(index - 1));
        row.querySelector('.queue-down').addEventListener('click', () => move(index + 1));
        row.querySelector('.queue-remove').addEventListener('click', () => {
            playbackQueue.splice(index, 1);
            if (index < currentQueueIndex) currentQueueIndex -= 1;
            playbackTouched = true;
            renderQueue();
            savePlayback();
            showToast('Usunięto z kolejki.');
        });
        fragment.appendChild(row);
    });
    dom.queueResults.replaceChildren(fragment);
}

function clearHistory() {
    if (!recentlyPlayedSongs.length) return showToast('Historia jest już pusta.');
    if (!canMutateLibrary()) return;
    if (!window.confirm('Czy na pewno chcesz wyczyścić historię odtwarzania?')) return;
    recentlyPlayedSongs = [];
    invalidateRecommendations();
    persistSection('history');
    loadHistory();
    updateAccountUI();
    showToast('Wyczyszczono historię odtwarzania.');
}

function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const handlers = {
        play: () => { if (!isPlaying) togglePlay(); },
        pause: () => { if (isPlaying) togglePlay(); },
        previoustrack: playPrevious,
        nexttrack: () => playNext()
    };
    Object.entries(handlers).forEach(([action, handler]) => {
        try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) { /* Nieobsługiwana akcja. */ }
    });
}

function updateMediaSession() {
    if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function' || !currentSong) return;
    try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
            title: currentSong.title,
            artist: currentSong.artist,
            artwork: currentSong.thumbnail ? [{ src: currentSong.thumbnail }] : []
        });
    } catch (_) { /* Odtwarzanie działa także bez Media Session. */ }
}

function seekTo() {
    if (!playerReady || !currentSong || adBlocker.isAdActive()) return;
    const durationValue = Number(player.getDuration());
    if (!Number.isFinite(durationValue) || durationValue <= 0) return;
    const position = (Number(dom.progressBar.value) / 100) * durationValue;
    player.seekTo(position, true);
    lastKnownPosition = position;
    savePlayback(position);
}

function seekToMobile() {
    if (!playerReady || !currentSong || adBlocker.isAdActive()) return;
    const durationValue = Number(player.getDuration());
    if (!Number.isFinite(durationValue) || durationValue <= 0) return;

    const percent = Number(dom.mobileProgressBar.value);
    const seekTime = (percent / 100) * durationValue;
    player.seekTo(seekTime, true);
    lastKnownPosition = seekTime;
    dom.mobileProgressFill.style.width = `${percent}%`;
    updateMobileTimeDisplays(seekTime, durationValue);
    savePlayback(seekTime);
}

function formatTime(seconds) {
    const safeSeconds = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const remainingSeconds = safeSeconds % 60;
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function updateMobileTimeDisplays(currentSeconds, durationSeconds) {
    dom.mobileCurrentTime.textContent = formatTime(currentSeconds);
    dom.mobileDuration.textContent = formatTime(durationSeconds);
}

function resetProgress() {
    dom.progressBar.value = '0';
    dom.mobileProgressBar.value = '0';
    dom.mobileProgressFill.style.width = '0%';
    dom.currentTime.textContent = '0:00';
    dom.duration.textContent = '0:00';
    updateMobileTimeDisplays(0, 0);
}

function updatePlaybackUI() {
    if (!playerReady || !currentSong || resumePosition !== null || adBlocker.isAdActive()) return;

    try {
        const currentTimeValue = Number(player.getCurrentTime());
        const durationValue = Number(player.getDuration());
        if (!Number.isFinite(currentTimeValue) || !Number.isFinite(durationValue) || durationValue <= 0) return;

        lastKnownPosition = currentTimeValue;
        const percent = Math.min(100, Math.max(0, (currentTimeValue / durationValue) * 100));
        if (!isSeeking) {
            dom.progressBar.value = String(percent);
            dom.currentTime.textContent = formatTime(currentTimeValue);
            dom.duration.textContent = formatTime(durationValue);
        }
        if (!isTouching) {
            dom.mobileProgressBar.value = String(percent);
            dom.mobileProgressFill.style.width = `${percent}%`;
            updateMobileTimeDisplays(currentTimeValue, durationValue);
        }
    } catch (_) {
        // The API can be temporarily unavailable while replacing a video.
    }
}

function updateVolume(unmute = false) {
    const value = Math.min(100, Math.max(0, Number(dom.volumeBar.value) || 0));
    currentVolume = value;
    if (value > 0) lastNonZeroVolume = value;
    adBlocker.setPreferredVolume(value);

    if (playerReady && !adBlocker.isAdActive()) {
        try {
            player.setVolume(value);
            if (unmute === true && value > 0 && typeof player.unMute === 'function') player.unMute();
        } catch (_) {
            // Keep the selected value and apply it when the player is ready.
        }
    }

    const icon = value === 0
        ? 'fas fa-volume-mute'
        : (value < 50 ? 'fas fa-volume-down' : 'fas fa-volume-up');
    setIcon(dom.volumeButton, icon);
    dom.volumeButton.setAttribute('aria-label', value === 0 ? 'Włącz dźwięk' : 'Wycisz');
}

function toggleVolume() {
    dom.volumeBar.value = String(currentVolume === 0 ? lastNonZeroVolume : 0);
    updateVolume(true);
}

function toggleShuffle() {
    isShuffleOn = !isShuffleOn;
    [dom.shuffleButton, dom.mobileShuffleButton].forEach((button) => {
        if (!button) return;
        button.classList.toggle('text-blue-400', isShuffleOn);
        button.classList.toggle('text-slate-400', !isShuffleOn);
        button.setAttribute('aria-pressed', String(isShuffleOn));
    });
    showToast(isShuffleOn ? 'Losowe odtwarzanie włączone.' : 'Losowe odtwarzanie wyłączone.');
}

function toggleRepeat() {
    isRepeatOn = !isRepeatOn;
    [dom.repeatButton, dom.mobileRepeatButton].forEach((button) => {
        if (!button) return;
        button.classList.toggle('text-blue-400', isRepeatOn);
        button.classList.toggle('text-slate-400', !isRepeatOn);
        button.setAttribute('aria-pressed', String(isRepeatOn));
    });
    showToast(isRepeatOn ? 'Powtarzanie utworu włączone.' : 'Powtarzanie utworu wyłączone.');
}

function toggleLikeSong(song) {
    const normalized = normalizeSong(song);
    if (!normalized || !canMutateLibrary()) return;

    const index = likedSongs.findIndex((item) => item.id === normalized.id);
    if (index === -1) {
        if (likedSongs.length >= 500) {
            showToast('Osiągnięto limit 500 polubionych utworów.', true);
            return;
        }
        likedSongs.push(normalized);
    } else {
        likedSongs.splice(index, 1);
    }

    persistSection('liked');
    updateLikeButtons(normalized.id);
    updateFavoritesCount();
    if (!dom.favoritesPage.classList.contains('hidden')) loadFavorites();
}

function toggleCurrentLike() {
    if (currentSong) toggleLikeSong(currentSong);
    else showToast('Najpierw wybierz utwór.');
}

function updateLikeButtons(videoId) {
    const liked = likedSongs.some((song) => song.id === videoId);
    document.querySelectorAll('.song-card .like-button').forEach((button) => {
        if (button.closest('.song-card').dataset.songId !== videoId) return;
        setIcon(button, `${liked ? 'fas' : 'far'} fa-heart`);
        button.classList.toggle('text-red-500', liked);
        button.classList.toggle('text-slate-400', !liked);
        button.setAttribute('aria-pressed', String(liked));
    });

    if (currentSong && currentSong.id === videoId) {
        setIcon(dom.likeButton, `${liked ? 'fas text-red-500' : 'far'} fa-heart`);
        setIcon(dom.mobileLikeButton, `${liked ? 'fas text-red-500' : 'far'} fa-heart text-xl`);
        dom.likeButton.setAttribute('aria-pressed', String(liked));
        dom.mobileLikeButton.setAttribute('aria-pressed', String(liked));
    }
}

function updateActiveCards() {
    document.querySelectorAll('.song-card').forEach((card) => {
        card.classList.toggle('active-song', Boolean(currentSong && card.dataset.songId === currentSong.id));
    });
}

function createSongCard(song, options = {}) {
    const settings = {
        showLike: options.showLike !== false,
        showAdd: options.showAdd !== false,
        showRemove: Boolean(options.showRemove),
        onPlay: options.onPlay || (() => playFromQueue([song], 0)),
        onRemove: options.onRemove || null
    };
    const liked = likedSongs.some((item) => item.id === song.id);
    const card = document.createElement('div');
    card.className = `song-card flex items-center p-3 rounded-lg bg-slate-800/50 cursor-pointer${currentSong && currentSong.id === song.id ? ' active-song' : ''}`;
    card.dataset.songId = song.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Odtwórz ${song.title}`);

    const actions = settings.showRemove
        ? `<button class="remove-from-playlist text-slate-400 hover:text-red-500 ml-2" aria-label="Usuń z playlisty"><i class="fas fa-times"></i></button>`
        : `<div class="flex space-x-2">
                ${settings.showLike ? `<button class="like-button ${liked ? 'text-red-500' : 'text-slate-400'} hover:text-red-500 ml-2" aria-label="Przełącz ulubione" aria-pressed="${liked}"><i class="${liked ? 'fas' : 'far'} fa-heart"></i></button>` : ''}
                ${settings.showAdd ? '<button class="add-to-playlist-button text-slate-400 hover:text-blue-500" aria-label="Dodaj do playlisty"><i class="fas fa-plus"></i></button>' : ''}
           </div>`;

    card.innerHTML = `
        <div class="relative mr-3 shrink-0">
            <div class="w-12 h-12 rounded-lg bg-slate-700 flex items-center justify-center overflow-hidden">
                ${artworkMarkup(song, 'w-12 h-12 rounded-lg object-cover')}
            </div>
            <div class="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                <i class="fas fa-play text-white"></i>
            </div>
        </div>
        <div class="flex-1 min-w-0">
            <h4 class="font-medium truncate">${escapeHTML(song.title)}</h4>
            <p class="text-slate-400 text-sm truncate">${escapeHTML(song.artist)}</p>
        </div>
        <button type="button" class="queue-add-button text-slate-400 hover:text-blue-400 px-2" aria-label="Dodaj do kolejki" title="Dodaj do kolejki"><i class="fas fa-stream" aria-hidden="true"></i></button>
        ${actions}
    `;

    card.addEventListener('click', settings.onPlay);
    card.addEventListener('keydown', (event) => {
        if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            settings.onPlay();
        }
    });

    card.querySelector('.queue-add-button').addEventListener('click', (event) => {
        event.stopPropagation();
        addSongToQueue(song);
    });

    const likeButton = card.querySelector('.like-button');
    if (likeButton) {
        likeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleLikeSong(song);
        });
    }

    const addButton = card.querySelector('.add-to-playlist-button');
    if (addButton) {
        addButton.addEventListener('click', (event) => {
            event.stopPropagation();
            showAddToPlaylistModal(song);
        });
    }

    const removeButton = card.querySelector('.remove-from-playlist');
    if (removeButton && settings.onRemove) {
        removeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            settings.onRemove(song.id);
        });
    }

    return card;
}

function renderSongCollection(container, songs, emptyMessage, options = {}) {
    updateActiveCards();
    if (!songs.length) {
        container.innerHTML = `<div class="text-slate-400 italic col-span-full">${emptyMessage}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    songs.forEach((song, index) => {
        fragment.appendChild(createSongCard(song, {
            ...options,
            onPlay: () => playFromQueue(songs, index)
        }));
    });
    container.replaceChildren(fragment);
}

function extractYouTubeVideoId(input) {
    if (typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        if (host === 'youtu.be') {
            const candidate = parsed.pathname.split('/').filter(Boolean)[0] || '';
            return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
        }
        if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
            const vParam = parsed.searchParams.get('v');
            if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) return vParam;
            const segments = parsed.pathname.split('/').filter(Boolean);
            if ((segments[0] === 'shorts' || segments[0] === 'embed' || segments[0] === 'live') && /^[A-Za-z0-9_-]{11}$/.test(segments[1] || '')) {
                return segments[1];
            }
        }
    } catch (_) {
        // Zwykłe zapytanie wyszukiwania.
    }
    return null;
}

function cancelPendingSearch() {
    searchRequestId += 1;
    if (searchController) searchController.abort();
    searchController = null;
}

function loadStarterSongs() {
    cancelPendingSearch();
    displayedHomeSongs = STARTER_SONGS.map(normalizeSong).filter(Boolean);
    renderSongCollection(dom.searchResults, displayedHomeSongs, 'Wpisz czego szukasz w polu wyszukiwania');
}

async function searchYouTube(query) {
    const trimmedQuery = String(query || '').trim();
    if (!trimmedQuery) {
        if (dom.searchInput) dom.searchInput.focus({ preventScroll: true });
        showToast('Wpisz tytuł utworu lub wykonawcę w polu wyszukiwania.');
        return;
    }

    showPage('home');
    cancelPendingSearch();

    const directVideoId = extractYouTubeVideoId(trimmedQuery);
    if (directVideoId) {
        const directSong = normalizeSong({
            id: directVideoId,
            title: `Utwór z linku YouTube (${directVideoId})`,
            artist: 'YouTube',
            thumbnail: `https://i.ytimg.com/vi/${directVideoId}/mqdefault.jpg`
        });
        if (directSong) {
            displayedHomeSongs = [directSong];
            renderSongCollection(dom.searchResults, displayedHomeSongs, 'Nie znaleziono wyników.');
            playFromQueue(displayedHomeSongs, 0);
            return;
        }
    }

    const requestId = searchRequestId;
    searchController = new AbortController();
    dom.searchResults.innerHTML = '<div class="col-span-full flex justify-center py-8"><div class="spinner"></div><span class="sr-only">Wyszukiwanie…</span></div>';

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=15&q=${encodeURIComponent(trimmedQuery)}&type=video&key=${API_KEY}`, {
            signal: searchController.signal
        });
        const data = await response.json();
        if (!response.ok || data.error) {
            throw new Error(data.error?.message || `HTTP ${response.status}`);
        }
        if (requestId !== searchRequestId) return;
        displaySearchResults(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
        if (error.name === 'AbortError' || requestId !== searchRequestId) return;
        console.error('Błąd wyszukiwania YouTube:', error);
        displayedHomeSongs = [];
        dom.searchResults.innerHTML = `
            <div class="text-slate-300 col-span-full bg-slate-800/70 border border-slate-700 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span>Wystąpił błąd podczas wyszukiwania. Sprawdź połączenie, wklej bezpośredni link YouTube lub wybierz gotowe utwory na start.</span>
                <button id="restore-starter-songs-button" type="button" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shrink-0 transition-colors">
                    Pokaż utwory startowe
                </button>
            </div>
        `;
        on(byId('restore-starter-songs-button'), 'click', loadStarterSongs);
    }
}

function displaySearchResults(items) {
    const songs = items.map((item) => normalizeSong({
        id: item?.id?.videoId,
        title: item?.snippet?.title,
        artist: item?.snippet?.channelTitle,
        thumbnail: item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url
    })).filter(Boolean);
    displayedHomeSongs = songs;
    renderSongCollection(dom.searchResults, songs, 'Nie znaleziono wyników.');
}

function addToRecentlyPlayed(song) {
    // Gdy trwa wczytywanie biblioteki konta lub wystąpił błąd wczytywania, nie nadpisuj zdalnej historii.
    if (activeAccountSession && !accountLibraryLoaded) return;

    invalidateRecommendations();
    recentlyPlayedSongs = recentlyPlayedSongs.filter((item) => item.id !== song.id);
    recentlyPlayedSongs.unshift({ ...song });
    recentlyPlayedSongs = recentlyPlayedSongs.slice(0, HISTORY_LIMIT);
    persistSection('history');
    updateHistoryCount();
    if (!dom.historyPage.classList.contains('hidden')) loadHistory();
}

function loadFavorites() {
    updateFavoritesCount();
    const query = dom.favoritesFilter.value.trim().toLocaleLowerCase('pl');
    const songs = likedSongs.filter((song) => `${song.title} ${song.artist}`.toLocaleLowerCase('pl').includes(query));
    if (dom.favoritesSort.value === 'title' || dom.favoritesSort.value === 'artist') {
        const key = dom.favoritesSort.value;
        songs.sort((a, b) => a[key].localeCompare(b[key], 'pl', { sensitivity: 'base' }));
    }
    renderSongCollection(dom.favoritesResults, songs, query ? 'Brak pasujących utworów' : 'Brak ulubionych utworów');
}

function loadHistory() {
    updateHistoryCount();
    renderSongCollection(dom.historyResults, recentlyPlayedSongs, 'Brak historii odtwarzania', {
        showLike: false,
        showAdd: false
    });
}

function updateFavoritesCount() {
    dom.favoritesCount.textContent = formatSongCount(likedSongs.length);
}

function updateHistoryCount() {
    dom.historyCount.textContent = formatSongCount(recentlyPlayedSongs.length);
}

function loadPlaylists() {
    const query = dom.playlistsFilter.value.trim().toLocaleLowerCase('pl');
    const shown = playlists.filter((playlist) => playlist.name.toLocaleLowerCase('pl').includes(query));
    if (dom.playlistsSort.value === 'name') shown.sort((a, b) => a.name.localeCompare(b.name, 'pl', { sensitivity: 'base' }));
    if (dom.playlistsSort.value === 'size') shown.sort((a, b) => b.songs.length - a.songs.length || a.name.localeCompare(b.name, 'pl'));
    if (!shown.length) {
        dom.playlistsResults.innerHTML = `<div class="text-slate-400 italic col-span-full">${query ? 'Brak pasujących playlist' : 'Brak playlist'}</div>`;
        return;
    }

    const fragment = document.createDocumentFragment();
    shown.forEach((playlist) => {
        const card = document.createElement('div');
        card.className = 'bg-slate-800/50 hover:bg-slate-700 rounded-xl p-4 cursor-pointer transition-all';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.innerHTML = `
            <div class="w-full aspect-square bg-blue-800 rounded-lg mb-3 flex items-center justify-center">
                <i class="fas fa-list text-3xl text-blue-400"></i>
            </div>
            <h3 class="font-medium truncate">${escapeHTML(playlist.name)}</h3>
            <p class="text-slate-400 text-sm">${formatSongCount(playlist.songs.length)}</p>
        `;
        card.addEventListener('click', () => showPlaylistDetail(playlist));
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                showPlaylistDetail(playlist);
            }
        });
        fragment.appendChild(card);
    });
    dom.playlistsResults.replaceChildren(fragment);
}

function showPlaylistDetail(playlist) {
    selectedPlaylistForDetail = playlist;
    dom.playlistDetailTitle.textContent = playlist.name;
    dom.playPlaylistButton.disabled = !playlist.songs.length;
    renderSongCollection(dom.playlistDetailContent, playlist.songs, 'Ta playlista jest pusta', {
        showLike: false,
        showAdd: false,
        showRemove: true,
        onRemove: removeFromCurrentPlaylist
    });
    dom.playlistDetailModal.classList.add('open');
}

function removeFromCurrentPlaylist(videoId) {
    if (!selectedPlaylistForDetail || !canMutateLibrary()) return;
    const playlistIndex = playlists.findIndex((item) => item.id === selectedPlaylistForDetail.id);
    if (playlistIndex === -1) return;

    playlists[playlistIndex].songs = playlists[playlistIndex].songs.filter((song) => song.id !== videoId);
    persistSection('playlists');
    showPlaylistDetail(playlists[playlistIndex]);
    loadPlaylists();
}

function deleteCurrentPlaylist() {
    if (!selectedPlaylistForDetail || !canMutateLibrary()) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć playlistę "${selectedPlaylistForDetail.name}"?`)) return;

    playlists = playlists.filter((playlist) => playlist.id !== selectedPlaylistForDetail.id);
    persistSection('playlists');
    selectedPlaylistForDetail = null;
    dom.playlistDetailModal.classList.remove('open');
    loadPlaylists();
}

function editCurrentPlaylist() {
    if (!selectedPlaylistForDetail || !canMutateLibrary()) return;
    const newName = window.prompt('Podaj nową nazwę playlisty:', selectedPlaylistForDetail.name);
    if (!newName || !newName.trim()) return;

    const playlist = playlists.find((item) => item.id === selectedPlaylistForDetail.id);
    if (!playlist) return;
    playlist.name = newName.trim().slice(0, 80);
    persistSection('playlists');
    showPlaylistDetail(playlist);
    loadPlaylists();
}

function makePlaylist(name, songs = []) {
    return {
        id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: name.trim().slice(0, 80),
        songs: deduplicateSongs(songs, 300)
    };
}

function createNewPlaylist() {
    if (!canMutateLibrary()) return;
    if (playlists.length >= 100) {
        showToast('Osiągnięto limit 100 playlist.', true);
        return;
    }
    const name = window.prompt('Podaj nazwę nowej playlisty:');
    if (!name || !name.trim()) return;
    playlists.push(makePlaylist(name));
    persistSection('playlists');
    loadPlaylists();
}

function showAddToPlaylistModal(song) {
    const normalized = normalizeSong(song);
    if (!normalized) {
        showToast('Najpierw wybierz utwór.');
        return;
    }

    selectedSongForPlaylist = normalized;
    dom.playlistModalContent.innerHTML = '';
    if (!playlists.length) {
        dom.playlistModalContent.innerHTML = '<div class="text-slate-400 italic">Nie masz jeszcze żadnych playlist</div>';
    } else {
        const fragment = document.createDocumentFragment();
        playlists.forEach((playlist) => {
            const alreadyAdded = playlist.songs.some((item) => item.id === normalized.id);
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between p-3 hover:bg-slate-700 rounded-lg';
            item.innerHTML = `
                <div class="min-w-0 mr-3">
                    <h3 class="font-medium truncate">${escapeHTML(playlist.name)}</h3>
                    <p class="text-slate-400 text-sm">${formatSongCount(playlist.songs.length)}</p>
                </div>
                ${alreadyAdded
                    ? '<span class="text-green-400 text-sm shrink-0">Dodano</span>'
                    : '<button class="add-to-this-playlist text-slate-400 hover:text-blue-500 shrink-0" aria-label="Dodaj do tej playlisty"><i class="fas fa-plus"></i></button>'}
            `;
            const button = item.querySelector('.add-to-this-playlist');
            if (button) button.addEventListener('click', () => addToPlaylist(playlist.id));
            fragment.appendChild(item);
        });
        dom.playlistModalContent.appendChild(fragment);
    }
    dom.playlistModal.classList.add('open');
}

function addToPlaylist(playlistId) {
    if (!selectedSongForPlaylist || !canMutateLibrary()) return;
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist || playlist.songs.some((song) => song.id === selectedSongForPlaylist.id)) return;
    if (playlist.songs.length >= 300) {
        showToast('Ta playlista osiągnęła limit 300 utworów.', true);
        return;
    }

    playlist.songs.push({ ...selectedSongForPlaylist });
    persistSection('playlists');
    showAddToPlaylistModal(selectedSongForPlaylist);
    loadPlaylists();
    if (selectedPlaylistForDetail?.id === playlistId) showPlaylistDetail(playlist);
}

function createNewPlaylistFromModal() {
    if (!selectedSongForPlaylist) {
        showToast('Najpierw wybierz utwór.');
        return;
    }
    if (!canMutateLibrary()) return;
    if (playlists.length >= 100) {
        showToast('Osiągnięto limit 100 playlist.', true);
        return;
    }
    const name = window.prompt('Podaj nazwę nowej playlisty:');
    if (!name || !name.trim()) return;

    const playlist = makePlaylist(name, [selectedSongForPlaylist]);
    playlists.push(playlist);
    persistSection('playlists');
    loadPlaylists();
    dom.playlistModal.classList.remove('open');
    showPlaylistDetail(playlist);
}

function toggleMobilePlayerExpanded() {
    const expanded = dom.mobilePlayerExpanded.classList.toggle('hidden') === false;
    dom.mainContent.style.paddingBottom = expanded ? '180px' : '100px';
    dom.mobileSongInfo.setAttribute('aria-expanded', String(expanded));
    document.documentElement.style.setProperty('--rj-mobile-ads-height', expanded ? '184px' : '92px');
}

function isEditableTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    if (target.closest('input, textarea, select')) return true;
    if (target.isContentEditable) return true;

    // Respect the nearest contenteditable boundary, including nested elements
    // and contenteditable="plaintext-only" / empty attributes.
    const editableHost = target.closest('[contenteditable]');
    return Boolean(editableHost && editableHost.getAttribute('contenteditable') !== 'false');
}

function isInteractiveTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest('button, a[href], [role="button"]'));
}

function handleGlobalKeyboardShortcuts(event) {
    if (event.key === 'Escape') {
        dom.mobileMenu.classList.remove('open');
        dom.accountModal.classList.remove('open');
        dom.playlistModal.classList.remove('open');
        dom.playlistDetailModal.classList.remove('open');
        return;
    }

    const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
    if (!isSpace || event.repeat || event.defaultPrevented || !currentSong) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (isEditableTarget(event.target) || isInteractiveTarget(event.target)) return;

    const modalIsOpen = [dom.accountModal, dom.playlistModal, dom.playlistDetailModal]
        .some((modal) => modal.classList.contains('open'));
    if (modalIsOpen) return;

    event.preventDefault();
    togglePlay();
}

function setupEventListeners() {
    dom.connectButtons.forEach((button) => {
        on(button, 'click', () => verifyAccountSession(true));
    });
    dom.retryButtons.forEach((button) => {
        on(button, 'click', () => verifyAccountSession(false));
    });
    dom.disconnectButtons.forEach((button) => {
        on(button, 'click', disconnectProjectAccount);
    });
    dom.syncRetryButtons.forEach((button) => {
        on(button, 'click', () => retrySync());
    });

    on(dom.headerAccountButton, 'click', openAccountModal);
    on(dom.desktopAccountButton, 'click', openAccountModal);
    on(dom.mobileAccountButton, 'click', openAccountModal);
    on(dom.closeAccountModal, 'click', closeAccountModal);
    on(dom.accountModalBackdrop, 'click', closeAccountModal);

    on(dom.dismissSyncPromo, 'click', () => {
        sessionSet(PROMO_DISMISSED_KEY, '1');
        updateAccountUI();
    });
    on(dom.migrateGuestDataButton, 'click', migrateGuestDataToAccount);
    on(dom.modalMigrateButton, 'click', migrateGuestDataToAccount);
    on(dom.skipGuestMigrationButton, 'click', skipGuestMigration);
    on(dom.modalSkipMigrationButton, 'click', skipGuestMigration);

    window.addEventListener('rj:account-ready', bindRejsonAccountBridge);
    window.addEventListener('pagehide', () => { savePlayback(); flushAccountSave(); });
    window.addEventListener('online', () => {
        if (accountState === 'network_error') verifyAccountSession(false);
        else if (activeAccountSession && syncState === 'error') retrySync();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') { savePlayback(); flushAccountSave(); }
        else checkSleepTimer();
    });

    on(dom.mobileMenuButton, 'click', () => dom.mobileMenu.classList.add('open'));
    on(dom.menuBackdrop, 'click', () => dom.mobileMenu.classList.remove('open'));
    dom.menuLinks.forEach((link) => {
        on(link, 'click', (event) => {
            event.preventDefault();
            showPage(link.dataset.page);
            dom.mobileMenu.classList.remove('open');
        });
    });
    on(dom.startListeningButton, 'click', () => {
        showPage('home');
        if (dom.searchInput) dom.searchInput.focus({ preventScroll: true });
    });

    if (dom.searchForm) {
        on(dom.searchForm, 'submit', (event) => {
            event.preventDefault();
            searchYouTube(dom.searchInput ? dom.searchInput.value : '');
        });
    } else {
        on(dom.searchInput, 'keydown', (event) => {
            if (event.key === 'Enter') searchYouTube(dom.searchInput.value);
        });
    }
    on(dom.searchInput, 'keydown', (event) => {
        if (event.key === 'Enter' && !dom.searchForm) {
            searchYouTube(dom.searchInput.value);
        }
    });

    on(dom.starterTracksButton, 'click', () => {
        if (dom.searchInput) dom.searchInput.value = '';
        showPage('home');
        loadStarterSongs();
    });
    dom.quickSearchButtons.forEach((button) => {
        on(button, 'click', () => {
            const query = button.dataset.quickSearch || '';
            if (dom.searchInput) dom.searchInput.value = query;
            searchYouTube(query);
        });
    });

    on(dom.playButton, 'click', togglePlay);
    on(dom.mobilePlayButton, 'click', togglePlay);
    on(dom.prevButton, 'click', playPrevious);
    on(dom.mobilePrevButton, 'click', playPrevious);
    on(dom.nextButton, 'click', () => playNext());
    on(dom.mobileNextButton, 'click', () => playNext());
    on(dom.progressBar, 'input', seekTo);
    on(dom.progressBar, 'pointerdown', () => { isSeeking = true; });
    window.addEventListener('pointerup', () => { isSeeking = false; });
    on(dom.likeButton, 'click', toggleCurrentLike);
    on(dom.mobileLikeButton, 'click', toggleCurrentLike);
    on(dom.addToPlaylistButton, 'click', () => {
        if (currentSong) showAddToPlaylistModal(currentSong);
        else showToast('Najpierw wybierz utwór.');
    });
    on(dom.mobilePlaylistButton, 'click', () => {
        if (currentSong) showAddToPlaylistModal(currentSong);
        else showToast('Najpierw wybierz utwór.');
    });
    on(dom.volumeBar, 'input', () => updateVolume(true));
    on(dom.volumeButton, 'click', toggleVolume);
    on(dom.shuffleButton, 'click', toggleShuffle);
    on(dom.mobileShuffleButton, 'click', toggleShuffle);
    on(dom.repeatButton, 'click', toggleRepeat);
    on(dom.mobileRepeatButton, 'click', toggleRepeat);

    on(dom.playFavoritesButton, 'click', () => {
        if (!likedSongs.length) return showToast('Nie masz jeszcze ulubionych utworów.');
        const query = dom.favoritesFilter.value.trim().toLocaleLowerCase('pl');
        const songs = likedSongs.filter((song) => `${song.title} ${song.artist}`.toLocaleLowerCase('pl').includes(query));
        if (dom.favoritesSort.value === 'title' || dom.favoritesSort.value === 'artist') {
            const key = dom.favoritesSort.value;
            songs.sort((a, b) => a[key].localeCompare(b[key], 'pl', { sensitivity: 'base' }));
        }
        if (!songs.length) return showToast('Brak pasujących ulubionych utworów.');
        playFromQueue(songs, 0);
    });
    on(dom.playPlaylistButton, 'click', () => {
        if (!selectedPlaylistForDetail?.songs.length) return;
        playFromQueue(selectedPlaylistForDetail.songs, 0);
        dom.playlistDetailModal.classList.remove('open');
    });
    on(dom.favoritesFilter, 'input', loadFavorites);
    on(dom.favoritesSort, 'change', loadFavorites);
    on(dom.playlistsFilter, 'input', loadPlaylists);
    on(dom.playlistsSort, 'change', loadPlaylists);
    on(dom.sleepTimer, 'change', setSleepTimer);
    on(dom.sharePlaylistButton, 'click', shareCurrentPlaylist);
    on(dom.playSharedButton, 'click', () => { if (sharedPlaylist?.songs.length) playFromQueue(sharedPlaylist.songs, 0); });
    on(dom.importSharedButton, 'click', importSharedPlaylist);
    on(dom.dismissSharedButton, 'click', dismissSharedPlaylist);
    on(dom.recommendationsButton, 'click', loadRecommendations);
    on(dom.clearHistoryButton, 'click', clearHistory);
    on(dom.clearQueueButton, 'click', clearQueue);
    on(dom.createPlaylistButton, 'click', createNewPlaylist);
    on(dom.closePlaylistModal, 'click', () => dom.playlistModal.classList.remove('open'));
    on(dom.createNewPlaylistButton, 'click', createNewPlaylistFromModal);
    on(dom.closePlaylistDetailModal, 'click', () => dom.playlistDetailModal.classList.remove('open'));
    on(dom.deletePlaylistButton, 'click', deleteCurrentPlaylist);
    on(dom.editPlaylistButton, 'click', editCurrentPlaylist);

    [dom.playlistModal, dom.playlistDetailModal].forEach((modal) => {
        if (modal && modal.firstElementChild) {
            on(modal.firstElementChild, 'click', () => modal.classList.remove('open'));
        }
    });

    on(dom.mobileProgressBar, 'input', seekToMobile);
    on(dom.mobileProgressBar, 'touchstart', () => { isTouching = true; }, { passive: true });
    on(dom.mobileProgressBar, 'touchmove', () => { isTouching = true; }, { passive: true });
    const finishTouch = () => {
        isTouching = false;
        seekToMobile();
    };
    on(dom.mobileProgressBar, 'touchend', finishTouch);
    on(dom.mobileProgressBar, 'touchcancel', finishTouch);

    on(dom.mobileSongInfo, 'click', toggleMobilePlayerExpanded);
    on(dom.mobileSongInfo, 'keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleMobilePlayerExpanded();
        }
    });

    document.addEventListener('keydown', handleGlobalKeyboardShortcuts);

    window.addEventListener('beforeunload', () => {
        savePlayback();
        window.clearInterval(progressTimer);
        window.clearInterval(playbackSaveTimer);
        window.clearTimeout(sleepTimeout);
        if (accountSubscriptionCleanup) {
            accountSubscriptionCleanup();
            accountSubscriptionCleanup = null;
        }
        adBlocker.detach();
    });
}

function initApp() {
    setupEventListeners();
    updateVolume();
    loadStarterSongs();
    renderQueue();
    setupMediaSession();
    loadFavorites();
    loadPlaylists();
    loadHistory();

    // Logowanie nie jest obowiązkowe: użytkownik od razu korzysta z aplikacji.
    if (isFirstVisit) {
        showWelcomePage();
        isFirstVisit = false;
        storageSet('isFirstVisit', 'false');
    } else {
        showPage('home');
    }

    openSharedPlaylistFromLink();

    if (window.RejsonAccount) {
        bindRejsonAccountBridge();
    } else {
        // Wyczyść ewentualny przeterminowany znacznik powrotu i zaktualizuj UI trybu gościa.
        hasValidPendingLogin();
        if (isDisconnectedByChoice()) {
            accountState = 'disconnected';
            accountStatusMessage = 'Odłączono konto w Jakuplayerze. Nadal możesz być zalogowany na rejson59.github.io.';
        }
        updateAccountUI();
    }

    loadYouTubeAPI();
    progressTimer = window.setInterval(() => { updatePlaybackUI(); checkSleepTimer(); }, 250);
    playbackSaveTimer = window.setInterval(savePlayback, 5000);
}

initApp();
