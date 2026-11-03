/* Lightning / Chapter Six
   A new interface around the established account, browser, community and AI engines.
   Character animation is deliberately two-state: her mouth is open while audio
   is *actually playing*, closed at every other moment. */
(() => {
  'use strict';
  if (!document.getElementById('boltShell')) return;

  const PREF_KEY = 'chan.settings';
  const TOUR_VERSION = 6;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const defaults = {
    tourVersion: 0,
    theme: 'dark',
    voice: false,
    engine: 'browser',
    voiceId: '',
    browserVoice: '',
    rate: 1.1,
    pitch: 1.06,
    auto: false,
    hud: {
      sidebar: 'comfortable',
      homeMascot: true,
      libraryMascot: true,
      aiMascot: true,
      announcements: true,
      shortcuts: true,
      motion: true,
      pose: 1
    }
  };

  const tour = [
    {
      label: 'Welcome', pose: 1,
      line: 'Welcome to lightning!',
      help: "I'm Lightning-chan! I'll show you around your brand-new workspace. You've got a few things to discover."
    },
    {
      label: 'Appearance', pose: 4, target: '#v4ThemeSwitch', chooseTheme: true,
      line: 'Theres two gui colors you can use, let me just pull those up... Okay! Light or Dark?',
      help: 'Midnight is purple and cozy. Daybreak is bright and soft. You can change your mind whenever you like.'
    },
    {
      label: 'Navigation', pose: 0, target: '.ln-sidebar',
      line: 'Great choice, now allow me to show you around.',
      help: 'The sidebar is your map. All your main destinations are grouped on the left.'
    },
    {
      label: 'Announcements', pose: 3, target: '.v5-announcement-card',
      line: "Heres annoucements, altough amare usally posts his update logs in there for some reason.. He's such an idiot",
      help: 'Real announcements from the community show up here. And yes, Amare posts his update logs here too.'
    },
    {
      label: 'Browser', pose: 2, target: '#addressForm',
      line: "Here's your browser. Search whatever you want, open tabs, bookmark sites... Just don't ask me to organize 200 tabs.",
      help: 'Everything you browse still uses the existing Lightning browser. You can find history and bookmarks here too.'
    },
    {
      label: 'Library', pose: 1, target: '#v4NavLibrary',
      line: "This is the Library! Your saved places, games and activities are all here. A very respectable collection of distractions.",
      help: 'Use Library whenever you want to jump into something fun.'
    },
    {
      label: 'Community', pose: 4, target: '#v4NavCommunity',
      line: "Over here is Community. Talk with friends, join channels and keep up with everyone!",
      help: 'Your existing servers, conversations and account are untouched.'
    },
    {
      label: 'AI', pose: 0, target: '#v4NavAI',
      line: "And that sparkle is me! You can ask me questions or get help with whatever you're doing.",
      help: 'Lightning AI keeps your existing conversation history. Voice replies can be turned on whenever you want.'
    },
    {
      label: 'HUD Editor', pose: 2, target: '#v4NavHUD',
      line: "Here's the HUD Editor! Make the sidebar smaller, choose when I appear, and make this place your own.",
      help: 'I only show up on Home, in the guide, and optionally in the Library or AI. I stay out of your browser pages.'
    },
    {
      label: 'Settings', pose: 4, target: '#v4NavSettings',
      line: 'Last stop, your settings! There are more options in here if you want to tweak how Lightning works.',
      help: 'Most preferences follow your account across devices.'
    },
    {
      label: 'All set', pose: 3,
      line: "And that's everything! You're officially ready. I'll be around when you need me. Have fun!",
      help: 'You can replay this guide using the question-mark in the top bar.'
    }
  ];

  let prefs = structuredClone(defaults);
  let initialized = false;
  let touring = false;
  let step = 0;
  let scene = 'home';
  let speechToken = 0;
  let audio = null;
  let audioUrl = null;
  let controller = null;
  let voices = [];
  let voiceConfigured = false;
  let voiceLoading = false;
  let typeFrame = 0;
  let typeProgress = 0;
  let textFinished = true;
  let autoTimer = 0;
  let nextTourPending = false;
  let mutationFrame = 0;

  const sprite = (pose, className = '') => `<div class="ln-character ${className}" data-pose="${pose}" data-speaking="false" role="img" aria-label="Lightning-chan, a silver-haired anime girl"><div class="ln-character-art"></div></div>`;

  const root = document.createElement('div');
  root.id = 'lnCompanion';
  root.innerHTML = `
    <div class="ln-tour" id="lnTour" role="dialog" aria-modal="true" aria-label="Lightning-chan guided tutorial" hidden>
      <div class="ln-tour-shade" id="lnTourShade"></div>
      <div class="ln-tour-target" id="lnTourTarget" hidden></div>
      <span class="ln-tour-edition">ϟ LIGHTNING <b>CHAPTER VI</b></span>
      <button type="button" id="lnTourExit" class="ln-tour-close" aria-label="Skip tutorial">✕ <span>Skip tour</span></button>
      <div class="ln-tour-visual">${sprite(1, 'ln-tour-character')}</div>
      <div class="ln-tour-dialogue">
        <div class="ln-tour-nameplate">ϟ &nbsp; Lightning-chan</div>
        <div class="ln-tour-controls">
          <button type="button" id="lnAuto" aria-pressed="false">⏭ Auto</button>
          <button type="button" id="lnLog">☷ Log</button>
          <button type="button" id="lnVoice">◖)) Voice</button>
        </div>
        <div class="ln-tour-writing">
          <p id="lnDialogueText" aria-live="polite"></p>
          <small id="lnDialogueHelp"></small>
        </div>
        <div id="lnThemeChoice" class="ln-tour-themes" hidden>
          <button type="button" data-ln-choice="dark"><span class="ln-theme-sample midnight"><i></i><b></b></span><strong>☾ Midnight</strong><small>Deep violet and soft glow</small></button>
          <button type="button" data-ln-choice="light"><span class="ln-theme-sample daybreak"><i></i><b></b></span><strong>☀ Daybreak</strong><small>Light lavender and clarity</small></button>
        </div>
        <div class="ln-tour-endline"><span id="lnTourCounter">01 / 11</span><div class="ln-tour-dots" id="lnTourDots"></div>
          <button type="button" id="lnPrev">← Back</button>
          <button type="button" id="lnNext">Continue <b>➜</b></button></div>
      </div>
    </div>
    <dialog class="ln-editor" id="lnHudEditor" aria-labelledby="lnHudTitle">
      <header><div><span class="ln-modal-kicker">YOUR PERSONAL SPACE</span><h2 id="lnHudTitle">HUD Studio</h2><p>Change how your workspace looks and where Lightning-chan appears.</p></div><button type="button" class="ln-icon-close" data-ln-close="hud" aria-label="Close HUD editor">✕</button></header>
      <div class="ln-editor-content">
        <section class="ln-preview-window"><span class="ln-modal-kicker">LIVE LAYOUT PREVIEW</span><div class="ln-preview-layout"><div class="ln-preview-side"></div><div class="ln-preview-header"></div><div class="ln-preview-panel"></div><div class="ln-preview-mini">✦</div></div><p>Changes are applied immediately and saved to your account.</p></section>
        <div class="ln-options">
          <fieldset><legend>Theme</legend><div class="ln-pills"><button type="button" data-ln-theme="dark">☾ Midnight</button><button type="button" data-ln-theme="light">☀ Daybreak</button></div></fieldset>
          <fieldset><legend>Navigation</legend><div class="ln-pills"><button type="button" data-ln-sidebar="comfortable">Comfortable</button><button type="button" data-ln-sidebar="compact">Compact</button></div></fieldset>
          <fieldset><legend>Lightning-chan</legend><label><span>On Home</span><input id="lnHomeMascot" type="checkbox"></label><label><span>In Library</span><input id="lnLibraryMascot" type="checkbox"></label><label><span>With AI answers</span><input id="lnAiMascot" type="checkbox"></label></fieldset>
          <fieldset><legend>Dashboard</legend><label><span>Announcements</span><input id="lnShowNews" type="checkbox"></label><label><span>Quick actions</span><input id="lnShowActions" type="checkbox"></label><label><span>Soft motion</span><input id="lnMotion" type="checkbox"></label></fieldset>
        </div>
      </div><footer><button type="button" id="lnHudReset">Restore defaults</button><button type="button" id="lnHudDone" class="ln-primary">Save layout ✓</button></footer>
    </dialog>
    <dialog class="ln-voice-editor" id="lnVoiceStudio" aria-labelledby="lnVoiceTitle">
      <header><div><span class="ln-modal-kicker">COMPANION SETTINGS</span><h2 id="lnVoiceTitle">Voice Studio</h2><p>Try voices before enabling narration.</p></div><button type="button" class="ln-icon-close" data-ln-close="voice" aria-label="Close Voice Studio">✕</button></header>
      <div class="ln-voice-inner"><span class="ln-voice-wave">▂ ▄ ▆ █ ▆ ▄ ▂</span>
        <label class="ln-setting-check"><span>Enable voicelines</span><input id="lnVoiceEnabled" type="checkbox"></label>
        <label>Voice engine <select id="lnVoiceEngine"><option value="browser">Browser speech</option><option value="voiceai">Voice.ai</option></select></label>
        <label>Voice <select id="lnVoiceSelect"></select></label>
        <p class="ln-voice-hint" id="lnVoiceHint"></p>
        <label>Speed <output id="lnRateOutput"></output><input type="range" id="lnRate" min=".85" max="1.4" step=".05"></label>
        <label>Pitch <output id="lnPitchOutput"></output><input type="range" id="lnPitch" min=".8" max="1.35" step=".05"></label>
        <div class="ln-voice-actions"><button type="button" id="lnPlaySample" class="ln-primary">▶ Play sample</button><button type="button" id="lnStopSample">■ Stop</button></div>
      </div>
    </dialog>
    <dialog class="ln-dialogue-log" id="lnDialogueLog" aria-label="Tour dialogue log"><header><h2>Conversation log</h2><button type="button" data-ln-close="log" aria-label="Close log">✕</button></header><ol id="lnLogEntries"></ol></dialog>`;
  document.body.append(root);

  const tourDialog = $('#lnTour');
  const editor = $('#lnHudEditor');
  const voiceStudio = $('#lnVoiceStudio');
  const logDialog = $('#lnDialogueLog');

  function save() {
    const snapshot = structuredClone(prefs);
    Promise.resolve(window.LightningAccount?.settings?.set(PREF_KEY, snapshot))
      .catch(error => console.warn('Could not sync companion preferences:', error.message));
  }

  function setTheme(next) {
    if (!['light', 'dark'].includes(next)) return;
    prefs.theme = next;
    apply();
    save();
  }

  function apply() {
    document.documentElement.dataset.lnTheme = prefs.theme;
    document.body.dataset.lnSidebar = prefs.hud.sidebar;
    document.body.dataset.lnMotion = prefs.hud.motion ? 'yes' : 'no';
    document.body.dataset.lnNews = prefs.hud.announcements ? 'on' : 'off';
    document.body.dataset.lnActions = prefs.hud.shortcuts ? 'on' : 'off';

    $$('[data-ln-theme]').forEach(button => {
      const selected = button.dataset.lnTheme === prefs.theme;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $$('[data-ln-sidebar]').forEach(button => button.classList.toggle('selected', button.dataset.lnSidebar === prefs.hud.sidebar));
    $$('[data-ln-choice]').forEach(button => button.classList.toggle('selected', button.dataset.lnChoice === prefs.theme));

    for (const [id, setting] of [
      ['lnHomeMascot', prefs.hud.homeMascot], ['lnLibraryMascot', prefs.hud.libraryMascot],
      ['lnAiMascot', prefs.hud.aiMascot], ['lnShowNews', prefs.hud.announcements],
      ['lnShowActions', prefs.hud.shortcuts], ['lnMotion', prefs.hud.motion],
      ['lnVoiceEnabled', prefs.voice]
    ]) {
      const control = $('#' + id);
      if (control) control.checked = !!setting;
    }
    updateCharacterVisibility();
  }

  function setPose(character, index) {
    if (!character) return;
    const pose = Math.max(0, Math.min(4, Math.floor(Number(index) || 0)));
    character.dataset.pose = String(pose);
    character.style.setProperty('--ln-pose', pose * 25 + '%');
  }

  function mouth(isOpen) {
    $$('.ln-character').forEach(character => {
      character.dataset.speaking = String(!!isOpen);
    });
  }

  function stopSpeech() {
    speechToken++;
    controller?.abort();
    controller = null;
    if (audio) {
      audio.pause();
      audio.onplaying = audio.onended = audio.onerror = null;
      audio.removeAttribute('src');
      audio = null;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
    window.speechSynthesis?.cancel();
    mouth(false);
    clearTimeout(autoTimer);
  }

  function finishedSpeech(token) {
    if (token !== speechToken) return;
    mouth(false);
    if (prefs.auto && touring && step < tour.length - 1) {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => advanceTour(1), 1050);
    }
  }

  function browserSpeech(text, token) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const list = window.speechSynthesis.getVoices().filter(voice => /^en/i.test(voice.lang));
    const preferred = list.find(voice => voice.name === prefs.browserVoice)
      || list.find(voice => /aria|jenny|samantha|ava|karen|zira/i.test(voice.name)) || list[0];
    const line = new SpeechSynthesisUtterance(text);
    if (preferred) line.voice = preferred;
    line.rate = Number(prefs.rate) || 1.1;
    line.pitch = Number(prefs.pitch) || 1.06;
    line.onstart = () => { if (token === speechToken) mouth(true); };
    line.onend = line.onerror = () => finishedSpeech(token);
    window.speechSynthesis.speak(line);
  }

  async function speak(message, manual = false) {
    if (!prefs.voice && !manual) return;
    stopSpeech();
    const token = speechToken;
    const text = String(message ?? '').replace(/https?:\/\/\S+/gi, 'website link')
      .replace(/[#*_>\[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text) return;

    if (prefs.engine === 'voiceai') {
      const request = new AbortController();
      controller = request;
      try {
        const result = await fetch('/api/chan/speech', {
          method: 'POST', credentials: 'same-origin', signal: request.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, ...(prefs.voiceId ? { voiceId: prefs.voiceId } : {}) })
        });
        if (!result.ok) throw new Error('Voice.ai speech unavailable');
        const blob = await result.blob();
        if (token !== speechToken) return;
        audioUrl = URL.createObjectURL(blob);
        audio = new Audio(audioUrl);
        audio.onplaying = () => { if (token === speechToken) mouth(true); };
        audio.onended = () => { if (token === speechToken) finishedSpeech(token); };
        audio.onerror = () => { if (token === speechToken) finishedSpeech(token); };
        await audio.play();
        return;
      } catch (error) {
        if (token !== speechToken) return;
        console.warn('Using browser speech instead:', error.message);
      }
    }
    browserSpeech(text, token);
  }

  function revealDialogue(text) {
    cancelAnimationFrame(typeFrame);
    const element = $('#lnDialogueText');
    element.textContent = '';
    typeProgress = 0;
    textFinished = false;
    const revealAll = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (revealAll) {
      element.textContent = text;
      textFinished = true;
      return;
    }
    let previous = performance.now();
    const tick = timestamp => {
      if (!touring) return;
      typeProgress += Math.min(70, timestamp - previous) * 0.067;
      previous = timestamp;
      const length = Math.min(text.length, Math.floor(typeProgress));
      element.textContent = text.slice(0, length);
      if (length < text.length) typeFrame = requestAnimationFrame(tick);
      else textFinished = true;
    };
    typeFrame = requestAnimationFrame(tick);
  }

  function spotlight() {
    if (!touring) return;
    const item = tour[step];
    const target = item.target ? $(item.target) : null;
    const focus = $('#lnTourTarget');
    const shade = $('#lnTourShade');
    if (!target) {
      focus.hidden = true;
      shade.style.clipPath = '';
      return;
    }
    const rect = target.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) {
      focus.hidden = true;
      shade.style.clipPath = '';
      return;
    }
    const left = Math.max(0, rect.left - 7);
    const top = Math.max(0, rect.top - 7);
    const right = Math.min(window.innerWidth, rect.right + 7);
    const bottom = Math.min(window.innerHeight, rect.bottom + 7);
    focus.hidden = false;
    Object.assign(focus.style, { left: left + 'px', top: top + 'px',
      width: right - left + 'px', height: bottom - top + 'px' });
    shade.style.clipPath = `polygon(evenodd, 0 0,100% 0,100% 100%,0 100%,0 0,${left}px ${top}px,${left}px ${bottom}px,${right}px ${bottom}px,${right}px ${top}px,${left}px ${top}px)`;
  }

  function showStep(withAudio = false) {
    const current = tour[step];
    const character = $('.ln-tour-character');
    setPose(character, current.pose);
    const nameplate = $('.ln-tour-nameplate');
    nameplate.textContent = 'ϟ  Lightning-chan';
    $('#lnDialogueHelp').textContent = current.help;
    $('#lnThemeChoice').hidden = !current.chooseTheme;
    $('#lnTourCounter').textContent = String(step + 1).padStart(2, '0') + ' / ' + tour.length;
    $('#lnNext').innerHTML = step === tour.length - 1 ? 'Enter Lightning <b>➜</b>' : 'Continue <b>➜</b>';
    $('#lnPrev').hidden = step === 0;
    $('#lnTourDots').innerHTML = tour.map((item, index) => `<span class="${index === step ? 'here' : ''}" title="${escape(item.label)}"></span>`).join('');
    revealDialogue(current.line);
    apply();
    requestAnimationFrame(spotlight);
    if (withAudio && prefs.voice) void speak(current.line);
  }

  function startTour() {
    if (!initialized) initialize();
    if (!initialized) return;
    stopSpeech();
    touring = true;
    step = 0;
    void openHub('overview');
    tourDialog.hidden = false;
    document.body.classList.add('ln-touring');
    showStep(false);
    $('#lnNext').focus({ preventScroll: true });
  }

  function finishTour() {
    if (!touring) return;
    touring = false;
    cancelAnimationFrame(typeFrame);
    stopSpeech();
    tourDialog.hidden = true;
    document.body.classList.remove('ln-touring');
    $('#lnTourShade').style.clipPath = '';
    prefs.tourVersion = TOUR_VERSION;
    save();
    apply();
    $('#v4Help').focus({ preventScroll: true });
  }

  function advanceTour(direction) {
    const item = tour[step];
    if (direction > 0 && !textFinished) {
      cancelAnimationFrame(typeFrame);
      $('#lnDialogueText').textContent = item.line;
      textFinished = true;
      return;
    }
    if (direction > 0 && step === tour.length - 1) {
      finishTour();
      return;
    }
    stopSpeech();
    step = Math.max(0, Math.min(tour.length - 1, step + direction));
    showStep(true);
  }

  async function openHub(view = 'overview') {
    // Reuse the exact same module as the primary browser app; never make two hub instances.
    try {
      const hub = await import('/assets/hub.js?v=48');
      hub.openHub(view);
      setPage(view === 'overview' ? 'home' : view === 'games' ? 'library' : view);
    } catch (error) {
      console.warn('Could not open workspace:', error);
    }
  }

  function showBrowser() {
    $('#newTabBtn')?.click();
    setPage('browser');
  }

  function openAi() {
    if (touring) finishTour();
    const bubble = $('#boltBubble');
    const panel = $('#boltAiPanel');
    if (bubble && panel?.getAttribute('aria-hidden') !== 'false') bubble.click();
    setTimeout(() => $('#boltAiInput')?.focus(), 20);
  }

  function setPage(next) {
    scene = next;
    const names = { home: 'Home', browser: 'Browse', library: 'Library', chat: 'Community',
      updates: 'Announcements', ai: 'AI Assistant', hud: 'HUD Editor', settings: 'Settings' };
    const name = names[next] || 'Workspace';
    const label = $('#lnPageName');
    if (label) label.textContent = name;
    $$('nav.ln-sidebar .ln-item').forEach(button => {
      const active = ({ home: 'v4NavHome', browser: 'v4NavBrowser', library: 'v4NavLibrary',
        chat: 'v4NavCommunity', updates: 'v4NavUpdates', ai: 'v4NavAI', hud: 'v4NavHUD',
        settings: 'v4NavSettings' })[next] === button.id;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    updateCharacterVisibility();
  }

  function decorateHome() {
    const dashboard = $('.v5-dashboard');
    if (!dashboard) return;
    const inner = $('.v5-dashboard-inner', dashboard);
    if (!inner || $('.ln-home-lead', inner)) return;
    const welcome = $('.v5-welcome h1', inner);
    const name = welcome?.querySelector('em')?.textContent?.replace(/\.$/, '') || 'you';

    const hero = document.createElement('section');
    hero.className = 'ln-home-lead';
    hero.innerHTML = `
      <div class="ln-hero-art">${sprite(1, 'ln-home-character')}</div>
      <div class="ln-hero-copy">
        <span class="ln-hero-kicker">✦ LIGHTNING / THE NEXT CHAPTER</span>
        <h1>Welcome back,<br><em>${escape(name)}.</em></h1>
        <p>A space for your ideas, your people and whatever you decide to explore next.</p>
        <div class="ln-hero-actions"><button type="button" class="ln-primary" data-ln-action="browse">◈ Explore the web</button>
        <button type="button" class="ln-secondary" data-ln-action="guide">✧ Meet Lightning-chan</button></div>
      </div>`;
    inner.prepend(hero);

    const strip = document.createElement('div');
    strip.className = 'ln-chapter-strip';
    strip.innerHTML = '<strong>YOUR DASHBOARD</strong><span>Everything important, at a glance.</span>';
    hero.after(strip);

    const actions = document.createElement('div');
    actions.className = 'ln-home-actions';
    actions.innerHTML = [
      ['browse', '◎', 'Browse', 'Explore anything'],
      ['ai', '✧', 'AI Assistant', 'Ask me anything'],
      ['community', '♧', 'Community', 'Find your people'],
      ['hud', '▣', 'HUD Studio', 'Make it yours']
    ].map(([action, glyph, label, subtitle]) => `<button type="button" data-ln-action="${action}"><span class="ln-action-glyph">${glyph}</span><span><strong>${label}</strong><small>${subtitle}</small></span></button>`).join('');
    strip.after(actions);

    const original = $('.v5-welcome', inner);
    if (original) original.hidden = true;
    updateCharacterVisibility();
  }

  function decorateLibrary() {
    const library = $('.v3-library');
    if (!library || $('.ln-library-buddy', library)) return;
    const top = $('.v3-library-top', library);
    if (!top) return;
    const companion = document.createElement('div');
    companion.className = 'ln-library-buddy';
    companion.innerHTML = sprite(4, 'ln-library-character') + '<span>✦ Found something interesting?</span>';
    top.append(companion);
    updateCharacterVisibility();
  }

  function decorateAi() {
    const head = $('#boltAiPanel .bolt-aux-head');
    if (!head || $('.ln-ai-buddy', head)) return;
    const companion = document.createElement('div');
    companion.className = 'ln-ai-buddy';
    companion.innerHTML = sprite(0, 'ln-ai-character');
    head.prepend(companion);
    updateCharacterVisibility();
  }

  function updateCharacterVisibility() {
    const hero = $('.ln-home-lead .ln-hero-art');
    if (hero) hero.hidden = !prefs.hud.homeMascot || touring;
    const library = $('.ln-library-buddy');
    if (library) library.hidden = !prefs.hud.libraryMascot || touring;
    const ai = $('.ln-ai-buddy');
    if (ai) ai.hidden = !prefs.hud.aiMascot || touring;
    // Never shown over web pages, games, private messages or the admin console.
    // Each character belongs to a specific feature and is removed with that feature.
  }

  function refreshScene() {
    const hub = $('#hubMount');
    if (!hub || hub.hidden) return;
    if ($('.v5-dashboard', hub)) {
      decorateHome();
      setPage('home');
    } else if ($('.v3-library', hub)) {
      decorateLibrary();
      setPage('library');
    }
    if (touring) spotlight();
  }

  function scheduleRefresh() {
    if (mutationFrame) return;
    mutationFrame = requestAnimationFrame(() => {
      mutationFrame = 0;
      refreshScene();
    });
  }

  function openEditor() {
    if (touring) finishTour();
    if (!editor.open) editor.showModal();
    apply();
  }

  function closeEditor() { if (editor.open) editor.close(); }

  async function loadVoices() {
    if (voiceLoading || voiceConfigured) return;
    voiceLoading = true;
    try {
      const result = await fetch('/api/chan/voices', { credentials: 'same-origin', cache: 'no-store' });
      const data = await result.json();
      voiceConfigured = !!data.configured;
      voices = Array.isArray(data.voices) ? data.voices : [];
    } catch (error) {
      console.warn('Voice list unavailable:', error.message);
    } finally {
      voiceLoading = false;
      if (voiceStudio.open) renderVoices();
    }
  }

  function renderVoices() {
    $('#lnVoiceEngine').value = prefs.engine;
    $('#lnVoiceEnabled').checked = prefs.voice;
    const select = $('#lnVoiceSelect');
    if (prefs.engine === 'voiceai') {
      select.innerHTML = '<option value="">Provider default voice</option>' + voices.map(voice =>
        `<option value="${escape(voice.id)}" ${prefs.voiceId === voice.id ? 'selected' : ''}>${escape(voice.name)}</option>`).join('');
      $('#lnVoiceHint').textContent = voiceConfigured
        ? 'Voice.ai is connected. Pick a voice and listen to the sample.'
        : 'Voice.ai has not returned a voice list. Browser speech is available as a fallback.';
    } else {
      const choices = window.speechSynthesis?.getVoices().filter(voice => /^en/i.test(voice.lang)) || [];
      select.innerHTML = '<option value="">Automatic English voice</option>' + choices.map(voice =>
        `<option value="${escape(voice.name)}" ${prefs.browserVoice === voice.name ? 'selected' : ''}>${escape(voice.name)}</option>`).join('');
      $('#lnVoiceHint').textContent = 'Browser voices depend on your device and operating system.';
    }
    $('#lnRate').value = prefs.rate;
    $('#lnPitch').value = prefs.pitch;
    $('#lnRateOutput').textContent = Number(prefs.rate).toFixed(2) + '×';
    $('#lnPitchOutput').textContent = Number(prefs.pitch).toFixed(2);
  }

  function openVoiceStudio() {
    if (!voiceStudio.open) voiceStudio.showModal();
    renderVoices();
    void loadVoices();
  }

  function initialize() {
    if (initialized || !window.LightningAccount?.settings) return;
    const saved = window.LightningAccount.settings.get(PREF_KEY, null);
    if (saved && typeof saved === 'object') {
      prefs = { ...defaults, ...saved, hud: { ...defaults.hud, ...(saved.hud || {}) } };
    }
    // Carry forward V5 preferences but never treat its tutorial as V6 completion.
    if (!['dark','light'].includes(prefs.theme)) prefs.theme = 'dark';
    if (!['comfortable','compact'].includes(prefs.hud.sidebar)) prefs.hud.sidebar = 'comfortable';
    if (!['voiceai','browser'].includes(prefs.engine)) prefs.engine = 'browser';
    initialized = true;
    apply();
    decorateAi();
    scheduleRefresh();
    if (Number(prefs.tourVersion) < TOUR_VERSION) {
      setTimeout(() => { if (!touring && !editor.open) startTour(); }, 800);
    }
  }

  document.addEventListener('lightning:account-settings-loaded', initialize);
  document.addEventListener('submit', event => {
    if (event.target?.matches?.('#newtabForm, #addressForm')) setPage('browser');
  }, true);
  document.addEventListener('lightning:ai-answer', event => {
    if (event.detail?.text && prefs.voice) void speak(event.detail.text);
  });

  // One delegated handler for our own controls. The old services still handle
  // data-hub, history, settings, tabs and their existing server APIs.
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;

    if (button.id === 'newTabBtn') { setPage('browser'); return; }
    if (button.dataset.lnAction) {
      switch (button.dataset.lnAction) {
        case 'browse': showBrowser(); break;
        case 'guide': startTour(); break;
        case 'ai': openAi(); break;
        case 'community': void openHub('chat'); break;
        case 'hud': openEditor(); break;
        case 'library': void openHub('games'); break;
      }
      return;
    }
    if (button.dataset.lnTheme) { setTheme(button.dataset.lnTheme); return; }
    if (button.hasAttribute('data-ln-home')) { void openHub('overview'); return; }
    if (button.hasAttribute('data-ln-browser')) { showBrowser(); return; }
    if (button.hasAttribute('data-ln-ai')) { openAi(); return; }
    if (button.hasAttribute('data-ln-hud')) { openEditor(); return; }
    if (button.hasAttribute('data-ln-guide')) { startTour(); return; }
    if (button.hasAttribute('data-ln-account')) { $('#accountButton')?.click(); return; }
    if (button.hasAttribute('data-hub')) {
      const next = button.dataset.hub;
      setPage(next === 'games' ? 'library' : next === 'chat' ? 'chat' : next === 'updates' ? 'updates' : 'home');
    }
    if (button.dataset.lnChoice) { setTheme(button.dataset.lnChoice); return; }
    if (button.dataset.lnSidebar) { prefs.hud.sidebar = button.dataset.lnSidebar; save(); apply(); return; }
    if (button.hasAttribute('data-ln-close')) {
      if (button.dataset.lnClose === 'hud') closeEditor();
      if (button.dataset.lnClose === 'voice') voiceStudio.close();
      if (button.dataset.lnClose === 'log') logDialog.close();
      return;
    }

    switch (button.id) {
      case 'lnTourExit': finishTour(); break;
      case 'lnNext': advanceTour(1); break;
      case 'lnPrev': advanceTour(-1); break;
      case 'lnVoice': openVoiceStudio(); break;
      case 'lnAuto':
        prefs.auto = !prefs.auto; button.setAttribute('aria-pressed', String(prefs.auto)); save();
        if (prefs.auto && prefs.voice) void speak(tour[step].line, true);
        break;
      case 'lnLog':
        $('#lnLogEntries').innerHTML = tour.slice(0, step + 1).map(item =>
          `<li><b>Lightning-chan</b><p>${escape(item.line)}</p></li>`).join('');
        logDialog.showModal(); break;
      case 'lnHudDone': closeEditor(); break;
      case 'lnHudReset': prefs.hud = { ...defaults.hud }; save(); apply(); break;
      case 'lnPlaySample': void speak("Hey there! I'm Lightning-chan. Welcome to your brand-new workspace!", true); break;
      case 'lnStopSample': stopSpeech(); break;
    }
  });

  root.addEventListener('change', event => {
    const field = event.target;
    const bindings = {
      lnHomeMascot: 'homeMascot', lnLibraryMascot: 'libraryMascot', lnAiMascot: 'aiMascot',
      lnShowNews: 'announcements', lnShowActions: 'shortcuts', lnMotion: 'motion'
    };
    if (bindings[field.id]) prefs.hud[bindings[field.id]] = field.checked;
    else if (field.id === 'lnVoiceEnabled') prefs.voice = field.checked;
    else if (field.id === 'lnVoiceEngine') {
      prefs.engine = field.value;
      prefs.voiceId = '';
      renderVoices();
      if (prefs.engine === 'voiceai') void loadVoices();
    } else if (field.id === 'lnVoiceSelect') {
      if (prefs.engine === 'voiceai') prefs.voiceId = field.value;
      else prefs.browserVoice = field.value;
    } else return;
    save(); apply();
  });

  root.addEventListener('input', event => {
    const field = event.target;
    if (field.id === 'lnRate') prefs.rate = Number(field.value);
    else if (field.id === 'lnPitch') prefs.pitch = Number(field.value);
    else return;
    save(); renderVoices();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && touring && !voiceStudio.open && !logDialog.open) finishTour();
    if (event.key === 'Enter' && touring && !voiceStudio.open && !logDialog.open &&
      !['BUTTON','INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName)) {
      event.preventDefault(); advanceTour(1);
    }
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'g') {
      event.preventDefault(); startTour();
    }
  });

  const hub = $('#hubMount');
  if (hub) new MutationObserver(scheduleRefresh).observe(hub, { subtree: true, childList: true });
  window.addEventListener('resize', spotlight);
  document.addEventListener('lightning:workspace-ready', scheduleRefresh);
  window.LightningChan = {
    open: startTour, openTour: startTour, openHUD: openEditor,
    openVoice: openVoiceStudio, speak, stop: stopSpeech
  };
  setTimeout(() => { if (!initialized && window.LightningAccount?.settings) initialize(); }, 1500);
})();