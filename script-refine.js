const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const caseEntryStorageKey = "portfolio-case-entry";

function normalizeNavigationPath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function setupCaseEntryTracking() {
  const clearCaseEntry = () => {
    try {
      window.sessionStorage.removeItem(caseEntryStorageKey);
    } catch {
      // Project links remain functional when session storage is unavailable.
    }
  };

  clearCaseEntry();
  window.addEventListener("pageshow", clearCaseEntry);

  document
    .querySelectorAll(".project-button, .project-card__visual-link")
    .forEach((link) => {
      link.addEventListener("click", (event) => {
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
          // Project links remain functional when session storage is unavailable.
        }
      });
    });
}

function setupContactIconMotion() {
  const iconShells = document.querySelectorAll(".contact-item__icon-shell");

  iconShells.forEach((shell) => {
    const currentIcon = shell.querySelector(".contact-item__icon");

    if (!currentIcon || shell.querySelector(".contact-item__icon--next")) {
      return;
    }

    const nextIcon = currentIcon.cloneNode(true);
    currentIcon.classList.add("contact-item__icon--current");
    nextIcon.classList.add("contact-item__icon--next");
    nextIcon.setAttribute("aria-hidden", "true");
    shell.append(nextIcon);
  });

  document.documentElement.classList.add("contact-motion-ready");
}

function setupInterestsWave() {
  const gallery = document.querySelector(".interests__gallery");
  const photos = gallery ? Array.from(gallery.querySelectorAll(".interests__photo")) : [];

  if (!gallery || photos.length === 0) {
    return;
  }

  const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
  const maxLift = 16;
  const maxScaleBoost = 0.02;
  const inertia = 0.13;
  const settleDistance = 0.02;
  const settleScale = 0.00005;
  const currentY = photos.map(() => 0);
  const currentScale = photos.map(() => 1);
  const targetY = photos.map(() => 0);
  const targetScale = photos.map(() => 1);

  let centers = [];
  let falloff = 240;
  let cursorX = 0;
  let frameId = 0;
  let isEnabled = false;
  let isPointerInside = false;

  const measure = () => {
    centers = photos.map((photo) => {
      const rect = photo.getBoundingClientRect();
      return rect.left + rect.width / 2;
    });

    if (centers.length > 1) {
      const totalStep = centers.slice(1).reduce((sum, center, index) => {
        return sum + center - centers[index];
      }, 0);
      const averageStep = totalStep / (centers.length - 1);
      falloff = Math.max(140, averageStep * 0.88);
    }
  };

  const updateTargets = () => {
    photos.forEach((_, index) => {
      if (!isPointerInside) {
        targetY[index] = 0;
        targetScale[index] = 1;
        return;
      }

      const distance = Math.abs(cursorX - centers[index]);
      const strength = Math.exp(-0.5 * (distance / falloff) ** 2);
      targetY[index] = -maxLift * strength;
      targetScale[index] = 1 + maxScaleBoost * strength;
    });
  };

  const render = () => {
    frameId = 0;
    updateTargets();

    let isSettling = false;

    photos.forEach((photo, index) => {
      currentY[index] += (targetY[index] - currentY[index]) * inertia;
      currentScale[index] += (targetScale[index] - currentScale[index]) * inertia;

      const yDistance = Math.abs(targetY[index] - currentY[index]);
      const scaleDistance = Math.abs(targetScale[index] - currentScale[index]);

      if (yDistance > settleDistance || scaleDistance > settleScale) {
        isSettling = true;
      } else {
        currentY[index] = targetY[index];
        currentScale[index] = targetScale[index];
      }

      photo.style.setProperty("--wave-y", `${currentY[index].toFixed(3)}px`);
      photo.style.setProperty("--wave-scale", currentScale[index].toFixed(5));
    });

    if (isSettling) {
      frameId = window.requestAnimationFrame(render);
      return;
    }

    gallery.classList.remove("is-wave-active");
  };

  const requestRender = () => {
    gallery.classList.add("is-wave-active");

    if (!frameId) {
      frameId = window.requestAnimationFrame(render);
    }
  };

  const handlePointerMove = (event) => {
    cursorX = event.clientX;
    isPointerInside = true;
    requestRender();
  };

  const handlePointerEnter = (event) => {
    measure();
    cursorX = event.clientX;
    isPointerInside = true;
    requestRender();
  };

  const handlePointerLeave = () => {
    isPointerInside = false;
    requestRender();
  };

  const handleResize = () => {
    measure();

    if (isPointerInside) {
      requestRender();
    }
  };

  const reset = () => {
    isPointerInside = false;

    if (frameId) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }

    photos.forEach((photo, index) => {
      currentY[index] = 0;
      currentScale[index] = 1;
      targetY[index] = 0;
      targetScale[index] = 1;
      photo.style.removeProperty("--wave-y");
      photo.style.removeProperty("--wave-scale");
    });

    gallery.classList.remove("interests-wave-ready", "is-wave-active");
  };

  const enable = () => {
    if (isEnabled) {
      return;
    }

    isEnabled = true;
    measure();
    gallery.classList.add("interests-wave-ready");
    gallery.addEventListener("pointerenter", handlePointerEnter);
    gallery.addEventListener("pointermove", handlePointerMove, { passive: true });
    gallery.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("resize", handleResize, { passive: true });
  };

  const disable = () => {
    if (!isEnabled) {
      return;
    }

    isEnabled = false;
    gallery.removeEventListener("pointerenter", handlePointerEnter);
    gallery.removeEventListener("pointermove", handlePointerMove);
    gallery.removeEventListener("pointerleave", handlePointerLeave);
    window.removeEventListener("resize", handleResize);
    reset();
  };

  const updateMode = () => {
    if (finePointerQuery.matches && !reducedMotionQuery.matches) {
      enable();
    } else {
      disable();
    }
  };

  finePointerQuery.addEventListener?.("change", updateMode);
  reducedMotionQuery.addEventListener?.("change", updateMode);
  updateMode();
}

function setupPageMotion() {
  if (reducedMotionQuery.matches) {
    return;
  }

  const root = document.documentElement;
  const revealItems = [];

  const addRevealItem = (element, delay = 0) => {
    if (!element) {
      return;
    }

    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${delay}ms`);
    revealItems.push(element);
  };

  const workOverview = document.querySelector(".work-overview");

  if (workOverview) {
    workOverview.classList.add("reveal--overview");
    addRevealItem(workOverview);
  }

  addRevealItem(document.querySelector(".projects__title"));

  document.querySelectorAll(".project-card").forEach((card) => {
    addRevealItem(card.querySelector(".project-card__content"));
    addRevealItem(card.querySelector(".project-card__visual-link"), 110);
  });

  addRevealItem(document.querySelector(".interests__body"));
  addRevealItem(document.querySelector(".interests__gallery"), 100);
  addRevealItem(document.querySelector(".site-footer__content"));

  root.classList.add("motion-ready");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => root.classList.add("motion-entered"));
  });

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.12,
      rootMargin: "0px 0px -10% 0px",
    },
  );

  revealItems.forEach((item) => observer.observe(item));
}

setupContactIconMotion();
setupPageMotion();
setupCaseEntryTracking();
setupInterestsWave();
