/**
 * main.js — Init, typewriter, scroll-spy, skill bars
 */

(function () {
  'use strict';

  // ── Typewriter ────────────────────────────────────
  const TAGLINES = [
    'I break things to understand them.',
    'fixing hyprland configs after recent update',
    'Low-level by day, ML by night.',
    '$ sudo make me a sandwich',
    'why be a king when you can be a God?',
    'git commit -m "first commit" # 67th time',
    'There is no place like 127.0.0.1',
    'make your choice oxygen or wifi',
    'I use Arch btw.',
    'Fighting overfitting and segfaults daily.',
    'Psst, I see dead people',
    'grep -r "meaning" /usr/life  # no results',
  ];

  function initTypewriter() {
    const el = document.getElementById('typewriter');
    if (!el) return;

    let tagIdx  = 0;
    let charIdx = 0;
    let deleting = false;
    let pause    = false;

    function tick() {
      const text = TAGLINES[tagIdx];

      if (pause) {
        pause = false;
        setTimeout(tick, deleting ? 50 : 80);
        return;
      }

      if (!deleting) {
        el.textContent = text.slice(0, ++charIdx);
        if (charIdx === text.length) {
          // Wait before deleting
          setTimeout(() => { deleting = true; tick(); }, 2200);
          return;
        }
      } else {
        el.textContent = text.slice(0, --charIdx);
        if (charIdx === 0) {
          deleting = false;
          tagIdx   = (tagIdx + 1) % TAGLINES.length;
          setTimeout(tick, 400);
          return;
        }
      }

      setTimeout(tick, deleting ? 38 : 68);
    }

    tick();
  }

  // ── Scroll-spy ────────────────────────────────────
  function initScrollSpy() {
    const links    = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.section');

    if (!links.length || !sections.length) return;

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            links.forEach(l => {
              const isActive = l.getAttribute('href') === `#${id}`;
              l.classList.toggle('active', isActive);
              if (isActive) {
                l.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
                const statFile = document.querySelector('.stat-file');
                if (statFile) {
                  const parts = l.textContent.trim().split(/\s+/);
                  statFile.textContent = parts[1] || `${id}.md`;
                }
              }
            });
          }
        });
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: 0 }
    );

    sections.forEach(s => obs.observe(s));
  }

  // ── Skill bars ────────────────────────────────────
  function initSkillBars() {
    const bars = document.querySelectorAll('.skill-bar');
    if (!bars.length) return;

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const bar = entry.target;
            const pct = bar.dataset.pct || '0';
            // Stagger slightly
            const delay = Array.from(bars).indexOf(bar) * 80;
            setTimeout(() => {
              bar.style.width = `${pct}%`;
            }, delay);
            obs.unobserve(bar);
          }
        });
      },
      { threshold: 0.1 }
    );

    bars.forEach(b => obs.observe(b));
  }

  // ── Statusline scroll position ────────────────────
  function initStatusline() {
    const posEl = document.getElementById('scroll-pos');
    if (!posEl) return;

    function updatePos() {
      const scrollY = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      
      if (scrollY <= 0) {
        posEl.textContent = 'Top';
      } else if (scrollY >= maxScroll - 2) {
        posEl.textContent = 'Bot';
      } else {
        const pct = Math.round((scrollY / maxScroll) * 100);
        posEl.textContent = `${pct}%`;
      }
    }

    updatePos();
    window.addEventListener('scroll', updatePos, { passive: true });
  }

  // ── Glitch — JS controlled with cooldown ──────────
  function initGlitch() {
    const name = document.querySelector('.hero-name');
    if (!name) return;

    let onCooldown = false;

    name.addEventListener('mouseenter', () => {
      if (onCooldown) return;
      onCooldown = true;

      name.classList.add('glitching');

      // Remove class once animation finishes
      name.addEventListener('animationend', () => {
        name.classList.remove('glitching');
      }, { once: true });

      // 2.5s cooldown before it can fire again
      setTimeout(() => { onCooldown = false; }, 2500);
    });
  }

  // ── ASCII Dragon ──────────────────────────────────
  function initDragon() {
    const track   = document.getElementById('dragon-track');
    const dragonEl = document.getElementById('dragon-ascii');
    if (!track || !dragonEl) return;

    // 4 frames — wing flap cycle (facing left, towards content)
    const FRAMES = [
      // wings up
      ' /\\  /\\ \n( o  o )\n )----( ~\n  \\  /  \n  (||) ',
      // wings angled up-mid
      ' --  -- \n( o  o )\n )----( ~\n  \\  /  \n  (||) ',
      // wings level / down
      ' \\/  \\/ \n( o  o )\n )----( ~\n  \\  /  \n  (||) ',
      // wings angled down-mid (mirror of frame 1)
      ' --  -- \n( o  o )\n )----( ~\n  \\  /  \n  (||) ',
    ];

    let frameIdx = 0;
    let isDragging = false;
    let grabOffsetY = 0;
    let flapSpeed = 320; // ms per frame (gentle when idle)
    let flapInterval = null;

    dragonEl.textContent = FRAMES[0];

    function startFlap(speed) {
      if (flapInterval) clearInterval(flapInterval);
      flapSpeed = speed;
      flapInterval = setInterval(() => {
        frameIdx = (frameIdx + 1) % FRAMES.length;
        dragonEl.textContent = FRAMES[frameIdx];
      }, flapSpeed);
    }

    startFlap(320);

    // Fast wing flap while moving/scrolling
    let scrollTimer = null;
    function triggerFastFlap() {
      if (flapSpeed !== 90) {
        startFlap(90);
      }
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        if (!isDragging) {
          startFlap(320);
        }
      }, 300);
    }

    function getUsableTrack() {
      const trackH = track.clientHeight;
      const dragonH = dragonEl.offsetHeight || 65;
      const maxTop = Math.max(1, trackH - dragonH);
      return { trackH, dragonH, maxTop };
    }

    // Scroll tracking — dragon Y follows page scroll %
    function updateDragonPos() {
      if (isDragging) return;
      const scrollTop = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const pct = Math.min(1, Math.max(0, scrollTop / maxScroll));
      const { maxTop } = getUsableTrack();
      const top = pct * maxTop;
      dragonEl.style.top = `${Math.round(top)}px`;
    }

    updateDragonPos();
    window.addEventListener('scroll', () => {
      triggerFastFlap();
      updateDragonPos();
    }, { passive: true });

    window.addEventListener('resize', updateDragonPos, { passive: true });

    // ── Drag & Drop Scrollbar Interaction ────────────

    function onPointerDown(e) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      e.stopPropagation();

      isDragging = true;
      dragonEl.classList.add('is-dragging');
      document.body.style.userSelect = 'none';

      const dragonRect = dragonEl.getBoundingClientRect();
      grabOffsetY = e.clientY - dragonRect.top;

      triggerFastFlap();

      if (dragonEl.setPointerCapture && e.pointerId !== undefined) {
        try { dragonEl.setPointerCapture(e.pointerId); } catch (_) {}
      }

      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      triggerFastFlap();

      const trackRect = track.getBoundingClientRect();
      const { maxTop } = getUsableTrack();
      const relativeY = e.clientY - trackRect.top - grabOffsetY;
      const clampedTop = Math.min(maxTop, Math.max(0, relativeY));

      const pct = clampedTop / maxTop;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

      dragonEl.style.top = `${Math.round(clampedTop)}px`;
      window.scrollTo(0, pct * maxScroll);
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      dragonEl.classList.remove('is-dragging');
      document.body.style.userSelect = '';

      if (dragonEl.releasePointerCapture && e.pointerId !== undefined) {
        try { dragonEl.releasePointerCapture(e.pointerId); } catch (_) {}
      }

      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      startFlap(320);
      updateDragonPos();
    }

    dragonEl.addEventListener('pointerdown', onPointerDown);

    // Clicking the track/pole jumps scroll to that point
    track.addEventListener('pointerdown', (e) => {
      if (e.target === dragonEl || dragonEl.contains(e.target)) return;
      e.preventDefault();

      const trackRect = track.getBoundingClientRect();
      const { maxTop, dragonH } = getUsableTrack();
      const clickY = e.clientY - trackRect.top - (dragonH / 2);
      const clampedTop = Math.min(maxTop, Math.max(0, clickY));

      const pct = clampedTop / maxTop;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);

      triggerFastFlap();
      window.scrollTo({
        top: pct * maxScroll,
        behavior: 'smooth'
      });
    });
  }

  // ── Init ──────────────────────────────────────────
  function init() {
    initTypewriter();
    initScrollSpy();
    initSkillBars();
    initStatusline();
    initGlitch();
    initDragon();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

