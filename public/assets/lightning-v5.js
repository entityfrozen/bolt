/* Lightning V5 — visual novel onboarding and a restrained, pose-based mascot.
 * This owns the workspace presentation while reusing the established account,
 * browser, community and AI implementations. It deliberately does not inject
 * Lightning-chan into browsing frames, private messages or staff tools.
 */
(() => {
  'use strict';
  if (!document.getElementById('boltShell')) return;

  const KEY = 'chan.settings';
  const TOUR_VERSION = 5;
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const defaults = {
    theme: 'light', seen: false, tourVersion: 0, voice: false,
    engine: 'browser', voiceId: '', browserVoice: '', rate: 1.1, pitch: 1.12,
    hud: { sidebar: 'full', announcement: true, shortcuts: true, motion: true,
      homeMascot: true, libraryMascot: true, aiMascot: true, scale: 100, side: 'right' }
  };
  const poses = {
    calm: 0, present: 1, explain: 2, excited: 3, think: 4
  };
  const dialogue = [
    { title: 'A brand-new beginning', pose: poses.present, target: null,
      text: 'Welcome to lightning!', note: 'Your workspace, reimagined.' },
    { title: 'First, your colors', pose: poses.explain, target: '#v4ThemeSwitch', theme: true,
      text: 'Theres two gui colors you can use, let me just pull those up... Okay! Light or Dark?',
      note: 'Pick whichever one feels like home. You can change your mind later.' },
    { title: 'Your new home', pose: poses.present, target: '.l5-welcome-banner',
      text: 'Great choice, now allow me to show you around.',
      note: 'Home is your starting point. Your real announcements and recent activity live here.' },
    { title: 'Announcements', pose: poses.think, target: '.v5-announcement-card',
      text: "Heres annoucements, altough amare usally posts his update logs in there for some reason.. He's such an idiot",
      note: 'The announcement cards show actual updates from Lightning, not fake sample posts.' },
    { title: 'The browser', pose: poses.explain, target: '#addressForm',
      text: "This is the browser! Search anything, keep a few tabs open, and don't forget where you put them. I definitely won't.",
      note: 'The address bar, browser history and bookmarks are all up top.' },
    { title: 'Community', pose: poses.present, target: '#v4NavCommunity',
      text: 'Here is Community! Friends, channels, messages... you know, all the social stuff. Try not to start a civil war in general chat.',
      note: 'Use the Community button on the left to enter your channels.' },
    { title: 'Library', pose: poses.calm, target: '#v4NavLibrary',
      text: 'And this is your Library. Activities, saved links, the things you actually came here for. I see you.',
      note: 'Your library is unchanged underneath the new interface.' },
    { title: 'AI assistant', pose: poses.explain, target: '#v4NavAI',
      text: "That's me too! Ask a question, get coding help, or just talk. I'm pretty good at more than looking cute.",
      note: 'Your existing AI conversations are still here.' },
    { title: 'HUD editor', pose: poses.explain, target: '#v4NavHUD',
      text: 'This is the HUD editor. You can hide me on certain pages, resize the layout, and make everything your own. Fair is fair!',
      note: 'You decide where the mascot appears. She never covers browser content.' },
    { title: 'Settings', pose: poses.think, target: '#v4NavSettings',
      text: 'And here are your settings. Themes, glass effects, personal preferences... all the fiddly stuff. Even I need a settings menu.',
      note: 'Preferences are saved to your Lightning account.' },
    { title: 'Ready?', pose: poses.excited, target: null,
      text: "That's it! You're officially ready for Lightning. I'll be around when you need help. Now go make something cool!",
      note: 'Replay this tour anytime with the ? button in the top bar.' }
  ];

  let prefs = structuredClone(defaults);
  let loaded = false, scene = 'home', step = 0, touring = false;
  let typingTimer = 0, autoTimer = 0, fullyTyped = false;
  let voiceList = [], voiceLoaded = false, audio = null, audioUrl = null;
  let speechToken = 0, speechController = null, speaking = false;
  let observing = false;
  const spriteUrl = '/assets/lightning-chan-v5-sprites.webp';
  const portrait = (name, pose = poses.calm) =>
    `<div class="l5-character ${name}" data-pose="${pose}" data-speaking="false" role="img" aria-label="Lightning-chan, a 2D anime mascot"><div class="l5-character-art"></div></div>`;

  const ui = document.createElement('div');
  ui.id = 'lightningV5';
  ui.innerHTML = `
    <section class="l5-novel" id="l5Novel" role="dialog" aria-modal="true" aria-label="Lightning-chan guided tour" hidden>
      <div class="l5-scrim"></div>
      <div class="l5-focus" id="l5Focus" hidden></div>
      <div class="l5-novel-scene" aria-hidden="true"><div class="l5-scene-glow"></div>${portrait('l5-tour-character', 1)}</div>
      <div class="l5-vn-box">
        <div class="l5-nameplate"><span>ϟ</span> Lightning-chan <small id="l5Chapter">CHAPTER 01</small></div>
        <div class="l5-vn-toolbar"><button type="button" id="l5Auto" aria-pressed="false">▷ Auto</button>
          <button type="button" id="l5Voice" aria-pressed="false">◖ Voice</button>
          <button type="button" id="l5Log">☷ Log</button><button type="button" id="l5Skip">⏭ Skip tour</button></div>
        <p class="l5-dialogue" id="l5Dialogue" aria-live="polite"></p>
        <div class="l5-theme-choice" id="l5ThemeChoice" hidden>
          <button type="button" data-l5-theme="light"><span>☀</span><strong>Light</strong><small>Bright lavender</small></button>
          <button type="button" data-l5-theme="dark"><span>☾</span><strong>Dark</strong><small>Midnight violet</small></button>
        </div>
        <div class="l5-vn-footer"><span id="l5TourHint"></span><div>
          <button type="button" id="l5Back">← Back</button><button type="button" id="l5Next">Continue <span>▾</span></button>
        </div></div>
      </div>
      <div class="l5-log" id="l5DialogueLog" hidden><header><strong>Lightning-chan · Dialogue log</strong>
        <button type="button" id="l5CloseLog">✕</button></header><div id="l5LogContent"></div></div>
    </section>
    <dialog class="l5-editor" id="l5HudEditor" aria-labelledby="l5EditorTitle">
      <header><div><small>MAKE IT YOURS / V5</small><h2 id="l5EditorTitle">HUD Editor</h2><p>A workspace that fits the way you use it.</p></div>
        <button type="button" id="l5EditorClose" aria-label="Close HUD editor">✕</button></header>
      <div class="l5-editor-body"><div class="l5-editor-preview"><span>LIVE PREVIEW</span>
        <div class="l5-editor-screen"><div class="l5-editor-side"></div><div class="l5-editor-cards"></div>
          ${portrait('l5-editor-character', 4)}</div><p>Your changes appear immediately and sync to your account.</p></div>
        <div class="l5-editor-options">
          <fieldset><legend>Color theme</legend><div class="l5-segments"><button data-l5-theme="light">☀ Daybreak</button><button data-l5-theme="dark">☾ Midnight</button></div></fieldset>
          <fieldset><legend>Sidebar</legend><div class="l5-segments"><button data-l5-sidebar="full">Comfortable</button><button data-l5-sidebar="compact">Compact</button></div></fieldset>
          <fieldset><legend>Where Lightning-chan appears</legend>
            <label><input id="l5HomeMascot" type="checkbox"> Home dashboard</label>
            <label><input id="l5LibraryMascot" type="checkbox"> Library</label>
            <label><input id="l5AiMascot" type="checkbox"> AI assistant</label>
            <small>Never shown over web pages, DMs, games or the admin console.</small></fieldset>
          <fieldset><legend>Layout</legend><label><input id="l5Announcements" type="checkbox"> Show announcements on Home</label>
            <label><input id="l5Shortcuts" type="checkbox"> Show quick actions</label>
            <label><input id="l5Motion" type="checkbox"> Interface animations</label>
            <label class="l5-slider-label">Mascot size <output id="l5ScaleOutput">100%</output><input id="l5Scale" type="range" min="80" max="130" step="5"></label></fieldset>
        </div></div><footer><button id="l5Reset" type="button">Reset defaults</button><button id="l5EditorDone" type="button">Save changes ✓</button></footer>
    </dialog>
    <dialog id="l5VoiceStudio" class="l5-voice-studio" aria-labelledby="l5VoiceTitle">
      <header><div><small>LIGHTNING-CHAN / VOICE</small><h2 id="l5VoiceTitle">Voice studio</h2><p>Preview voices. Nothing plays automatically without your choice.</p></div>
        <button id="l5VoiceClose" aria-label="Close voice studio">✕</button></header>
      <div class="l5-voice-controls"><label>Speech engine<select id="l5Engine"><option value="browser">Browser voice</option><option value="voiceai">Voice.ai</option></select></label>
        <label>Voice<select id="l5VoiceList"></select></label><p id="l5VoiceHint"></p>
        <label>Speed <output id="l5RateOutput"></output><input id="l5Rate" type="range" min=".85" max="1.4" step=".05"></label>
        <label>Pitch <output id="l5PitchOutput"></output><input id="l5Pitch" type="range" min=".8" max="1.35" step=".05"></label>
        <div class="l5-voice-buttons"><button id="l5PlaySample">▶ Play sample</button><button id="l5StopSample">Stop</button></div>
      </div>
    </dialog>`;
  document.body.append(ui);
  const novel = $('#l5Novel');
  const editor = $('#l5HudEditor');
  const voiceStudio = $('#l5VoiceStudio');

  function save() {
    if (!loaded) return;
    const copy = structuredClone(prefs);
    Promise.resolve(window.LightningAccount?.settings.set(KEY, copy)).catch(error => {
      console.warn('Could not save Lightning appearance:', error.message);
    });
  }

  function load() {
    if (loaded) return;
    const account = window.LightningAccount?.settings;
    const previous = account?.get(KEY, null);
    if (previous && typeof previous === 'object') {
      prefs = { ...defaults, ...previous, hud: { ...defaults.hud, ...(previous.hud || {}) } };
    }
    if (!['light', 'dark'].includes(prefs.theme)) prefs.theme = 'light';
    if (!['full', 'compact'].includes(prefs.hud.sidebar)) prefs.hud.sidebar = 'full';
    prefs.hud.scale = Math.max(80, Math.min(130, Number(prefs.hud.scale) || 100));
    loaded = true;
    apply();
    showHome();
    if (Number(prefs.tourVersion) < TOUR_VERSION) {
      setTimeout(() => { if (!touring) startTour(); }, 700);
    }
  }

  function apply() {
    const root = document.documentElement;
    root.dataset.l5Theme = prefs.theme;
    root.dataset.chanTheme = prefs.theme; // existing settings and glass controls
    root.dataset.l5Motion = prefs.hud.motion ? 'yes' : 'no';
    document.body.dataset.l5Sidebar = prefs.hud.sidebar;
    document.body.dataset.l5Announcements = prefs.hud.announcement ? 'yes' : 'no';
    document.body.dataset.l5Shortcuts = prefs.hud.shortcuts ? 'yes' : 'no';
    root.style.setProperty('--l5-character-scale', (prefs.hud.scale / 100).toFixed(2));
    $$('[data-l5-theme]').forEach(button => {
      const active = button.dataset.l5Theme === prefs.theme;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $$('[data-l5-sidebar]').forEach(button => button.classList.toggle('active', button.dataset.l5Sidebar === prefs.hud.sidebar));
    $$('[data-v4-theme]').forEach(button => {
      const active = button.dataset.v4Theme === prefs.theme;
      button.setAttribute('aria-pressed', String(active));
    });
    const boxes = { l5HomeMascot: prefs.hud.homeMascot, l5LibraryMascot: prefs.hud.libraryMascot,
      l5AiMascot: prefs.hud.aiMascot, l5Announcements: prefs.hud.announcement,
      l5Shortcuts: prefs.hud.shortcuts, l5Motion: prefs.hud.motion };
    Object.entries(boxes).forEach(([id, on]) => { const box = $('#' + id); if (box) box.checked = Boolean(on); });
    $('#l5Scale').value = String(prefs.hud.scale);
    $('#l5ScaleOutput').textContent = `${prefs.hud.scale}%`;
    updateCharacterVisibility();
  }

  function setTheme(theme) {
    if (!['light', 'dark'].includes(theme)) return;
    prefs.theme = theme;
    apply(); save();
    if (touring) { $('#l5TourHint').textContent = `Nice. ${theme === 'light' ? 'Daybreak' : 'Midnight'} it is!`; }
  }

  function setNav(id) {
    $$('.rail .rail-button').forEach(button => button.classList.toggle('active', button.id === id));
  }
  function openHub(view) {
    const mount = $('#hubMount');
    if (mount) mount.hidden = false;
    scene = view === 'overview' ? 'home' : view;
    updateCharacterVisibility();
    import('/assets/hub.js?v=48').then(mod => mod.openHub(view)).catch(error => console.warn('Hub failed:', error));
  }
  function showHome() { openHub('overview'); setNav('v4NavHome'); }
  function showBrowser() {
    scene = 'browser';
    $('#hubMount').hidden = true;
    $('#newTabBtn')?.click();
    setNav('v4NavBrowser');
    updateCharacterVisibility();
  }
  function showAi() {
    if (touring) finishTour();
    const bubble = $('#boltBubble'), panel = $('#boltAiPanel');
    if (panel?.getAttribute('aria-hidden') !== 'false') bubble?.click();
    requestAnimationFrame(() => $('#boltAiInput')?.focus());
    decorateAi();
  }

  function upgradeHome() {
    const home = $('#hubMount .v5-dashboard-inner');
    if (!home || home.querySelector('.l5-welcome-banner')) return;
    const hero = document.createElement('section');
    hero.className = 'l5-welcome-banner';
    hero.innerHTML = `<div class="l5-hero-copy"><span class="l5-eyebrow">✦ THE NEXT CHAPTER / LIGHTNING V5</span>
      <h1>Welcome to <em>Lightning!</em></h1><p>Browsing, community, and everything you love—all in a brand-new home.</p>
      <div class="l5-hero-buttons"><button type="button" data-l5-go="browser">◉ Open Browser</button>
      <button type="button" data-l5-go="tour">✧ Meet Lightning-chan</button></div>
      <span class="l5-hero-foot">YOUR SPACE. YOUR STYLE. YOUR RULES.</span></div>
      <div class="l5-hero-glow"></div>${portrait('l5-hero-character', poses.present)}`;
    home.prepend(hero);
    const quick = document.createElement('section');
    quick.className = 'l5-quickbar';
    quick.innerHTML = `<span><b>QUICK ACCESS</b><small>Where to next?</small></span>
      <button type="button" data-l5-go="browser">◉ <strong>Browser</strong></button>
      <button type="button" data-l5-go="community">♧ <strong>Community</strong></button>
      <button type="button" data-l5-go="library">▤ <strong>Library</strong></button>
      <button type="button" data-l5-go="hud">▣ <strong>Edit HUD</strong></button>`;
    hero.after(quick);
    updateCharacterVisibility();
  }

  function decorateLibrary() {
    const page = $('#hubMount .v3-apps-page');
    if (!page || page.querySelector('.l5-library-hello')) return;
    const header = $('.v3-apps-header', page);
    if (!header) return;
    const card = document.createElement('aside');
    card.className = 'l5-library-hello';
    card.innerHTML = `<div><span>✧ LIGHTNING-CHAN SAYS</span><strong>Find your next favorite.</strong>
      <p>Everything in your library, right where you left it.</p></div>${portrait('l5-library-character', poses.think)}`;
    header.after(card);
    updateCharacterVisibility();
  }

  function decorateAi() {
    const panel = $('#boltAiPanel');
    if (!panel || $('#l5AiBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'l5AiBanner';
    banner.className = 'l5-ai-banner';
    banner.innerHTML = `${portrait('l5-ai-character', poses.calm)}<div><span>YOUR DIGITAL SIDEKICK</span>
      <strong>Lightning-chan</strong><small>Ask a question, explore an idea, or just say hi.</small></div>`;
    const after = $('.bolt-ai-workspace-top', panel);
    if (after) after.after(banner);
    updateCharacterVisibility();
  }

  function updateCharacterVisibility() {
    const hero = $('.l5-hero-character');
    if (hero) hero.hidden = !prefs.hud.homeMascot || touring;
    const library = $('.l5-library-hello');
    if (library) library.hidden = !prefs.hud.libraryMascot;
    const ai = $('#l5AiBanner');
    if (ai) ai.hidden = !prefs.hud.aiMascot;
  }

  function pose(element, index) {
    if (!element) return;
    element.dataset.pose = String(Math.max(0, Math.min(4, Number(index) || 0)));
    element.dataset.speaking = String(speaking);
  }
  function mouth(open) {
    speaking = Boolean(open);
    $$('.l5-character').forEach(element => { element.dataset.speaking = String(speaking); });
  }

  function stopSpeech() {
    ++speechToken;
    speechController?.abort(); speechController = null;
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio = null; }
    if (audioUrl) { URL.revokeObjectURL(audioUrl); audioUrl = null; }
    window.speechSynthesis?.cancel();
    mouth(false);
  }

  async function speak(text, force = false) {
    if (!prefs.voice && !force) return;
    stopSpeech();
    const token = speechToken;
    const trimmed = String(text || '').replace(/https?:\/\/\S+/g, 'a link').replace(/[#*\[\]<>]/g, ' ').trim().slice(0, 500);
    if (!trimmed) return;
    if (prefs.engine === 'voiceai') {
      const controller = new AbortController(); speechController = controller;
      try {
        const response = await fetch('/api/chan/speech', { method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({ text: trimmed, ...(prefs.voiceId ? { voiceId: prefs.voiceId } : {}) }) });
        if (!response.ok) throw Error('Voice.ai did not return audio');
        const blob = await response.blob();
        if (token !== speechToken) return;
        audioUrl = URL.createObjectURL(blob);
        audio = new Audio(audioUrl);
        audio.onplaying = () => { if (token === speechToken) mouth(true); };
        audio.onended = () => { if (token === speechToken) stopSpeech(); };
        audio.onerror = () => { if (token === speechToken) stopSpeech(); };
        await audio.play();
        return;
      } catch (error) {
        if (token !== speechToken) return;
        console.warn('Voice.ai unavailable, using browser speech:', error.message);
      }
    }
    const synth = window.speechSynthesis;
    if (!synth || !window.SpeechSynthesisUtterance) { mouth(false); return; }
    const line = new SpeechSynthesisUtterance(trimmed);
    const voices = synth.getVoices().filter(voice => /^en/i.test(voice.lang));
    line.voice = voices.find(voice => voice.name === prefs.browserVoice)
      || voices.find(voice => /jenny|aria|samantha|ava|zira|karen/i.test(voice.name)) || voices[0] || null;
    line.rate = Number(prefs.rate) || 1.1;
    line.pitch = Number(prefs.pitch) || 1.12;
    line.onstart = () => { if (token === speechToken) mouth(true); };
    line.onend = line.onerror = () => { if (token === speechToken) mouth(false); };
    synth.speak(line);
  }

  function completeTyping() {
    clearInterval(typingTimer);
    fullyTyped = true;
    $('#l5Dialogue').textContent = dialogue[step].text;
  }
  function typeLine(line) {
    clearInterval(typingTimer); fullyTyped = false;
    const output = $('#l5Dialogue');
    output.textContent = '';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      completeTyping(); return;
    }
    let count = 0;
    typingTimer = window.setInterval(() => {
      count = Math.min(line.length, count + 2);
      output.textContent = line.slice(0, count);
      if (count === line.length) completeTyping();
    }, 22);
  }
  function spotlight() {
    const selector = dialogue[step]?.target;
    const target = selector ? $(selector) : null;
    const focus = $('#l5Focus');
    if (!target) { focus.hidden = true; return; }
    const rect = target.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) { focus.hidden = true; return; }
    focus.hidden = false;
    focus.style.left = `${Math.max(3, rect.left - 6)}px`;
    focus.style.top = `${Math.max(3, rect.top - 6)}px`;
    focus.style.width = `${Math.min(window.innerWidth - 6, rect.width + 12)}px`;
    focus.style.height = `${Math.min(window.innerHeight - 6, rect.height + 12)}px`;
  }
  function displayStep(index, speakLine = false) {
    clearTimeout(autoTimer);
    stopSpeech();
    step = Math.max(0, Math.min(dialogue.length - 1, index));
    const chapter = dialogue[step];
    $('#l5Chapter').textContent = `CHAPTER ${String(step + 1).padStart(2, '0')} / ${dialogue.length}`;
    $('#l5TourHint').textContent = chapter.note;
    $('#l5ThemeChoice').hidden = !chapter.theme;
    $('#l5Back').disabled = step === 0;
    $('#l5Next').innerHTML = step === dialogue.length - 1 ? 'Finish tour <span>✓</span>' : 'Continue <span>▾</span>';
    pose($('.l5-tour-character'), chapter.pose);
    typeLine(chapter.text);
    requestAnimationFrame(spotlight);
    if (speakLine && prefs.voice) void speak(chapter.text);
    if ($('#l5Auto').getAttribute('aria-pressed') === 'true') {
      autoTimer = window.setTimeout(() => {
        if (!touring) return;
        if (step === dialogue.length - 1) finishTour(); else displayStep(step + 1, true);
      }, Math.max(4000, chapter.text.length * 63));
    }
  }
  function startTour() {
    if (touring) return;
    touring = true; scene = 'tour';
    novel.hidden = false;
    document.body.classList.add('l5-tour-active');
    showHome();
    updateCharacterVisibility();
    displayStep(0);
    $('#l5Next').focus({ preventScroll: true });
  }
  function finishTour() {
    if (!touring) return;
    touring = false;
    novel.hidden = true;
    document.body.classList.remove('l5-tour-active');
    clearTimeout(autoTimer); clearInterval(typingTimer); stopSpeech();
    prefs.seen = true; prefs.tourVersion = TOUR_VERSION;
    save(); apply();
    scene = 'home';
    $('#v4Help')?.focus({ preventScroll: true });
  }
  function nextStep() {
    if (!fullyTyped) { completeTyping(); return; }
    if (step >= dialogue.length - 1) finishTour();
    else displayStep(step + 1, true);
  }

  function openEditor() {
    apply();
    if (!editor.open) editor.showModal();
  }
  function closeEditor() { if (editor.open) editor.close(); save(); }
  async function loadVoices() {
    if (voiceLoaded) return;
    try {
      const response = await fetch('/api/chan/voices', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      voiceList = Array.isArray(data.voices) ? data.voices : [];
      voiceLoaded = Boolean(data.configured);
      if (!prefs.voiceId && voiceList.length) {
        const favorite = voiceList.find(voice => /ellie|anime|sakura|yuki|aria/i.test(voice.name));
        if (favorite) { prefs.voiceId = favorite.id; save(); }
      }
    } catch { voiceList = []; }
    if (voiceStudio.open) renderVoices();
  }
  function renderVoices() {
    $('#l5Engine').value = prefs.engine;
    const select = $('#l5VoiceList');
    if (prefs.engine === 'voiceai') {
      select.innerHTML = '<option value="">Voice.ai default</option>' + voiceList.map(voice =>
        `<option value="${escape(voice.id)}" ${voice.id === prefs.voiceId ? 'selected' : ''}>${escape(voice.name)}</option>`).join('');
      $('#l5VoiceHint').textContent = voiceLoaded ? 'Select a voice your Voice.ai account provides.' :
        'Voice.ai is not configured or is temporarily unavailable. Browser speech still works.';
    } else {
      const voices = window.speechSynthesis?.getVoices().filter(voice => /^en/i.test(voice.lang)) || [];
      select.innerHTML = '<option value="">Auto-select a bright English voice</option>' + voices.map(voice =>
        `<option value="${escape(voice.name)}" ${voice.name === prefs.browserVoice ? 'selected' : ''}>${escape(voice.name)}</option>`).join('');
      $('#l5VoiceHint').textContent = 'Available voices depend on your device and browser.';
    }
    $('#l5Rate').value = prefs.rate;
    $('#l5Pitch').value = prefs.pitch;
    $('#l5RateOutput').textContent = `${Number(prefs.rate).toFixed(2)}×`;
    $('#l5PitchOutput').textContent = Number(prefs.pitch).toFixed(2);
  }
  function openVoice() {
    if (!voiceStudio.open) voiceStudio.showModal();
    renderVoices(); void loadVoices();
  }

  function observe() {
    if (observing) return;
    observing = true;
    const mount = $('#hubMount');
    const observer = new MutationObserver(() => {
      upgradeHome(); decorateLibrary(); decorateAi();
      if (touring) requestAnimationFrame(spotlight);
    });
    if (mount) observer.observe(mount, { childList: true, subtree: true });
    const aiPanel = $('#boltAiPanel');
    if (aiPanel) {
      const aiObserver = new MutationObserver(() => decorateAi());
      aiObserver.observe(aiPanel, { attributes: true, attributeFilter: ['aria-hidden'] });
    }
    window.addEventListener('resize', () => { if (touring) requestAnimationFrame(spotlight); });
  }

  ui.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.l5Theme) { setTheme(button.dataset.l5Theme); return; }
    if (button.dataset.l5Sidebar) { prefs.hud.sidebar = button.dataset.l5Sidebar; apply(); save(); return; }
    if (button.dataset.l5Go) {
      if (button.dataset.l5Go === 'browser') showBrowser();
      else if (button.dataset.l5Go === 'tour') startTour();
      else if (button.dataset.l5Go === 'hud') openEditor();
      else if (button.dataset.l5Go === 'community') openHub('chat');
      else if (button.dataset.l5Go === 'library') openHub('games');
      return;
    }
    switch (button.id) {
      case 'l5Next': nextStep(); break;
      case 'l5Back': if (step > 0) displayStep(step - 1, false); break;
      case 'l5Skip': finishTour(); break;
      case 'l5Voice': {
        const on = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', String(on)); prefs.voice = on; save();
        if (on) void speak(dialogue[step].text, true); else stopSpeech(); break;
      }
      case 'l5Auto': {
        const on = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', String(on));
        clearTimeout(autoTimer);
        if (on) displayStep(step, false);
        break;
      }
      case 'l5Log': {
        const log = $('#l5DialogueLog'); log.hidden = !log.hidden;
        if (!log.hidden) $('#l5LogContent').innerHTML = dialogue.slice(0, step + 1).map(item =>
          `<p><strong>Lightning-chan</strong><br>${escape(item.text)}</p>`).join('');
        break;
      }
      case 'l5CloseLog': $('#l5DialogueLog').hidden = true; break;
      case 'l5EditorClose': case 'l5EditorDone': closeEditor(); break;
      case 'l5Reset': prefs.hud = { ...defaults.hud }; apply(); save(); break;
      case 'l5VoiceClose': voiceStudio.close(); break;
      case 'l5PlaySample': void speak("Hey! I'm Lightning-chan, your favorite little bolt of energy!", true); break;
      case 'l5StopSample': stopSpeech(); break;
    }
  });
  ui.addEventListener('change', event => {
    const target = event.target;
    const bindings = { l5HomeMascot: 'homeMascot', l5LibraryMascot: 'libraryMascot',
      l5AiMascot: 'aiMascot', l5Announcements: 'announcement',
      l5Shortcuts: 'shortcuts', l5Motion: 'motion' };
    if (bindings[target.id]) prefs.hud[bindings[target.id]] = target.checked;
    else if (target.id === 'l5Engine') { prefs.engine = target.value; renderVoices(); void loadVoices(); }
    else if (target.id === 'l5VoiceList') {
      if (prefs.engine === 'voiceai') prefs.voiceId = target.value;
      else prefs.browserVoice = target.value;
    } else return;
    apply(); save();
  });
  ui.addEventListener('input', event => {
    const field = event.target;
    if (field.id === 'l5Scale') prefs.hud.scale = Number(field.value);
    else if (field.id === 'l5Rate') prefs.rate = Number(field.value);
    else if (field.id === 'l5Pitch') prefs.pitch = Number(field.value);
    else return;
    if (field.id === 'l5Scale') apply();
    else renderVoices();
    save();
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || ui.contains(button)) return;
    // Home's real quick-action buttons live in the hub, not the companion root.
    if (button.dataset.l5Go) {
      const action = button.dataset.l5Go;
      if (action === 'browser') showBrowser();
      else if (action === 'tour') startTour();
      else if (action === 'hud') openEditor();
      else if (action === 'community') openHub('chat');
      else if (action === 'library') openHub('games');
      return;
    }
    if (button.dataset.v4Theme) { setTheme(button.dataset.v4Theme); return; }
    if (button.hasAttribute('data-v4-tour') || button.hasAttribute('data-chan-open')) { startTour(); return; }
    if (button.dataset.v4Hud !== undefined) { openEditor(); return; }
    if (button.dataset.v4Ai !== undefined) { showAi(); return; }
    if (button.dataset.v4Home !== undefined) { showHome(); return; }
    if (button.dataset.v4Browser !== undefined) { showBrowser(); return; }
    if (button.hasAttribute('data-hub')) {
      scene = button.dataset.hub;
      if (button.id) setNav(button.id);
      updateCharacterVisibility();
    }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault(); startTour();
    }
    if (event.key === 'Escape' && touring && !voiceStudio.open && !editor.open) finishTour();
    if (event.key === 'Enter' && touring && event.target === $('#l5Novel')) nextStep();
  });
  document.addEventListener('lightning:ai-answer', event => {
    if (event.detail?.text && prefs.hud.aiMascot && $('#boltAiPanel')?.getAttribute('aria-hidden') === 'false') {
      void speak(event.detail.text);
    }
  });
  document.addEventListener('lightning:account-settings-loaded', load);
  document.addEventListener('lightning:workspace-ready', () => { upgradeHome(); decorateLibrary(); });
  // Tool panel is added from another defer script; initialization sees it after load.
  window.addEventListener('load', () => { observe(); upgradeHome(); decorateLibrary(); decorateAi(); });
  if (document.readyState === 'complete') { observe(); upgradeHome(); decorateAi(); }
  window.LightningChan = { open: startTour, openTour: startTour, openHUD: openEditor,
    openVoice, speak, stop: stopSpeech, setPose: index => {
      [$('.l5-hero-character'), $('.l5-ai-character')].forEach(element => pose(element, index));
    } };
})();