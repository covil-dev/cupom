function setupSceneReferenceLayout() {
  const gameScreen = document.getElementById("gameScreen");
  const sceneReference = document.getElementById("sceneReference");
  const SCENE_WIDTH = 1156;
  const SCENE_HEIGHT = 2072;

  if (!gameScreen || !sceneReference) {
    return;
  }

  let frameRequestId = null;

  const applySceneBounds = () => {
    frameRequestId = null;
    const { width: screenWidth, height: screenHeight } = gameScreen.getBoundingClientRect();

    if (screenWidth <= 0 || screenHeight <= 0) {
      return;
    }

    const coverScale = Math.max(screenWidth / SCENE_WIDTH, screenHeight / SCENE_HEIGHT);
    const renderedWidth = Math.round(SCENE_WIDTH * coverScale);
    const renderedHeight = Math.round(SCENE_HEIGHT * coverScale);
    const offsetLeft = Math.round((screenWidth - renderedWidth) / 2);
    const offsetTop = Math.round(screenHeight - renderedHeight);

    sceneReference.style.width = `${renderedWidth}px`;
    sceneReference.style.height = `${renderedHeight}px`;
    sceneReference.style.left = `${offsetLeft}px`;
    sceneReference.style.top = `${offsetTop}px`;
  };

  const requestSceneBoundsUpdate = () => {
    if (frameRequestId !== null) {
      return;
    }

    frameRequestId = window.requestAnimationFrame(applySceneBounds);
  };

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(requestSceneBoundsUpdate);
    observer.observe(gameScreen);
  }

  window.addEventListener("resize", requestSceneBoundsUpdate, { passive: true });
  window.addEventListener("orientationchange", requestSceneBoundsUpdate, { passive: true });
  requestSceneBoundsUpdate();
}

function bootApp() {
  const dogModule = globalThis.DogAnimationModule;
  const feedModule = globalThis.FeedButtonModule;
  const dropModule = globalThis.DropButtonModule;
  const FEED_COST = 150;
  const INITIAL_GLOBAL_RATION_BALANCE = 600;
  const DROP_REWARD_AMOUNT = 150;
  const DROP_REWARD_INTERVAL_MS = 10000;

  if (
    !dogModule ||
    typeof dogModule.createDogAnimation !== "function" ||
    !feedModule ||
    typeof feedModule.createFeedButtonController !== "function" ||
    !dropModule ||
    typeof dropModule.createDropButtonController !== "function"
  ) {
    console.error("Modulos principais da aplicacao nao foram carregados.");
    return;
  }

  setupSceneReferenceLayout();

  const dogSprite = document.getElementById("dogSprite");
  const feedButton = document.getElementById("feedButton");
  const globalRationBalance = document.getElementById("globalRationBalance");
  const dropButton = document.getElementById("dropButton");
  const dropBalance = document.getElementById("dropBalance");
  const dropCountdown = document.getElementById("dropCountdown");
  const dropGainFeedback = document.getElementById("dropGainFeedback");

  if (
    !dogSprite ||
    !feedButton ||
    !globalRationBalance ||
    !dropButton ||
    !dropBalance ||
    !dropCountdown ||
    !dropGainFeedback
  ) {
    console.error("Elementos da interface do cachorro nao foram encontrados.");
    return;
  }

  const { animator, config, timelineIndexes } = dogModule.createDogAnimation(dogSprite);
  const state = {
    globalRationBalance: INITIAL_GLOBAL_RATION_BALANCE,
    pendingFeedCost: 0
  };

  function getAvailableFeedBalance() {
    return state.globalRationBalance - state.pendingFeedCost;
  }

  function canAffordFeed() {
    return getAvailableFeedBalance() >= FEED_COST;
  }

  function renderGlobalRationBalance() {
    globalThis.rationBalance = state.globalRationBalance;
    feedController.render();
  }

  function queueFeed() {
    if (!canAffordFeed()) {
      return false;
    }

    state.pendingFeedCost += FEED_COST;
    animator.enqueueManual("eat", { priority: true });
    return true;
  }

  const feedController = feedModule.createFeedButtonController({
    feedButton,
    feedBalanceOutput: globalRationBalance,
    getTotalBalance: () => state.globalRationBalance,
    canAffordFeed: () => canAffordFeed(),
    onRequestFeed: queueFeed
  });

  const dropController = dropModule.createDropButtonController({
    dropButton,
    dropBalanceOutput: dropBalance,
    dropCountdownOutput: dropCountdown,
    dropGainFeedback,
    rewardAmount: DROP_REWARD_AMOUNT,
    rewardIntervalMs: DROP_REWARD_INTERVAL_MS,
    onRewardCollected: (rewardAmount) => {
      state.globalRationBalance += rewardAmount;
      renderGlobalRationBalance();
    }
  });

  function setupFeedStateSync() {
    animator.on("manual-sequence-start", ({ sequenceName }) => {
      if (sequenceName !== "eat" || state.pendingFeedCost < FEED_COST) {
        return;
      }

      state.pendingFeedCost -= FEED_COST;
      state.globalRationBalance -= FEED_COST;
      renderGlobalRationBalance();
    });
  }

  function setupControls() {
    feedController.mount();
    dropController.mount();
    dropController.startAccumulator();
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
      if (key === "e") feedController.requestFeed();
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

  animator.start();
  setupFeedStateSync();
  setupControls();
  renderGlobalRationBalance();
  setupDogClick();
  setupDebugMode();

  globalThis.dogAnimation = {
    start: () => animator.start(),
    stop: () => animator.stop(),
    triggerEat: () => feedController.requestFeed(),
    triggerStand: () => animator.enqueueManual("stand", { priority: true }),
    triggerChokeSpit: () => animator.enqueueManual("chokeSpit"),
    collectDropReward: () => dropController.collectReward(),
    getFeedBalance: () => state.globalRationBalance,
    getDropBalance: () => dropController.getBalance(),
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
