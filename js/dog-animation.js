/*
  Logica isolada do cachorro:
  - mapa de sprites
  - configuracao de tempos
  - timeline automatica
  - fila manual com prioridade para eat
*/

(() => {
  const DOG_SPRITES = {
    default: "./assets/dog/padrao.png",
    tail1: "./assets/dog/rabo1.png",
    tail2: "./assets/dog/rabo2.png",
    stand1: "./assets/dog/empe1.png",
    stand2: "./assets/dog/empe2.png",
    tongue: "./assets/dog/lingua.png",
    opa: "./assets/dog/opa.png",
    eat: "./assets/dog/come.png",
    choke: "./assets/dog/engasga.png",
    spit: "./assets/dog/escarra.png"
  };

  const DOG_ANIMATION_CONFIG = {
    frameDelay: 500,
    eatFrameDelay: 1000,
    idleHoldFrames: 3,
    sequenceGapFrames: 1,
    debugMode: true
  };

  const DOG_AUTO_TIMELINE = [
    "idle",
    "idle",
    "tail",
    "idle",
    "opa",
    "idle",
    "tongue",
    "idle",
    "idle",
    "stand",
    "idle",
    "idle",
    "idle"
  ];

  class DogAnimator {
  constructor(spriteElement, sprites, config, autoTimeline) {
    this.spriteElement = spriteElement;
    this.sprites = sprites;
    this.config = config;
    this.autoTimeline = autoTimeline;

    this.running = false;
    this.currentState = "default";
    this.autoIndex = 0;
    this.manualQueue = [];
    this.listeners = new Map();
  }

  on(eventName, listener) {
    const listeners = this.listeners.get(eventName) ?? [];
    listeners.push(listener);
    this.listeners.set(eventName, listeners);

    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    const listeners = this.listeners.get(eventName);

    if (!listeners) {
      return;
    }

    this.listeners.set(
      eventName,
      listeners.filter((registeredListener) => registeredListener !== listener)
    );
  }

  emit(eventName, payload = {}) {
    const listeners = this.listeners.get(eventName) ?? [];

    listeners.forEach((listener) => {
      listener(payload);
    });
  }

  preloadAll() {
    Object.values(this.sprites).forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }

  setState(stateName) {
    const src = this.sprites[stateName];
    if (!src || !this.spriteElement) {
      return;
    }

    this.currentState = stateName;
    this.spriteElement.src = src;
  }

  wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async playFrame(stateName, delay = this.config.frameDelay) {
    this.setState(stateName);
    await this.wait(delay);
  }

  async playSequence(frames) {
    await this.playFrame("default");

    for (const frame of frames) {
      await this.playFrame(frame);
    }

    await this.playFrame("default");
    await this.wait(this.config.frameDelay * this.config.sequenceGapFrames);
  }

  async playIdle() {
    this.setState("default");
    await this.wait(this.config.frameDelay * this.config.idleHoldFrames);
  }

  async playTail() {
    await this.playSequence(["tail1", "tail2", "tail1"]);
  }

  async playStand() {
    await this.playSequence(["stand1", "stand2", "stand1"]);
  }

  async playOpa() {
    await this.playSequence(["opa"]);
  }

  async playTongue() {
    await this.playSequence(["tongue"]);
  }

  async playEat() {
    await this.playFrame("default");
    await this.playFrame("eat", this.config.eatFrameDelay);
    await this.playFrame("default");
    await this.wait(this.config.frameDelay * this.config.sequenceGapFrames);
  }

  async playChokeSpit() {
    await this.playSequence(["choke", "spit"]);
  }

  async runAutomaticStep() {
    const step = this.autoTimeline[this.autoIndex % this.autoTimeline.length];
    this.autoIndex += 1;

    if (step === "tail") {
      await this.playTail();
      return;
    }

    if (step === "opa") {
      await this.playOpa();
      return;
    }

    if (step === "tongue") {
      await this.playTongue();
      return;
    }

    if (step === "stand") {
      await this.playStand();
      return;
    }

    await this.playIdle();
  }

  enqueueManual(sequenceName, options = {}) {
    const { priority = false } = options;

    if (sequenceName !== "eat" && sequenceName !== "chokeSpit" && sequenceName !== "stand") {
      return;
    }

    if (sequenceName === "eat") {
      const firstNonEatIndex = this.manualQueue.findIndex((queuedSequence) => queuedSequence !== "eat");

      if (firstNonEatIndex === -1) {
        this.manualQueue.push(sequenceName);
        return;
      }

      this.manualQueue.splice(firstNonEatIndex, 0, sequenceName);
      return;
    }

    if (priority) {
      this.manualQueue.unshift(sequenceName);
      return;
    }

    this.manualQueue.push(sequenceName);
  }

  dequeueNextManual() {
    const eatIndex = this.manualQueue.indexOf("eat");

    if (eatIndex !== -1) {
      return this.manualQueue.splice(eatIndex, 1)[0];
    }

    return this.manualQueue.shift();
  }

  async runManualSequence(sequenceName) {
    this.emit("manual-sequence-start", { sequenceName });

    if (sequenceName === "eat") {
      await this.playEat();
      this.emit("manual-sequence-end", { sequenceName });
      return;
    }

    if (sequenceName === "stand") {
      await this.playStand();
      this.emit("manual-sequence-end", { sequenceName });
      return;
    }

    if (sequenceName === "chokeSpit") {
      await this.playChokeSpit();
      this.emit("manual-sequence-end", { sequenceName });
    }
  }

  async start() {
    if (this.running || !this.spriteElement) {
      return;
    }

    this.running = true;
    this.preloadAll();
    this.setState("default");

    while (this.running) {
      if (this.manualQueue.length > 0) {
        const manualSequence = this.dequeueNextManual();
        await this.runManualSequence(manualSequence);
        continue;
      }

      await this.runAutomaticStep();
    }
  }

  stop() {
    this.running = false;
    this.setState("default");
  }

  getStatus() {
    return {
      running: this.running,
      currentState: this.currentState,
      manualQueue: [...this.manualQueue],
      nextAutoStep: this.autoTimeline[this.autoIndex % this.autoTimeline.length]
    };
  }
  }

  function createDogAnimation(spriteElement) {
    const animator = new DogAnimator(
      spriteElement,
      DOG_SPRITES,
      DOG_ANIMATION_CONFIG,
      DOG_AUTO_TIMELINE
    );

    return {
      animator,
      config: DOG_ANIMATION_CONFIG,
      timelineIndexes: {
        tail: 2,
        opa: 4,
        tongue: 6,
        stand: 9
      }
    };
  }

  globalThis.DogAnimationModule = {
    createDogAnimation
  };
})();
