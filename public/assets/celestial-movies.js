/* Celestial Movies — a small, independent view that leaves browser tabs untouched. */
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const text = (value) => String(value ?? "");
  const esc = (value) => text(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
  const poster = (path, size = "w342") =>
    path ? "https://image.tmdb.org/t/p/" + size + path : "";
  let activeRequest = 0;
  let debounceTimer;

  async function request(url) {
    const response = await fetch(url, { credentials: "same-origin" });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Movies could not be loaded.");
    }
    return response.json();
  }

  function movieCard(item) {
    const title = esc(item.title || item.name);
    const sub = [item.year, item.score ? "★ " + item.score : ""].filter(Boolean).join(" · ");
    return '<button type="button" class="cel-movie" data-title-id="' + Number(item.id) +
      '" data-kind="' + (item.type === "tv" ? "tv" : "movie") + '" aria-label="' + title + '">' +
      (item.poster ? '<img loading="lazy" alt="" src="' + poster(item.poster) + '">' : '<span class="cel-no-poster">✦</span>') +
      '<span class="cel-movie-title">' + title + '</span><small>' + esc(sub) + '</small></button>';
  }

  function makePlayer() {
    let overlay = $("#celestialPlayer");
    if (overlay) return overlay;
    overlay = document.createElement("section");
    overlay.id = "celestialPlayer";
    overlay.className = "cel-player";
    overlay.hidden = true;
    overlay.innerHTML = '<div class="cel-player-dim" data-close></div>' +
      '<div class="cel-player-shell" role="dialog" aria-modal="true" aria-label="Movie player">' +
      '<div class="cel-player-header"><div><strong data-player-title></strong><span data-player-subtitle></span></div>' +
      '<button type="button" data-close aria-label="Close player">✕</button></div>' +
      '<div class="cel-player-screen" data-screen></div>' +
      '<div class="cel-player-controls" data-controls></div></div>';
    overlay.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) closePlayer();
    });
    document.body.append(overlay);
    return overlay;
  }

  function closePlayer() {
    const overlay = $("#celestialPlayer");
    if (!overlay) return;
    overlay.hidden = true;
    $("[data-screen]", overlay).replaceChildren();
    document.body.classList.remove("cel-playing");
  }
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !$("#celestialPlayer")?.hidden && !document.fullscreenElement) closePlayer();
  });

  async function openPlayer(item, season = 1, episode = 1) {
    const overlay = makePlayer();
    overlay.hidden = false;
    document.body.classList.add("cel-playing");
    $("[data-player-title]", overlay).textContent = item.title || item.name;
    $("[data-player-subtitle]", overlay).textContent =
      item.type === "tv" ? "Season " + season + " · Episode " + episode : String(item.year || "");
    const screen = $("[data-screen]", overlay);
    screen.innerHTML = '<div class="cel-player-status">Connecting to your streaming provider…</div>';
    try {
      const route = "/api/celestial/play/" + item.type + "/" + Number(item.id) +
        (item.type === "tv" ? "/" + season + "/" + episode : "");
      const result = await request(route);
      if (overlay.hidden) return;
      if (!result.url) throw new Error("No playback source is configured.");
      const frame = document.createElement("iframe");
      frame.title = item.title || item.name;
      frame.allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "no-referrer";
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-presentation allow-popups");
      frame.src = result.url;
      screen.replaceChildren(frame);
    } catch (error) {
      screen.replaceChildren();
      const message = document.createElement("div");
      message.className = "cel-player-status";
      message.textContent = error.message;
      screen.append(message);
    }
    const controls = $("[data-controls]", overlay);
    controls.replaceChildren();
    if (item.type === "tv") {
      const seasonField = document.createElement("input");
      seasonField.type = "number";
      seasonField.min = "1";
      seasonField.max = "100";
      seasonField.value = String(season);
      seasonField.setAttribute("aria-label", "Season");
      const episodeField = document.createElement("input");
      episodeField.type = "number";
      episodeField.min = "1";
      episodeField.max = "500";
      episodeField.value = String(episode);
      episodeField.setAttribute("aria-label", "Episode");
      const go = document.createElement("button");
      go.textContent = "Play episode";
      go.addEventListener("click", () => openPlayer(item, +seasonField.value || 1, +episodeField.value || 1));
      controls.append("Season", seasonField, "Episode", episodeField, go);
    }
  }

  async function showDetails(item) {
    const details = $("#celMovieDetails");
    if (!details) return;
    details.hidden = false;
    details.innerHTML = '<p class="cel-empty">Loading details…</p>';
    try {
      const data = await request("/api/celestial/title/" + item.type + "/" + Number(item.id));
      details.innerHTML =
        (data.backdrop ? '<img class="cel-detail-backdrop" src="' + poster(data.backdrop, "w780") + '" alt="">' : "") +
        '<div class="cel-detail-info"><span class="cel-kicker">' + (item.type === "tv" ? "SERIES" : "FEATURE FILM") + '</span>' +
        '<h3>' + esc(data.title || data.name) + '</h3><p>' + esc(data.overview || "No synopsis available.") + '</p>' +
        '<div class="cel-detail-actions"><button type="button" class="cel-primary" id="celPlay">Play now</button>' +
        '<button type="button" id="celBack">Back to library</button></div></div>';
      $("#celPlay", details).addEventListener("click", () => openPlayer(item));
      $("#celBack", details).addEventListener("click", () => details.hidden = true);
    } catch (error) {
      details.textContent = error.message;
    }
  }

  window.renderCelestialMoviesPanel = function ({ dom }) {
    dom.panelKicker.textContent = "CELESTIAL";
    dom.panelTitle.textContent = "Movies & TV";
    dom.panelBody.innerHTML =
      '<div class="cel-movies"><div class="cel-movie-intro"><span class="cel-kicker">THE CINEMA</span>' +
      '<h3>Stories worth staying for.</h3><p>Find a favorite, pick up a series, or discover something new.</p></div>' +
      '<div class="cel-movie-filters"><button type="button" data-kind="movie" class="selected">Movies</button>' +
      '<button type="button" data-kind="tv">TV shows</button></div>' +
      '<label class="cel-movie-search"><span>⌕</span><input id="celMovieQuery" placeholder="Search the library…" autocomplete="off"></label>' +
      '<div class="cel-movie-grid" id="celMovieGrid"></div><div id="celMovieDetails" class="cel-detail" hidden></div></div>';
    const root = $(".cel-movies", dom.panelBody);
    const grid = $("#celMovieGrid", root);
    const query = $("#celMovieQuery", root);
    let kind = "movie";

    async function load() {
      const token = ++activeRequest;
      grid.innerHTML = '<p class="cel-empty">Loading the library…</p>';
      const value = query.value.trim();
      try {
        const endpoint = value
          ? "/api/celestial/search?type=" + kind + "&q=" + encodeURIComponent(value)
          : "/api/celestial/discover?type=" + kind;
        const result = await request(endpoint);
        if (token !== activeRequest || !root.isConnected) return;
        const items = result.items || [];
        grid.innerHTML = items.length
          ? items.map(movieCard).join("")
          : '<p class="cel-empty">Nothing found. Try another title.</p>';
        grid.onclick = (event) => {
          const card = event.target.closest("[data-title-id]");
          if (!card) return;
          const item = items.find(x => Number(x.id) === Number(card.dataset.titleId));
          if (item) showDetails(item);
        };
      } catch (error) {
        if (token === activeRequest) grid.innerHTML = '<p class="cel-empty">' + esc(error.message) + '</p>';
      }
    }
    root.querySelectorAll(".cel-movie-filters button").forEach(button => {
      button.addEventListener("click", () => {
        kind = button.dataset.kind;
        root.querySelectorAll(".cel-movie-filters button").forEach(b => b.classList.toggle("selected", b === button));
        $("#celMovieDetails", root).hidden = true;
        load();
      });
    });
    query.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, 280);
    });
    load();
  };
})();