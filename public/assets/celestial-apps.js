/* Celestial Apps: shortcuts open inside the existing browser tab system. */
(() => {
  const apps = [
    ["YouTube", "Watch", "youtube.com", "https://youtube.com", "Entertainment"],
    ["Discord", "Connect", "discord.com", "https://discord.com/app", "Social"],
    ["Spotify", "Listen", "spotify.com", "https://open.spotify.com", "Entertainment"],
    ["Reddit", "Communities", "reddit.com", "https://reddit.com", "Social"],
    ["Twitch", "Live streams", "twitch.tv", "https://twitch.tv", "Entertainment"],
    ["Google Drive", "Your files", "drive.google.com", "https://drive.google.com", "Productivity"],
    ["Google Docs", "Documents", "docs.google.com", "https://docs.google.com", "Productivity"],
    ["GitHub", "Build things", "github.com", "https://github.com", "Productivity"],
    ["Desmos", "Graphing", "desmos.com", "https://desmos.com/calculator", "Tools"],
    ["Photopea", "Image editor", "photopea.com", "https://photopea.com", "Tools"],
    ["Canva", "Design", "canva.com", "https://canva.com", "Tools"],
    ["Wikipedia", "Explore", "wikipedia.org", "https://wikipedia.org", "Learning"],
  ];
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const icon = domain => "https://www.google.com/s2/favicons?domain=" + encodeURIComponent(domain) + "&sz=128";
  const saved = () => {
    try { return JSON.parse(localStorage.getItem("celestial.favoriteApps") || "[]"); }
    catch { return []; }
  };
  const save = ids => {
    try { localStorage.setItem("celestial.favoriteApps", JSON.stringify(ids)); } catch {}
  };

  window.renderCelestialAppsPanel = ({ dom, navigate, closePanel }) => {
    dom.panelKicker.textContent = "EXPLORE";
    dom.panelTitle.textContent = "Apps";
    dom.panelBody.innerHTML =
      '<div class="cel-apps"><div class="cel-apps-hero"><span class="cel-kicker">ALL IN ONE PLACE</span>' +
      '<h3>Go wherever.</h3><p>Your favorite corners of the internet, one click away.</p></div>' +
      '<label class="cel-movie-search"><span>⌕</span><input id="celAppsSearch" type="search" placeholder="Find an app…" autocomplete="off"></label>' +
      '<div class="cel-app-tabs"><button class="selected" type="button" data-filter="All">All</button>' +
      '<button type="button" data-filter="Favorites">Favorites</button>' +
      '<button type="button" data-filter="Productivity">Productivity</button>' +
      '<button type="button" data-filter="Entertainment">Entertainment</button>' +
      '<button type="button" data-filter="Tools">Tools</button></div><div class="cel-app-grid" id="celAppGrid"></div></div>';
    const root = dom.panelBody.querySelector(".cel-apps");
    const input = root.querySelector("#celAppsSearch");
    let filter = "All";
    function render() {
      const value = input.value.trim().toLowerCase();
      const favs = saved();
      const list = apps.filter(([name, description, , url, category]) => {
        const matches = (name + " " + description + " " + category).toLowerCase().includes(value);
        return matches && (filter === "All" || filter === category || (filter === "Favorites" && favs.includes(url)));
      }).sort((a, b) => Number(favs.includes(b[3])) - Number(favs.includes(a[3])));
      root.querySelector("#celAppGrid").innerHTML = list.length ? list.map(([name, description, domain, url]) =>
        '<div class="cel-app-tile"><button class="cel-app-launch" type="button" data-open="' + esc(url) +
        '"><img alt="" loading="lazy" src="' + icon(domain) + '"><span><b>' + esc(name) +
        '</b><small>' + esc(description) + '</small></span></button><button type="button" class="cel-app-favorite' +
        (favs.includes(url) ? " on" : "") + '" data-favorite="' + esc(url) + '" aria-label="Favorite ' + esc(name) +
        '">★</button></div>'
      ).join("") : '<p class="cel-empty">No apps match your search.</p>';
    }
    root.addEventListener("click", event => {
      const fav = event.target.closest("[data-favorite]");
      if (fav) {
        const ids = saved();
        const next = ids.includes(fav.dataset.favorite)
          ? ids.filter(x => x !== fav.dataset.favorite) : [...ids, fav.dataset.favorite];
        save(next);
        render();
        return;
      }
      const launch = event.target.closest("[data-open]");
      if (launch) {
        navigate(launch.dataset.open);
        closePanel();
      }
      const tab = event.target.closest("[data-filter]");
      if (tab) {
        filter = tab.dataset.filter;
        root.querySelectorAll("[data-filter]").forEach(b => b.classList.toggle("selected", b === tab));
        render();
      }
    });
    input.addEventListener("input", render);
    render();
  };
})();