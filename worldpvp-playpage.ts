import { assetUrl } from "@openfront/shared/AssetUrls";
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { whenModalLoaded } from "../LazyModals";
import "./NavAccountMenu";
import "./NavUtilityIcons";

type LobbyModal = HTMLElement & { open?: (args?: Record<string, unknown>) => void };

@customElement("play-page")
export class PlayPage extends LitElement {
  createRenderRoot() {
    return this;
  }

  private openMode(kind: "host" | "join" | "solo", preset: "2v2" | "3v3" | "ffa" | "custom" = "custom") {
    const tag = {
      host: "host-lobby-modal",
      join: "join-lobby-modal",
      solo: "single-player-modal",
    }[kind];
    const username = this.querySelector("username-input") as (HTMLElement & {canPlay?: () => boolean}) | null;
    if (username?.canPlay?.() === false) return;
    whenModalLoaded(tag, () => {
      const modal = document.querySelector(tag) as LobbyModal | null;
      if (typeof modal?.open === "function") {
        modal.open(kind === "host" ? {partyPreset:preset} : undefined);
      } else {
        console.error("WorldPvP failed to open", tag);
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

        <section class="worldpvp-party-presets" aria-label="Party match formats">
          <div class="worldpvp-party-header">
            <span>PARTY MATCHMAKING</span>
            <strong>Choose your battlefield.</strong>
            <p>Host private rooms. Choose the format, customize the map, and invite your squad.</p>
          </div>
          <div class="worldpvp-party-options">
            <button type="button" class="worldpvp-party-option" @click=${() => this.openMode("host","2v2")}>
              <span>TEAM BATTLE</span><strong>2v2</strong><small>4 players · Duos</small>
            </button>
            <button type="button" class="worldpvp-party-option" @click=${() => this.openMode("host","3v3")}>
              <span>SQUAD BATTLE</span><strong>3v3</strong><small>6 players · Trios</small>
            </button>
            <button type="button" class="worldpvp-party-option" @click=${() => this.openMode("host","ffa")}>
              <span>FREE FOR ALL</span><strong>FFA</strong><small>Every commander for themselves</small>
            </button>
            <button type="button" class="worldpvp-party-option worldpvp-party-custom" @click=${() => this.openMode("host","custom")}>
              <span>CUSTOM ROOM</span><strong>Custom</strong><small>Build your own game rules</small>
            </button>
          </div>
        </section>
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
