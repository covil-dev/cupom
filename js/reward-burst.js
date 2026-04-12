(() => {
  const INTERACTION_LOCK_MS = 2500;

  function createRewardBurstController({ hostElement, iconPath, labelText = "" }) {
    if (!hostElement) {
      throw new Error("Elemento host do reward burst nao encontrado.");
    }

    const layerElement = document.createElement("div");
    layerElement.className = "reward-burst-layer";

    const overlayElement = document.createElement("div");
    overlayElement.className = "reward-burst-overlay";
    overlayElement.setAttribute("aria-hidden", "true");

    const coreElement = document.createElement("div");
    coreElement.className = "reward-burst-core";

    const contentElement = document.createElement("div");
    contentElement.className = "reward-burst-content";

    const itemElement = document.createElement("img");
    itemElement.className = "reward-burst-item";
    itemElement.src = iconPath;
    itemElement.alt = "";

    contentElement.appendChild(itemElement);

    let labelElement = null;

    if (typeof labelText === "string" && labelText.trim().length > 0) {
      coreElement.classList.add("has-label");
      labelElement = document.createElement("span");
      labelElement.className = "reward-burst-label";
      labelElement.textContent = labelText.trim();
      contentElement.appendChild(labelElement);
    }

    coreElement.appendChild(contentElement);
    overlayElement.appendChild(coreElement);
    layerElement.appendChild(overlayElement);
    hostElement.appendChild(layerElement);

    let dismissCallback = null;
    let interactionUnlockAt = 0;
    let unlockTimeoutId = null;

    function restartAnimations() {
      coreElement.style.animation = "none";
      itemElement.style.animation = "none";

      if (labelElement) {
        labelElement.style.animation = "none";
      }

      void overlayElement.offsetWidth;
      coreElement.style.animation = "";
      itemElement.style.animation = "";

      if (labelElement) {
        labelElement.style.animation = "";
      }
    }

    function onOverlayPointerDown(event) {
      event.preventDefault();
      event.stopPropagation();

      if (!isVisible()) {
        return;
      }

      if (Date.now() < interactionUnlockAt) {
        return;
      }

      hide();

      if (typeof dismissCallback === "function") {
        dismissCallback();
      }
    }

    function show() {
      interactionUnlockAt = Date.now() + INTERACTION_LOCK_MS;

      if (unlockTimeoutId) {
        clearTimeout(unlockTimeoutId);
        unlockTimeoutId = null;
      }

      unlockTimeoutId = window.setTimeout(() => {
        unlockTimeoutId = null;
      }, INTERACTION_LOCK_MS);

      restartAnimations();
      overlayElement.classList.remove("is-visible");
      void overlayElement.offsetWidth;
      overlayElement.classList.add("is-visible");
    }

    function setIconPath(nextIconPath) {
      if (typeof nextIconPath !== "string" || nextIconPath.trim().length === 0) {
        return;
      }

      itemElement.src = nextIconPath;
    }

    function hide() {
      overlayElement.classList.remove("is-visible");
    }

    function isVisible() {
      return overlayElement.classList.contains("is-visible");
    }

    function onDismiss(callback) {
      dismissCallback = typeof callback === "function" ? callback : null;
    }

    function destroy() {
      if (unlockTimeoutId) {
        clearTimeout(unlockTimeoutId);
        unlockTimeoutId = null;
      }

      overlayElement.removeEventListener("pointerdown", onOverlayPointerDown);
      layerElement.remove();
      dismissCallback = null;
      interactionUnlockAt = 0;
    }

    overlayElement.addEventListener("pointerdown", onOverlayPointerDown);

    return {
      show,
      hide,
      setIconPath,
      isVisible,
      onDismiss,
      destroy
    };
  }

  globalThis.RewardBurstModule = {
    createRewardBurstController
  };
})();
