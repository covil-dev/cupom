(() => {
  function createDropButtonController({
    dropButton,
    dropBalanceOutput,
    dropCountdownOutput,
    dropGainFeedback,
    rewardAmount,
    rewardIntervalMs,
    onRewardCollected
  }) {
    if (!dropButton || !dropBalanceOutput || !dropCountdownOutput || !dropGainFeedback) {
      throw new Error("Elementos do botao de recompensa nao encontrados.");
    }

    if (
      typeof rewardAmount !== "number" ||
      typeof rewardIntervalMs !== "number" ||
      typeof onRewardCollected !== "function"
    ) {
      throw new Error("Configuracao invalida do botao de recompensa.");
    }

    const REWARD_INTERVAL_STEP_SECONDS = 5;
    const REWARD_INTERVAL_LIMIT_SECONDS = 120;
    const REWARD_INTERVAL_RESET_SECONDS = 10;
    const MAX_DROP_BALANCE = 6000;

    const initialRewardIntervalSeconds = Math.ceil(rewardIntervalMs / 1000);

    if (initialRewardIntervalSeconds <= 0) {
      throw new Error("O intervalo da recompensa precisa ser maior que zero.");
    }

    let dropBalance = 0;
    let currentRewardIntervalSeconds = initialRewardIntervalSeconds;
    let rewardTimeoutId = null;
    let countdownIntervalId = null;
    let nextRewardAt = null;
    let lastRenderedCountdown = null;
    let feedbackTimeoutId = null;
    let accumulatorStarted = false;
    let isPausedAtCap = false;

    const handleClick = () => {
      collectReward();
    };

    function renderDropBalance() {
      dropBalanceOutput.textContent = `+${dropBalance}`;
      dropBalanceOutput.classList.toggle("is-charged", dropBalance > 0);
    }

    function renderCountdown(seconds) {
      if (lastRenderedCountdown === seconds) {
        return;
      }

      dropCountdownOutput.textContent = `${seconds}`;
      lastRenderedCountdown = seconds;
    }

    function renderCountdownFromTimestamp() {
      if (nextRewardAt === null) {
        renderCountdown(currentRewardIntervalSeconds);
        return;
      }

      const remainingMs = Math.max(0, nextRewardAt - Date.now());
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      renderCountdown(remainingSeconds);
    }

    function clearRewardTimers() {
      if (rewardTimeoutId) {
        clearTimeout(rewardTimeoutId);
        rewardTimeoutId = null;
      }

      if (countdownIntervalId) {
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
      }
    }

    function scheduleNextReward() {
      if (!accumulatorStarted || isPausedAtCap) {
        return;
      }

      clearRewardTimers();
      nextRewardAt = Date.now() + currentRewardIntervalSeconds * 1000;
      lastRenderedCountdown = null;
      renderCountdownFromTimestamp();

      countdownIntervalId = setInterval(() => {
        renderCountdownFromTimestamp();
      }, 250);

      rewardTimeoutId = setTimeout(() => {
        const hasAccumulated = accumulateReward();

        if (!hasAccumulated || dropBalance >= MAX_DROP_BALANCE) {
          pauseAccumulatorAtCap();
          return;
        }

        scheduleNextReward();
      }, currentRewardIntervalSeconds * 1000);
    }

    function increaseRewardIntervalAfterAccumulation() {
      const nextRewardInterval = currentRewardIntervalSeconds + REWARD_INTERVAL_STEP_SECONDS;
      currentRewardIntervalSeconds =
        nextRewardInterval >= REWARD_INTERVAL_LIMIT_SECONDS
          ? REWARD_INTERVAL_RESET_SECONDS
          : nextRewardInterval;
    }

    function showGainFeedback(gainedAmount) {
      dropGainFeedback.textContent = `+${gainedAmount}`;
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
      if (dropBalance >= MAX_DROP_BALANCE) {
        return false;
      }

      const nextDropBalance = Math.min(MAX_DROP_BALANCE, dropBalance + rewardAmount);
      const gainedAmount = nextDropBalance - dropBalance;

      if (gainedAmount <= 0) {
        return false;
      }

      dropBalance = nextDropBalance;
      renderDropBalance();
      showGainFeedback(gainedAmount);
      increaseRewardIntervalAfterAccumulation();
      return true;
    }

    function pauseAccumulatorAtCap() {
      clearRewardTimers();
      nextRewardAt = null;
      isPausedAtCap = true;
      renderCountdown(currentRewardIntervalSeconds);
    }

    function collectReward() {
      if (dropBalance <= 0) {
        return false;
      }

      const collectedAmount = dropBalance;
      dropBalance = 0;
      renderDropBalance();

      if (accumulatorStarted) {
        isPausedAtCap = false;
        scheduleNextReward();
      } else {
        renderCountdown(currentRewardIntervalSeconds);
      }

      onRewardCollected(collectedAmount);
      return true;
    }

    function startAccumulator() {
      if (accumulatorStarted) {
        return;
      }

      accumulatorStarted = true;

      if (dropBalance >= MAX_DROP_BALANCE) {
        pauseAccumulatorAtCap();
        return;
      }

      scheduleNextReward();
    }

    function stopAccumulator() {
      if (!accumulatorStarted) {
        return;
      }

      accumulatorStarted = false;
      isPausedAtCap = false;
      clearRewardTimers();
      nextRewardAt = null;
      renderCountdown(currentRewardIntervalSeconds);
    }

    function mount() {
      renderDropBalance();
      renderCountdown(currentRewardIntervalSeconds);
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
