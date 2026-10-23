// The arcade uses the real OpenFront client in an isolated Railway service.
// This replaces Lightning's prototype territory game rather than re-skinning it.
// The OpenFront source and notices remain available at:
// https://github.com/openfrontio/OpenFrontIO (AGPL-3.0).

const GAME_URL = "https://lightning-openfront-production.up.railway.app/";

export function installWorldPort(Hub) {
  const previousShow = Hub.prototype.show;
  const previousAct = Hub.prototype.act;
  const previousClose = Hub.prototype.close;

  Hub.prototype.worldScreen = function () {
    this.header("WorldPvP", "OpenFront engine · Self-hosted on Lightning");
    this.$("#hubContent").innerHTML = "";

    const mount = this.$("#hubWorld");
    mount.classList.add("hub-openfront-port");
    mount.innerHTML = `
      <div class="openfront-port-bar">
        <div class="openfront-port-identity">
          <span class="openfront-port-icon">◈</span>
          <div><strong>WORLD<span>PVP</span></strong>
          <small>Powered by OpenFront · Full strategy engine</small></div>
        </div>
        <span class="openfront-port-grow"></span>
        <a href="${GAME_URL}" target="_blank" rel="noopener noreferrer"
           class="openfront-port-action">↗ Open in a tab</a>
        <button data-act="back" class="openfront-port-action" type="button">← Arcade</button>
      </div>
      <iframe class="openfront-port-frame"
              title="WorldPvP, powered by OpenFront"
              allow="fullscreen; gamepad"
              referrerpolicy="strict-origin-when-cross-origin"
              src="${GAME_URL}"></iframe>
      <div class="openfront-port-credit">
        OpenFront © OpenFront and Contributors ·
        <a href="https://github.com/openfrontio/OpenFrontIO"
           target="_blank" rel="noopener noreferrer">Source &amp; license (AGPL-3.0)</a>
        · <a href="https://github.com/openfrontio/OpenFrontIO/blob/main/LICENSE-ASSETS"
             target="_blank" rel="noopener noreferrer">Asset terms</a>
      </div>`;
  };

  Hub.prototype.act = function (action, button) {
    if (action === "worldView") return this.show("world");
    return previousAct.call(this, action, button);
  };

  Hub.prototype.show = function (view, channel) {
    if (view !== "world") {
      const mount = this.$("#hubWorld");
      if (mount) {
        mount.innerHTML = "";
        mount.classList.remove("hub-openfront-port");
      }
    }
    return previousShow.call(this, view, channel);
  };

  Hub.prototype.close = function () {
    const mount = this.$("#hubWorld");
    if (mount) mount.innerHTML = "";
    previousClose.call(this);
  };
}
