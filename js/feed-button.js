(() => {
  function createFeedButtonController({
    feedButton,
    feedBalanceOutput,
    getTotalBalance,
    canAffordFeed,
    onRequestFeed
  }) {
    if (!feedButton || !feedBalanceOutput) {
      throw new Error("Elementos do botao de alimentar nao encontrados.");
    }

    if (
      typeof getTotalBalance !== "function" ||
      typeof canAffordFeed !== "function" ||
      typeof onRequestFeed !== "function"
    ) {
      throw new Error("Configuracao invalida do botao de alimentar.");
    }

    const handleClick = () => {
      requestFeed();
    };

    function render() {
      feedBalanceOutput.textContent = String(getTotalBalance());
      feedButton.disabled = !canAffordFeed();
    }

    function requestFeed() {
      const queued = onRequestFeed();
      render();
      return queued;
    }

    function mount() {
      feedButton.addEventListener("click", handleClick);
    }

    function unmount() {
      feedButton.removeEventListener("click", handleClick);
    }

    return {
      mount,
      unmount,
      render,
      requestFeed
    };
  }

  globalThis.FeedButtonModule = {
    createFeedButtonController
  };
})();
