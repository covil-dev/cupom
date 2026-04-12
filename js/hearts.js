(() => {
  /*
    Ajustes principais da mecanica de coracoes.
    Esses valores foram centralizados para facilitar manutencao futura.
  */
  const HEARTS_CONFIG = {
    feedsPerHeart: 2,
    progressGainPercent: 5,
    iconPath: "./assets/icons/ic-coracao.png",
    spawnArea: {
      widthPercent: 56,
      heightPx: 122,
      offsetBottomPx: 12,
      heartSizePx: 52,
      jitterPercentX: 3.5,
      jitterPercentY: 2.2
    },
    animation: {
      spawnMs: 340,
      readyPulseMs: 1400,
      consumeMs: 240
    },
    partial: {
      dimOpacity: 0.4
    },
    spawnSlots: [
      { x: 0.18, y: 0.72 },
      { x: 0.33, y: 0.48 },
      { x: 0.52, y: 0.58 },
      { x: 0.7, y: 0.4 },
      { x: 0.84, y: 0.66 },
      { x: 0.46, y: 0.3 }
    ],
    spawnJitterPattern: [
      { x: -1, y: 0 },
      { x: 0.8, y: -0.8 },
      { x: 0.2, y: 1 },
      { x: -0.7, y: 0.6 },
      { x: 0.6, y: -0.2 }
    ]
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function toFiniteNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function resolveMarkerThreshold(markerElement) {
    const thresholdFromDataset = toFiniteNumber(markerElement?.dataset?.threshold, NaN);

    if (Number.isFinite(thresholdFromDataset)) {
      return clamp(thresholdFromDataset, 0, 100);
    }

    const className = markerElement?.className || "";
    const thresholdMatch = className.match(/reward-marker-(\d+)/);

    if (!thresholdMatch) {
      return null;
    }

    return clamp(toFiniteNumber(thresholdMatch[1], NaN), 0, 100);
  }

  function createHeartSystem({
    anchorElement,
    progressBarElement,
    progressFillElement,
    rewardBurstLayerElement,
    onHeartConsumed,
    config = {}
  }) {
    if (!anchorElement) {
      throw new Error("Elemento ancora da mecanica de coracoes nao encontrado.");
    }

    const resolvedConfig = {
      ...HEARTS_CONFIG,
      ...config,
      spawnArea: {
        ...HEARTS_CONFIG.spawnArea,
        ...(config.spawnArea || {})
      },
      animation: {
        ...HEARTS_CONFIG.animation,
        ...(config.animation || {})
      },
      partial: {
        ...HEARTS_CONFIG.partial,
        ...(config.partial || {})
      },
      spawnSlots: Array.isArray(config.spawnSlots) && config.spawnSlots.length > 0
        ? config.spawnSlots
        : HEARTS_CONFIG.spawnSlots,
      spawnJitterPattern:
        Array.isArray(config.spawnJitterPattern) && config.spawnJitterPattern.length > 0
          ? config.spawnJitterPattern
          : HEARTS_CONFIG.spawnJitterPattern
    };
    const feedsPerHeart = Math.max(1, Math.round(toFiniteNumber(resolvedConfig.feedsPerHeart, 2)));
    const rewardMilestoneIcons = new Map([
      [60, "./assets/icons/ic-prato.png"],
      [80, "./assets/icons/ic-chocolate.png"],
      [100, "./assets/icons/ic-cupom.png"]
    ]);
    const rewardMilestones = Array.from(rewardMilestoneIcons.keys());
    const defaultRewardBurstIconPath = rewardMilestoneIcons.get(100);
    const rewardBurstModule = globalThis.RewardBurstModule;

    const state = {
      hearts: [],
      layerElement: null,
      spawnIndex: 0,
      progressPercent: 0,
      progressMarkers: [],
      reachedMilestones: new Set(),
      rewardBurstController: null,
      rewardBurstPendingMilestones: []
    };

    function mount() {
      if (state.layerElement) {
        return;
      }

      const layerElement = document.createElement("div");
      layerElement.className = "hearts-layer";
      layerElement.style.setProperty("--heart-area-width", `${resolvedConfig.spawnArea.widthPercent}%`);
      layerElement.style.setProperty("--heart-area-height", `${resolvedConfig.spawnArea.heightPx}px`);
      layerElement.style.setProperty(
        "--heart-area-offset",
        `${resolvedConfig.spawnArea.offsetBottomPx}px`
      );
      layerElement.style.setProperty("--heart-size", `${resolvedConfig.spawnArea.heartSizePx}px`);
      layerElement.style.setProperty(
        "--heart-dim-opacity",
        String(resolvedConfig.partial.dimOpacity)
      );
      layerElement.style.setProperty(
        "--heart-spawn-duration",
        `${resolvedConfig.animation.spawnMs}ms`
      );
      layerElement.style.setProperty(
        "--heart-ready-duration",
        `${resolvedConfig.animation.readyPulseMs}ms`
      );
      layerElement.style.setProperty(
        "--heart-consume-duration",
        `${resolvedConfig.animation.consumeMs}ms`
      );

      anchorElement.appendChild(layerElement);
      state.layerElement = layerElement;
      state.progressMarkers = Array.from(
        progressBarElement?.parentElement?.querySelectorAll(".reward-marker") || []
      )
        .map((markerElement) => ({
          element: markerElement,
          threshold: resolveMarkerThreshold(markerElement)
        }))
        .filter((markerData) => markerData.threshold !== null);
      setupRewardBurstController();
      syncProgressFromUi();
      hydrateReachedMilestones();
      renderProgress();
    }

    function unmount() {
      if (!state.layerElement) {
        return;
      }

      state.rewardBurstController?.destroy();

      state.layerElement.remove();
      state.layerElement = null;
      state.hearts = [];
      state.progressMarkers = [];
      state.reachedMilestones.clear();
      state.rewardBurstController = null;
      state.rewardBurstPendingMilestones = [];
    }

    function syncProgressFromUi() {
      const ariaValueNow = progressBarElement?.getAttribute("aria-valuenow");
      const fallbackFromAria = toFiniteNumber(ariaValueNow, 0);
      const widthStyleValue = progressFillElement?.style.width || "";
      const fallbackFromWidth = widthStyleValue
        ? toFiniteNumber(widthStyleValue.replace("%", ""), fallbackFromAria)
        : fallbackFromAria;

      state.progressPercent = clamp(fallbackFromWidth, 0, 100);
    }

    function hydrateReachedMilestones() {
      state.reachedMilestones.clear();
      rewardMilestones.forEach((threshold) => {
        if (state.progressPercent >= threshold) {
          state.reachedMilestones.add(threshold);
        }
      });
    }

    function setupRewardBurstController() {
      if (state.rewardBurstController) {
        return;
      }

      if (!rewardBurstModule || typeof rewardBurstModule.createRewardBurstController !== "function") {
        console.error("Modulo de reward burst nao carregado.");
        return;
      }

      const overlayHost = rewardBurstLayerElement || anchorElement.parentElement || anchorElement;
      const burstController = rewardBurstModule.createRewardBurstController({
        hostElement: overlayHost,
        iconPath: defaultRewardBurstIconPath
      });

      burstController.onDismiss(() => {
        if (state.rewardBurstPendingMilestones.length === 0) {
          return;
        }

        window.setTimeout(() => {
          showNextRewardBurst();
        }, 60);
      });

      state.rewardBurstController = burstController;
    }

    function showRewardBurst(threshold) {
      setupRewardBurstController();

      if (!state.rewardBurstController) {
        return;
      }

      const rewardIconPath =
        rewardMilestoneIcons.get(threshold) ||
        defaultRewardBurstIconPath;
      state.rewardBurstController.setIconPath?.(rewardIconPath);

      state.rewardBurstController.show();
    }

    function showNextRewardBurst() {
      if (state.rewardBurstPendingMilestones.length === 0) {
        return;
      }

      const nextThreshold = state.rewardBurstPendingMilestones.shift();
      showRewardBurst(nextThreshold);
    }

    function renderProgress() {
      if (!progressFillElement || !progressBarElement) {
        return;
      }

      progressFillElement.style.width = `${state.progressPercent}%`;
      progressBarElement.setAttribute("aria-valuenow", `${Math.round(state.progressPercent)}`);
      state.progressMarkers.forEach((markerData) => {
        markerData.element.classList.toggle("is-reached", state.progressPercent >= markerData.threshold);
      });
    }

    function increaseProgressByHeart() {
      const previousProgressPercent = state.progressPercent;

      state.progressPercent = clamp(
        state.progressPercent + resolvedConfig.progressGainPercent,
        0,
        100
      );
      renderProgress();
      checkMilestonesCrossed(previousProgressPercent, state.progressPercent);
    }

    function checkMilestonesCrossed(previousProgressPercent, currentProgressPercent) {
      rewardMilestones.forEach((threshold) => {
        const crossedThreshold =
          previousProgressPercent < threshold && currentProgressPercent >= threshold;

        if (!crossedThreshold || state.reachedMilestones.has(threshold)) {
          return;
        }

        state.reachedMilestones.add(threshold);
        state.rewardBurstPendingMilestones.push(threshold);

        if (state.rewardBurstController?.isVisible()) {
          return;
        }

        showNextRewardBurst();
      });
    }

    function nextSpawnPosition() {
      const slotIndex = state.spawnIndex % resolvedConfig.spawnSlots.length;
      const jitterIndex = state.spawnIndex % resolvedConfig.spawnJitterPattern.length;
      state.spawnIndex += 1;

      const slot = resolvedConfig.spawnSlots[slotIndex];
      const jitter = resolvedConfig.spawnJitterPattern[jitterIndex];

      const x = clamp(
        slot.x + (jitter.x * resolvedConfig.spawnArea.jitterPercentX) / 100,
        0.1,
        0.9
      );
      const y = clamp(
        slot.y + (jitter.y * resolvedConfig.spawnArea.jitterPercentY) / 100,
        0.08,
        0.92
      );

      return { x, y };
    }

    function animateHeartSpawn(heartState) {
      heartState.element.classList.add("is-spawning");

      window.setTimeout(() => {
        heartState.element.classList.remove("is-spawning");
      }, resolvedConfig.animation.spawnMs);
    }

    function markHeartClickable(heartState) {
      heartState.element.disabled = false;
      heartState.element.classList.add("is-ready");
      heartState.element.setAttribute("aria-disabled", "false");
      heartState.element.setAttribute("aria-label", "Coracao cheio. Toque para converter em progresso");
    }

    function fillHeart(heartState) {
      heartState.isFull = true;
      heartState.fillRatio = 1;
      heartState.element.style.setProperty("--heart-fill-ratio", "1");
      markHeartClickable(heartState);
    }

    function updateHeartState(heartState) {
      const fillRatio = clamp(heartState.feedCount / feedsPerHeart, 0, 1);
      heartState.fillRatio = fillRatio;
      heartState.element.style.setProperty("--heart-fill-ratio", fillRatio.toFixed(3));

      if (fillRatio >= 1 && !heartState.isFull) {
        fillHeart(heartState);
      }
    }

    function consumeHeart(heartId) {
      const heartState = state.hearts.find((heart) => heart.id === heartId);

      if (!heartState || !heartState.isFull || !heartState.element.isConnected) {
        return false;
      }

      const progressPercentBeforeConsume = state.progressPercent;

      heartState.element.disabled = true;
      heartState.element.classList.remove("is-ready");
      heartState.element.classList.add("is-consuming");
      increaseProgressByHeart();
      const progressPercentAfterConsume = state.progressPercent;

      if (typeof onHeartConsumed === "function") {
        try {
          onHeartConsumed({
            heartId: heartState.id,
            progressPercentBeforeConsume,
            progressPercentAfterConsume,
            didConsumeWithProgressFull: progressPercentBeforeConsume >= 100
          });
        } catch (error) {
          console.error("Falha ao processar callback de consumo de coracao.", error);
        }
      }

      window.setTimeout(() => {
        heartState.element.remove();
        state.hearts = state.hearts.filter((heart) => heart.id !== heartId);
      }, resolvedConfig.animation.consumeMs);

      return true;
    }

    function createHeart() {
      if (!state.layerElement) {
        return null;
      }

      const heartElement = document.createElement("button");
      heartElement.type = "button";
      heartElement.className = "heart-token";
      heartElement.disabled = true;
      heartElement.setAttribute("aria-disabled", "true");
      heartElement.setAttribute("aria-label", "Coracao parcial");

      const visualElement = document.createElement("span");
      visualElement.className = "heart-token-visual";

      const dimLayerElement = document.createElement("span");
      dimLayerElement.className = "heart-token-layer heart-token-layer-dim";
      dimLayerElement.style.backgroundImage = `url("${resolvedConfig.iconPath}")`;

      const fillLayerElement = document.createElement("span");
      fillLayerElement.className = "heart-token-layer heart-token-layer-fill";
      fillLayerElement.style.backgroundImage = `url("${resolvedConfig.iconPath}")`;

      visualElement.appendChild(dimLayerElement);
      visualElement.appendChild(fillLayerElement);
      heartElement.appendChild(visualElement);

      const { x, y } = nextSpawnPosition();
      heartElement.style.left = `${(x * 100).toFixed(2)}%`;
      heartElement.style.top = `${(y * 100).toFixed(2)}%`;
      heartElement.style.setProperty("--heart-fill-ratio", "0");

      const heartState = {
        id: `heart-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        element: heartElement,
        feedCount: 0,
        fillRatio: 0,
        isFull: false
      };

      heartElement.addEventListener("click", () => {
        consumeHeart(heartState.id);
      });

      state.layerElement.appendChild(heartElement);
      state.hearts.push(heartState);
      animateHeartSpawn(heartState);
      return heartState;
    }

    function registerSuccessfulFeed() {
      if (!state.layerElement) {
        mount();
      }

      let heartToUpdate = state.hearts.find((heart) => !heart.isFull);

      if (!heartToUpdate) {
        heartToUpdate = createHeart();
      }

      if (!heartToUpdate) {
        return null;
      }

      heartToUpdate.feedCount += 1;
      updateHeartState(heartToUpdate);
      return heartToUpdate;
    }

    function getStatus() {
      return {
        progressPercent: state.progressPercent,
        hearts: state.hearts.map((heart) => ({
          id: heart.id,
          feedCount: heart.feedCount,
          fillRatio: heart.fillRatio,
          isFull: heart.isFull
        }))
      };
    }

    return {
      mount,
      unmount,
      createHeart,
      updateHeartState,
      fillHeart,
      animateHeartSpawn,
      markHeartClickable,
      consumeHeart,
      registerSuccessfulFeed,
      getStatus,
      config: resolvedConfig
    };
  }

  globalThis.HeartsModule = {
    createHeartSystem,
    HEARTS_CONFIG
  };
})();
