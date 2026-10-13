const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const hoverDevice = matchMedia('(hover: hover) and (pointer: fine)');
const mobile = matchMedia('(max-width: 767px)');

// Disable a reaction here or adjust its frame times. Every sheet uses 430 × 740 frames.
const ACTIONS = {
  idle: { priority: 0 },
  blink: { enabled: true, frames: [105, 115, 105], priority: 1 },
  lookCookie: { enabled: true, frames: [150, 480, 150], priority: 1, asset: 'look-cookie' },
  sleep: { enabled: true, frames: [170, 170], priority: 1 },
  sitDown: { enabled: true, frames: [140, 180, 170], priority: 1, asset: 'sit-down' },
  sit: { priority: 1 },
  wake: { enabled: true, frames: [150, 160, 150], priority: 2 },
  standUp: { enabled: true, frames: [140, 180, 140], priority: 2, asset: 'stand-up' },
  wave: { enabled: true, frames: [120, 155, 175, 155, 120], priority: 2 },
  jump: { enabled: true, priority: 2 },
  walk: { enabled: true, frames: Array(4).fill(250), priority: 2, asset: 'walk-left' },
  walkRight: { enabled: true, frames: Array(4).fill(250), priority: 2, asset: 'walk-right' },
  surprised: { enabled: true, frames: [130, 330, 150], priority: 3 },
  eatCookie: { enabled: true, frames: [170, 460, 220], priority: 3, asset: 'eat-cookie' },
  annoyed: { enabled: true, frames: [170, 1900, 180], priority: 4 },
  run: { enabled: true, priority: 5 },
};
const TIMING = {
  blink: [5000, 9000], lookCookie: [14000, 24000], sleep: [35000, 60000],
  sit: [9000, 12000], mobileMultiplier: 1.5, clickCooldown: 450,
  annoyedClicks: 4, walkDistance: 20,
};

class MascotController {
  constructor(mascot, hero) {
    this.mascot = mascot;
    this.hero = hero;
    this.cookie = hero.querySelector('[data-fortune-cookie]');
    this.sheet = mascot.querySelector('[data-mascot-sheet]');
    this.stage = mascot.querySelector('.hero__mascot-stage');
    this.motion = mascot.querySelector('[data-mascot-motion]');
    this.bubble = hero.querySelector('[data-mascot-bubble] .ui-bubble__text');
    this.sprites = new Map([...mascot.querySelectorAll('[data-mascot-state]')]
      .map(node => [node.dataset.mascotState, node]));
    this.idleSprite = this.sprites.get('idle');
    this.sheetAssets = new Map(Object.entries(ACTIONS).filter(([, action]) => action.frames)
      .map(([name, action]) => {
        const image = new Image();
        image.src = `./assets/images/main-page/mascot-${action.asset ?? name}-polished.png?v=directional-walk-1`;
        return [name, image];
      }));
    this.gaze = document.createElement('canvas');
    this.gaze.className = 'hero__mascot-gaze';
    this.gaze.width = 430;
    this.gaze.height = 740;
    this.gazeContext = this.gaze.getContext('2d');
    this.stage.append(this.gaze);
    this.gazeDirection = 'center';
    this.state = 'idle';
    this.locked = false;
    this.pendingWake = false;
    this.generation = 0;
    this.idleTimers = new Map();
    this.walkAnimation = null;
    this.position = 0;
    this.clickReadyAt = 0;
    this.clickTimes = [];
    this.lastPointerActivity = 0;
    this.sleepDueAt = Date.now() + this.randomDelay(TIMING.sleep);
    this.sitDueAt = Date.now() + this.randomDelay(TIMING.sit);
    this.mascot.dataset.mascotCurrentState = 'idle';
    this.bind();
    this.scheduleIdle();
  }

  randomDelay([min, max]) {
    return (min + Math.random() * (max - min)) * (mobile.matches ? TIMING.mobileMultiplier : 1);
  }
  wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  visible() {
    const box = this.mascot.getBoundingClientRect();
    return !document.hidden && box.bottom > 0 && box.top < innerHeight;
  }
  introFinished() {
    if (!this.hero.querySelector('[data-doodle-pencil]')) return true;
    return this.hero.querySelector('.hero__characters')?.classList.contains('doodle-intro-finished') ?? true;
  }
  clearIdleTimers() {
    this.idleTimers.forEach(clearTimeout);
    this.idleTimers.clear();
  }
  setState(name) {
    this.state = name;
    this.mascot.dataset.mascotCurrentState = name;
    this.mascot.classList.remove('is-reacting', 'is-running', 'is-tickle', 'is-annoyed');
    if (name !== 'idle') this.setGaze('center');
  }
  setSprite(name) {
    this.sprites.forEach((node, key) => node.classList.toggle('is-active', key === name));
    this.sheet.classList.toggle('is-active', name === 'sheet');
  }
  setGaze(direction) {
    if (direction === this.gazeDirection || !this.gazeContext) return;
    this.gazeDirection = direction;
    this.mascot.dataset.mascotGaze = direction;
    const context = this.gazeContext;
    context.clearRect(0, 0, 430, 740);
    if (direction === 'center' || !this.idleSprite?.complete) return;
    const eye = direction === 'left'
      ? { x: 166, y: 157, width: 33, height: 30 }
      : { x: 234, y: 157, width: 33, height: 30 };
    context.save();
    context.translate(eye.x + eye.width, eye.y);
    context.scale(-1, 1);
    context.drawImage(this.idleSprite, eye.x, eye.y, eye.width, eye.height,
      0, 0, eye.width, eye.height);
    context.restore();
  }
  watchCursor(event) {
    if (mobile.matches || reduced.matches || !hoverDevice.matches ||
        this.state !== 'idle' || !this.introFinished() || !this.visible()) return;
    const box = this.mascot.getBoundingClientRect();
    const offset = event.clientX - (box.left + box.width / 2);
    this.setGaze(offset < -32 ? 'left' : offset > 32 ? 'right' : 'center');
  }
  idle() {
    this.setState('idle');
    this.setSprite('idle');
    this.bubble.textContent = 'хаха, щекотно!';
    this.scheduleIdle();
  }
  canStart(name) {
    if (!ACTIONS[name]?.enabled || !this.visible() || this.locked) return false;
    return this.state === 'idle' ||
      (this.state === 'sit' && ['eatCookie', 'standUp', 'sleep', 'annoyed'].includes(name)) ||
      (this.state === 'sleep' && name === 'wake');
  }
  start(name, task, restingState = 'idle') {
    if (!this.canStart(name)) return false;
    this.locked = true;
    this.clearIdleTimers();
    const generation = ++this.generation;
    void (async () => {
      try { await task(generation); }
      finally {
        if (generation !== this.generation) return;
        this.locked = false;
        if (restingState === 'sit') { this.setState('sit'); this.scheduleSitSleep(); }
        else if (restingState === 'sleep') {
          this.setState('sleep');
          if (this.pendingWake) {
            this.pendingWake = false;
            this.start('wake', next => this.frames('wake', next));
          }
        }
        else this.idle();
      }
    })();
    return true;
  }
  async frames(name, generation) {
    const action = ACTIONS[name];
    if (!action?.enabled || generation !== this.generation) return;
    if (reduced.matches && name !== 'annoyed') return;
    const image = this.sheetAssets.get(name);
    if (!image) return;
    try { await image.decode(); } catch { return; }
    if (generation !== this.generation) return;
    this.setState(name);
    this.sheet.style.backgroundImage = `url('${image.src}')`;
    this.sheet.style.backgroundSize = `${action.frames.length * 100}% 100%`;
    this.sheet.style.backgroundPositionX = '0%';
    this.setSprite('sheet');
    if (name === 'annoyed') {
      this.bubble.textContent = 'хватит тыкать 😭';
      this.mascot.classList.add('is-annoyed');
    }
    const count = reduced.matches ? 1 : action.frames.length;
    for (let index = 0; index < count && generation === this.generation; index++) {
      this.sheet.style.backgroundPositionX = `${index * 100 / Math.max(1, action.frames.length - 1)}%`;
      await this.wait(action.frames[index]);
    }
  }
  async walk(to, generation) {
    if (!ACTIONS.walk.enabled || reduced.matches || !this.motion) return;
    const from = this.position;
    const travel = this.motion.animate([
      { transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` },
    ], { duration: 1000, easing: 'ease-in-out', fill: 'forwards' });
    this.walkAnimation = travel;
    const walkingState = to < from ? 'walk' : 'walkRight';
    await Promise.all([this.frames(walkingState, generation), travel.finished.catch(() => {})]);
    if (generation !== this.generation) return;
    this.position = to;
    this.motion.style.transform = `translateX(${to}px)`;
    travel.cancel();
    this.walkAnimation = null;
  }
  jump() {
    if (reduced.matches) return false;
    return this.start('jump', async generation => {
      this.setState('jump');
      this.setSprite('jump');
      this.mascot.classList.add('is-tickle');
      const animation = this.stage.getAnimations()[0];
      if (animation) await animation.finished.catch(() => {});
      else await this.wait(650);
      if (generation !== this.generation) return;
    });
  }
  greeting() {
    if (reduced.matches || !ACTIONS.wave.enabled) return;
    this.start('wave', generation => this.frames('wave', generation));
  }
  run() {
    if (!ACTIONS.run.enabled) return;
    // Navigation is the only action allowed to interrupt an active cycle.
    this.generation++;
    this.locked = true;
    this.clearIdleTimers();
    this.walkAnimation?.cancel();
    this.walkAnimation = null;
    this.position = 0;
    if (this.motion) this.motion.style.transform = 'translateX(0px)';
    this.setState('run');
    this.setSprite('run');
    if (reduced.matches) { this.locked = false; this.idle(); return; }
    this.mascot.classList.add('is-running');
    const generation = this.generation;
    const animation = this.stage.getAnimations()[0];
    void (animation ? animation.finished.catch(() => {}) : this.wait(640)).then(() => {
      if (generation !== this.generation) return;
      this.locked = false;
      this.idle();
    });
  }
  fortune() {
    if (!this.introFinished() || reduced.matches) return;
    if (this.state === 'sit') {
      this.start('eatCookie', async generation => this.frames('eatCookie', generation), 'sit');
      return;
    }
    this.start('surprised', async generation => {
      await this.frames('lookCookie', generation);
      await this.frames('surprised', generation);
      await this.walk(-TIMING.walkDistance, generation);
      await this.frames('sitDown', generation);
      await this.frames('eatCookie', generation);
    }, 'sit');
  }
  scheduleIdle() {
    this.clearIdleTimers();
    if (this.state !== 'idle' || this.locked || reduced.matches || document.hidden) return;
    const schedule = (key, duration, callback) => this.idleTimers.set(key,
      setTimeout(() => {
        this.idleTimers.delete(key);
        if (this.state !== 'idle' || this.locked) return;
        if (!this.introFinished() || !this.visible()) { this.scheduleIdle(); return; }
        callback();
      }, duration));
    schedule('blink', this.randomDelay(TIMING.blink), () =>
      this.start('blink', generation => this.frames('blink', generation)));
    schedule('look', this.randomDelay(TIMING.lookCookie), () => {
      if (this.cookie?.dataset.cookieState === 'closed')
        this.start('lookCookie', generation => this.frames('lookCookie', generation));
      else this.scheduleIdle();
    });
    schedule('sit', Math.max(0, this.sitDueAt - Date.now()), () =>
      this.start('sitDown', generation => this.frames('sitDown', generation), 'sit'));
    schedule('sleep', Math.max(0, this.sleepDueAt - Date.now()), () =>
      this.start('sleep', generation => this.frames('sleep', generation), 'sleep'));
  }
  scheduleSitSleep() {
    this.clearIdleTimers();
    if (reduced.matches || document.hidden || this.state !== 'sit') return;
    this.idleTimers.set('sleep', setTimeout(() => {
      if (this.state !== 'sit' || !this.visible() || !this.introFinished()) return;
      this.start('sleep', async generation => {
        await this.frames('standUp', generation);
        await this.walk(0, generation);
        await this.frames('sleep', generation);
      }, 'sleep');
    }, Math.max(0, this.sleepDueAt - Date.now())));
  }
  activity(event) {
    if (this.state === 'sleep') {
      this.sleepDueAt = Date.now() + this.randomDelay(TIMING.sleep);
      this.sitDueAt = Date.now() + this.randomDelay(TIMING.sit);
      if (this.locked) this.pendingWake = true;
      else this.start('wake', generation => this.frames('wake', generation));
      return;
    }
    if (event?.type === 'pointermove') {
      this.watchCursor(event);
      if (Date.now() - this.lastPointerActivity < 500) return;
      this.lastPointerActivity = Date.now();
    }
    this.sleepDueAt = Date.now() + this.randomDelay(TIMING.sleep);
    this.sitDueAt = Date.now() + this.randomDelay(TIMING.sit);
    if (this.state === 'idle' && !this.locked) this.scheduleIdle();
    else if (this.state === 'sit' && !this.locked) this.scheduleSitSleep();
  }
  click() {
    this.activity();
    if (!this.introFinished()) return;
    const now = Date.now();
    if (now < this.clickReadyAt || this.locked || ['run', 'annoyed', 'sleep'].includes(this.state)) return;
    this.clickReadyAt = now + TIMING.clickCooldown;
    this.clickTimes = this.clickTimes.filter(time => now - time < 6000);
    this.clickTimes.push(now);
    if (this.clickTimes.length >= TIMING.annoyedClicks) {
      this.clickTimes = [];
      this.start('annoyed', async generation => {
        if (this.state === 'sit') {
          await this.frames('standUp', generation);
          await this.walk(0, generation);
        }
        await this.frames('annoyed', generation);
      });
    } else if (this.state === 'sit') {
      this.start('standUp', async generation => {
        await this.frames('standUp', generation);
        await this.walk(0, generation);
      });
    } else if (this.state === 'idle') {
      if (Math.random() < 0.5 && ACTIONS.wave.enabled)
        this.start('wave', generation => this.frames('wave', generation));
      else this.jump();
    }
  }
  projects(event) {
    const section = document.querySelector('#projects');
    if (!section) return;
    event.preventDefault();
    this.run();
    if (location.hash !== '#projects') history.pushState(null, '', '#projects');
    setTimeout(() => section.scrollIntoView({
      behavior: reduced.matches ? 'auto' : 'smooth', block: 'start',
    }), reduced.matches ? 0 : 160);
  }
  bind() {
    this.mascot.addEventListener('click', () => this.click());
    this.mascot.addEventListener('mascot:fortune', () => this.fortune());
    this.hero.addEventListener('mascot:greeting', () => this.greeting());
    this.hero.addEventListener('pointermove', event => this.activity(event));
    this.hero.addEventListener('pointerleave', () => this.setGaze('center'));
    this.hero.addEventListener('pointerdown', event => this.activity(event));
    this.hero.addEventListener('keydown', event => this.activity(event));
    window.addEventListener('scroll', event => this.activity(event), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.clearIdleTimers();
      else {
        this.sleepDueAt = Date.now() + this.randomDelay(TIMING.sleep);
        if (this.state === 'idle') this.scheduleIdle();
        else if (this.state === 'sit') this.scheduleSitSleep();
      }
    });
    document.querySelector('.v2-nav__projects')?.addEventListener('click', event => this.projects(event));
    reduced.addEventListener?.('change', () => {
      this.generation++;
      this.locked = false;
      this.walkAnimation?.cancel();
      this.position = 0;
      if (this.motion) this.motion.style.transform = 'translateX(0px)';
      this.idle();
    });
  }
}

const mascot = document.querySelector('[data-mascot]');
const hero = document.querySelector('.hero');
if (mascot && hero) new MascotController(mascot, hero);
