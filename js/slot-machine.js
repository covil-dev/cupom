(() => {
  const DEFAULT_SLOT_MACHINE_CONFIG = Object.freeze({
    rewardAmount: 600,
    spinDurationMs: 1850,
    reelStopStaggerMs: 260,
    reelTickMs: 95,
    winChance: 0.24,
    frameImagePath: "./assets/icons/roleta.png",
    triggerImagePath: "./assets/icons/bt-roleta.png",
    rewardIconPath: "./assets/icons/ic-racao.png",
    iconPaths: [
      "./assets/icons/ic-anel.png",
      "./assets/icons/ic-batom.png",
      "./assets/icons/ic-coracao.png",
      "./assets/icons/ic-hamburger.png",
      "./assets/icons/ic-moeda.png",
      "./assets/icons/ic-presente.png",
      "./assets/icons/ic-racao.png",
      "./assets/icons/ic-segredo.png"
    ]
  });

  function toFiniteNumber(value, fallback) {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function normalizeIconPaths(iconPaths) {
    if (!Array.isArray(iconPaths)) {
      return [...DEFAULT_SLOT_MACHINE_CONFIG.iconPaths];
    }

    const normalizedIcons = iconPaths.filter((iconPath) => typeof iconPath === "string" && iconPath.length > 0);
    return normalizedIcons.length >= 3
      ? normalizedIcons
      : [...DEFAULT_SLOT_MACHINE_CONFIG.iconPaths];
  }

  function resolveConfig(config = {}) {
    return {
      rewardAmount: Math.max(1, Math.round(toFiniteNumber(config.rewardAmount, DEFAULT_SLOT_MACHINE_CONFIG.rewardAmount))),
      spinDurationMs: Math.max(
        300,
        Math.round(toFiniteNumber(config.spinDurationMs, DEFAULT_SLOT_MACHINE_CONFIG.spinDurationMs))
      ),
      reelStopStaggerMs: Math.max(
        60,
        Math.round(toFiniteNumber(config.reelStopStaggerMs, DEFAULT_SLOT_MACHINE_CONFIG.reelStopStaggerMs))
      ),
      reelTickMs: Math.max(
        50,
        Math.round(toFiniteNumber(config.reelTickMs, DEFAULT_SLOT_MACHINE_CONFIG.reelTickMs))
      ),
      winChance: clamp(toFiniteNumber(config.winChance, DEFAULT_SLOT_MACHINE_CONFIG.winChance), 0, 1),
      frameImagePath: config.frameImagePath || DEFAULT_SLOT_MACHINE_CONFIG.frameImagePath,
      triggerImagePath: config.triggerImagePath || DEFAULT_SLOT_MACHINE_CONFIG.triggerImagePath,
      rewardIconPath: config.rewardIconPath || DEFAULT_SLOT_MACHINE_CONFIG.rewardIconPath,
      iconPaths: normalizeIconPaths(config.iconPaths)
    };
  }

  function createSlotMachineDom(config) {
    const rootElement = document.createElement("div");
    rootElement.className = "slot-machine-root";

    const triggerButton = document.createElement("button");
    triggerButton.type = "button";
    triggerButton.className = "slot-machine-trigger";
    triggerButton.setAttribute("aria-label", "Abrir maquina caca-niquel");

    const triggerImage = document.createElement("img");
    triggerImage.className = "slot-machine-trigger-icon";
    triggerImage.src = config.triggerImagePath;
    triggerImage.alt = "";
    triggerImage.setAttribute("aria-hidden", "true");
    triggerButton.appendChild(triggerImage);
    rootElement.appendChild(triggerButton);

    const overlayElement = document.createElement("section");
    overlayElement.className = "slot-machine-overlay";
    overlayElement.setAttribute("aria-hidden", "true");

    const backdropButton = document.createElement("button");
    backdropButton.type = "button";
    backdropButton.className = "slot-machine-backdrop";
    backdropButton.setAttribute("aria-label", "Fechar maquina caca-niquel");
    overlayElement.appendChild(backdropButton);

    const panelElement = document.createElement("div");
    panelElement.className = "slot-machine-panel";

    const shellButton = document.createElement("button");
    shellButton.type = "button";
    shellButton.className = "slot-machine-shell";
    shellButton.setAttribute("aria-label", "Girar maquina caca-niquel");

    const reelsElement = document.createElement("div");
    reelsElement.className = "slot-machine-reels";

    const reels = [];

    for (let reelIndex = 0; reelIndex < 3; reelIndex += 1) {
      const windowElement = document.createElement("div");
      windowElement.className = "slot-machine-window";

      const reelElement = document.createElement("div");
      reelElement.className = "slot-reel";
      reelElement.style.setProperty("--slot-reel-offset", `${reelIndex * 14}ms`);

      const trackElement = document.createElement("div");
      trackElement.className = "slot-reel-track";

      const iconElements = [];

      for (let rowIndex = 0; rowIndex < 3; rowIndex += 1) {
        const reelIcon = document.createElement("img");
        reelIcon.className = "slot-reel-icon";
        reelIcon.alt = "";
        reelIcon.setAttribute("aria-hidden", "true");
        trackElement.appendChild(reelIcon);
        iconElements.push(reelIcon);
      }

      reelElement.appendChild(trackElement);
      windowElement.appendChild(reelElement);
      reelsElement.appendChild(windowElement);

      reels.push({
        element: reelElement,
        iconElements,
        intervalId: null,
        stopTimeoutId: null
      });
    }

    const frameElement = document.createElement("img");
    frameElement.className = "slot-machine-frame";
    frameElement.src = config.frameImagePath;
    frameElement.alt = "";
    frameElement.setAttribute("aria-hidden", "true");

    shellButton.appendChild(reelsElement);
    shellButton.appendChild(frameElement);
    panelElement.appendChild(shellButton);

    const hintElement = document.createElement("p");
    hintElement.className = "slot-machine-hint";
    hintElement.textContent = "Toque na maquina para girar";
    panelElement.appendChild(hintElement);

    overlayElement.appendChild(panelElement);
    rootElement.appendChild(overlayElement);

    return {
      rootElement,
      triggerButton,
      overlayElement,
      backdropButton,
      shellButton,
      hintElement,
      reels
    };
  }

  function createSlotMachineController({ hostElement, onRewardGranted, config = {} }) {
    if (!hostElement) {
      throw new Error("Elemento host da maquina caca-niquel nao encontrado.");
    }

    const resolvedConfig = resolveConfig(config);
    const rewardBurstModule = globalThis.RewardBurstModule;
    const dom = createSlotMachineDom(resolvedConfig);
    const state = {
      isMounted: false,
      isOpen: false,
      isSpinning: false,
      spinFinishTimeoutId: null,
      rewardBurstController: null
    };

    function pickRandomSymbol() {
      const symbolIndex = Math.floor(Math.random() * resolvedConfig.iconPaths.length);
      return resolvedConfig.iconPaths[symbolIndex];
    }

    function setReelSymbols(reelState, symbols) {
      reelState.iconElements.forEach((iconElement, index) => {
        iconElement.src = symbols[index];
      });
    }

    function shuffleReel(reelState) {
      setReelSymbols(reelState, [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()]);
    }

    function setFinalReelSymbol(reelState, symbolPath) {
      setReelSymbols(reelState, [pickRandomSymbol(), symbolPath, pickRandomSymbol()]);
      reelState.element.classList.add("is-settled");

      window.setTimeout(() => {
        reelState.element.classList.remove("is-settled");
      }, 260);
    }

    function primeReels() {
      dom.reels.forEach((reelState) => {
        shuffleReel(reelState);
      });
    }

    function setupRewardBurstController() {
      if (state.rewardBurstController) {
        return;
      }

      if (!rewardBurstModule || typeof rewardBurstModule.createRewardBurstController !== "function") {
        console.error("Modulo de reward burst nao carregado para a slot machine.");
        return;
      }

      state.rewardBurstController = rewardBurstModule.createRewardBurstController({
        hostElement: dom.overlayElement,
        iconPath: resolvedConfig.rewardIconPath,
        labelText: `+${resolvedConfig.rewardAmount}`
      });
    }

    function hideWinBurst() {
      state.rewardBurstController?.hide();
    }

    function showWinBurst() {
      setupRewardBurstController();
      state.rewardBurstController?.show();
    }

    function clearSpinTimers() {
      dom.reels.forEach((reelState) => {
        if (reelState.intervalId) {
          clearInterval(reelState.intervalId);
          reelState.intervalId = null;
        }

        if (reelState.stopTimeoutId) {
          clearTimeout(reelState.stopTimeoutId);
          reelState.stopTimeoutId = null;
        }

        reelState.element.classList.remove("is-spinning");
      });

      if (state.spinFinishTimeoutId) {
        clearTimeout(state.spinFinishTimeoutId);
        state.spinFinishTimeoutId = null;
      }
    }

    function grantReward(amount) {
      if (typeof onRewardGranted === "function") {
        onRewardGranted(amount);
        return;
      }

      const currentBalance = Number(globalThis.rationBalance);

      if (Number.isFinite(currentBalance)) {
        globalThis.rationBalance = currentBalance + amount;
      } else {
        globalThis.rationBalance = amount;
      }
    }

    function isWinningResult(resultSymbols) {
      return (
        Array.isArray(resultSymbols) &&
        resultSymbols.length === 3 &&
        resultSymbols[0] === resultSymbols[1] &&
        resultSymbols[1] === resultSymbols[2]
      );
    }

    function generateFinalSymbols() {
      const shouldWin = Math.random() < resolvedConfig.winChance;

      if (shouldWin) {
        const winningSymbol = pickRandomSymbol();
        return [winningSymbol, winningSymbol, winningSymbol];
      }

      const symbols = [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()];

      if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
        const replacement = resolvedConfig.iconPaths.find((iconPath) => iconPath !== symbols[0]);
        symbols[2] = replacement || symbols[2];
      }

      return symbols;
    }

    function finishSpin(finalSymbols) {
      clearSpinTimers();
      state.isSpinning = false;
      dom.shellButton.classList.remove("is-spinning");

      const hasWon = isWinningResult(finalSymbols);

      if (hasWon) {
        dom.shellButton.classList.add("is-winning");
        dom.hintElement.textContent = `Premio! +${resolvedConfig.rewardAmount} racoes`;
        showWinBurst();
        grantReward(resolvedConfig.rewardAmount);

        window.setTimeout(() => {
          dom.shellButton.classList.remove("is-winning");
        }, 1200);
      } else {
        dom.hintElement.textContent = "Toque na maquina para girar";
      }
    }

    function startSpin() {
      if (!state.isOpen || state.isSpinning) {
        return false;
      }

      state.isSpinning = true;
      dom.shellButton.classList.add("is-spinning");
      dom.hintElement.textContent = "Girando...";
      hideWinBurst();

      const finalSymbols = generateFinalSymbols();

      dom.reels.forEach((reelState, reelIndex) => {
        reelState.element.classList.add("is-spinning");
        shuffleReel(reelState);

        const reelTickMs = Math.max(50, resolvedConfig.reelTickMs + reelIndex * 14);
        reelState.intervalId = window.setInterval(() => {
          shuffleReel(reelState);
        }, reelTickMs);

        const stopDelay = resolvedConfig.spinDurationMs + reelIndex * resolvedConfig.reelStopStaggerMs;
        reelState.stopTimeoutId = window.setTimeout(() => {
          if (reelState.intervalId) {
            clearInterval(reelState.intervalId);
            reelState.intervalId = null;
          }

          reelState.element.classList.remove("is-spinning");
          setFinalReelSymbol(reelState, finalSymbols[reelIndex]);
        }, stopDelay);
      });

      const completeSpinDelay =
        resolvedConfig.spinDurationMs +
        (dom.reels.length - 1) * resolvedConfig.reelStopStaggerMs +
        80;

      state.spinFinishTimeoutId = window.setTimeout(() => {
        finishSpin(finalSymbols);
      }, completeSpinDelay);

      return true;
    }

    function open() {
      if (!state.isMounted || state.isOpen) {
        return;
      }

      state.isOpen = true;
      dom.triggerButton.classList.add("is-active");
      dom.overlayElement.classList.add("is-open");
      dom.overlayElement.setAttribute("aria-hidden", "false");
      dom.hintElement.textContent = state.isSpinning ? "Girando..." : "Toque na maquina para girar";
    }

    function close() {
      if (!state.isMounted || !state.isOpen || state.isSpinning) {
        return;
      }

      state.isOpen = false;
      dom.triggerButton.classList.remove("is-active");
      dom.overlayElement.classList.remove("is-open");
      dom.overlayElement.setAttribute("aria-hidden", "true");
      hideWinBurst();
    }

    function toggle() {
      if (state.isOpen) {
        close();
      } else {
        open();
      }
    }

    function handleTriggerClick() {
      toggle();
    }

    function handleBackdropClick() {
      close();
    }

    function handleShellClick(event) {
      event.preventDefault();
      startSpin();
    }

    function mount() {
      if (state.isMounted) {
        return;
      }

      hostElement.appendChild(dom.rootElement);
      dom.triggerButton.addEventListener("click", handleTriggerClick);
      dom.backdropButton.addEventListener("click", handleBackdropClick);
      dom.shellButton.addEventListener("click", handleShellClick);
      primeReels();
      state.isMounted = true;
    }

    function unmount() {
      if (!state.isMounted) {
        return;
      }

      clearSpinTimers();
      hideWinBurst();
      state.rewardBurstController?.destroy();
      state.rewardBurstController = null;
      state.isOpen = false;
      state.isSpinning = false;
      dom.triggerButton.removeEventListener("click", handleTriggerClick);
      dom.backdropButton.removeEventListener("click", handleBackdropClick);
      dom.shellButton.removeEventListener("click", handleShellClick);
      dom.rootElement.remove();
      state.isMounted = false;
    }

    return {
      mount,
      unmount,
      open,
      close,
      toggle,
      startSpin,
      isOpen: () => state.isOpen,
      isSpinning: () => state.isSpinning
    };
  }

  globalThis.SlotMachineModule = {
    createSlotMachineController,
    DEFAULT_SLOT_MACHINE_CONFIG
  };
})();
