(() => {
  const cards = [...document.querySelectorAll('.v2-project')];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nav = document.querySelector('.v2-nav');
  const header = document.querySelector('.v2-header');
  const projectsLink = nav.querySelector('.v2-nav__projects');
  const aboutLink = nav.querySelector('.v2-nav__about');
  const cvLink = nav.querySelector('.v2-nav__cv');
  const aboutCard = document.getElementById('about');
  const hero = document.querySelector('.v2-hero-flow .hero');
  const backToTop = document.querySelector('.v2-back-to-top');
  const projectsSection = document.getElementById('projects');
  const firstProject = projectsSection.querySelector('.v2-project');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  let scrollLockTimer;
  let cvFeedbackTimer;
  let activeSegment = null;
  let scrollTarget = 0;
  let scrollStartedAt = 0;
  let scrollLocked = false;
  let scrollLockKind = '';
  let wheelIntent = 0;
  let lastWheelAt = 0;

  if (!reducedMotion.matches) document.documentElement.classList.add('v2-hero-motion');

  const renderActiveSegment = (segment) => {
    if (segment) nav.dataset.active = segment;
    else nav.removeAttribute('data-active');
    if (segment === 'projects') projectsLink.setAttribute('aria-current', 'page');
    else projectsLink.removeAttribute('aria-current');
    if (segment === 'about') aboutLink.setAttribute('aria-current', 'page');
    else aboutLink.removeAttribute('aria-current');
  };

  const setActiveSegment = (segment) => {
    activeSegment = segment;
    renderActiveSegment(segment);
  };

  let headerFrame = 0;
  const updateHeaderState = () => {
    headerFrame = 0;
    header.classList.toggle('is-compact', window.scrollY > 100);
    if (!scrollLocked && window.scrollY <= 80 && activeSegment !== null) {
      setActiveSegment(null);
    }
  };
  window.addEventListener('scroll', () => {
    if (!headerFrame) headerFrame = requestAnimationFrame(updateHeaderState);
  }, { passive: true });
  updateHeaderState();

  if (backToTop && firstProject) {
    const contrastCanvas = document.createElement('canvas');
    contrastCanvas.width = 1;
    contrastCanvas.height = 1;
    const contrastContext = contrastCanvas.getContext('2d', { willReadFrequently: true });
    let contrastFrame = 0;

    const brightness = ([red, green, blue]) =>
      red * 0.2126 + green * 0.7152 + blue * 0.0722;

    const mediaBrightness = (media, x, y) => {
      if (!contrastContext) return null;
      const isVideo = media instanceof HTMLVideoElement;
      const naturalWidth = isVideo ? media.videoWidth : media.naturalWidth;
      const naturalHeight = isVideo ? media.videoHeight : media.naturalHeight;
      if (!naturalWidth || !naturalHeight) return null;

      const rect = media.getBoundingClientRect();
      const style = getComputedStyle(media);
      const cover = style.objectFit === 'cover';
      const contain = style.objectFit === 'contain';
      let sourceX = ((x - rect.left) / rect.width) * naturalWidth;
      let sourceY = ((y - rect.top) / rect.height) * naturalHeight;

      if (cover || contain) {
        const scale = cover
          ? Math.max(rect.width / naturalWidth, rect.height / naturalHeight)
          : Math.min(rect.width / naturalWidth, rect.height / naturalHeight);
        const [horizontal = '50%', vertical = '50%'] = style.objectPosition.split(' ');
        const position = (value) => {
          if (value === 'left' || value === 'top') return 0;
          if (value === 'right' || value === 'bottom') return 1;
          const percent = parseFloat(value);
          return Number.isFinite(percent) && value.endsWith('%') ? percent / 100 : .5;
        };
        const offsetX = (rect.width - naturalWidth * scale) * position(horizontal);
        const offsetY = (rect.height - naturalHeight * scale) * position(vertical);
        sourceX = (x - rect.left - offsetX) / scale;
        sourceY = (y - rect.top - offsetY) / scale;
      }

      if (sourceX < 0 || sourceY < 0 || sourceX >= naturalWidth || sourceY >= naturalHeight) return null;
      try {
        contrastContext.clearRect(0, 0, 1, 1);
        contrastContext.drawImage(media, Math.floor(sourceX), Math.floor(sourceY), 1, 1, 0, 0, 1, 1);
        const pixel = contrastContext.getImageData(0, 0, 1, 1).data;
        return pixel[3] > 128 ? brightness(pixel) : null;
      } catch {
        return null;
      }
    };

    const surfaceBrightness = (x, y) => {
      for (const element of document.elementsFromPoint(x, y)) {
        if (element === backToTop || backToTop.contains(element)) continue;
        if (element instanceof HTMLImageElement || element instanceof HTMLVideoElement) {
          const value = mediaBrightness(element, x, y);
          if (value !== null) return value;
        }
        const color = getComputedStyle(element).backgroundColor.match(
          /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/
        );
        if (color && (color[4] === undefined || Number(color[4]) > .9)) {
          return brightness(color.slice(1, 4).map(Number));
        }
      }
      return 0;
    };

    const updateBackToTopContrast = () => {
      contrastFrame = 0;
      if (!backToTop.classList.contains('is-visible')) {
        backToTop.classList.remove('is-on-dark');
        return;
      }
      const rect = backToTop.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const points = [
        [centerX, centerY],
        [centerX - 12, centerY],
        [centerX + 12, centerY],
        [centerX, centerY - 12],
        [centerX, centerY + 12],
      ];
      const average = points.reduce((sum, [x, y]) => sum + surfaceBrightness(x, y), 0) / points.length;
      backToTop.classList.toggle('is-on-dark', average < 140);
    };

    const scheduleBackToTopContrast = () => {
      if (!contrastFrame) contrastFrame = requestAnimationFrame(updateBackToTopContrast);
    };

    const setBackToTopVisible = (visible) => {
      backToTop.classList.toggle('is-visible', visible);
      backToTop.setAttribute('aria-hidden', String(!visible));
      backToTop.tabIndex = visible ? 0 : -1;
      scheduleBackToTopContrast();
    };

    const projectObserver = new IntersectionObserver((entries) => {
      const entry = entries[0];
      setBackToTopVisible(entry.isIntersecting || entry.boundingClientRect.top < 0);
    }, { threshold: 0 });
    projectObserver.observe(firstProject);

    window.addEventListener('scroll', scheduleBackToTopContrast, { passive: true });
    window.addEventListener('resize', scheduleBackToTopContrast);
    window.addEventListener('pageshow', scheduleBackToTopContrast);
    document.querySelectorAll('img').forEach((image) => image.addEventListener('load', scheduleBackToTopContrast));
    document.querySelectorAll('video').forEach((video) => {
      video.addEventListener('loadeddata', scheduleBackToTopContrast);
      video.addEventListener('timeupdate', scheduleBackToTopContrast);
    });

    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    });
  }

  const projectScrollTarget = () => {
    const headerHeight = document.querySelector('.v2-header').getBoundingClientRect().height;
    const cardStickyTop = parseFloat(getComputedStyle(firstProject).top) || 0;
    const offset = Math.max(headerHeight, cardStickyTop);
    return Math.max(0, window.scrollY + projectsSection.getBoundingClientRect().top - offset);
  };

  const lockProgrammaticScroll = (target, kind) => {
    scrollLocked = true;
    scrollLockKind = kind;
    updateHeaderState();
    scrollTarget = target;
    scrollStartedAt = performance.now();
    wheelIntent = 0;
    window.clearTimeout(scrollLockTimer);
    scrollLockTimer = window.setTimeout(() => {
      scrollLocked = false;
      updateHeaderState();
    }, 1500);
  };

  window.addEventListener('scrollend', () => {
    if (scrollLocked && performance.now() - scrollStartedAt > 350 &&
        Math.abs(window.scrollY - scrollTarget) < 4) {
      window.clearTimeout(scrollLockTimer);
      scrollLocked = false;
      updateHeaderState();
    }
  }, { passive: true });

  window.addEventListener('wheel', (event) => {
    if (scrollLocked) {
      if (scrollLockKind === 'snap' && event.deltaY > 0 && window.scrollY < scrollTarget - 4) {
        event.preventDefault();
      }
      return;
    }
    if (reducedMotion.matches || !finePointer.matches || window.innerWidth <= 767 || event.ctrlKey) return;
    if (event.deltaY <= 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      wheelIntent = 0;
      return;
    }

    const target = projectScrollTarget();
    const heroRect = hero.getBoundingClientRect();
    if (heroRect.bottom <= window.innerHeight * .55 || target <= window.scrollY + 24) {
      wheelIntent = 0;
      return;
    }

    const now = performance.now();
    if (now - lastWheelAt > 200) wheelIntent = 0;
    lastWheelAt = now;
    const delta = event.deltaMode === 1 ? event.deltaY * 16 :
      event.deltaMode === 2 ? event.deltaY * window.innerHeight : event.deltaY;
    wheelIntent += delta;
    if (wheelIntent < 90) return;

    event.preventDefault();
    lockProgrammaticScroll(target, 'snap');
    window.scrollTo({ top: target, behavior: 'smooth' });
  }, { passive: false });

  projectsLink.addEventListener('click', (event) => {
    event.preventDefault();
    setActiveSegment('projects');
    const target = projectScrollTarget();
    lockProgrammaticScroll(target, 'navigation');
    window.scrollTo({ top: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    if (location.hash !== '#projects') history.pushState(null, '', '#projects');
  });

  aboutLink.addEventListener('click', (event) => {
    event.preventDefault();
    const target = Math.max(0, window.scrollY + aboutCard.getBoundingClientRect().top - header.getBoundingClientRect().height - 8);
    setActiveSegment('about');
    lockProgrammaticScroll(target, 'navigation');
    window.scrollTo({ top: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    if (location.hash !== '#about') history.pushState(null, '', '#about');
  });

  cvLink.addEventListener('click', () => {
    window.clearTimeout(cvFeedbackTimer);
    renderActiveSegment('cv');
    cvFeedbackTimer = window.setTimeout(() => renderActiveSegment(activeSegment), 700);
  });

  const restorePersistentSegment = () => {
    window.clearTimeout(cvFeedbackTimer);
    renderActiveSegment(activeSegment);
  };

  window.addEventListener('pageshow', updateHeaderState);
  window.addEventListener('focus', restorePersistentSegment);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) restorePersistentSegment();
  });

  if (!reducedMotion.matches && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('v2-motion-ready');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.18 });
    cards.forEach((card) => observer.observe(card));
  }

  const finalSection = document.querySelector('.v2-final');
  if (finalSection && !reducedMotion.matches && 'IntersectionObserver' in window) {
    finalSection.classList.add('v2-final--motion');
    const finalObserver = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      finalSection.classList.add('is-visible');
      finalObserver.disconnect();
    }, { threshold: 0.3 });
    finalObserver.observe(finalSection);
  }

  document.querySelectorAll('.v2-project__link').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const destination = new URL(link.href, location.href);
      if (destination.origin !== location.origin) return;
      try {
        sessionStorage.setItem('portfolio-case-entry', JSON.stringify({
          casePath: destination.pathname.replace(/\/+$/, '') || '/',
          sourcePath: location.pathname.replace(/\/+$/, '') || '/',
          timestamp: Date.now(),
        }));
      } catch {
        // Normal navigation remains available without session storage.
      }
    });
  });

  const mobileHeroContacts = window.matchMedia('(max-width: 767px) and (pointer: coarse)');
  document.querySelectorAll('.contacts--hero .contact-item').forEach((link) => {
    let tapTimer;
    link.addEventListener('pointerdown', (event) => {
      if (event.pointerType !== 'touch' || !mobileHeroContacts.matches || reducedMotion.matches) return;
      window.clearTimeout(tapTimer);
      link.classList.add('is-touch-animated');
      tapTimer = window.setTimeout(() => link.classList.remove('is-touch-animated'), 440);
    }, { passive: true });
  });

  const dotCanvas = document.querySelector('.v2-dot-field__canvas');
  if (dotCanvas && !dotCanvas.dataset.initialized) {
    dotCanvas.dataset.initialized = 'true';
    const context = dotCanvas.getContext('2d');
    if (context) {
      const dotHero = dotCanvas.closest('.hero');
      const accents = [[0, 100, 254], [251, 57, 18], [177, 236, 16]];
      const graphite = [34, 32, 34];
      const coarsePointer = window.matchMedia('(any-pointer: coarse)');
      const pointer = { x: 0, y: 0, targetX: 0, targetY: 0, strength: 0, active: false };
      const exclusions = [
        ['.v2-header', 8, 48, 24, .08],
        ['.hero__characters', 36, 72, 76, .06],
        ['.hero__mascot', 32, 60, 76, .06],
        ['.hero__fortune', 36, 60, 42, .06],
        ['.hero__name', 10, 40, 18, .08],
        ['.hero__meta', 10, 38, 18, .08],
        ['.hero__description', 10, 42, 18, .08],
        ['.contacts--hero', 12, 46, 22, .08],
      ];
      const dots = [];
      let width = 0;
      let height = 0;
      let pixelRatio = 1;
      let frame = 0;
      let activeTouchId = null;

      const canInteract = () => finePointer.matches && !coarsePointer.matches
        && width > 767 && !reducedMotion.matches;
      const canTouch = () => width <= 767 && !reducedMotion.matches;
      const smoothstep = (value) => {
        const t = Math.max(0, Math.min(1, value));
        return t * t * (3 - 2 * t);
      };

      const getExclusions = () => {
        const canvasRect = dotCanvas.getBoundingClientRect();
        return exclusions.map(([selector, safe, feather, radius, minimum]) => {
          const element = selector === '.v2-header' ? header : dotHero.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            left: rect.left - canvasRect.left - safe,
            top: rect.top - canvasRect.top - safe,
            right: rect.right - canvasRect.left + safe,
            bottom: rect.bottom - canvasRect.top + safe,
            feather, radius, minimum,
          };
        }).filter(Boolean);
      };

      const suppressionAt = (x, y, areas) => {
        let suppression = 1;
        for (const area of areas) {
          const centerX = (area.left + area.right) / 2;
          const centerY = (area.top + area.bottom) / 2;
          const halfWidth = (area.right - area.left) / 2;
          const halfHeight = (area.bottom - area.top) / 2;
          const dx = Math.abs(x - centerX) - halfWidth + area.radius;
          const dy = Math.abs(y - centerY) - halfHeight + area.radius;
          const distance = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
            + Math.min(Math.max(dx, dy), 0) - area.radius;
          const fade = smoothstep(distance / area.feather);
          suppression = Math.min(suppression, area.minimum + (1 - area.minimum) * fade);
        }
        return suppression;
      };

      const draw = () => {
        context.clearRect(0, 0, width, height);
        const areas = getExclusions();
        const interactive = canInteract();
        const mobile = width <= 767;
        const touchInteractive = canTouch();
        const restingOpacity = mobile ? (reducedMotion.matches ? .065 : .105)
          : interactive ? .05 : .035;
        for (const { x, y, accent } of dots) {
          const distance = Math.hypot(x - pointer.x, y - pointer.y);
          const proximity = interactive || touchInteractive
            ? pointer.strength * Math.exp(-1.5 * (distance / (mobile ? 105 : 120)) ** 2) : 0;
          const blend = interactive ? Math.min(1, proximity) : 0;
          const red = Math.round(graphite[0] + (accent[0] - graphite[0]) * blend);
          const green = Math.round(graphite[1] + (accent[1] - graphite[1]) * blend);
          const blue = Math.round(graphite[2] + (accent[2] - graphite[2]) * blend);
          const horizontalFade = smoothstep(Math.min(x, width - x) / (width * .05));
          const topFade = .1 + .9 * smoothstep(y / (height * .12));
          const bottomFade = .75 + .25 * smoothstep((height - y) / (height * .08));
          const wave = touchInteractive && proximity > .001
            ? Math.sin((x - pointer.x) / 38 + (y - pointer.y) / 45) : 0;
          const suppression = suppressionAt(x, y, areas);
          const mobileSuppression = mobile ? Math.max(.25, suppression) : suppression;
          const opacity = (restingOpacity + (interactive ? .84 : .48) * proximity)
            * horizontalFade * topFade * bottomFade * mobileSuppression;
          if (opacity < .002) continue;
          const radius = (mobile ? 1.2 : 1) + (mobile ? 1.1 : 1.4) * proximity;
          context.beginPath();
          context.arc(x, y + 6 * proximity * wave, radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${opacity})`;
          context.fill();
        }
      };

      const animate = () => {
        frame = 0;
        const targetStrength = pointer.active && (canInteract() || canTouch()) ? 1 : 0;
        pointer.strength += (targetStrength - pointer.strength) * .16;
        if (targetStrength) {
          pointer.x += (pointer.targetX - pointer.x) * .2;
          pointer.y += (pointer.targetY - pointer.y) * .2;
        }
        if (pointer.strength < .004 && !targetStrength) pointer.strength = 0;
        draw();
        if (Math.abs(pointer.strength - targetStrength) > .004 ||
            (targetStrength && Math.hypot(pointer.targetX - pointer.x, pointer.targetY - pointer.y) > .5)) {
          frame = requestAnimationFrame(animate);
        }
      };

      const requestDraw = () => {
        if (!frame) frame = requestAnimationFrame(animate);
      };

      const resize = () => {
        const bounds = dotCanvas.getBoundingClientRect();
        const nextWidth = bounds.width;
        const nextHeight = bounds.height;
        const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
        if (!nextWidth || !nextHeight ||
            (nextWidth === width && nextHeight === height && nextRatio === pixelRatio)) return;
        if ((width <= 767) !== (nextWidth <= 767)) {
          activeTouchId = null;
          pointer.active = false;
          pointer.strength = 0;
        }
        width = nextWidth;
        height = nextHeight;
        pixelRatio = nextRatio;
        dots.length = 0;
        const spacing = width <= 767 ? 23 : 20;
        const columns = Math.floor(width / spacing);
        const rows = Math.floor(height / spacing);
        const xOffset = (width - columns * spacing) / 2;
        const yOffset = (height - rows * spacing) / 2;
        for (let row = 0; row <= rows; row += 1) {
          for (let column = 0; column <= columns; column += 1) {
            dots.push({
              x: xOffset + column * spacing,
              y: yOffset + row * spacing,
              accent: accents[(column * 5 + row * 7) % accents.length],
            });
          }
        }
        dotCanvas.width = Math.round(width * pixelRatio);
        dotCanvas.height = Math.round(height * pixelRatio);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        requestDraw();
      };

      dotHero.addEventListener('pointermove', (event) => {
        if (!canInteract() || event.pointerType === 'touch') return;
        const bounds = dotCanvas.getBoundingClientRect();
        pointer.targetX = event.clientX - bounds.left;
        pointer.targetY = event.clientY - bounds.top;
        if (pointer.targetX < 0 || pointer.targetX > width ||
            pointer.targetY < 0 || pointer.targetY > height) {
          pointer.active = false;
          requestDraw();
          return;
        }
        if (!pointer.active) {
          pointer.x = pointer.targetX;
          pointer.y = pointer.targetY;
        }
        pointer.active = true;
        requestDraw();
      }, { passive: true });

      dotHero.addEventListener('pointerleave', () => {
        if (!canInteract() || !pointer.active) return;
        pointer.active = false;
        requestDraw();
      });

      const updateTouch = (touch) => {
        const bounds = dotCanvas.getBoundingClientRect();
        const x = touch.clientX - bounds.left;
        const y = touch.clientY - bounds.top;
        if (x < 0 || x > width || y < 0 || y > height) {
          if (pointer.active) {
            pointer.active = false;
            requestDraw();
          }
          return;
        }
        pointer.targetX = x;
        pointer.targetY = y;
        if (!pointer.active) {
          pointer.x = x;
          pointer.y = y;
        }
        pointer.active = true;
        requestDraw();
      };

      dotHero.addEventListener('touchstart', (event) => {
        if (!canTouch() || activeTouchId !== null) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        activeTouchId = touch.identifier;
        updateTouch(touch);
      }, { passive: true });

      window.addEventListener('touchmove', (event) => {
        if (activeTouchId === null || !canTouch()) return;
        const touch = [...event.changedTouches].find((item) => item.identifier === activeTouchId);
        if (touch) updateTouch(touch);
      }, { passive: true });

      const endTouch = (event) => {
        if (activeTouchId === null ||
            ![...event.changedTouches].some((item) => item.identifier === activeTouchId)) return;
        activeTouchId = null;
        pointer.active = false;
        requestDraw();
      };
      window.addEventListener('touchend', endTouch, { passive: true });
      window.addEventListener('touchcancel', endTouch, { passive: true });

      const updateMotionMode = () => {
        activeTouchId = null;
        pointer.active = false;
        pointer.strength = 0;
        requestDraw();
      };
      finePointer.addEventListener('change', updateMotionMode);
      coarsePointer.addEventListener('change', updateMotionMode);
      reducedMotion.addEventListener('change', updateMotionMode);
      window.addEventListener('resize', resize, { passive: true });
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(dotCanvas);
      resize();
    }
  }
})();
