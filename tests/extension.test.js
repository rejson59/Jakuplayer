'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const YouTubeFrameAdBlocker = require('../extension/content.js');

const root = path.join(__dirname, '..');

function createFixture({ ad = true, duration = 15, muted = false } = {}) {
    const dom = new JSDOM(`
        <div id="movie_player" class="${ad ? 'ad-showing' : ''}">
            <video></video>
            <button class="ytp-ad-skip-button-modern">Skip</button>
        </div>
    `, { url: 'https://www.youtube.com/embed/test' });
    const document = dom.window.document;
    const video = document.querySelector('video');
    const button = document.querySelector('button');
    let currentTime = 0;
    let playbackRate = 1;
    let volume = 0.7;
    let isMuted = muted;
    let clicks = 0;

    Object.defineProperties(video, {
        currentTime: {
            configurable: true,
            get: () => currentTime,
            set: (value) => { currentTime = value; }
        },
        duration: { configurable: true, get: () => duration },
        playbackRate: {
            configurable: true,
            get: () => playbackRate,
            set: (value) => { playbackRate = value; }
        },
        volume: {
            configurable: true,
            get: () => volume,
            set: (value) => { volume = value; }
        },
        muted: {
            configurable: true,
            get: () => isMuted,
            set: (value) => { isMuted = value; }
        }
    });
    button.addEventListener('click', () => { clicks += 1; });

    const blocker = new YouTubeFrameAdBlocker(document, {
        setInterval: () => 1,
        clearInterval: () => {}
    });

    return {
        dom,
        document,
        video,
        blocker,
        get clicks() { return clicks; }
    };
}

test('extension manifest and network rules target YouTube embeds without blocking content media', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
    const rules = JSON.parse(fs.readFileSync(path.join(root, 'extension/rules.json'), 'utf8'));

    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.permissions.includes('declarativeNetRequest'), true);
    assert.equal(manifest.permissions.includes('webRequest'), false);
    assert.deepEqual(manifest.content_scripts[0].matches, [
        'https://www.youtube.com/embed/*',
        'https://www.youtube-nocookie.com/embed/*'
    ]);
    assert.equal(manifest.content_scripts[0].all_frames, true);
    assert.equal(new Set(rules.map((rule) => rule.id)).size, rules.length);
    assert.equal(rules.every((rule) => rule.action.type === 'block'), true);
    assert.equal(JSON.stringify(rules).includes('googlevideo.com'), false);

    for (const file of ['content.js', 'rules.json', 'popup.html', 'popup.css', 'icons/128.png']) {
        assert.equal(fs.existsSync(path.join(root, 'extension', file)), true, `${file} must be packaged`);
    }
});

test('website links to the extension guide with a ZIP download and manual installation steps', () => {
    const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const guide = fs.readFileSync(path.join(root, 'extension.html'), 'utf8');

    assert.match(index, /href="extension\.html"/);
    assert.match(guide, /href="jakuplayer-adblock\.zip" download/);
    assert.match(guide, /chrome:\/\/extensions/);
    assert.match(guide, /edge:\/\/extensions/);
    assert.match(guide, /Załaduj rozpakowane/);
    assert.match(guide, /nie jest gwarantowane/);
});

test('frame blocker fast-forwards and mutes only an ad, clicks skip once and restores playback', (t) => {
    const fixture = createFixture();
    t.after(() => fixture.dom.window.close());

    fixture.blocker.check();
    assert.equal(fixture.video.muted, true);
    assert.equal(fixture.video.playbackRate, 16);
    assert.equal(fixture.video.currentTime, 14.95);
    assert.equal(fixture.clicks, 1);

    fixture.blocker.check();
    assert.equal(fixture.clicks, 1, 'the same skip button must not be clicked repeatedly');

    fixture.document.getElementById('movie_player').classList.remove('ad-showing');
    fixture.blocker.check();
    assert.equal(fixture.video.muted, false);
    assert.equal(fixture.video.playbackRate, 1);
    assert.equal(fixture.video.volume, 0.7);
});

test('frame blocker leaves normal content playback untouched', (t) => {
    const fixture = createFixture({ ad: false, duration: 200 });
    t.after(() => fixture.dom.window.close());
    fixture.video.currentTime = 42;

    fixture.blocker.check();
    assert.equal(fixture.video.currentTime, 42);
    assert.equal(fixture.video.playbackRate, 1);
    assert.equal(fixture.video.muted, false);
});

test('frame blocker preserves intentional mute after the ad', (t) => {
    const fixture = createFixture({ muted: true });
    t.after(() => fixture.dom.window.close());

    fixture.blocker.check();
    fixture.document.getElementById('movie_player').classList.remove('ad-showing');
    fixture.blocker.check();
    assert.equal(fixture.video.muted, true);
    assert.equal(fixture.video.playbackRate, 1);
});

test('frame blocker handles non-seekable ads without touching currentTime', (t) => {
    const fixture = createFixture({ duration: Number.NaN });
    t.after(() => fixture.dom.window.close());
    fixture.video.currentTime = 3;

    fixture.blocker.check();
    assert.equal(fixture.video.currentTime, 3);
    assert.equal(fixture.video.muted, true);
    assert.equal(fixture.video.playbackRate, 16);
});

test('frame blocker start and stop manage styles, observers and timers cleanly', (t) => {
    const fixture = createFixture({ ad: false });
    t.after(() => fixture.dom.window.close());

    fixture.blocker.start();
    assert.notEqual(fixture.blocker.timer, null);
    assert.notEqual(fixture.blocker.observer, null);
    assert.notEqual(fixture.document.getElementById('jakuplayer-adblock-style'), null);

    fixture.blocker.stop();
    assert.equal(fixture.blocker.timer, null);
    assert.equal(fixture.blocker.observer, null);
    assert.equal(fixture.document.getElementById('jakuplayer-adblock-style'), null);
});
