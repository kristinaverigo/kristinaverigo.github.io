const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const portfolioIntroStorageKey = "portfolioIntroPlayed";

function preventHangingPrepositions(root = document.body) {
  const skippedTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE"]);
  const shortWords =
    /(^|[\s([{«„])((?:а|без|в|во|для|до|за|и|из|к|ко|на|над|не|но|о|об|от|по|под|при|с|со|у))[ \t\r\n]+(?=\S)/giu;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];

  while (walker.nextNode()) {
    const textNode = walker.currentNode;

    if (!skippedTags.has(textNode.parentElement?.tagName)) {
      textNodes.push(textNode);
    }
  }

  textNodes.forEach((textNode) => {
    let refinedText = textNode.nodeValue;
    let previousText;

    do {
      previousText = refinedText;
      refinedText = refinedText.replace(shortWords, "$1$2\u00a0");
    } while (refinedText !== previousText);

    textNode.nodeValue = refinedText;
  });
}

preventHangingPrepositions();

const caseEntryStorageKey = "portfolio-case-entry";

function normalizeNavigationPath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function rememberCaseEntry(event) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }

  const link = event.currentTarget;
  const destination = new URL(link.href, window.location.href);

  if (destination.origin !== window.location.origin) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      caseEntryStorageKey,
      JSON.stringify({
        casePath: normalizeNavigationPath(destination.pathname),
        sourcePath: normalizeNavigationPath(window.location.pathname),
        timestamp: Date.now(),
      }),
    );
  } catch {
    // The links remain fully functional when session storage is unavailable.
  }
}

document
  .querySelectorAll(".project-button, .project-card__visual-link")
  .forEach((link) => link.addEventListener("click", rememberCaseEntry));

function enableCaseCloseNavigation() {
  const closeLink = document.querySelector("[data-case-close]");

  if (!closeLink) {
    return;
  }

  closeLink.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    let caseEntry;

    try {
      caseEntry = JSON.parse(window.sessionStorage.getItem(caseEntryStorageKey));
    } catch {
      caseEntry = null;
    }

    let referrerPath = "";

    try {
      const referrer = new URL(document.referrer);

      if (referrer.origin === window.location.origin) {
        referrerPath = referrer.pathname;
      }
    } catch {
      referrerPath = "";
    }

    const normalizedReferrerPath = referrerPath
      ? normalizeNavigationPath(referrerPath)
      : "";
    const finalHomePath = normalizeNavigationPath(
      new URL(closeLink.href, window.location.href).pathname,
    );
    const finalHomePaths = [
      finalHomePath,
      normalizeNavigationPath(new URL("index.html", closeLink.href).pathname),
      normalizeNavigationPath(new URL("index-v2.html", closeLink.href).pathname),
    ];
    const hasReliablePortfolioHistory =
      caseEntry &&
      caseEntry.casePath === normalizeNavigationPath(window.location.pathname) &&
      caseEntry.sourcePath === normalizedReferrerPath &&
      finalHomePaths.includes(caseEntry.sourcePath) &&
      Date.now() - caseEntry.timestamp < 30 * 60 * 1000 &&
      window.history.length > 1;

    if (!hasReliablePortfolioHistory) {
      return;
    }

    event.preventDefault();

    try {
      window.sessionStorage.removeItem(caseEntryStorageKey);
    } catch {
      // History navigation remains safe even if storage cleanup is unavailable.
    }

    window.history.back();
  });
}

enableCaseCloseNavigation();

if (!document.querySelector("[data-case-close]")) {
  const clearCaseEntry = () => {
    try {
      window.sessionStorage.removeItem(caseEntryStorageKey);
    } catch {
      // The page remains usable when session storage is unavailable.
    }
  };

  clearCaseEntry();
  window.addEventListener("pageshow", clearCaseEntry);
}

document.querySelectorAll(".contact-item__text > strong").forEach((primaryText) => {
  const textWindow = document.createElement("span");
  const textClone = primaryText.cloneNode(true);

  textWindow.className = "contact-item__primary-window";
  primaryText.classList.add("contact-item__primary");
  textClone.classList.add("contact-item__primary", "contact-item__primary--clone");
  textClone.setAttribute("aria-hidden", "true");

  primaryText.before(textWindow);
  textWindow.append(primaryText, textClone);
});

function enableAvatarMotion() {
  const avatarMedia = document.querySelector(".brand__avatar-media");
  const avatarName = document.querySelector(".brand__name");
  const avatarFrame = document.querySelector(".brand__avatar-frame");
  const nameTrigger = document.querySelector(".brand__name-trigger");
  const hoverQuery = window.matchMedia(
    "(min-width: 768px) and (hover: hover) and (pointer: fine)",
  );

  if (!avatarMedia || !avatarName || !avatarFrame || !nameTrigger) {
    return {
      playIntro: () => {},
      reset: () => {},
    };
  }

  const triggers = [avatarFrame, nameTrigger];
  let avatarAnimations = [];
  let avatarIntroTimers = [];
  let avatarIntroActive = false;
  let motionRunId = 0;
  let targetExpanded = false;
  let leaveTimer;

  function clearAvatarIntroTimers() {
    avatarIntroTimers.forEach((timer) => window.clearTimeout(timer));
    avatarIntroTimers = [];
  }

  function getMotionSettings() {
    const frameStyles = getComputedStyle(avatarFrame);
    const rootStyles = getComputedStyle(document.documentElement);
    const readDuration = (property, fallback) => {
      const value = Number.parseFloat(rootStyles.getPropertyValue(property));
      return Number.isFinite(value) ? value : fallback;
    };

    return {
      avatarSize: frameStyles.getPropertyValue("--avatar-size").trim(),
      expandedWidth: frameStyles.getPropertyValue("--avatar-expanded-width").trim(),
      expandedHeight: frameStyles.getPropertyValue("--avatar-expanded-height").trim(),
      expandedOffsetY: frameStyles
        .getPropertyValue("--avatar-expanded-offset-y")
        .trim(),
      expandDuration: readDuration("--avatar-expand-duration", 600),
      returnDuration: readDuration("--avatar-return-duration", 800),
      holdDuration: readDuration("--avatar-hold-duration", 170),
      expandEasing:
        rootStyles.getPropertyValue("--avatar-expand-ease").trim() ||
        "cubic-bezier(0.22, 1, 0.36, 1)",
      returnEasing:
        rootStyles.getPropertyValue("--avatar-return-ease").trim() ||
        "cubic-bezier(0.16, 1, 0.3, 1)",
    };
  }

  function cancelAvatarAnimations() {
    avatarAnimations.forEach((animation) => animation.cancel());
    avatarAnimations = [];
  }

  function getCurrentAvatarState() {
    const mediaStyles = getComputedStyle(avatarMedia);
    const nameStyles = getComputedStyle(avatarName);

    return {
      top: mediaStyles.top,
      width: mediaStyles.width,
      height: mediaStyles.height,
      borderRadius: mediaStyles.borderRadius,
      nameTransform:
        nameStyles.transform === "none"
          ? "translate3d(0, 0, 0)"
          : nameStyles.transform,
    };
  }

  function playAvatarMotion(expanded) {
    if (reducedMotionQuery.matches || !hoverQuery.matches) {
      return;
    }

    const settings = getMotionSettings();
    const current = getCurrentAvatarState();
    const currentWidth = Number.parseFloat(current.width);
    const currentHeight = Number.parseFloat(current.height);
    const avatarSize = Number.parseFloat(settings.avatarSize);
    const squishThreshold = Math.max(90, avatarSize * 1.8);
    const shouldUseSquish = expanded
      ? currentWidth < squishThreshold && currentHeight < squishThreshold
      : currentWidth > squishThreshold || currentHeight > squishThreshold;
    const duration = expanded ? settings.expandDuration : settings.returnDuration;
    const easing = expanded ? settings.expandEasing : settings.returnEasing;
    const shapeKeyframes = [
      {
        top: current.top,
        width: current.width,
        height: current.height,
        borderRadius: current.borderRadius,
      },
    ];

    if (shouldUseSquish) {
      shapeKeyframes.push({
        top: settings.expandedOffsetY,
        width: "72px",
        height: settings.expandedHeight,
        borderRadius: "570px",
        offset: 0.5,
      });
    }

    shapeKeyframes.push(
      expanded
        ? {
            top: settings.expandedOffsetY,
            width: settings.expandedWidth,
            height: settings.expandedHeight,
            borderRadius: "200px",
          }
        : {
            top: "0px",
            width: settings.avatarSize,
            height: settings.avatarSize,
            borderRadius: "200px",
          },
    );

    motionRunId += 1;
    const currentRunId = motionRunId;
    targetExpanded = expanded;
    cancelAvatarAnimations();

    const shapeAnimation = avatarMedia.animate(shapeKeyframes, {
      duration,
      easing,
      fill: "forwards",
    });
    const nameAnimation = avatarName.animate(
      [
        { transform: current.nameTransform },
        {
          transform: expanded
            ? "translate3d(-70px, -7px, 0)"
            : "translate3d(0, 0, 0)",
        },
      ],
      {
        duration,
        easing,
        fill: "forwards",
      },
    );

    avatarAnimations = [shapeAnimation, nameAnimation];

    if (!expanded) {
      Promise.allSettled(avatarAnimations.map((animation) => animation.finished)).then(
        () => {
          if (currentRunId !== motionRunId || targetExpanded) {
            return;
          }

          cancelAvatarAnimations();
        },
      );
    }
  }

  function stopAvatarIntro() {
    clearAvatarIntroTimers();
    avatarIntroActive = false;
  }

  function playAvatarIntro() {
    if (reducedMotionQuery.matches || !hoverQuery.matches) {
      return;
    }

    resetAvatarMotion();
    const settings = getMotionSettings();
    avatarIntroActive = true;
    playAvatarMotion(true);

    avatarIntroTimers.push(
      window.setTimeout(() => {
        avatarIntroActive = false;
        playAvatarMotion(false);
      }, settings.expandDuration + settings.holdDuration),
    );
  }

  function resetAvatarMotion() {
    window.clearTimeout(leaveTimer);
    clearAvatarIntroTimers();
    avatarIntroActive = false;
    targetExpanded = false;
    motionRunId += 1;
    cancelAvatarAnimations();
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("pointerenter", () => {
      window.clearTimeout(leaveTimer);
      stopAvatarIntro();

      if (!targetExpanded) {
        playAvatarMotion(true);
      }
    });

    trigger.addEventListener("pointerleave", () => {
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        if (!triggers.some((item) => item.matches(":hover"))) {
          stopAvatarIntro();

          if (targetExpanded) {
            playAvatarMotion(false);
          }
        }
      }, 40);
    });
  });

  hoverQuery.addEventListener?.("change", (event) => {
    if (!event.matches) {
      resetAvatarMotion();
    }
  });

  return {
    playIntro: playAvatarIntro,
    reset: resetAvatarMotion,
  };
}

function enableMobileTapMotion() {
  const mobileQuery = window.matchMedia("(max-width: 767px)");
  const avatarMedia = document.querySelector(".brand__avatar-media");
  const avatarFrame = document.querySelector(".brand__avatar-frame");
  const expertiseCards = document.querySelectorAll(".expertise-card");
  const contactItems = document.querySelectorAll(".contact-item");
  const animatedElements = [
    avatarMedia,
    ...expertiseCards,
    ...contactItems,
  ].filter(Boolean);
  const mobileAnimationNames = new Set([
    "mobile-avatar-press",
    "mobile-expertise-smile-wiggle",
    "mobile-expertise-result-hop",
    "mobile-contact-primary-in",
  ]);

  function restartAnimation(element) {
    if (!mobileQuery.matches || reducedMotionQuery.matches) {
      return;
    }

    element.classList.remove("is-touch-animated");
    void element.offsetWidth;
    element.classList.add("is-touch-animated");
  }

  function clearAnimation(event) {
    if (!mobileAnimationNames.has(event.animationName)) {
      return;
    }

    event.currentTarget.classList.remove("is-touch-animated");
  }

  avatarFrame?.addEventListener("pointerdown", () => restartAnimation(avatarMedia));
  expertiseCards.forEach((card) => {
    card.addEventListener("pointerdown", () => restartAnimation(card));
  });
  contactItems.forEach((contact) => {
    contact.addEventListener("pointerdown", () => restartAnimation(contact));
  });

  animatedElements.forEach((element) => {
    element.addEventListener("animationend", clearAnimation);
    element.addEventListener("animationcancel", clearAnimation);
  });

  function resetMobileTapMotion() {
    animatedElements.forEach((element) => {
      element.classList.remove("is-touch-animated");
    });
  }

  mobileQuery.addEventListener?.("change", (event) => {
    if (!event.matches) {
      resetMobileTapMotion();
    }
  });

  return {
    playIntro: () => restartAnimation(avatarMedia),
    reset: resetMobileTapMotion,
  };
}

function enablePortfolioIntro(avatarMotion, mobileTapMotion) {
  if (document.querySelector("[data-case-close]") || reducedMotionQuery.matches) {
    return false;
  }

  let introAlreadyPlayed = false;

  try {
    introAlreadyPlayed = window.sessionStorage.getItem(portfolioIntroStorageKey) === "true";
  } catch {
    introAlreadyPlayed = false;
  }

  if (introAlreadyPlayed) {
    return false;
  }

  try {
    window.sessionStorage.setItem(portfolioIntroStorageKey, "true");
  } catch {
    // The intro still works on the current load if session storage is unavailable.
  }

  const root = document.documentElement;
  const introTimers = [];

  root.classList.add("intro-playing");

  introTimers.push(
    window.setTimeout(() => {
      avatarMotion.playIntro();
      mobileTapMotion.playIntro();
    }, 300),
    window.setTimeout(() => root.classList.remove("intro-playing"), 1320),
  );

  window.addEventListener("pagehide", () => {
    introTimers.forEach((timer) => window.clearTimeout(timer));
    root.classList.remove("intro-playing");
    avatarMotion.reset();
    mobileTapMotion.reset();
  });

  return true;
}

function enableScrollReveal() {
  const root = document.documentElement;
  const revealItems = [];
  let observer;

  function addRevealItem(element, delay = 0) {
    if (!element) {
      return;
    }

    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${delay}ms`);
    revealItems.push(element);
  }

  addRevealItem(document.querySelector(".hero h1"));
  addRevealItem(document.querySelector(".hero__description-container"), 100);
  addRevealItem(document.querySelector(".contacts--hero"), 200);

  document.querySelectorAll(".expertise-card").forEach((card, index) => {
    addRevealItem(card, index * 100);
  });

  addRevealItem(document.querySelector(".projects__title"));

  document.querySelectorAll(".project-card").forEach((card) => {
    addRevealItem(card.querySelector(".project-card__content"));
    addRevealItem(card.querySelector(".project-card__visual-link"), 100);
  });

  addRevealItem(document.querySelector(".interests__body"));
  addRevealItem(document.querySelector(".interests__gallery"), 100);
  addRevealItem(document.querySelector(".site-footer__content"));

  function showAllContent() {
    observer?.disconnect();
    observer = undefined;
    root.classList.remove("motion-ready");
    revealItems.forEach((item) => item.classList.remove("is-visible"));
  }

  function setupReveal() {
    if (
      reducedMotionQuery.matches ||
      !("IntersectionObserver" in window) ||
      revealItems.length === 0
    ) {
      showAllContent();
      return;
    }

    observer?.disconnect();
    revealItems.forEach((item) => item.classList.remove("is-visible"));

    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const hasPassedViewport =
            entry.boundingClientRect.top < window.innerHeight * 0.95;

          if (!entry.isIntersecting && !hasPassedViewport) {
            return;
          }

          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        });
      },
      { threshold: 0.14 },
    );

    root.classList.add("motion-ready");
    revealItems.forEach((item) => observer.observe(item));
  }

  setupReveal();

  return {
    refresh: setupReveal,
    reset: showAllContent,
  };
}

const avatarMotion = enableAvatarMotion();
const mobileTapMotion = enableMobileTapMotion();
enablePortfolioIntro(avatarMotion, mobileTapMotion);
const scrollReveal = enableScrollReveal();

reducedMotionQuery.addEventListener?.("change", (event) => {
  if (event.matches) {
    document.documentElement.classList.remove("intro-playing");
    avatarMotion.reset();
    mobileTapMotion.reset();
    scrollReveal.reset();
  } else {
    scrollReveal.refresh();
  }
});
