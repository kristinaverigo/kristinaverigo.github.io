(() => {
  const characters = document.querySelector('.home-v2 .hero__characters');
  const layer = characters?.querySelector('[data-doodle-layer]');
  const heart = characters?.querySelector('[data-doodle-heart]');
  const rays = characters?.querySelector('.hero__cookie-rays');
  const pencil = characters?.querySelector('[data-doodle-pencil]');
  const fortuneButton = characters?.querySelector('.hero__fortune-button');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!characters || !layer || !heart || !rays || !pencil || !fortuneButton) return;

  // One timeline: heart, travel to cookie, three rays, pencil exit, doodle fade.
  const introDelay = 900;
  const greeting = characters.querySelector('[data-greeting-anchor]');
  let greetingShown = false;
  const showGreeting = async () => {
    if (greetingShown || !greeting) return;
    greetingShown = true;
    greeting.classList.add('is-visible');
    characters.dispatchEvent(new Event('mascot:greeting', { bubbles: true }));
    await new Promise(resolve => window.setTimeout(resolve, 2600));
    greeting.classList.remove('is-visible');
    await new Promise(resolve => window.setTimeout(resolve, reducedMotion.matches ? 0 : 180));
  };
  const heartDurations = [390, 370];
  const travelDuration = 520;
  const rayDurations = [270, 270, 270];
  const rayPause = 50;
  const pencilExitDuration = 300;
  const doodleHoldDuration = 2100;
  const fadeDuration = 650;
  const introController = new AbortController();
  const activeAnimations = new Set();
  let introPlayed = false;
  let introStartTimer = 0;
  let observer;
  let pencilPosition = null;

  const isCancelled = () => introController.signal.aborted;
  const ensureActive = () => {
    if (isCancelled()) throw new DOMException('Intro cancelled', 'AbortError');
  };
  const wait = (duration) => new Promise((resolve) => {
    if (isCancelled()) { resolve(); return; }
    const timer = window.setTimeout(() => {
      introController.signal.removeEventListener('abort', onAbort);
      resolve();
    }, duration);
    function onAbort() {
      window.clearTimeout(timer);
      resolve();
    }
    introController.signal.addEventListener('abort', onAbort, { once: true });
  });
  const transformAt = ({ x, y }) => `translate3d(${x}px, ${y}px, 0)`;

  function cancelIntro() {
    if (isCancelled() || characters.classList.contains('doodle-intro-finished')) return;
    introController.abort();
    greeting?.classList.remove('is-visible');
    window.clearTimeout(introStartTimer);
    observer?.disconnect();
    activeAnimations.forEach((animation) => animation.cancel());
    activeAnimations.clear();
    pencil.remove();
    layer.remove();
    rays.querySelectorAll('path').forEach((path) => { path.style.opacity = '0'; });
    characters.classList.add('doodle-intro-cancelled', 'doodle-intro-finished');
  }

  fortuneButton.addEventListener('click', cancelIntro, { capture: true });

  async function copyAssetPaths(target, splitRays = false) {
    const response = await fetch(target.dataset.doodleAsset);
    if (!response.ok) throw new Error(`Doodle asset failed: ${response.status}`);

    const source = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
    const paths = [...source.querySelectorAll('path')].flatMap((path) => {
      if (!splitRays) return [path.cloneNode(true)];
      const segments = path.getAttribute('d').match(/M[^M]+/g) || [];
      return segments.map((segment) => {
        const copy = path.cloneNode(true);
        copy.setAttribute('d', segment.trim());
        return copy;
      });
    });

    if (paths.length !== (splitRays ? 3 : 2)) throw new Error('Unexpected doodle paths');
    paths.forEach((path, index) => {
      if (splitRays) path.setAttribute('class', `hero__cookie-ray hero__cookie-ray--${index + 1}`);
      target.append(path);
    });
    return paths;
  }

  function prepareStroke(path) {
    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length + 1}`;
    path.style.strokeDashoffset = `${length + 1}`;
    return length;
  }

  function pencilPoint(path, progress) {
    const length = path.getTotalLength();
    const point = path.getPointAtLength(length * progress);
    const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
    const bounds = characters.getBoundingClientRect();
    const pencilWidth = pencil.getBoundingClientRect().width;
    return {
      x: screen.x - bounds.left - pencilWidth * 0.18,
      y: screen.y - bounds.top - pencilWidth * 0.75,
    };
  }

  async function movePencilTo(position, duration) {
    ensureActive();
    if (!pencilPosition) {
      pencil.style.transform = transformAt(position);
      pencilPosition = position;
      return;
    }
    if (!duration) {
      pencil.style.transform = transformAt(position);
      pencilPosition = position;
      return;
    }
    const animation = pencil.animate(
      [{ transform: transformAt(pencilPosition) }, { transform: transformAt(position) }],
      { duration, easing: 'ease-in-out', fill: 'forwards' },
    );
    activeAnimations.add(animation);
    await animation.finished.catch(() => {});
    activeAnimations.delete(animation);
    ensureActive();
    pencil.style.transform = transformAt(position);
    animation.cancel();
    pencilPosition = position;
  }

  async function drawStroke(path, duration, moveDuration = 90) {
    ensureActive();
    const length = path.getTotalLength();
    await movePencilTo(pencilPoint(path, 0), moveDuration);
    path.style.opacity = '1';
    const frames = Array.from({ length: 61 }, (_, index) => ({
      transform: transformAt(pencilPoint(path, index / 60)),
    }));
    const line = path.animate(
      [{ strokeDashoffset: `${length + 1}` }, { strokeDashoffset: '0' }],
      { duration, easing: 'linear', fill: 'forwards' },
    );
    const movement = pencil.animate(frames, { duration, easing: 'linear', fill: 'forwards' });
    activeAnimations.add(line);
    activeAnimations.add(movement);
    await Promise.all([line.finished.catch(() => {}), movement.finished.catch(() => {})]);
    activeAnimations.delete(line);
    activeAnimations.delete(movement);
    ensureActive();
    path.style.strokeDashoffset = '0';
    pencilPosition = pencilPoint(path, 1);
    pencil.style.transform = transformAt(pencilPosition);
    line.cancel();
    movement.cancel();
  }

  async function finishIntro() {
    await wait(doodleHoldDuration);
    ensureActive();
    layer.classList.add('is-fading');
    rays.classList.add('is-intro-fading');
    await wait(fadeDuration);
    ensureActive();
    pencil.remove();
    layer.remove();
    rays.querySelectorAll('path').forEach((path) => {
      path.style.removeProperty('opacity');
      path.style.removeProperty('stroke-dashoffset');
    });
    rays.classList.remove('is-intro-fading');
    characters.classList.add('doodle-intro-finished');
  }

  async function playIntro(heartPaths, rayPaths) {
    ensureActive();
    layer.classList.add('is-active');

    if (reducedMotion.matches || !Element.prototype.animate) {
      heartPaths.forEach((path) => { path.style.strokeDashoffset = '0'; });
      rayPaths.forEach((path) => {
        path.style.strokeDashoffset = '0';
        path.style.opacity = '1';
      });
      await finishIntro();
      return;
    }

    await movePencilTo(pencilPoint(heartPaths[0], 0), 0);
    pencil.classList.add('is-visible');
    await wait(160);

    for (let index = 0; index < heartPaths.length; index += 1) {
      await drawStroke(heartPaths[index], heartDurations[index], index ? 120 : 0);
    }
    await wait(200);
    await movePencilTo(pencilPoint(rayPaths[0], 0), travelDuration);
    for (let index = 0; index < rayPaths.length; index += 1) {
      await drawStroke(rayPaths[index], rayDurations[index], index ? 100 : 0);
      if (index < rayPaths.length - 1) await wait(rayPause);
    }

    const exitPosition = { x: pencilPosition.x + 6, y: pencilPosition.y - 6 };
    const exit = pencil.animate(
      [
        { transform: transformAt(pencilPosition), opacity: 1 },
        { transform: transformAt(exitPosition), opacity: 0 },
      ],
      { duration: pencilExitDuration, easing: 'ease-out', fill: 'forwards' },
    );
    activeAnimations.add(exit);
    await exit.finished.catch(() => {});
    activeAnimations.delete(exit);
    ensureActive();
    pencil.style.opacity = '0';
    pencil.style.transform = transformAt(exitPosition);
    pencil.classList.remove('is-visible');
    exit.cancel();
    await finishIntro();
  }

  async function setup() {
    try {
      const [heartPaths, rayPaths] = await Promise.all([
        copyAssetPaths(heart),
        copyAssetPaths(rays, true),
      ]);
      heartPaths.forEach(prepareStroke);
      rayPaths.forEach((path) => {
        path.style.setProperty('--ray-length', `${path.getTotalLength() + 1}px`);
      });

      observer = new IntersectionObserver((entries) => {
        if (!entries[0].isIntersecting || introPlayed) return;
        introPlayed = true;
        observer.disconnect();
        void showGreeting().then(() => {
          introStartTimer = window.setTimeout(() => {
            void playIntro(heartPaths, rayPaths).catch((error) => {
              if (error.name !== 'AbortError') cancelIntro();
            });
          }, introDelay);
        });
      }, { threshold: 0.2 });
      observer.observe(characters);
    } catch {
      // The original Hero remains fully usable if a decorative asset cannot load.
      layer.remove();
      rays.remove();
      characters.classList.add('doodle-intro-finished');
    }
  }

  void setup();
})();
