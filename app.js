'use strict';

// This is a browser-side YouTube Data API key. Restrict it by HTTP referrer
// and to the YouTube Data API in Google Cloud Console.
const API_KEY = 'AIzaSyBzEss-uFNFF-jl1kIY6jYswAnCDRN4eao';
const byId = (id) => document.getElementById(id);

const dom = {
    searchInput: byId('search-input'),
    searchResults: byId('search-results'),
    favoritesResults: byId('favorites-results'),
    playlistsResults: byId('playlists-results'),
    historyResults: byId('history-results'),
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
    loginModal: byId('login-modal'),
    loginButton: byId('login-button'),
    usernameInput: byId('username'),
    welcomeUsername: byId('welcome-username'),
    headerUsername: byId('header-username'),
    headerUsernameInitial: byId('header-username-initial'),
    desktopUsername: byId('desktop-username'),
    mobileUsername: byId('mobile-username'),
    logoutButton: byId('logout-button'),
    desktopLogoutButton: byId('desktop-logout-button'),
    startListeningButton: byId('start-listening-button'),
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
    toast: byId('toast')
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
let playbackQueue = [];
let currentQueueIndex = -1;
let progressTimer = null;
let searchController = null;
let searchRequestId = 0;
let isSeeking = false;
let isTouching = false;
let toastTimer = null;
let playerLoadingToastShown = false;
let storageWarningShown = false;

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

function readPlaylists() {
    return readStoredArray('playlists').map((playlist) => {
        if (!playlist || typeof playlist !== 'object' || !playlist.id) return null;
        return {
            id: String(playlist.id),
            name: String(playlist.name || 'Playlista').slice(0, 80),
            songs: (Array.isArray(playlist.songs) ? playlist.songs : [])
                .map(normalizeSong)
                .filter(Boolean)
        };
    }).filter(Boolean);
}

let username = storageGet('username') || 'Użytkownik';
let likedSongs = readStoredArray('likedSongs').map(normalizeSong).filter(Boolean);
let recentlyPlayedSongs = readStoredArray('recentlyPlayed').map(normalizeSong).filter(Boolean).slice(0, 10);
let playlists = readPlaylists();
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

function artworkMarkup(song, className) {
    if (!song.thumbnail) {
        return '<i class="fas fa-music text-slate-500" aria-hidden="true"></i>';
    }
    return `<img src="${escapeHTML(song.thumbnail)}" alt="${escapeHTML(song.title)}" class="${className}" loading="lazy" referrerpolicy="no-referrer">`;
}

function updateUsernameDisplay() {
    dom.welcomeUsername.textContent = username;
    dom.headerUsername.textContent = username;
    dom.headerUsernameInitial.textContent = username.charAt(0).toUpperCase() || 'U';
    dom.desktopUsername.textContent = username;
    dom.mobileUsername.textContent = username;
}

function showLoginModal() {
    dom.loginModal.classList.add('open');
    dom.usernameInput.focus();
}

function hideLoginModal() {
    dom.loginModal.classList.remove('open');
}

function showWelcomePage() {
    [dom.homePage, dom.favoritesPage, dom.playlistsPage, dom.historyPage]
        .forEach((page) => page.classList.add('hidden'));
    dom.welcomePage.classList.remove('hidden');
}

function showPage(pageName) {
    const pages = {
        home: dom.homePage,
        favorites: dom.favoritesPage,
        playlists: dom.playlistsPage,
        history: dom.historyPage
    };
    if (!pages[pageName]) return;

    dom.welcomePage.classList.add('hidden');
    Object.values(pages).forEach((page) => page.classList.add('hidden'));
    pages[pageName].classList.remove('hidden');

    if (pageName === 'favorites') loadFavorites();
    if (pageName === 'playlists') loadPlaylists();
    if (pageName === 'history') loadHistory();

    dom.menuLinks.forEach((link) => {
        const active = link.dataset.page === pageName;
        link.classList.toggle('bg-blue-900', active);
        link.classList.toggle('text-white', active);
        if (active) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    });
}

function handleLogin() {
    const newUsername = dom.usernameInput.value.trim().slice(0, 40);
    if (!newUsername) {
        dom.usernameInput.focus();
        return;
    }

    username = newUsername;
    storageSet('username', username);
    updateUsernameDisplay();
    hideLoginModal();
    loadFavorites();
    loadPlaylists();
    loadHistory();

    if (isFirstVisit) {
        showWelcomePage();
        isFirstVisit = false;
        storageSet('isFirstVisit', 'false');
    } else {
        showPage('home');
    }
}

function handleLogout() {
    if (playerReady) {
        try { player.pauseVideo(); } catch (_) { /* Player may be destroyed. */ }
    }
    isPlaying = false;
    updatePlayButtons();
    storageRemove('username');
    username = 'Użytkownik';
    dom.usernameInput.value = '';
    updateUsernameDisplay();
    showLoginModal();
    dom.mobileMenu.classList.remove('open');
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

    if (currentSong) {
        loadCurrentSong();
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
    isPlaying = false;
    adBlocker.setVideo(normalized.id);
    resetProgress();
    updateCurrentSongUI();
    updatePlayButtons();
    updateActiveCards();
    addToRecentlyPlayed(normalized);

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
}

function togglePlay() {
    if (!currentSong) {
        showToast('Najpierw wybierz utwór.');
        return;
    }
    if (!playerReady) {
        showToast('Odtwarzacz jest jeszcze ładowany.');
        return;
    }

    try {
        if (isPlaying) player.pauseVideo();
        else player.playVideo();
    } catch (_) {
        showToast('Nie udało się zmienić stanu odtwarzania.', true);
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
    if (!currentSong || !playerReady) return;
    const elapsed = Number(player.getCurrentTime()) || 0;
    if (elapsed > 3) {
        restartCurrentSong();
        return;
    }

    const index = playbackQueue.findIndex((song) => song.id === currentSong.id);
    if (index > 0) playQueueIndex(index - 1);
    else restartCurrentSong();
}

function playNext(fromEnded = false) {
    if (!currentSong) return;

    if (!playbackQueue.length && isShuffleOn && likedSongs.length) {
        playbackQueue = likedSongs.map(normalizeSong).filter(Boolean);
    }
    if (!playbackQueue.length) {
        if (!fromEnded) restartCurrentSong();
        return;
    }

    const currentIndex = playbackQueue.findIndex((song) => song.id === currentSong.id);
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

function seekTo() {
    if (!playerReady || !currentSong || adBlocker.isAdActive()) return;
    const durationValue = Number(player.getDuration());
    if (!Number.isFinite(durationValue) || durationValue <= 0) return;
    player.seekTo((Number(dom.progressBar.value) / 100) * durationValue, true);
}

function seekToMobile() {
    if (!playerReady || !currentSong || adBlocker.isAdActive()) return;
    const durationValue = Number(player.getDuration());
    if (!Number.isFinite(durationValue) || durationValue <= 0) return;

    const percent = Number(dom.mobileProgressBar.value);
    const seekTime = (percent / 100) * durationValue;
    player.seekTo(seekTime, true);
    dom.mobileProgressFill.style.width = `${percent}%`;
    updateMobileTimeDisplays(seekTime, durationValue);
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
    if (!playerReady || !currentSong || adBlocker.isAdActive()) return;

    try {
        const currentTimeValue = Number(player.getCurrentTime());
        const durationValue = Number(player.getDuration());
        if (!Number.isFinite(currentTimeValue) || !Number.isFinite(durationValue) || durationValue <= 0) return;

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
    dom.shuffleButton.classList.toggle('text-blue-400', isShuffleOn);
    dom.shuffleButton.classList.toggle('text-slate-400', !isShuffleOn);
    dom.shuffleButton.setAttribute('aria-pressed', String(isShuffleOn));
}

function toggleRepeat() {
    isRepeatOn = !isRepeatOn;
    dom.repeatButton.classList.toggle('text-blue-400', isRepeatOn);
    dom.repeatButton.classList.toggle('text-slate-400', !isRepeatOn);
    dom.repeatButton.setAttribute('aria-pressed', String(isRepeatOn));
}

function toggleLikeSong(song) {
    const normalized = normalizeSong(song);
    if (!normalized) return;

    const index = likedSongs.findIndex((item) => item.id === normalized.id);
    if (index === -1) likedSongs.push(normalized);
    else likedSongs.splice(index, 1);

    storageSet('likedSongs', JSON.stringify(likedSongs));
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
        ${actions}
    `;

    card.addEventListener('click', settings.onPlay);
    card.addEventListener('keydown', (event) => {
        if (event.target === card && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            settings.onPlay();
        }
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

async function searchYouTube(query) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    showPage('home');
    const requestId = ++searchRequestId;
    if (searchController) searchController.abort();
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
        dom.searchResults.innerHTML = '<div class="text-slate-400 col-span-full">Wystąpił błąd podczas wyszukiwania. Sprawdź połączenie i spróbuj ponownie.</div>';
    }
}

function displaySearchResults(items) {
    const songs = items.map((item) => normalizeSong({
        id: item?.id?.videoId,
        title: item?.snippet?.title,
        artist: item?.snippet?.channelTitle,
        thumbnail: item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url
    })).filter(Boolean);
    renderSongCollection(dom.searchResults, songs, 'Nie znaleziono wyników.');
}

function addToRecentlyPlayed(song) {
    recentlyPlayedSongs = recentlyPlayedSongs.filter((item) => item.id !== song.id);
    recentlyPlayedSongs.unshift({ ...song });
    recentlyPlayedSongs = recentlyPlayedSongs.slice(0, 10);
    storageSet('recentlyPlayed', JSON.stringify(recentlyPlayedSongs));
    updateHistoryCount();
    if (!dom.historyPage.classList.contains('hidden')) loadHistory();
}

function loadFavorites() {
    updateFavoritesCount();
    renderSongCollection(dom.favoritesResults, likedSongs, 'Brak ulubionych utworów');
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
    if (!playlists.length) {
        dom.playlistsResults.innerHTML = '<div class="text-slate-400 italic col-span-full">Brak playlist</div>';
        return;
    }

    const fragment = document.createDocumentFragment();
    playlists.forEach((playlist) => {
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
    renderSongCollection(dom.playlistDetailContent, playlist.songs, 'Ta playlista jest pusta', {
        showLike: false,
        showAdd: false,
        showRemove: true,
        onRemove: removeFromCurrentPlaylist
    });
    dom.playlistDetailModal.classList.add('open');
}

function removeFromCurrentPlaylist(videoId) {
    if (!selectedPlaylistForDetail) return;
    const playlistIndex = playlists.findIndex((item) => item.id === selectedPlaylistForDetail.id);
    if (playlistIndex === -1) return;

    playlists[playlistIndex].songs = playlists[playlistIndex].songs.filter((song) => song.id !== videoId);
    storageSet('playlists', JSON.stringify(playlists));
    showPlaylistDetail(playlists[playlistIndex]);
    loadPlaylists();
}

function deleteCurrentPlaylist() {
    if (!selectedPlaylistForDetail) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć playlistę "${selectedPlaylistForDetail.name}"?`)) return;

    playlists = playlists.filter((playlist) => playlist.id !== selectedPlaylistForDetail.id);
    storageSet('playlists', JSON.stringify(playlists));
    selectedPlaylistForDetail = null;
    dom.playlistDetailModal.classList.remove('open');
    loadPlaylists();
}

function editCurrentPlaylist() {
    if (!selectedPlaylistForDetail) return;
    const newName = window.prompt('Podaj nową nazwę playlisty:', selectedPlaylistForDetail.name);
    if (!newName || !newName.trim()) return;

    const playlist = playlists.find((item) => item.id === selectedPlaylistForDetail.id);
    if (!playlist) return;
    playlist.name = newName.trim().slice(0, 80);
    storageSet('playlists', JSON.stringify(playlists));
    showPlaylistDetail(playlist);
    loadPlaylists();
}

function makePlaylist(name, songs = []) {
    return {
        id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: name.trim().slice(0, 80),
        songs: songs.map(normalizeSong).filter(Boolean)
    };
}

function createNewPlaylist() {
    const name = window.prompt('Podaj nazwę nowej playlisty:');
    if (!name || !name.trim()) return;
    playlists.push(makePlaylist(name));
    storageSet('playlists', JSON.stringify(playlists));
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
    if (!selectedSongForPlaylist) return;
    const playlist = playlists.find((item) => item.id === playlistId);
    if (!playlist || playlist.songs.some((song) => song.id === selectedSongForPlaylist.id)) return;

    playlist.songs.push({ ...selectedSongForPlaylist });
    storageSet('playlists', JSON.stringify(playlists));
    showAddToPlaylistModal(selectedSongForPlaylist);
    loadPlaylists();
    if (selectedPlaylistForDetail?.id === playlistId) showPlaylistDetail(playlist);
}

function createNewPlaylistFromModal() {
    if (!selectedSongForPlaylist) {
        showToast('Najpierw wybierz utwór.');
        return;
    }
    const name = window.prompt('Podaj nazwę nowej playlisty:');
    if (!name || !name.trim()) return;

    const playlist = makePlaylist(name, [selectedSongForPlaylist]);
    playlists.push(playlist);
    storageSet('playlists', JSON.stringify(playlists));
    loadPlaylists();
    dom.playlistModal.classList.remove('open');
    showPlaylistDetail(playlist);
}

function toggleMobilePlayerExpanded() {
    const expanded = dom.mobilePlayerExpanded.classList.toggle('hidden') === false;
    dom.mainContent.style.paddingBottom = expanded ? '180px' : '100px';
    dom.mobileSongInfo.setAttribute('aria-expanded', String(expanded));
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
        dom.playlistModal.classList.remove('open');
        dom.playlistDetailModal.classList.remove('open');
        return;
    }

    const isSpace = event.code === 'Space' || event.key === ' ' || event.key === 'Spacebar';
    if (!isSpace || event.repeat || event.defaultPrevented || !currentSong) return;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
    if (isEditableTarget(event.target) || isInteractiveTarget(event.target)) return;

    const modalIsOpen = [dom.loginModal, dom.playlistModal, dom.playlistDetailModal]
        .some((modal) => modal.classList.contains('open'));
    if (modalIsOpen) return;

    event.preventDefault();
    togglePlay();
}

function setupEventListeners() {
    dom.loginButton.addEventListener('click', handleLogin);
    dom.usernameInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') handleLogin();
    });
    dom.logoutButton.addEventListener('click', handleLogout);
    dom.desktopLogoutButton.addEventListener('click', handleLogout);

    dom.mobileMenuButton.addEventListener('click', () => dom.mobileMenu.classList.add('open'));
    dom.menuBackdrop.addEventListener('click', () => dom.mobileMenu.classList.remove('open'));
    dom.menuLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            showPage(link.dataset.page);
            dom.mobileMenu.classList.remove('open');
        });
    });
    dom.startListeningButton.addEventListener('click', () => showPage('home'));

    dom.searchInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') searchYouTube(dom.searchInput.value);
    });

    dom.playButton.addEventListener('click', togglePlay);
    dom.mobilePlayButton.addEventListener('click', togglePlay);
    dom.prevButton.addEventListener('click', playPrevious);
    dom.mobilePrevButton.addEventListener('click', playPrevious);
    dom.nextButton.addEventListener('click', () => playNext());
    dom.mobileNextButton.addEventListener('click', () => playNext());
    dom.progressBar.addEventListener('input', seekTo);
    dom.progressBar.addEventListener('pointerdown', () => { isSeeking = true; });
    window.addEventListener('pointerup', () => { isSeeking = false; });
    dom.likeButton.addEventListener('click', toggleCurrentLike);
    dom.mobileLikeButton.addEventListener('click', toggleCurrentLike);
    dom.addToPlaylistButton.addEventListener('click', () => {
        if (currentSong) showAddToPlaylistModal(currentSong);
        else showToast('Najpierw wybierz utwór.');
    });
    dom.mobilePlaylistButton.addEventListener('click', () => {
        if (currentSong) showAddToPlaylistModal(currentSong);
        else showToast('Najpierw wybierz utwór.');
    });
    dom.volumeBar.addEventListener('input', () => updateVolume(true));
    dom.volumeButton.addEventListener('click', toggleVolume);
    dom.shuffleButton.addEventListener('click', toggleShuffle);
    dom.repeatButton.addEventListener('click', toggleRepeat);

    dom.createPlaylistButton.addEventListener('click', createNewPlaylist);
    dom.closePlaylistModal.addEventListener('click', () => dom.playlistModal.classList.remove('open'));
    dom.createNewPlaylistButton.addEventListener('click', createNewPlaylistFromModal);
    dom.closePlaylistDetailModal.addEventListener('click', () => dom.playlistDetailModal.classList.remove('open'));
    dom.deletePlaylistButton.addEventListener('click', deleteCurrentPlaylist);
    dom.editPlaylistButton.addEventListener('click', editCurrentPlaylist);

    [dom.playlistModal, dom.playlistDetailModal].forEach((modal) => {
        modal.firstElementChild.addEventListener('click', () => modal.classList.remove('open'));
    });

    dom.mobileProgressBar.addEventListener('input', seekToMobile);
    dom.mobileProgressBar.addEventListener('touchstart', () => { isTouching = true; }, { passive: true });
    dom.mobileProgressBar.addEventListener('touchmove', () => { isTouching = true; }, { passive: true });
    const finishTouch = () => {
        isTouching = false;
        seekToMobile();
    };
    dom.mobileProgressBar.addEventListener('touchend', finishTouch);
    dom.mobileProgressBar.addEventListener('touchcancel', finishTouch);

    dom.mobileSongInfo.addEventListener('click', toggleMobilePlayerExpanded);
    dom.mobileSongInfo.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleMobilePlayerExpanded();
        }
    });

    document.addEventListener('keydown', handleGlobalKeyboardShortcuts);

    window.addEventListener('beforeunload', () => {
        window.clearInterval(progressTimer);
        adBlocker.detach();
    });
}

function initApp() {
    setupEventListeners();
    updateUsernameDisplay();
    updateVolume();
    loadFavorites();
    loadPlaylists();
    loadHistory();

    if (!storageGet('username')) {
        showLoginModal();
    } else if (isFirstVisit) {
        showWelcomePage();
        isFirstVisit = false;
        storageSet('isFirstVisit', 'false');
    } else {
        showPage('home');
    }

    loadYouTubeAPI();
    progressTimer = window.setInterval(updatePlaybackUI, 250);
}

initApp();
