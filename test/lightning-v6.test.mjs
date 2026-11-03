import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const source = read('views/app.html');
const html = source.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
const app = read('public/assets/lightning-v6.js');
const styles = read('public/assets/lightning-v6.css');

test('Chapter VI has a completely restructured shell but retains every service hook', () => {
  assert.match(source, /<title>&#76;ightning<\/title>/);
  assert.match(html, /lightning-v6\.js\?v=1/);
  assert.match(html, /lightning-v6\.css\?v=1/);
  assert.doesNotMatch(html, /src="\/assets\/lightning-v5\.js|href="\/assets\/lightning-v5/);
  assert.doesNotMatch(html, /src="\/assets\/lightning-chan-v4\.js/);
  assert.match(html, /class="workarea ln-layout"/);
  assert.match(html, /class="rail ln-sidebar"/);
  assert.match(html, /class="ln-main"/);
  assert.match(html, /class="toolbar ln-toolbar"/);
  assert.match(styles, /--ln-sidebar:234px/);
  for (const id of ['boltShell','tabs','newTabBtn','homeMark','accountButton','accountInitial',
    'addressForm','addressInput','backBtn','forwardBtn','reloadBtn','bookmarkBtn',
    'newtabView','newtabForm','newtabInput','recentList','bookmarkList',
    'frameStack','hubMount','sidePanel','panelTitle','panelBody','panelClose',
    'accountPopover','toast','v4NavHome','v4NavBrowser','v4NavAI','v4NavHUD','v4Help']) {
    assert.ok(html.includes(`id="${id}"`), 'Missing original behavior hook ' + id);
  }
});

test('Mascot lives on selected screens, rather than over web pages or staff tools', () => {
  for (const className of ['ln-home-character','ln-library-character', 'ln-ai-character','ln-tour-character']) {
    assert.ok(app.includes(className), 'Missing scoped mascot ' + className);
  }
  assert.match(app, /Never shown over web pages, games, private messages or the admin console/);
  assert.match(app, /prefs\.hud\.homeMascot \|\| touring/);
  assert.match(app, /prefs\.hud\.libraryMascot \|\| touring/);
  assert.match(app, /prefs\.hud\.aiMascot \|\| touring/);
  assert.match(app, /function decorateHome\(/);
  assert.match(app, /function decorateLibrary\(/);
  assert.match(app, /function decorateAi\(/);
});

test('Mouth frames use the exact same pose registration, toggling only on real speech events', () => {
  const webp = fs.readFileSync(new URL('../public/assets/lightning-chan-v6-sprites.webp', import.meta.url));
  assert.ok(webp.length > 200_000 && webp.length < 1_500_000, 'Optimized sprite atlas expected');
  assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
  assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
  assert.match(styles, /background:url\('\/assets\/lightning-chan-v6-sprites\.webp\?v=1'\)/);
  assert.match(styles, /background-position-y:100%/);
  assert.match(app, /character\.dataset\.speaking = String\(!!isOpen\)/);
  assert.match(app, /audio\.onplaying = \(\) => \{ if \(token === speechToken\) mouth\(true\)/);
  assert.match(app, /audio\.onended = \(\) => \{ if \(token === speechToken\) finishedSpeech\(token\)/);
  assert.match(app, /line\.onstart = \(\) => \{ if \(token === speechToken\) mouth\(true\)/);
  assert.match(app, /line\.onend = line\.onerror = \(\) => finishedSpeech\(token\)/);
  assert.match(app, /function stopSpeech\(\)/);
  assert.match(app, /mouth\(false\)/);
  assert.doesNotMatch(app, /setInterval\([^)]*mouth/);
});

test('Visual-novel tutorial has the actual requested dialogue and spotlights real UI controls', () => {
  const lines = [
    'Welcome to lightning!',
    'Theres two gui colors you can use, let me just pull those up... Okay! Light or Dark?',
    'Great choice, now allow me to show you around.',
    "Heres annoucements, altough amare usally posts his update logs in there for some reason.. He's such an idiot"
  ];
  for (const line of lines) assert.ok(app.includes(line), 'Missing dialogue: ' + line);
  for (const selector of ['#v4ThemeSwitch','.v5-announcement-card','#addressForm',
    '#v4NavAI','#v4NavLibrary','#v4NavCommunity','#v4NavHUD','#v4NavSettings']) {
    assert.ok(app.includes(selector), 'Missing target: ' + selector);
  }
  assert.match(app, /TOUR_VERSION = 6/);
  assert.match(app, /prefs\.tourVersion = TOUR_VERSION/);
  assert.match(app, /lightning:account-settings-loaded/);
  assert.match(app, /getBoundingClientRect\(\)/);
  assert.match(app, /polygon\(evenodd/);
  assert.match(styles, /\.ln-tour-dialogue/);
  assert.match(styles, /\.ln-tour-nameplate/);
  assert.match(styles, /\.ln-tour-themes/);
});

test('New Home, navigation, editor and AI reuse actual application services', () => {
  assert.match(app, /import\('\/assets\/hub\.js\?v=48'\)/);
  assert.match(app, /\['browse', '◎', 'Browse'/);
  assert.match(app, /function openEditor\(/);
  assert.match(app, /function openAi\(/);
  assert.match(app, /function hideHub\(/);
  assert.match(app, /mount\.hidden = true/);
  assert.match(app, /\/api\/chan\/voices/);
  assert.match(app, /\/api\/chan\/speech/);
  assert.match(app, /lightning:ai-answer/);
  assert.match(app, /window\.LightningChan = \{/);
  assert.match(styles, /@media\(max-width:510px\)/);
  assert.match(styles, /html\[data-ln-theme="light"\]/);
  assert.doesNotMatch(app + source, /vk_[a-zA-Z0-9]{24,}/);
  assert.match(read('account-space.js'), /"chan\.settings"/);
});