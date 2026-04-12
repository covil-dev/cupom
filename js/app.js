const APP_DEBUG_PRESET = {
  enabled: true,
  rationBalance: 0,
  progressPercent: 0
};

function clampProgressPercent(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(Math.max(numericValue, 0), 100);
}

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
  const heartsModule = globalThis.HeartsModule;
  const slotMachineModule = globalThis.SlotMachineModule;
  const rewardBurstModule = globalThis.RewardBurstModule;
  const FEED_COST = 150;
  const DEFAULT_INITIAL_GLOBAL_RATION_BALANCE = 600;
  const DROP_REWARD_AMOUNT = 750;
  const DROP_REWARD_INTERVAL_MS = 10000;
  const POST_COMPLETE_HEARTS_TO_CHOKE = 2;
  const DOG_SPIT_RECOVERY_MS = 860;
  const DOG_ALLIANCE_FLIGHT_MS = 760;
  const DOG_ALLIANCE_ICON_PATH = "./assets/icons/ic-alianaca.png";
  const initialGlobalRationBalance = APP_DEBUG_PRESET.enabled
    ? APP_DEBUG_PRESET.rationBalance
    : DEFAULT_INITIAL_GLOBAL_RATION_BALANCE;
  const initialProgressPercent = APP_DEBUG_PRESET.enabled
    ? clampProgressPercent(APP_DEBUG_PRESET.progressPercent)
    : 0;

  if (
    !dogModule ||
    typeof dogModule.createDogAnimation !== "function" ||
    !feedModule ||
    typeof feedModule.createFeedButtonController !== "function" ||
    !dropModule ||
    typeof dropModule.createDropButtonController !== "function" ||
    !heartsModule ||
    typeof heartsModule.createHeartSystem !== "function" ||
    !slotMachineModule ||
    typeof slotMachineModule.createSlotMachineController !== "function"
  ) {
    console.error("Modulos principais da aplicacao nao foram carregados.");
    return;
  }

  setupSceneReferenceLayout();

  const gameScreen = document.getElementById("gameScreen");
  const dogSprite = document.getElementById("dogSprite");
  const feedButton = document.getElementById("feedButton");
  const globalRationBalance = document.getElementById("globalRationBalance");
  const dropButton = document.getElementById("dropButton");
  const dropBalance = document.getElementById("dropBalance");
  const dropCountdown = document.getElementById("dropCountdown");
  const dropGainFeedback = document.getElementById("dropGainFeedback");
  const rewardProgress = document.getElementById("rewardProgress");
  const rewardProgressFill = document.getElementById("rewardProgressFill");
  const dogStage = dogSprite?.closest(".dog-stage");
  const uiLayer = document.querySelector(".ui-layer");

  if (
    !gameScreen ||
    !dogSprite ||
    !feedButton ||
    !globalRationBalance ||
    !dropButton ||
    !dropBalance ||
    !dropCountdown ||
    !dropGainFeedback ||
    !dogStage ||
    !uiLayer
  ) {
    console.error("Elementos da interface do cachorro nao foram encontrados.");
    return;
  }

  const { animator, config } = dogModule.createDogAnimation(dogSprite);
  const state = {
    globalRationBalance: initialGlobalRationBalance,
    pendingFeedCost: 0,
    postCompleteHeartCount: 0,
    dogIsChoking: false,
    dogRecoveryTimeoutId: null,
    dogAllianceFlightElement: null,
    dogAllianceBurstController: null
  };

  function applyInitialProgress() {
    if (!rewardProgress || !rewardProgressFill) {
      return;
    }

    rewardProgressFill.style.width = `${initialProgressPercent}%`;
    rewardProgress.setAttribute("aria-valuenow", `${Math.round(initialProgressPercent)}`);
  }

  function getAvailableFeedBalance() {
    return state.globalRationBalance - state.pendingFeedCost;
  }

  function canAffordFeed() {
    return getAvailableFeedBalance() >= FEED_COST;
  }

  function canRequestFeed() {
    return !state.dogIsChoking && canAffordFeed();
  }

  function renderGlobalRationBalance() {
    globalThis.rationBalance = state.globalRationBalance;
    feedController.render();
  }

  function queueFeed() {
    if (!canRequestFeed()) {
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
    canAffordFeed: () => canRequestFeed(),
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

  function setupDogAllianceBurstController() {
    if (state.dogAllianceBurstController) {
      return;
    }

    if (!rewardBurstModule || typeof rewardBurstModule.createRewardBurstController !== "function") {
      console.error("Modulo de reward burst nao carregado para o evento da alianca.");
      return;
    }

    const overlayHost = uiLayer || gameScreen;
    state.dogAllianceBurstController = rewardBurstModule.createRewardBurstController({
      hostElement: overlayHost,
      iconPath: DOG_ALLIANCE_ICON_PATH
    });
  }

  function showDogAllianceBurst() {
    setupDogAllianceBurstController();
    state.dogAllianceBurstController?.show();
  }

  function clearDogAllianceFlight() {
    if (!state.dogAllianceFlightElement) {
      return;
    }

    state.dogAllianceFlightElement.remove();
    state.dogAllianceFlightElement = null;
  }

  function launchAllianceToScreenCenter() {
    if (!dogSprite) {
      showDogAllianceBurst();
      return;
    }

    const overlayHost = uiLayer || gameScreen;
    const hostRect = overlayHost.getBoundingClientRect();
    const dogRect = dogSprite.getBoundingClientRect();

    if (hostRect.width <= 0 || hostRect.height <= 0 || dogRect.width <= 0 || dogRect.height <= 0) {
      showDogAllianceBurst();
      return;
    }

    const startX = dogRect.left + dogRect.width / 2 - hostRect.left;
    const startY = dogRect.top + dogRect.height / 2 - hostRect.top;
    const targetX = hostRect.width / 2;
    const targetY = hostRect.height / 2;
    const deltaX = targetX - startX;
    const deltaY = targetY - startY;

    clearDogAllianceFlight();

    const flightElement = document.createElement("div");
    flightElement.className = "dog-alliance-flight";
    flightElement.style.setProperty("--alliance-start-x", `${startX}px`);
    flightElement.style.setProperty("--alliance-start-y", `${startY}px`);
    flightElement.style.setProperty("--alliance-dx", `${deltaX}px`);
    flightElement.style.setProperty("--alliance-dy", `${deltaY}px`);
    flightElement.style.setProperty("--alliance-flight-duration", `${DOG_ALLIANCE_FLIGHT_MS}ms`);

    const flightIconElement = document.createElement("img");
    flightIconElement.className = "dog-alliance-flight-icon";
    flightIconElement.src = DOG_ALLIANCE_ICON_PATH;
    flightIconElement.alt = "";
    flightIconElement.setAttribute("aria-hidden", "true");

    flightElement.appendChild(flightIconElement);
    overlayHost.appendChild(flightElement);
    state.dogAllianceFlightElement = flightElement;

    const finalizeFlight = () => {
      if (state.dogAllianceFlightElement === flightElement) {
        state.dogAllianceFlightElement = null;
      }

      flightElement.remove();
      showDogAllianceBurst();
    };

    flightElement.addEventListener("animationend", finalizeFlight, { once: true });
  }

  function enterDogChokeMode() {
    if (state.dogIsChoking) {
      return;
    }

    if (state.dogRecoveryTimeoutId) {
      clearTimeout(state.dogRecoveryTimeoutId);
      state.dogRecoveryTimeoutId = null;
    }

    state.dogIsChoking = true;
    state.postCompleteHeartCount = 0;
    clearDogAllianceFlight();

    animator.stop({ resetState: false });
    animator.setState("choke");
    dogSprite.classList.remove("is-spitting");
    void dogSprite.offsetWidth;
    dogSprite.classList.add("is-choking");
    feedController.render();
  }

  function resolveDogChokeMode() {
    if (!state.dogIsChoking) {
      return;
    }

    state.dogIsChoking = false;
    state.postCompleteHeartCount = 0;

    if (state.dogRecoveryTimeoutId) {
      clearTimeout(state.dogRecoveryTimeoutId);
      state.dogRecoveryTimeoutId = null;
    }

    dogSprite.classList.remove("is-choking");
    dogSprite.classList.add("is-spitting");
    animator.setState("spit");
    launchAllianceToScreenCenter();
    feedController.render();

    state.dogRecoveryTimeoutId = window.setTimeout(() => {
      state.dogRecoveryTimeoutId = null;
      dogSprite.classList.remove("is-spitting");

      if (!animator.running) {
        animator.start();
      }
    }, DOG_SPIT_RECOVERY_MS);
  }

  function handleHeartConsumedAfterCompletion({ didConsumeWithProgressFull }) {
    if (state.dogIsChoking) {
      return;
    }

    if (didConsumeWithProgressFull) {
      state.postCompleteHeartCount += 1;

      if (state.postCompleteHeartCount >= POST_COMPLETE_HEARTS_TO_CHOKE) {
        enterDogChokeMode();
      }

      return;
    }

    state.postCompleteHeartCount = 0;
  }

  const heartsController = heartsModule.createHeartSystem({
    anchorElement: dogStage,
    progressBarElement: rewardProgress,
    progressFillElement: rewardProgressFill,
    rewardBurstLayerElement: uiLayer,
    onHeartConsumed: handleHeartConsumedAfterCompletion
  });

  const slotMachineController = slotMachineModule.createSlotMachineController({
    hostElement: gameScreen,
    onRewardGranted: (rewardAmount) => {
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
      heartsController.registerSuccessfulFeed();
    });
  }

  function setupControls() {
    heartsController.mount();
    feedController.mount();
    dropController.mount();
    dropController.startAccumulator();
    slotMachineController.mount();
  }

  function setupDogClick() {
    dogSprite.addEventListener("click", () => {
      if (state.dogIsChoking) {
        resolveDogChokeMode();
        return;
      }

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

      if (key === "1") animator.forceNextAutoStep("tail");
      if (key === "2") animator.forceNextAutoStep("stand");
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
  applyInitialProgress();
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
    openSlotMachine: () => slotMachineController.open(),
    spinSlotMachine: () => slotMachineController.startSpin(),
    getFeedBalance: () => state.globalRationBalance,
    getDropBalance: () => dropController.getBalance(),
    getHeartsStatus: () => heartsController.getStatus(),
    playTailAuto: () => animator.forceNextAutoStep("tail"),
    playOpaAuto: () => animator.forceNextAutoStep("opa"),
    playTongueAuto: () => animator.forceNextAutoStep("tongue"),
    playStandAuto: () => animator.forceNextAutoStep("stand")
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApp, { once: true });
} else {
  bootApp();
}
