const led = document.getElementById("led-server");
const statusText = document.getElementById("status-text");
const btnPlay = document.getElementById("btn-play");
const btnSettings = document.getElementById("btn-settings");
const btnQuit = document.getElementById("btn-quit");
const btnClose = document.getElementById("btn-close");
const hint = document.getElementById("hint");
const versionEl = document.getElementById("version");
const phaseList = document.getElementById("phase-list");
const hydrateSummary = document.getElementById("hydrate-summary");

const PHASE_ORDER = ["hydrate", "market", "portfolio", "news"];

function setPhaseUi(activePhase) {
  if (!phaseList) return;
  const idx = PHASE_ORDER.indexOf(activePhase);
  for (const li of phaseList.querySelectorAll("li")) {
    const phase = li.getAttribute("data-phase");
    const phaseIdx = PHASE_ORDER.indexOf(phase);
    li.classList.remove("active", "done");
    if (phaseIdx < idx) li.classList.add("done");
    else if (phaseIdx === idx) li.classList.add("active");
  }
}

function setStatus(state, text, payload) {
  led.className = "led" + (state ? ` ${state}` : "");
  statusText.textContent = text;

  if (state === "warming") {
    btnPlay.disabled = true;
    btnPlay.textContent = "▶ Preloading…";
    if (phaseList) phaseList.hidden = false;
    if (payload?.phase) setPhaseUi(payload.phase);
    if (hydrateSummary && payload?.hydrateSummary) {
      const h = payload.hydrateSummary;
      hydrateSummary.hidden = false;
      hydrateSummary.textContent = `${h.quoteCount} quotes · ${h.articleCount} articles · ${h.holdingCount} holdings cached`;
    }
    if (payload?.detail) {
      hint.textContent = payload.detail;
    }
    return;
  }

  if (phaseList) phaseList.hidden = true;
  if (hydrateSummary) hydrateSummary.hidden = true;

  if (state === "ready") {
    btnPlay.disabled = false;
    btnPlay.textContent = "▶ Open Terminal";
    hint.textContent = "Preload complete. Open the terminal or tweak settings.";
    for (const li of phaseList?.querySelectorAll("li") ?? []) {
      li.classList.add("done");
      li.classList.remove("active");
    }
  } else if (state === "starting") {
    btnPlay.disabled = true;
    btnPlay.textContent = "▶ Starting…";
    hint.textContent = "Starting local API engine…";
  } else if (state === "error") {
    btnPlay.disabled = false;
    btnPlay.textContent = "▶ Retry";
    hint.textContent = text || "Engine error — retry preload.";
  } else {
    btnPlay.disabled = false;
    btnPlay.textContent = "▶ Play";
    hint.textContent = "Launch the local API and preload data before opening the terminal.";
  }
}

if (window.launcher) {
  versionEl.textContent = `v${window.launcher.getVersion()}`;

  window.launcher.onStatus((payload) => {
    if (payload.state === "warming") {
      setStatus("warming", payload.detail || "Launch preload…", payload);
    } else if (payload.state === "ready") {
      setStatus("ready", payload.message || "Engine online");
    } else if (payload.state === "starting") {
      setStatus("starting", payload.message || "Starting engine…");
    } else if (payload.state === "error") {
      setStatus("", payload.message || "Engine error");
    } else {
      setStatus("", "Engine offline");
    }
  });

  btnPlay.addEventListener("click", () => window.launcher.play());
  btnSettings.addEventListener("click", () => window.launcher.openSettings());
  btnQuit.addEventListener("click", () => window.launcher.quit());
  if (btnClose) btnClose.addEventListener("click", () => window.launcher.quit());
}
