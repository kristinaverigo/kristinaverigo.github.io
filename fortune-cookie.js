const designerFortunes = [
  "Печенье видит нового стейкхолдера. Соболезнуем.",
  "Хорошая новость: концепт согласовали. Плохая: не этот.",
  "Вы на верном пути. К сожалению, это user flow на 17 экранов.",
  "Скоро появится комментарий: «Что-то не то». Уточнений не будет.",
  "Вас ждёт большое будущее и очень маленький дедлайн.",
  "Сегодня вы найдёте нужный компонент. Он будет detached.",
  "Печенье чувствует сильную энергетику final_final_8_REAL.",
  "Пусть сегодня вам немного повезёт. Печенье настаивает.",
];

const fortuneVisibleDuration = 5000;
const cookieReactionDuration = 220;
const cookieCrackedDelay = 145;
const cookieBrokenDelay = 310;
const fortuneRevealDelay = 390;
const fortuneOpeningDuration = 750;
const fortuneTransitionDuration = 420;
const cookieClosingCrackedDelay = 150;
const cookieClosingClosedDelay = 300;
const fortuneReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function shuffleFortunes(fortunes) {
  const shuffled = [...fortunes];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

class FortuneCookieController {
  constructor({ root, button, strip, text, mascot }) {
    this.root = root;
    this.button = button;
    this.strip = strip;
    this.text = text;
    this.mascot = mascot;

    this.state = "closed";
    this.currentFortune = "";
    this.shuffledFortunes = [];
    this.currentIndex = 0;
    this.closeTimer = 0;
    this.transitionTimer = 0;
    this.appearanceTimer = 0;
    this.crackedTimer = 0;
    this.brokenTimer = 0;
    this.closingCrackedTimer = 0;
    this.closingClosedTimer = 0;
    this.swapTimer = 0;
    this.reactionTimer = 0;
    this.lastFortune = "";

    this.refillShuffleBag();
    this.setState("closed");
    this.setFrame("closed");
    this.bindEvents();
  }

  setState(state) {
    this.state = state;
    this.root.dataset.cookieState = state;
  }

  setFrame(frame) {
    this.root.dataset.cookieFrame = frame;
  }

  refillShuffleBag() {
    this.shuffledFortunes = shuffleFortunes(designerFortunes);

    if (
      this.lastFortune &&
      this.shuffledFortunes.length > 1 &&
      this.shuffledFortunes[0] === this.lastFortune
    ) {
      const swapIndex = this.shuffledFortunes.findIndex(
        (fortune) => fortune !== this.lastFortune,
      );
      [this.shuffledFortunes[0], this.shuffledFortunes[swapIndex]] = [
        this.shuffledFortunes[swapIndex],
        this.shuffledFortunes[0],
      ];
    }

    this.currentIndex = 0;
  }

  getNextFortune() {
    if (this.currentIndex >= this.shuffledFortunes.length) {
      this.refillShuffleBag();
    }

    const fortune = this.shuffledFortunes[this.currentIndex];
    this.currentIndex += 1;
    this.currentFortune = fortune;
    this.lastFortune = fortune;
    return fortune;
  }

  playCookieReaction() {
    window.clearTimeout(this.reactionTimer);
    this.button.classList.remove("is-refreshing");
    void this.button.offsetWidth;
    this.button.classList.add("is-refreshing");
    this.reactionTimer = window.setTimeout(() => {
      this.button.classList.remove("is-refreshing");
    }, cookieReactionDuration);
  }

  requestMascotReaction() {
    this.mascot?.dispatchEvent(new CustomEvent("mascot:fortune"));
  }

  scheduleClose() {
    window.clearTimeout(this.closeTimer);
    this.closeTimer = window.setTimeout(
      () => this.closeFortune(),
      fortuneVisibleDuration,
    );
  }

  revealFortune() {
    if (this.state !== "breaking") {
      return;
    }

    this.strip.hidden = false;
    this.strip.setAttribute("aria-hidden", "false");
    this.button.setAttribute("aria-expanded", "true");

    window.requestAnimationFrame(() => {
      if (this.state === "breaking") {
        this.root.classList.add("is-fortune-visible");
      }
    });
  }

  showNextFortune() {
    if (this.state === "breaking" || this.state === "closing") {
      return;
    }

    window.clearTimeout(this.closeTimer);

    const nextFortune = this.getNextFortune();

    if (this.state === "open") {
      this.playCookieReaction();
      window.clearTimeout(this.swapTimer);
      this.strip.classList.add("is-swapping");
      this.swapTimer = window.setTimeout(() => {
        this.text.textContent = nextFortune;
        this.strip.classList.remove("is-swapping");
      }, fortuneReducedMotion.matches ? 0 : 110);
      this.scheduleClose();
      return;
    }

    this.root.classList.add("has-been-opened");
    this.text.textContent = nextFortune;
    this.strip.hidden = true;
    this.strip.setAttribute("aria-hidden", "true");
    this.button.setAttribute("aria-expanded", "false");
    this.root.classList.remove("is-fortune-visible");
    this.setState("breaking");
    this.setFrame("closed");

    if (fortuneReducedMotion.matches) {
      this.setFrame("broken");
      this.strip.hidden = false;
      this.strip.setAttribute("aria-hidden", "false");
      this.button.setAttribute("aria-expanded", "true");
      this.root.classList.add("is-fortune-visible");
      this.setState("open");
      this.requestMascotReaction();
      this.scheduleClose();
      return;
    }

    this.crackedTimer = window.setTimeout(() => {
      if (this.state === "breaking") {
        this.setFrame("cracked");
      }
    }, cookieCrackedDelay);
    this.brokenTimer = window.setTimeout(() => {
      if (this.state === "breaking") {
        this.setFrame("broken");
        this.requestMascotReaction();
      }
    }, cookieBrokenDelay);
    this.appearanceTimer = window.setTimeout(
      () => this.revealFortune(),
      fortuneRevealDelay,
    );
    this.transitionTimer = window.setTimeout(() => {
      if (this.state !== "breaking") {
        return;
      }

      this.setState("open");
      this.scheduleClose();
    }, fortuneOpeningDuration);
  }

  closeFortune() {
    window.clearTimeout(this.closeTimer);

    if (this.state !== "open") {
      return;
    }

    this.setState("closing");
    this.root.classList.remove("is-fortune-visible");
    this.strip.setAttribute("aria-hidden", "true");
    this.button.setAttribute("aria-expanded", "false");

    if (fortuneReducedMotion.matches) {
      this.strip.hidden = true;
      this.setFrame("closed");
      this.setState("closed");
      return;
    }

    this.transitionTimer = window.setTimeout(() => {
      if (this.state !== "closing") {
        return;
      }

      this.strip.hidden = true;
      this.closingCrackedTimer = window.setTimeout(() => {
        if (this.state === "closing") {
          this.setFrame("cracked");
        }
      }, cookieClosingCrackedDelay);
      this.closingClosedTimer = window.setTimeout(() => {
        if (this.state === "closing") {
          this.setFrame("closed");
          this.setState("closed");
        }
      }, cookieClosingClosedDelay);
    }, fortuneTransitionDuration);
  }

  bindEvents() {
    this.button.addEventListener("click", () => this.showNextFortune());
  }
}

function setupFortuneCookie() {
  const root = document.querySelector("[data-fortune-cookie]");

  if (!root) {
    return;
  }

  const button = root.querySelector("[data-fortune-button]");
  const strip = document.querySelector("[data-fortune-strip]");
  const text = strip?.querySelector("[data-fortune-text]");

  if (!button || !strip || !text) {
    return;
  }

  new FortuneCookieController({
    root,
    button,
    strip,
    text,
    mascot: document.querySelector("[data-mascot]"),
  });
}

setupFortuneCookie();
