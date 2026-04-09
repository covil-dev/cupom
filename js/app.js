function bootApp() {
  const dogModule = globalThis.DogAnimationModule;
  const FEED_COST = 150;
  const INITIAL_FEED_BALANCE = 600;

  if (!dogModule || typeof dogModule.createDogAnimation !== "function") {
    console.error("DogAnimationModule nao foi carregado.");
    return;
  }

  const dogSprite = document.getElementById("dogSprite");
  const feedButton = document.getElementById("feedButton");
  const feedBalance = document.getElementById("feedBalance");

  if (!dogSprite || !feedBalance) {
    console.error("Elementos da interface do cachorro nao foram encontrados.");
    return;
  }

  const { animator, config, timelineIndexes } = dogModule.createDogAnimation(dogSprite);
  const state = {
    feedBalance: INITIAL_FEED_BALANCE,
    pendingFeedCost: 0
  };

  animator.start();

  function getAvailableFeedBalance() {
    return state.feedBalance - state.pendingFeedCost;
  }

  function canAffordFeed() {
    return getAvailableFeedBalance() >= FEED_COST;
  }

  function renderFeedBalance() {
    feedBalance.textContent = String(state.feedBalance);

    if (feedButton) {
      feedButton.disabled = !canAffordFeed();
    }
  }

  function queueFeed() {
    if (!canAffordFeed()) {
      return false;
    }

    state.pendingFeedCost += FEED_COST;
    animator.enqueueManual("eat", { priority: true });
    renderFeedBalance();
    return true;
  }

  function setupFeedStateSync() {
    animator.on("manual-sequence-start", ({ sequenceName }) => {
      if (sequenceName !== "eat" || state.pendingFeedCost < FEED_COST) {
        return;
      }

      state.pendingFeedCost -= FEED_COST;
      state.feedBalance -= FEED_COST;
      renderFeedBalance();
    });
  }

  function setupFeedButton() {
    if (!feedButton) {
      return;
    }

    feedButton.addEventListener("click", () => {
      queueFeed();
    });
  }

  function setupDogClick() {
    dogSprite.addEventListener("click", () => {
      animator.enqueueManual("stand", { priority: true });
    });
  }

  function createDebugOverlay() {
    const panel = document.createElement("div");
    panel.setAttribute("id", "debugPanel");
    panel.style.position = "fixed";
    panel.style.left = "12px";
    panel.style.bottom = "12px";
    panel.style.zIndex = "9999";
    panel.style.padding = "10px 12px";
    panel.style.borderRadius = "10px";
    panel.style.background = "rgba(10, 12, 16, 0.82)";
    panel.style.color = "#e9f0ff";
    panel.style.fontFamily = "monospace";
    panel.style.fontSize = "12px";
    panel.style.lineHeight = "1.45";
    panel.style.maxWidth = "330px";
    panel.style.pointerEvents = "none";

    document.body.appendChild(panel);
    return panel;
  }

  function setupDebugMode() {
    if (!config.debugMode) {
      return;
    }

    const debugPanel = createDebugOverlay();

    const renderDebugInfo = () => {
      const { running, currentState, manualQueue, nextAutoStep } = animator.getStatus();
      debugPanel.textContent =
        "[DEBUG] 1:tail(auto) 2:stand(auto) E:eat(manual) C:choke+spit(manual) S:start/stop\n" +
        `running: ${running ? "yes" : "no"} | state: ${currentState} | nextAuto: ${nextAutoStep}\n` +
        `manualQueue: ${manualQueue.length > 0 ? manualQueue.join(", ") : "(empty)"}`;
    };

    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();

      if (key === "1") animator.autoIndex = timelineIndexes.tail;
      if (key === "2") animator.autoIndex = timelineIndexes.stand;
      if (key === "e") queueFeed();
      if (key === "c") animator.enqueueManual("chokeSpit");

      if (key === "s") {
        if (animator.running) {
          animator.stop();
        } else {
          animator.start();
        }
      }

      renderDebugInfo();
    });

    setInterval(renderDebugInfo, 200);
    renderDebugInfo();
  }

  setupFeedStateSync();
  renderFeedBalance();
  setupFeedButton();
  setupDogClick();
  setupDebugMode();

  globalThis.dogAnimation = {
    start: () => animator.start(),
    stop: () => animator.stop(),
    triggerEat: () => queueFeed(),
    triggerStand: () => animator.enqueueManual("stand", { priority: true }),
    triggerChokeSpit: () => animator.enqueueManual("chokeSpit"),
    getFeedBalance: () => state.feedBalance,
    playTailAuto: () => (animator.autoIndex = timelineIndexes.tail),
    playOpaAuto: () => (animator.autoIndex = timelineIndexes.opa),
    playTongueAuto: () => (animator.autoIndex = timelineIndexes.tongue),
    playStandAuto: () => (animator.autoIndex = timelineIndexes.stand)
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApp, { once: true });
} else {
  bootApp();
}
