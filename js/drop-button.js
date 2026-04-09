(() => {
  function createDropButtonController({
    dropButton,
    dropBalanceOutput,
    dropGainFeedback,
    rewardAmount,
    rewardIntervalMs,
    onRewardCollected
  }) {
    if (!dropButton || !dropBalanceOutput || !dropGainFeedback) {
      throw new Error("Elementos do botao de recompensa nao encontrados.");
    }

    if (
      typeof rewardAmount !== "number" ||
      typeof rewardIntervalMs !== "number" ||
      typeof onRewardCollected !== "function"
    ) {
      throw new Error("Configuracao invalida do botao de recompensa.");
    }

    let dropBalance = 0;
    let intervalId = null;
    let feedbackTimeoutId = null;

    const handleClick = () => {
      collectReward();
    };

    function renderDropBalance() {
      dropBalanceOutput.textContent = `+${dropBalance}`;
      dropButton.classList.toggle("is-charged", dropBalance > 0);
    }

    function showGainFeedback() {
      dropGainFeedback.textContent = `+${rewardAmount}`;
      dropGainFeedback.classList.remove("is-visible");
      void dropGainFeedback.offsetWidth;
      dropGainFeedback.classList.add("is-visible");

      if (feedbackTimeoutId) {
        clearTimeout(feedbackTimeoutId);
      }

      feedbackTimeoutId = setTimeout(() => {
        dropGainFeedback.classList.remove("is-visible");
      }, 900);
    }

    function accumulateReward() {
      dropBalance += rewardAmount;
      renderDropBalance();
      showGainFeedback();
    }

    function collectReward() {
      if (dropBalance <= 0) {
        return false;
      }

      const collectedAmount = dropBalance;
      dropBalance = 0;
      renderDropBalance();
      onRewardCollected(collectedAmount);
      return true;
    }

    function startAccumulator() {
      if (intervalId) {
        return;
      }

      intervalId = setInterval(() => {
        accumulateReward();
      }, rewardIntervalMs);
    }

    function stopAccumulator() {
      if (!intervalId) {
        return;
      }

      clearInterval(intervalId);
      intervalId = null;
    }

    function mount() {
      renderDropBalance();
      dropButton.addEventListener("click", handleClick);
    }

    function unmount() {
      dropButton.removeEventListener("click", handleClick);
      stopAccumulator();

      if (feedbackTimeoutId) {
        clearTimeout(feedbackTimeoutId);
        feedbackTimeoutId = null;
      }
    }

    function getBalance() {
      return dropBalance;
    }

    return {
      mount,
      unmount,
      getBalance,
      collectReward,
      startAccumulator,
      stopAccumulator
    };
  }

  globalThis.DropButtonModule = {
    createDropButtonController
  };
})();
