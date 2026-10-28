import { assetUrl } from "@openfront/shared/AssetUrls";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { whenModalLoaded } from "../LazyModals";
import "./NavAccountMenu";
import "./NavUtilityIcons";

type LobbyModal = HTMLElement & { open?: () => void };

@customElement("play-page")
export class PlayPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  private openMode(kind: "host" | "join" | "solo") {
    const tag = {
      host: "host-lobby-modal",
      join: "join-lobby-modal",
      solo: "single-player-modal",
    }[kind];
    whenModalLoaded(tag, () => {
      const modal = document.querySelector(tag) as LobbyModal | null;
      if (typeof modal?.open === "function") {
        modal.open();
      } else {
        window.showPage?.({
          host: "page-host-lobby",
          join: "page-join-lobby",
          solo: "page-single-player",
        }[kind]);
      }
    });
  }

  render() {
    return html`
      <div id="page-play" class="worldpvp-home">
        <token-login class="absolute"></token-login>
        <rewards-modal class="absolute"></rewards-modal>

        <div class="worldpvp-mobile-top">
          <button
            id="hamburger-btn"
            type="button"
            class="worldpvp-mobile-menu"
            aria-label="Open navigation"
            aria-controls="sidebar-menu"
            aria-expanded="false"
          >☰</button>
          <strong>WORLD<span>PVP</span></strong>
          <div>
            <nav-utility-icons size="mobile"></nav-utility-icons>
            <nav-account-menu variant="mobile"></nav-account-menu>
          </div>
        </div>

        <header class="worldpvp-banner">
          <div class="worldpvp-banner-glow"></div>
          <div class="worldpvp-banner-content">
            <div class="worldpvp-eyebrow"><i></i> LIVE STRATEGY / GLOBAL WARFARE</div>
            <h1>WORLD<span>PVP</span><b>.</b></h1>
            <p>Every border is temporary. Command armies, forge alliances, and fight for control of the map—against real players, on your own battlefield.</p>
            <div class="worldpvp-banner-tags">
              <span>◉ REAL-TIME CONQUEST</span>
              <span>◇ PRIVATE LOBBIES</span>
              <span>⌁ GLOBAL MAPS</span>
            </div>
          </div>
          <div class="worldpvp-banner-art" style=${"background-image:url('" + assetUrl("images/GameplayScreenshot.png") + "')"} aria-hidden="true"></div>
          <div class="worldpvp-banner-grid" aria-hidden="true"></div>
        </header>

        <div class="worldpvp-start-panel">
          <div class="worldpvp-player">
            <span>YOUR CALLSIGN</span>
            <username-input></username-input>
          </div>
          <div class="worldpvp-mode-actions">
            <button type="button" class="worldpvp-mode worldpvp-mode-primary"
              @click=${() => this.openMode("host")}>
              <b>01 / CREATE ROOM</b><strong>Host Multiplayer</strong>
              <small>Start a lobby and invite your friends</small><span>↗</span>
            </button>
            <button type="button" class="worldpvp-mode"
              @click=${() => this.openMode("join")}>
              <b>02 / JOIN ROOM</b><strong>Join a Battle</strong>
              <small>Enter a lobby ID or find an open war</small><span>↗</span>
            </button>
            <button type="button" class="worldpvp-mode"
              @click=${() => this.openMode("solo")}>
              <b>03 / TRAINING</b><strong>Solo Campaign</strong>
              <small>Conquer the map against commanders</small><span>↗</span>
            </button>
          </div>
        </div>

        <div class="worldpvp-public-header">
          <div><small>LIVE BATTLES</small><h2>Find your next war.</h2></div>
          <span><i></i> WORLD PVP SERVER</span>
        </div>
        <game-mode-selector></game-mode-selector>
        <footer class="worldpvp-source-credit">
          WorldPvP is powered by the open-source OpenFrontIO game engine.
          <a href="https://github.com/openfrontio/OpenFrontIO" target="_blank" rel="noopener noreferrer">Original source &amp; attribution</a> · AGPL-3.0
        </footer>
      </div>
    `;
  }
}
