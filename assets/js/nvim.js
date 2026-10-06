/**
 * nvim.js — Neovim command-line, tab navigation, split windows, telescope grep & which-key system
 *
 * Implements:
 * 1. Buffer Persistence (Save ONLY on write)
 *    - Changes to tab order or themes are marked dirty/modified ([+])
 *    - Changes ONLY persist to localStorage on ':w', ':write', ':wq', ':x', or '<Space> f w'
 * 2. Real Interactive Telescope Picker & Live Grep
 *    - '<Space> pw' / ':grep': Grep word under cursor / live grep across all 5 buffers
 *    - '<Space> pg': Live grep modal with real-time match count and preview
 *    - '<Space> pf': Find files picker
 *    - Arrow keys / Ctrl+j / Ctrl+k / Ctrl+n / Ctrl+p navigate matches
 *    - Enter jumps directly to section & line with glowing highlight
 * 3. Neovim Commandline (triggered with ':')
 *    - ':w' / ':write' saves modified state to localStorage
 *    - ':vsp' / ':vsplit' and ':sp' / ':split' for window splits
 *    - ':close' to close split, ':only' to maximize active window
 *    - ':grep <query>' to live grep across buffers
 *    - ':terminal', ':tabn', ':tabp', ':tabm', ':tabreset', ':colorscheme'
 * 4. Split Windows (<Space>s, :vsp, :sp, <C-w>, gw)
 *    - Vertical & horizontal splits with divider drag & equalize
 *    - Active pane highlight, buffer navigation within panes
 * 5. Which-Key System (<Space> / Leader)
 *    - 6.5s timeout with hover pause
 *    - Collision-free single-key mappings
 */

(function () {
  'use strict';

  const DEFAULT_TABS = [
    { id: 'about', file: 'about.md' },
    { id: 'skills', file: 'skills.sh' },
    { id: 'projects', file: 'projects.rs' },
    { id: 'hobbies', file: 'hobbies.txt' },
    { id: 'contact', file: 'contact.cfg' }
  ];

  let tabs = [...DEFAULT_TABS];

  // ── Keymap Tree ──────────────────────────────────────
  const KEYMAPS = {
    title: '<leader>',
    items: [
      { key: 't', desc: '+tabs', sub: 'tabs' },
      { key: 's', desc: '+splits', sub: 'splits' },
      { key: 'p', desc: '+telescope', sub: 'telescope' },
      { key: 'f', desc: '+file/format', sub: 'file' },
      { key: 'c', desc: '+clear', sub: 'clear' },
      { key: 'T', desc: '+theme', sub: 'theme' },
      { key: 'r', desc: 'Replace word globally', action: () => showNotify('Replace', ':%s/<cword>/<cword>/gI', '󰑕') },
      { key: 'e', desc: 'MiniFiles explorer', action: () => toggleMiniFiles() },
      { key: ':', desc: 'Neovim cmdline', action: () => openCmdline() }
    ],
    subs: {
      tabs: {
        title: '<leader> t',
        items: [
          { key: 'p', desc: 'Move to previous tab (tabp)', action: () => prevTab() },
          { key: 'n', desc: 'Move to next tab (tabn)', action: () => nextTab() },
          { key: 'h', desc: 'Move tab left (:tabm -1)', action: () => moveActiveTab(-1) },
          { key: 'l', desc: 'Move tab right (:tabm +1)', action: () => moveActiveTab(1) },
          { key: '<', desc: 'Move tab left (:tabm -1)', action: () => moveActiveTab(-1) },
          { key: '>', desc: 'Move tab right (:tabm +1)', action: () => moveActiveTab(1) },
          { key: 'm', desc: '+move tab in order...', sub: 'moveTab' },
          { key: '1', desc: 'Buffer 1 (about.md)', action: () => goToTab(0) },
          { key: '2', desc: 'Buffer 2 (skills.sh)', action: () => goToTab(1) },
          { key: '3', desc: 'Buffer 3 (projects.rs)', action: () => goToTab(2) },
          { key: '4', desc: 'Buffer 4 (hobbies.txt)', action: () => goToTab(3) },
          { key: '5', desc: 'Buffer 5 (contact.cfg)', action: () => goToTab(4) },
          { key: 'o', desc: 'Open new tab (tabnew)', action: () => showNotify('Tab', 'tabnew: opened scratch buffer', '󰓩') },
          { key: 'x', desc: 'Close current tab (tabclose)', action: () => showNotify('Tab', 'tabclose: cannot close last tab', '󰅙') }
        ]
      },
      moveTab: {
        title: '<leader> t m',
        items: [
          { key: 'h', desc: 'Move active tab left', action: () => moveActiveTab(-1) },
          { key: 'l', desc: 'Move active tab right', action: () => moveActiveTab(1) },
          { key: '<', desc: 'Move active tab left', action: () => moveActiveTab(-1) },
          { key: '>', desc: 'Move active tab right', action: () => moveActiveTab(1) },
          { key: 'r', desc: 'Reset tabs to default order', action: () => resetTabOrder() }
        ]
      },
      splits: {
        title: '<leader> s',
        items: [
          { key: 'v', desc: 'Split window vertically (:vsp)', action: () => openSplit('vertical') },
          { key: 'h', desc: 'Split window horizontally (:sp)', action: () => openSplit('horizontal') },
          { key: 'w', desc: 'Switch focus between splits (<C-w>w)', action: () => cycleSplitFocus() },
          { key: 'e', desc: 'Make splits equal size (<C-w>=)', action: () => equalizeSplits() },
          { key: 'x', desc: 'Close active split (:close / <C-w>c)', action: () => closeSplit() },
          { key: 'o', desc: 'Only keep active split (:only)', action: () => onlySplit() }
        ]
      },
      file: {
        title: '<leader> f',
        items: [
          { key: 'w', desc: 'Save / write buffer (:w)', action: () => writeBuffer() },
          { key: 'f', desc: 'Format buffer (LSP)', action: () => formatBuffer() },
          { key: 'p', desc: 'Copy file path / URL', action: () => copyFilePath() }
        ]
      },
      telescope: {
        title: '<leader> p',
        items: [
          { key: 'w', desc: 'Grep word under cursor (:grep)', action: () => grepWordUnderCursor() },
          { key: 'g', desc: 'Live grep all buffers (:grep)', action: () => openTelescope('grep') },
          { key: 'f', desc: 'Find files in project (:find)', action: () => openTelescope('files') },
          { key: 'r', desc: 'Recent files / buffers', action: () => openTelescope('files') },
          { key: 'n', desc: 'Fuzzy find notifications', action: () => showNotify('Telescope', 'Notification ring active', '󰍉') },
          { key: 't', desc: 'Telescope colorschemes', action: () => switchThemeNext() }
        ]
      },
      theme: {
        title: '<leader> T',
        items: [
          { key: 'n', desc: 'Cycle next theme', action: () => switchThemeNext() },
          { key: 'p', desc: 'Paper theme (notebook)', action: () => applyThemeDirect('paper') },
          { key: 'g', desc: 'Green phosphor theme', action: () => applyThemeDirect('green') },
          { key: 'a', desc: 'Amber CRT theme', action: () => applyThemeDirect('amber') },
          { key: 's', desc: 'Synthwave theme', action: () => applyThemeDirect('synthwave') }
        ]
      },
      clear: {
        title: '<leader> c',
        items: [
          { key: 'n', desc: 'Clear notifications', action: () => clearNotifications() },
          { key: 'h', desc: 'Clear search highlight (:nohl)', action: () => clearSearchHighlights() }
        ]
      }
    }
  };

  // ── State ──────────────────────────────────────────
  let whichKeyActive = false;
  let currentSubmenu = null;
  let leaderTimeout = null;
  const TIMEOUT_LEN = 6500;

  // Buffer Modified State (persists to localStorage only on :w / <Space>fw)
  let isModified = false;

  // Split Window State
  let splitActive = false;
  let splitDirection = 'vertical';
  let activePaneId = 1;
  let pane1Buffer = null;
  let pane2Buffer = null;

  // Key prefix state (<C-w> and gw)
  let ctrlWPending = false;
  let ctrlWTimeout = null;
  let gPending = false;
  let gTimeout = null;

  // Telescope Picker State
  let telescopeActive = false;
  let telescopeMode = 'grep'; // 'grep' | 'files'
  let telescopeResults = [];
  let telescopeSelectedIndex = 0;
  let lastHoveredWord = '';

  // DOM Elements
  let cmdlinePopup, cmdlineInput, whichKeyPopup, notifyContainer;
  let telescopeModal, telescopeInput, telescopeResultsEl, telescopeCountEl, telescopeTitleEl, telescopeModeTag;

  // ── Notifications (nvim-notify style) ───────────────
  function showNotify(title, msg, icon = 'ℹ') {
    if (!notifyContainer) {
      notifyContainer = document.getElementById('nvim-notify-container');
      if (!notifyContainer) return;
    }

    const toast = document.createElement('div');
    toast.className = 'nvim-notification';
    toast.innerHTML = `
      <span class="nvim-notify-icon">${icon}</span>
      <div class="nvim-notify-body">
        <span class="nvim-notify-title">${escapeHTML(title)}</span>
        <span class="nvim-notify-msg">${escapeHTML(msg)}</span>
      </div>
    `;

    notifyContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fading');
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function clearNotifications() {
    if (!notifyContainer) return;
    const notes = notifyContainer.querySelectorAll('.nvim-notification');
    notes.forEach(n => {
      n.classList.add('fading');
      setTimeout(() => n.remove(), 200);
    });
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // ── Buffer Write & Storage Persistence ───────────────

  function markModified() {
    isModified = true;
    updateModifiedIndicators();
  }

  function updateModifiedIndicators() {
    const statReadonly = document.querySelector('.stat-readonly');
    if (statReadonly) {
      statReadonly.textContent = isModified ? '[+]' : '[RO]';
      statReadonly.classList.toggle('stat-modified', isModified);
    }
    document.querySelectorAll('.split-pane-ro').forEach(el => {
      el.textContent = isModified ? '[+]' : '[RO]';
      el.classList.toggle('stat-modified', isModified);
    });
  }

  function writeBuffer() {
    const saved = [];

    // 1. Persist tab order to localStorage
    try {
      localStorage.setItem('ps-tab-order', JSON.stringify(tabs.map(t => t.id)));
      saved.push('tabs');
    } catch (e) {}

    // 2. Persist current theme to localStorage
    try {
      const curTheme = window.PortfolioTerminal?.getCurrentTheme() || document.documentElement.getAttribute('data-theme') || 'paper';
      localStorage.setItem('ps-theme', curTheme);
      saved.push(`theme "${curTheme}"`);
    } catch (e) {}

    isModified = false;
    updateModifiedIndicators();

    showNotify('Write', `"index.html" [w] written to localStorage (${saved.join(', ')})`, '󰆓');
  }

  // ── Tab Order Management & Website Reordering ────────

  function applyTabOrder(newOrder, notifyMsg = null, shouldScroll = false, activeIdToKeep = null) {
    let activeId = activeIdToKeep;
    if (!activeId) {
      const curActive = document.querySelector('.nav-link.active');
      activeId = curActive ? curActive.getAttribute('href').replace('#', '') : newOrder[0]?.id;
    }

    tabs = [...newOrder];

    const navLinksContainer = document.querySelector('.nav-links');
    const main = document.querySelector('main');
    const siteFooter = document.querySelector('.site-footer');

    // 1. Reorder navbar tab items and update position numbers
    if (navLinksContainer) {
      tabs.forEach((tab, idx) => {
        let link = navLinksContainer.querySelector(`.nav-link[href="#${tab.id}"]`);
        if (link) {
          link.innerHTML = `<span class="dim">${idx + 1}</span> ${tab.file}`;
          link.setAttribute('draggable', 'true');
          link.setAttribute('title', `Tab ${idx + 1}: ${tab.file} (Drag to move)`);
          link.classList.toggle('active', tab.id === activeId);
          navLinksContainer.appendChild(link);
        }
      });
    }

    // 2. Reorder <section> elements in <main>
    if (main) {
      tabs.forEach((tab) => {
        const section = document.getElementById(tab.id);
        if (section) {
          if (siteFooter) {
            main.insertBefore(section, siteFooter);
          } else {
            main.appendChild(section);
          }
          section.classList.remove('section-reordered');
          void section.offsetWidth;
          section.classList.add('section-reordered');
        }
      });
    }

    // 3. Mark buffer modified (persists to localStorage ONLY on :w / <Space>fw)
    markModified();

    // 4. Update statusline current file
    const statFile = document.querySelector('.stat-file');
    if (statFile && activeId) {
      const activeTabObj = tabs.find(t => t.id === activeId);
      if (activeTabObj) statFile.textContent = activeTabObj.file;
    }

    // 5. Scroll active section into view if requested (and splits not active)
    if (shouldScroll && activeId && !splitActive) {
      const activeSection = document.getElementById(activeId);
      if (activeSection) {
        activeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    if (notifyMsg) {
      showNotify('Tab Layout', notifyMsg, '󰓩');
    }
  }

  function initTabOrder() {
    try {
      const saved = localStorage.getItem('ps-tab-order');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids) && ids.length) {
          const reordered = [];
          ids.forEach(id => {
            const found = DEFAULT_TABS.find(t => t.id === id);
            if (found) reordered.push(found);
          });
          DEFAULT_TABS.forEach(t => {
            if (!reordered.find(r => r.id === t.id)) reordered.push(t);
          });
          applyTabOrder(reordered, null, false);
          isModified = false;
          updateModifiedIndicators();
          return;
        }
      }
    } catch (e) {}

    applyTabOrder(DEFAULT_TABS, null, false);
    isModified = false;
    updateModifiedIndicators();
  }

  function moveActiveTab(delta) {
    const currentIdx = getCurrentTabIndex();
    const movedTab = tabs[currentIdx];
    if (!movedTab) return;

    let targetIdx = currentIdx + delta;
    if (targetIdx < 0) targetIdx = tabs.length - 1;
    if (targetIdx >= tabs.length) targetIdx = 0;
    if (targetIdx === currentIdx) return;

    const newTabs = [...tabs];
    newTabs.splice(currentIdx, 1);
    newTabs.splice(targetIdx, 0, movedTab);

    applyTabOrder(newTabs, `Moved "${movedTab.file}" to position ${targetIdx + 1} (type :w to save)`, true, movedTab.id);
  }

  function moveActiveTabTo(targetIdx) {
    const currentIdx = getCurrentTabIndex();
    const movedTab = tabs[currentIdx];
    if (!movedTab) return;

    const bounded = Math.max(0, Math.min(tabs.length - 1, targetIdx));
    if (bounded === currentIdx) return;

    const newTabs = [...tabs];
    newTabs.splice(currentIdx, 1);
    newTabs.splice(bounded, 0, movedTab);

    applyTabOrder(newTabs, `Moved "${movedTab.file}" to position ${bounded + 1} (type :w to save)`, true, movedTab.id);
  }

  function resetTabOrder() {
    applyTabOrder(DEFAULT_TABS, 'Reset tabs to default order (type :w to save)', true);
  }

  // ── Drag & Drop Tabs ────────────────────────────────

  function reorderTabs(sourceId, targetId, insertAfter) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const currentOrder = [...tabs];
    const sourceIdx = currentOrder.findIndex(t => t.id === sourceId);
    if (sourceIdx < 0) return;

    const [movedTab] = currentOrder.splice(sourceIdx, 1);
    let targetIdx = currentOrder.findIndex(t => t.id === targetId);
    if (targetIdx < 0) return;

    if (insertAfter) {
      targetIdx += 1;
    }
    currentOrder.splice(targetIdx, 0, movedTab);
    applyTabOrder(currentOrder, `Moved "${movedTab.file}" to position ${targetIdx + 1} (type :w to save)`, false);
  }

  function initDragAndDrop() {
    const container = document.querySelector('.nav-links');
    if (!container) return;

    let draggedTabId = null;

    // Desktop HTML5 Drag & Drop
    container.addEventListener('dragstart', (e) => {
      const link = e.target.closest('.nav-link');
      if (!link) return;

      draggedTabId = link.getAttribute('href').replace('#', '');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', draggedTabId);
      link.classList.add('is-dragging');
    });

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      const targetLink = e.target.closest('.nav-link');
      if (!targetLink) return;

      container.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('drag-target-left', 'drag-target-right');
      });

      const rect = targetLink.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      if (e.clientX < midX) {
        targetLink.classList.add('drag-target-left');
      } else {
        targetLink.classList.add('drag-target-right');
      }
    });

    container.addEventListener('dragleave', (e) => {
      const targetLink = e.target.closest('.nav-link');
      if (targetLink && !targetLink.contains(e.relatedTarget)) {
        targetLink.classList.remove('drag-target-left', 'drag-target-right');
      }
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();
      const targetLink = e.target.closest('.nav-link');

      container.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('drag-target-left', 'drag-target-right', 'is-dragging');
      });

      if (!targetLink || !draggedTabId) return;

      const targetId = targetLink.getAttribute('href').replace('#', '');
      const rect = targetLink.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertAfter = e.clientX >= midX;

      reorderTabs(draggedTabId, targetId, insertAfter);
      draggedTabId = null;
    });

    container.addEventListener('dragend', () => {
      container.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('is-dragging', 'drag-target-left', 'drag-target-right');
      });
      draggedTabId = null;
    });

    // Touch Drag & Drop for Mobile
    let touchTimer = null;
    let touchStartLink = null;
    let touchStartX = 0;
    let touchStartY = 0;
    let isTouchDragging = false;
    let currentDropTarget = null;
    let currentInsertAfter = false;
    let justDropped = false;

    function clearTouchHighlights() {
      container.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('is-dragging', 'drag-target-left', 'drag-target-right');
      });
    }

    container.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const link = e.target.closest('.nav-link');
      if (!link) return;

      touchStartLink = link;
      const touch = e.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      isTouchDragging = false;
      currentDropTarget = null;

      clearTimeout(touchTimer);
      touchTimer = setTimeout(() => {
        isTouchDragging = true;
        draggedTabId = link.getAttribute('href').replace('#', '');
        link.classList.add('is-dragging');
        if (navigator.vibrate) {
          try { navigator.vibrate(40); } catch (_) {}
        }
      }, 250);
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (!touchStartLink) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartX);
      const dy = Math.abs(touch.clientY - touchStartY);

      if (!isTouchDragging) {
        if (dx > 8 || dy > 8) {
          clearTimeout(touchTimer);
          touchStartLink = null;
        }
        return;
      }

      if (e.cancelable) {
        e.preventDefault();
      }

      const elem = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetLink = elem ? elem.closest('.nav-link') : null;

      container.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('drag-target-left', 'drag-target-right');
      });

      if (targetLink && targetLink !== touchStartLink) {
        currentDropTarget = targetLink;
        const rect = targetLink.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        currentInsertAfter = touch.clientX >= midX;
        if (currentInsertAfter) {
          targetLink.classList.add('drag-target-right');
        } else {
          targetLink.classList.add('drag-target-left');
        }
      } else {
        currentDropTarget = null;
      }
    }, { passive: false });

    const handleTouchEnd = () => {
      clearTimeout(touchTimer);
      if (isTouchDragging) {
        justDropped = true;
        setTimeout(() => { justDropped = false; }, 300);
        if (touchStartLink && currentDropTarget && draggedTabId) {
          const targetId = currentDropTarget.getAttribute('href').replace('#', '');
          reorderTabs(draggedTabId, targetId, currentInsertAfter);
        }
      }
      clearTouchHighlights();
      touchStartLink = null;
      isTouchDragging = false;
      draggedTabId = null;
      currentDropTarget = null;
    };

    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    // Suppress accidental navigation right after drop
    container.addEventListener('click', (e) => {
      if (justDropped) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  // ── Tab Navigation ──────────────────────────────────

  function getCurrentTabIndex() {
    if (splitActive) {
      const curBuffer = activePaneId === 1 ? pane1Buffer : pane2Buffer;
      const idx = tabs.findIndex(t => t.id === curBuffer);
      return idx >= 0 ? idx : 0;
    }
    const activeLink = document.querySelector('.nav-link.active');
    if (!activeLink) return 0;
    const href = activeLink.getAttribute('href').replace('#', '');
    const idx = tabs.findIndex(t => t.id === href);
    return idx >= 0 ? idx : 0;
  }

  function goToTab(index) {
    const boundedIdx = (index + tabs.length) % tabs.length;
    const target = tabs[boundedIdx];
    if (!target) return;

    if (splitActive) {
      setPaneBuffer(activePaneId, target.id);
      return;
    }

    const targetEl = document.getElementById(target.id);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      document.querySelectorAll('.nav-link').forEach(link => {
        const isActive = link.getAttribute('href') === `#${target.id}`;
        link.classList.toggle('active', isActive);
        if (isActive && link.scrollIntoView) {
          link.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        }
      });

      const statFile = document.querySelector('.stat-file');
      if (statFile) {
        statFile.textContent = target.file || `${target.id}.txt`;
      }

      showNotify('Buffer', `Switched to [${boundedIdx + 1}] ${target.file}`, '󰓩');
    }
  }

  function nextTab() {
    goToTab(getCurrentTabIndex() + 1);
  }

  function prevTab() {
    goToTab(getCurrentTabIndex() - 1);
  }

  function copyFilePath() {
    const path = window.location.href;
    navigator.clipboard?.writeText(path).then(() => {
      showNotify('Yank', `File path copied: ${path}`, '󰅍');
    }).catch(() => {
      showNotify('Yank', `File path: ${path}`, '󰅍');
    });
  }

  function formatBuffer() {
    showNotify('LSP', 'vim.lsp.buf.format: Buffer formatted cleanly', '󰉿');
  }

  function toggleMiniFiles() {
    showNotify('MiniFiles', 'cwd: ~/literate-carnival/ [5 buffers]', '󰉓');
  }

  function switchThemeNext() {
    if (window.PortfolioTerminal && typeof window.PortfolioTerminal.cycleTheme === 'function') {
      window.PortfolioTerminal.cycleTheme();
      const newTheme = window.PortfolioTerminal.getCurrentTheme();
      showNotify('Colorscheme', `Theme switched to "${newTheme}" (type :w to save)`, '󰔎');
      markModified();
    }
  }

  function applyThemeDirect(themeName) {
    if (window.PortfolioTerminal && typeof window.PortfolioTerminal.applyTheme === 'function') {
      if (window.PortfolioTerminal.applyTheme(themeName)) {
        showNotify('Colorscheme', `Applied colorscheme "${themeName}" (type :w to save)`, '󰔎');
        markModified();
      } else {
        showNotify('Error', `Unknown theme "${themeName}"`, '󰅙');
      }
    }
  }

  // ── Telescope Live Grep & Finder (telescope.nvim) ────

  function buildSearchIndex() {
    const index = [];
    tabs.forEach(tab => {
      const section = document.getElementById(tab.id);
      if (!section) return;

      const nodes = section.querySelectorAll('h1, h2, h3, h4, p, li, pre, code, .project-card, .skill-name, .hero-tagline, .hero-meta p, .hobbies-grid p, .contact-card, .dragon-banner');
      let lineNum = 1;
      const seen = new Set();

      nodes.forEach(node => {
        const raw = (node.innerText || node.textContent || '').trim();
        if (!raw) return;

        raw.split('\n').map(l => l.trim()).filter(l => l.length > 1).forEach(line => {
          const key = `${tab.id}:${line}`;
          if (seen.has(key)) return;
          seen.add(key);

          index.push({
            file: tab.file,
            tabId: tab.id,
            line: lineNum++,
            text: line,
            element: node
          });
        });
      });
    });
    return index;
  }

  function openTelescope(mode = 'grep', initialQuery = '') {
    closeWhichKey();
    closeCmdline();
    if (!telescopeModal || !telescopeInput) return;

    telescopeActive = true;
    telescopeMode = mode;
    telescopeModal.classList.remove('hidden');

    if (mode === 'files') {
      if (telescopeTitleEl) telescopeTitleEl.textContent = 'Find Files';
      if (telescopeModeTag) telescopeModeTag.textContent = 'find files';
      telescopeInput.placeholder = 'Search project files/buffers...';
    } else {
      if (telescopeTitleEl) telescopeTitleEl.textContent = initialQuery ? `Live Grep: "${initialQuery}"` : 'Telescope Live Grep';
      if (telescopeModeTag) telescopeModeTag.textContent = 'live grep';
      telescopeInput.placeholder = 'Type to grep across buffers...';
    }

    telescopeInput.value = initialQuery;
    telescopeInput.focus();
    performTelescopeSearch(initialQuery);
  }

  function closeTelescope() {
    telescopeActive = false;
    if (telescopeModal) {
      telescopeModal.classList.add('hidden');
    }
    if (telescopeInput) {
      telescopeInput.blur();
    }
  }

  function performTelescopeSearch(query) {
    if (!telescopeResultsEl) return;
    const q = (query || '').trim();

    if (telescopeMode === 'files') {
      const qLower = q.toLowerCase();
      telescopeResults = tabs.filter(t => !q || t.file.toLowerCase().includes(qLower) || t.id.toLowerCase().includes(qLower)).map(t => ({
        type: 'files',
        file: t.file,
        tabId: t.id,
        text: `~/literate-carnival/${t.file}`
      }));
    } else {
      const allItems = buildSearchIndex();
      if (!q) {
        telescopeResults = allItems.slice(0, 40).map(item => ({ ...item, type: 'grep' }));
      } else {
        const qLower = q.toLowerCase();
        telescopeResults = allItems.filter(item => item.text.toLowerCase().includes(qLower)).map(item => ({ ...item, type: 'grep' }));
      }
    }

    telescopeSelectedIndex = 0;
    renderTelescopeResults(q);
  }

  function renderTelescopeResults(query = '') {
    if (!telescopeResultsEl) return;

    if (telescopeCountEl) {
      const total = telescopeResults.length;
      if (telescopeMode === 'files') {
        telescopeCountEl.textContent = `${total} files`;
      } else {
        const fileCount = new Set(telescopeResults.map(r => r.file)).size;
        telescopeCountEl.textContent = `${total} matches in ${fileCount} buffers`;
      }
    }

    if (telescopeResults.length === 0) {
      telescopeResultsEl.innerHTML = `<div class="telescope-empty dim">No matches found for "${escapeHTML(query)}"</div>`;
      return;
    }

    const qLower = query.toLowerCase().trim();

    const html = telescopeResults.map((item, idx) => {
      const isSelected = idx === telescopeSelectedIndex;
      let textHtml = escapeHTML(item.text);

      if (qLower && item.type === 'grep') {
        const regex = new RegExp(`(${escapeRegex(query.trim())})`, 'gi');
        textHtml = escapeHTML(item.text).replace(regex, '<span class="telescope-match-highlight">$1</span>');
      }

      if (item.type === 'files') {
        return `
          <div class="telescope-result-row ${isSelected ? 'selected' : ''}" data-idx="${idx}" role="option" aria-selected="${isSelected}">
            <span class="telescope-result-file">${escapeHTML(item.file)}</span>
            <span class="telescope-result-text">${escapeHTML(item.text)}</span>
          </div>
        `;
      }

      return `
        <div class="telescope-result-row ${isSelected ? 'selected' : ''}" data-idx="${idx}" role="option" aria-selected="${isSelected}">
          <span class="telescope-result-file">${escapeHTML(item.file)}</span>
          <span class="telescope-result-line">:${item.line}</span>
          <span class="telescope-result-text">${textHtml}</span>
        </div>
      `;
    }).join('');

    telescopeResultsEl.innerHTML = html;

    telescopeResultsEl.querySelectorAll('.telescope-result-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(row.getAttribute('data-idx'), 10);
        selectTelescopeIndex(idx);
        confirmTelescopeSelection();
      });
    });

    scrollSelectedTelescopeIntoView();
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function selectTelescopeIndex(idx) {
    if (!telescopeResults.length) return;
    telescopeSelectedIndex = Math.max(0, Math.min(telescopeResults.length - 1, idx));
    const rows = telescopeResultsEl.querySelectorAll('.telescope-result-row');
    rows.forEach((r, i) => {
      r.classList.toggle('selected', i === telescopeSelectedIndex);
      r.setAttribute('aria-selected', i === telescopeSelectedIndex);
    });
    scrollSelectedTelescopeIntoView();
  }

  function scrollSelectedTelescopeIntoView() {
    const selectedRow = telescopeResultsEl.querySelector('.telescope-result-row.selected');
    if (selectedRow) {
      selectedRow.scrollIntoView({ block: 'nearest' });
    }
  }

  function confirmTelescopeSelection() {
    const item = telescopeResults[telescopeSelectedIndex];
    if (!item) return;

    closeTelescope();

    if (item.type === 'files') {
      const idx = tabs.findIndex(t => t.id === item.tabId);
      if (idx >= 0) goToTab(idx);
      showNotify('Telescope', `Opened buffer [${item.file}]`, '󰍉');
      return;
    }

    // Grep match jump
    if (splitActive) {
      setPaneBuffer(activePaneId, item.tabId);
      setTimeout(() => {
        const pane = document.getElementById(`nvim-pane-${activePaneId}`);
        if (pane) {
          const body = pane.querySelector('.split-pane-body');
          if (body) {
            const matchingNodes = body.querySelectorAll('h1, h2, h3, h4, p, li, pre, code, .project-card, .skill-name');
            for (let n of matchingNodes) {
              if (n.textContent.includes(item.text)) {
                n.scrollIntoView({ behavior: 'smooth', block: 'center' });
                n.classList.remove('search-target-flash');
                void n.offsetWidth;
                n.classList.add('search-target-flash');
                setTimeout(() => n.classList.remove('search-target-flash'), 2500);
                break;
              }
            }
          }
        }
      }, 60);
    } else {
      const tabIdx = tabs.findIndex(t => t.id === item.tabId);
      if (tabIdx >= 0) goToTab(tabIdx);

      setTimeout(() => {
        if (item.element) {
          item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          item.element.classList.remove('search-target-flash');
          void item.element.offsetWidth;
          item.element.classList.add('search-target-flash');
          setTimeout(() => item.element.classList.remove('search-target-flash'), 2500);
        }
      }, 60);
    }

    showNotify('Telescope', `Jumped to [${item.file}:${item.line}] "${item.text.slice(0, 32)}..."`, '󰍉');
  }

  function grepWordUnderCursor() {
    let word = '';
    const sel = window.getSelection() ? window.getSelection().toString().trim() : '';
    if (sel) {
      word = sel;
    } else if (lastHoveredWord) {
      word = lastHoveredWord;
    }
    openTelescope('grep', word);
  }

  function clearSearchHighlights() {
    document.querySelectorAll('.search-target-flash').forEach(el => el.classList.remove('search-target-flash'));
    showNotify('Search', ':nohl Search highlight cleared', '󰱐');
  }

  // ── Real Split Window Engine (<Space>s, :vsp, :sp, <C-w>) ──

  function openSplit(direction = 'vertical', targetBufferId = null) {
    const container = document.getElementById('nvim-split-container');
    if (!container) return;

    if (splitActive) {
      if (splitDirection !== direction) {
        setSplitDirection(direction);
        showNotify('Window', `Layout switched to ${direction} split`, '󰤼');
      } else {
        showNotify('Window', `${direction} split already active`, '󰤼');
      }
      return;
    }

    splitActive = true;
    splitDirection = direction;

    const curIdx = getCurrentTabIndex();
    pane1Buffer = tabs[curIdx] ? tabs[curIdx].id : tabs[0].id;
    if (targetBufferId && tabs.find(t => t.id === targetBufferId)) {
      pane2Buffer = targetBufferId;
    } else {
      pane2Buffer = tabs[(curIdx + 1) % tabs.length].id;
    }
    activePaneId = 2; // Neovim convention: focus the new window

    document.body.classList.add('nvim-split-active');
    document.body.classList.remove('split-vertical', 'split-horizontal');
    document.body.classList.add(`split-${direction}`);

    container.classList.remove('hidden');
    container.innerHTML = `
      <div class="nvim-split-pane" id="nvim-pane-1" data-pane-id="1">
        <div class="split-pane-header">
          <div class="split-pane-info">
            <span class="split-pane-mode">NORMAL</span>
            <span class="split-pane-file"></span>
            <span class="split-pane-ro">${isModified ? '[+]' : '[RO]'}</span>
          </div>
          <div class="split-pane-actions">
            <button class="split-action-btn split-btn-equal" title="Equalize splits (<C-w>=)">[=]</button>
            <button class="split-action-btn split-btn-close" title="Close split (<C-w>c / :close)">[×]</button>
          </div>
        </div>
        <div class="split-pane-body"></div>
      </div>
      <div class="nvim-split-divider" id="nvim-split-divider" title="Drag to resize split"></div>
      <div class="nvim-split-pane" id="nvim-pane-2" data-pane-id="2">
        <div class="split-pane-header">
          <div class="split-pane-info">
            <span class="split-pane-mode">NORMAL</span>
            <span class="split-pane-file"></span>
            <span class="split-pane-ro">${isModified ? '[+]' : '[RO]'}</span>
          </div>
          <div class="split-pane-actions">
            <button class="split-action-btn split-btn-equal" title="Equalize splits (<C-w>=)">[=]</button>
            <button class="split-action-btn split-btn-close" title="Close split (<C-w>c / :close)">[×]</button>
          </div>
        </div>
        <div class="split-pane-body"></div>
      </div>
    `;

    setPaneBuffer(1, pane1Buffer, false);
    setPaneBuffer(2, pane2Buffer, false);
    setActivePane(2);

    initSplitEvents();

    const t1 = tabs.find(t => t.id === pane1Buffer);
    const t2 = tabs.find(t => t.id === pane2Buffer);
    showNotify('Window', `Split ${direction}: ${t1?.file || pane1Buffer} | ${t2?.file || pane2Buffer}`, '󰤼');
  }

  function setSplitDirection(direction) {
    if (!splitActive) return;
    splitDirection = direction;
    document.body.classList.remove('split-vertical', 'split-horizontal');
    document.body.classList.add(`split-${direction}`);
    equalizeSplits();
  }

  function renderPaneContent(paneId, sectionId) {
    const pane = document.getElementById(`nvim-pane-${paneId}`);
    if (!pane) return;
    const body = pane.querySelector('.split-pane-body');
    if (!body) return;

    const sourceSection = document.getElementById(sectionId);
    if (!sourceSection) {
      body.innerHTML = `<div class="p-4 dim">Buffer [${escapeHTML(sectionId)}] empty or not found</div>`;
      return;
    }

    const clone = sourceSection.cloneNode(true);
    clone.removeAttribute('id');

    // Canvas cloning for #dither-canvas
    const origCanvas = sourceSection.querySelector('#dither-canvas');
    const cloneCanvas = clone.querySelector('#dither-canvas');
    if (origCanvas && cloneCanvas) {
      cloneCanvas.removeAttribute('id');
      cloneCanvas.classList.add('split-dither-canvas');
      cloneCanvas.width = origCanvas.width;
      cloneCanvas.height = origCanvas.height;
      const ctx = cloneCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(origCanvas, 0, 0);
      }
    }

    // Preserve typewriter string if populated
    const origTw = sourceSection.querySelector('#typewriter');
    const cloneTw = clone.querySelector('#typewriter');
    if (origTw && cloneTw) {
      cloneTw.textContent = origTw.textContent || 'Machine Learning & Systems Developer';
    }

    // Pre-fill skill progress bars
    clone.querySelectorAll('.skill-bar').forEach(bar => {
      const level = bar.getAttribute('data-level');
      const fill = bar.querySelector('.skill-fill');
      if (fill && level) {
        fill.style.width = `${level}%`;
      }
    });

    body.innerHTML = '';
    body.appendChild(clone);
    body.scrollTop = 0;
  }

  function setPaneBuffer(paneId, sectionId, doNotify = true) {
    if (!sectionId) return;

    if (paneId === 1) pane1Buffer = sectionId;
    if (paneId === 2) pane2Buffer = sectionId;

    renderPaneContent(paneId, sectionId);

    const pane = document.getElementById(`nvim-pane-${paneId}`);
    if (pane) {
      const fileLabel = pane.querySelector('.split-pane-file');
      const tabObj = tabs.find(t => t.id === sectionId);
      if (fileLabel && tabObj) {
        fileLabel.textContent = tabObj.file;
      }
    }

    if (paneId === activePaneId) {
      setActivePane(paneId);
      if (doNotify) {
        const tabObj = tabs.find(t => t.id === sectionId);
        showNotify('Buffer', `Pane ${paneId}: [${tabObj?.file || sectionId}]`, '󰓩');
      }
    }
  }

  function setActivePane(paneId) {
    if (!splitActive) return;
    activePaneId = paneId;

    const pane1 = document.getElementById('nvim-pane-1');
    const pane2 = document.getElementById('nvim-pane-2');

    if (pane1) pane1.classList.toggle('active-pane', paneId === 1);
    if (pane2) pane2.classList.toggle('active-pane', paneId === 2);

    const currentBuffer = paneId === 1 ? pane1Buffer : pane2Buffer;
    const activeTab = tabs.find(t => t.id === currentBuffer);

    // Update statusline file
    const statFile = document.querySelector('.stat-file');
    if (statFile && activeTab) {
      statFile.textContent = activeTab.file;
    }

    // Update active nav-link tab
    if (currentBuffer) {
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${currentBuffer}`);
      });
    }
  }

  function cycleSplitFocus() {
    if (!splitActive) {
      showNotify('Window', 'No split window active to cycle', '󰖲');
      return;
    }
    const nextPaneId = activePaneId === 1 ? 2 : 1;
    setActivePane(nextPaneId);
    showNotify('Window', `Focused Pane ${nextPaneId} (<C-w>w)`, '󰖲');
  }

  function equalizeSplits() {
    if (!splitActive) return;
    const pane1 = document.getElementById('nvim-pane-1');
    const pane2 = document.getElementById('nvim-pane-2');
    if (pane1) pane1.style.flex = '1 1 50%';
    if (pane2) pane2.style.flex = '1 1 50%';
    showNotify('Window', '<C-w>= Splits equalized (50% / 50%)', '󰕰');
  }

  function closeSplit(paneIdToClose = null) {
    if (!splitActive) {
      showNotify('Window', 'close: Only one window exists', '󰅙');
      return;
    }

    const closeTarget = paneIdToClose !== null ? paneIdToClose : activePaneId;
    const remainingPaneId = closeTarget === 1 ? 2 : 1;
    const remainingBuffer = remainingPaneId === 1 ? pane1Buffer : pane2Buffer;

    splitActive = false;
    document.body.classList.remove('nvim-split-active', 'split-vertical', 'split-horizontal');

    const container = document.getElementById('nvim-split-container');
    if (container) {
      container.classList.add('hidden');
      container.innerHTML = '';
    }

    const targetIdx = tabs.findIndex(t => t.id === remainingBuffer);
    if (targetIdx >= 0) {
      goToTab(targetIdx);
    }

    const remainingTab = tabs.find(t => t.id === remainingBuffer);
    showNotify('Window', `Closed split. Active: ${remainingTab?.file || remainingBuffer}`, '󰅙');
  }

  function onlySplit() {
    if (!splitActive) {
      showNotify('Window', 'only: Already only one window', '󰅙');
      return;
    }
    const currentBuffer = activePaneId === 1 ? pane1Buffer : pane2Buffer;
    splitActive = false;
    document.body.classList.remove('nvim-split-active', 'split-vertical', 'split-horizontal');

    const container = document.getElementById('nvim-split-container');
    if (container) {
      container.classList.add('hidden');
      container.innerHTML = '';
    }

    const targetIdx = tabs.findIndex(t => t.id === currentBuffer);
    if (targetIdx >= 0) {
      goToTab(targetIdx);
    }
    showNotify('Window', ':only — kept active window', '󰖲');
  }

  function initSplitEvents() {
    const pane1 = document.getElementById('nvim-pane-1');
    const pane2 = document.getElementById('nvim-pane-2');
    const divider = document.getElementById('nvim-split-divider');

    if (pane1) {
      pane1.addEventListener('click', (e) => {
        if (e.target.closest('.split-btn-equal')) {
          equalizeSplits();
          return;
        }
        if (e.target.closest('.split-btn-close')) {
          closeSplit(1);
          return;
        }
        if (activePaneId !== 1) {
          setActivePane(1);
        }
      });
    }

    if (pane2) {
      pane2.addEventListener('click', (e) => {
        if (e.target.closest('.split-btn-equal')) {
          equalizeSplits();
          return;
        }
        if (e.target.closest('.split-btn-close')) {
          closeSplit(2);
          return;
        }
        if (activePaneId !== 2) {
          setActivePane(2);
        }
      });
    }

    if (divider) {
      initSplitDividerDrag(divider);
    }
  }

  function initSplitDividerDrag(divider) {
    const container = document.getElementById('nvim-split-container');
    const pane1 = document.getElementById('nvim-pane-1');
    const pane2 = document.getElementById('nvim-pane-2');
    if (!container || !pane1 || !pane2 || !divider) return;

    let isDragging = false;

    divider.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isDragging = true;
      divider.classList.add('dragging');
      document.body.style.userSelect = 'none';

      const onPointerMove = (moveEvent) => {
        if (!isDragging) return;
        const rect = container.getBoundingClientRect();
        if (splitDirection === 'vertical') {
          const rawPct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
          const pct = Math.max(15, Math.min(85, rawPct));
          pane1.style.flex = `0 0 ${pct}%`;
          pane2.style.flex = `0 0 ${100 - pct}%`;
        } else {
          const rawPct = ((moveEvent.clientY - rect.top) / rect.height) * 100;
          const pct = Math.max(15, Math.min(85, rawPct));
          pane1.style.flex = `0 0 ${pct}%`;
          pane2.style.flex = `0 0 ${100 - pct}%`;
        }
      };

      const onPointerUp = () => {
        isDragging = false;
        divider.classList.remove('dragging');
        document.body.style.userSelect = '';
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  function initNavClicks() {
    const navLinksContainer = document.querySelector('.nav-links');
    if (navLinksContainer) {
      navLinksContainer.addEventListener('click', (e) => {
        const link = e.target.closest('.nav-link');
        if (!link) return;
        if (splitActive) {
          e.preventDefault();
          const targetId = link.getAttribute('href').replace('#', '');
          setPaneBuffer(activePaneId, targetId);
        }
      });
    }
  }

  document.addEventListener('themechange', () => {
    if (!splitActive) return;
    setTimeout(() => {
      const origCanvas = document.getElementById('dither-canvas');
      if (!origCanvas) return;
      const clonedCanvases = document.querySelectorAll('#nvim-split-container .split-dither-canvas');
      clonedCanvases.forEach(cloned => {
        cloned.width = origCanvas.width;
        cloned.height = origCanvas.height;
        const ctx = cloned.getContext('2d');
        if (ctx) ctx.drawImage(origCanvas, 0, 0);
      });
    }, 100);
  });

  // Track hover word for Telescope <Space>pw
  document.addEventListener('pointerover', (e) => {
    const target = e.target;
    if (target && !target.closest('#which-key-popup') && !target.closest('#nvim-cmdline-popup') && !target.closest('#telescope-modal')) {
      const text = target.innerText || target.textContent || '';
      const words = text.trim().split(/\s+/).filter(w => w.length > 2 && /^[a-zA-Z0-9_-]+$/.test(w));
      if (words.length) {
        lastHoveredWord = words[0];
      }
    }
  });

  // ── Neovim Commandline Popup (:) ────────────────────
  function openCmdline(initialVal = '') {
    closeWhichKey();
    closeTelescope();
    if (!cmdlinePopup || !cmdlineInput) return;

    cmdlinePopup.classList.remove('hidden');
    cmdlineInput.value = initialVal;
    cmdlineInput.focus();
  }

  function closeCmdline() {
    if (!cmdlinePopup) return;
    cmdlinePopup.classList.add('hidden');
    if (cmdlineInput) cmdlineInput.blur();
  }

  function handleCmdlineSubmit(raw) {
    const cmd = raw.trim();
    closeCmdline();
    if (!cmd) return;

    const cleanCmd = cmd.replace(/^:+/, '').trim();
    const parts = cleanCmd.toLowerCase().split(/\s+/);
    const verb = parts[0];

    switch (verb) {
      case 'w':
      case 'write':
        writeBuffer();
        break;

      case 'wq':
      case 'x':
        writeBuffer();
        if (window.PortfolioTerminal && window.PortfolioTerminal.isOpen()) {
          window.PortfolioTerminal.close();
        } else if (splitActive) {
          closeSplit();
        }
        break;

      case 'grep':
      case 'live_grep':
        openTelescope('grep', cleanCmd.slice(verb.length).trim());
        break;

      case 'find':
      case 'files':
        openTelescope('files', cleanCmd.slice(verb.length).trim());
        break;

      case 'nohl':
      case 'nohlsearch':
        clearSearchHighlights();
        break;

      case 'vsplit':
      case 'vsp':
        openSplit('vertical', parts[1] || null);
        break;

      case 'split':
      case 'sp':
        openSplit('horizontal', parts[1] || null);
        break;

      case 'close':
      case 'clo':
        closeSplit();
        break;

      case 'only':
      case 'on':
        onlySplit();
        break;

      case 'terminal':
      case 'term':
        if (window.PortfolioTerminal) {
          window.PortfolioTerminal.open();
          showNotify('Terminal', ':terminal buffer opened', '󰞷');
        }
        break;

      case 'tabn':
      case 'tabnext':
        nextTab();
        break;

      case 'tabp':
      case 'tabprev':
      case 'tabprevious':
        prevTab();
        break;

      case 'tabm':
      case 'tabmove':
        handleTabMoveCmd(parts.slice(1));
        break;

      case 'tabreset':
        resetTabOrder();
        break;

      case 'tabnew':
        showNotify('Tab', 'tabnew: opened scratch buffer', '󰓩');
        break;

      case 'tabclose':
        showNotify('Tab', 'tabclose: cannot close last tab', '󰅙');
        break;

      case 'colorscheme':
      case 'theme':
        if (parts[1] && window.PortfolioTerminal) {
          if (window.PortfolioTerminal.applyTheme(parts[1])) {
            showNotify('Colorscheme', `Applied colorscheme "${parts[1]}" (type :w to save)`, '󰔎');
            markModified();
          } else {
            showNotify('Error', `Unknown theme "${parts[1]}"`, '󰅙');
          }
        } else if (window.PortfolioTerminal) {
          showNotify('Colorscheme', `Current: ${window.PortfolioTerminal.getCurrentTheme()}`, '󰔎');
        }
        break;

      case 'set':
        if (parts[1] === 'theme' && parts[2] && window.PortfolioTerminal) {
          if (window.PortfolioTerminal.applyTheme(parts[2])) {
            showNotify('Colorscheme', `Theme set to "${parts[2]}" (type :w to save)`, '󰔎');
            markModified();
          } else {
            showNotify('Error', `Unknown theme "${parts[2]}"`, '󰅙');
          }
        } else {
          showNotify('Option', `:set ${cleanCmd.slice(4)}`, '󰒓');
        }
        break;

      case 'q':
      case 'quit':
      case 'q!':
        if (window.PortfolioTerminal && window.PortfolioTerminal.isOpen()) {
          window.PortfolioTerminal.close();
        } else if (splitActive) {
          closeSplit();
        } else {
          showNotify('Quit', 'Use browser tab to close window', '󰅙');
        }
        break;

      case 'help':
      case 'h':
        if (window.PortfolioTerminal) {
          window.PortfolioTerminal.open();
          window.PortfolioTerminal.handleCommand('help');
        }
        break;

      default:
        if (window.PortfolioTerminal) {
          window.PortfolioTerminal.open();
          window.PortfolioTerminal.handleCommand(cleanCmd);
        } else {
          showNotify('Error', `Not an editor command: :${cleanCmd}`, '󰅙');
        }
        break;
    }
  }

  function handleTabMoveCmd(args) {
    if (!args || args.length === 0) {
      moveActiveTabTo(tabs.length - 1);
      return;
    }

    const arg = args[0];
    if (arg === '+1' || arg === '>' || arg === 'right' || arg === 'l') {
      moveActiveTab(1);
    } else if (arg === '-1' || arg === '<' || arg === 'left' || arg === 'h') {
      moveActiveTab(-1);
    } else if (arg === 'reset') {
      resetTabOrder();
    } else {
      const pos = parseInt(arg, 10);
      if (!isNaN(pos)) {
        moveActiveTabTo(pos - 1);
      } else {
        showNotify('Error', `Invalid tabmove argument: ${arg}`, '󰅙');
      }
    }
  }

  // ── Which-Key System (<Space> / Leader) ─────────────
  function openWhichKey(submenu = null) {
    closeTelescope();
    closeCmdline();
    if (!whichKeyPopup) return;
    whichKeyActive = true;
    currentSubmenu = submenu;

    resetLeaderTimeout();
    renderWhichKey();
    whichKeyPopup.classList.remove('hidden');
  }

  function closeWhichKey() {
    whichKeyActive = false;
    currentSubmenu = null;
    clearTimeout(leaderTimeout);
    if (whichKeyPopup) {
      whichKeyPopup.classList.add('hidden');
    }
  }

  function resetLeaderTimeout() {
    clearTimeout(leaderTimeout);
    leaderTimeout = setTimeout(() => {
      closeWhichKey();
    }, TIMEOUT_LEN);
  }

  function renderWhichKey() {
    if (!whichKeyPopup) return;

    const data = currentSubmenu ? KEYMAPS.subs[currentSubmenu] : KEYMAPS;
    if (!data) {
      closeWhichKey();
      return;
    }

    const title = data.title || '<leader>';
    const items = data.items || [];

    const itemsHtml = items.map(item => `
      <div class="which-key-item" data-key="${item.key}" role="button" tabindex="0">
        <span class="which-key-key">${escapeHTML(item.key)}</span>
        <span class="which-key-desc">${escapeHTML(item.desc)}</span>
      </div>
    `).join('');

    whichKeyPopup.innerHTML = `
      <div class="which-key-header">
        <span class="which-key-title">${escapeHTML(title)}</span>
        <button type="button" class="which-key-close-btn" aria-label="Close Which-Key">Esc &times;</button>
        <span class="which-key-hint dim">press key or [Esc] to cancel</span>
      </div>
      <div class="which-key-grid">
        ${itemsHtml}
      </div>
    `;

    const closeBtn = whichKeyPopup.querySelector('.which-key-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeWhichKey();
      });
    }

    whichKeyPopup.querySelectorAll('.which-key-item').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = el.getAttribute('data-key');
        handleWhichKeyPress(key);
      });
    });
  }

  function handleWhichKeyPress(key) {
    resetLeaderTimeout();

    // 1. Root leader menu
    if (!currentSubmenu) {
      const match = KEYMAPS.items.find(i => i.key === key);
      if (match) {
        if (match.sub) {
          openWhichKey(match.sub);
          return;
        }
        if (typeof match.action === 'function') {
          closeWhichKey();
          match.action();
          return;
        }
      }
    } else {
      // 2. In submenu
      const sub = KEYMAPS.subs[currentSubmenu];
      if (sub) {
        const match = sub.items.find(i => i.key === key);
        if (match) {
          if (match.sub) {
            openWhichKey(match.sub);
            return;
          }
          if (typeof match.action === 'function') {
            closeWhichKey();
            match.action();
            return;
          }
        }
      }
    }

    closeWhichKey();
  }

  // ── Global Keyboard Listener ────────────────────────
  function isInputActive() {
    const el = document.activeElement;
    return el && (
      el.tagName === 'INPUT' ||
      el.tagName === 'TEXTAREA' ||
      el.tagName === 'SELECT' ||
      el.isContentEditable
    );
  }

  function onGlobalKeyDown(e) {
    // 0. If Telescope picker is active
    if (telescopeActive && telescopeModal && !telescopeModal.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeTelescope();
        return;
      }
      if (e.key === 'ArrowDown' || (e.ctrlKey && (e.key === 'j' || e.key === 'n'))) {
        e.preventDefault();
        selectTelescopeIndex(telescopeSelectedIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp' || (e.ctrlKey && (e.key === 'k' || e.key === 'p'))) {
        e.preventDefault();
        selectTelescopeIndex(telescopeSelectedIndex - 1);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmTelescopeSelection();
        return;
      }
      return; // Let prompt input handle text characters
    }

    // 1. If commandline popup is open
    if (cmdlinePopup && !cmdlinePopup.classList.contains('hidden')) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCmdline();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        autocompleteCmdline();
        return;
      }
      return;
    }

    // 2. If terminal overlay is open, let terminal handle keys
    if (window.PortfolioTerminal && window.PortfolioTerminal.isOpen()) {
      return;
    }

    // 3. Ignore keys if user is typing in any form input
    if (isInputActive()) {
      return;
    }

    // 4. Handle pending <C-w> prefix window commands
    if (ctrlWPending) {
      ctrlWPending = false;
      clearTimeout(ctrlWTimeout);
      e.preventDefault();

      const wk = e.key.toLowerCase();
      if (wk === 'v') {
        openSplit('vertical');
      } else if (wk === 's') {
        openSplit('horizontal');
      } else if (wk === 'w') {
        cycleSplitFocus();
      } else if (wk === 'c' || wk === 'q') {
        closeSplit();
      } else if (e.key === '=') {
        equalizeSplits();
      } else if (wk === 'o') {
        onlySplit();
      } else if (wk === 'h' || e.key === 'ArrowLeft') {
        if (splitActive) setActivePane(1);
      } else if (wk === 'l' || e.key === 'ArrowRight') {
        if (splitActive) setActivePane(2);
      } else if (wk === 'k' || e.key === 'ArrowUp') {
        if (splitActive) setActivePane(1);
      } else if (wk === 'j' || e.key === 'ArrowDown') {
        if (splitActive) setActivePane(2);
      } else if (e.key === 'Escape') {
        showNotify('Window', 'Canceled <C-w>', '󰖲');
      } else {
        showNotify('Window', `Unknown window command: <C-w>${e.key}`, '󰅙');
      }
      return;
    }

    // 5. Intercept <C-w> prefix for window operations
    if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault();
      ctrlWPending = true;
      clearTimeout(ctrlWTimeout);
      ctrlWTimeout = setTimeout(() => {
        ctrlWPending = false;
      }, 2500);
      showNotify('Window', '<C-w> (press: v, s, w, c, =, o, h, l, j, k)', '󰖲');
      return;
    }

    // 6. Normal mode 'g' prefix commands ('gw' for window, 'gt'/'gT' for tabs)
    if (!whichKeyActive && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (gPending) {
        gPending = false;
        clearTimeout(gTimeout);
        if (e.key === 'w') {
          e.preventDefault();
          ctrlWPending = true;
          clearTimeout(ctrlWTimeout);
          ctrlWTimeout = setTimeout(() => {
            ctrlWPending = false;
          }, 2500);
          showNotify('Window', 'gw window command (press: v, s, w, c, =, o, h, l, j, k)', '󰖲');
          return;
        } else if (e.key === 't') {
          e.preventDefault();
          nextTab();
          return;
        } else if (e.key === 'T') {
          e.preventDefault();
          prevTab();
          return;
        }
      } else if (e.key === 'g') {
        gPending = true;
        clearTimeout(gTimeout);
        gTimeout = setTimeout(() => { gPending = false; }, 1200);
        return;
      }
    }

    // 7. Tab move keyboard shortcuts with modifiers
    const k = e.key;
    const c = e.code;
    const isLeft = k === 'ArrowLeft' || k === 'Left' || c === 'ArrowLeft';
    const isRight = k === 'ArrowRight' || k === 'Right' || c === 'ArrowRight';
    const isPageUp = k === 'PageUp' || c === 'PageUp';
    const isPageDown = k === 'PageDown' || c === 'PageDown';

    // A) Combination with Shift + Arrows
    if (e.shiftKey && (isLeft || isRight)) {
      e.preventDefault();
      e.stopPropagation();
      moveActiveTab(isLeft ? -1 : 1);
      return;
    }

    // B) Combination with Alt + Arrows or Ctrl + Arrows
    if ((e.altKey || e.ctrlKey) && (isLeft || isRight)) {
      e.preventDefault();
      e.stopPropagation();
      moveActiveTab(isLeft ? -1 : 1);
      return;
    }

    // C) PageUp / PageDown with modifier
    if ((e.shiftKey || e.ctrlKey || e.altKey) && (isPageUp || isPageDown)) {
      e.preventDefault();
      e.stopPropagation();
      moveActiveTab(isPageUp ? -1 : 1);
      return;
    }

    // 8. Normal Mode single-key navigation (without comma/dot collision)
    // '<' moves tab left, '>' moves tab right (matches vim visual shift)
    // '[' or 'H' moves tab left, ']' or 'L' moves tab right
    if (!whichKeyActive && !e.ctrlKey && !e.altKey && !e.metaKey && !gPending) {
      if (k === '<' || k === '[' || k === 'H') {
        e.preventDefault();
        moveActiveTab(-1);
        return;
      }
      if (k === '>' || k === ']' || k === 'L') {
        e.preventDefault();
        moveActiveTab(1);
        return;
      }
    }

    // 9. Which-Key interaction
    if (whichKeyActive) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeWhichKey();
        return;
      }

      if (e.key.length === 1) {
        e.preventDefault();
        handleWhichKeyPress(e.key);
        return;
      }
    }

    // 10. Leader key trigger: Space
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      openWhichKey();
      return;
    }

    // 11. Neovim Commandline trigger: ':'
    if (e.key === ':') {
      e.preventDefault();
      openCmdline();
      return;
    }
  }

  function autocompleteCmdline() {
    if (!cmdlineInput) return;
    const val = cmdlineInput.value.trim().toLowerCase();
    const suggestions = [
      'terminal', 'tabnext', 'tabprev', 'tabmove +1', 'tabmove -1', 'tabreset',
      'vsplit', 'vsp', 'split', 'sp', 'close', 'only',
      'grep', 'live_grep', 'find', 'nohl',
      'colorscheme green', 'colorscheme amber', 'colorscheme synthwave', 'colorscheme paper',
      'help', 'quit', 'write'
    ];
    const match = suggestions.find(s => s.startsWith(val) && s !== val);
    if (match) {
      cmdlineInput.value = match;
    }
  }

  // ── Init ────────────────────────────────────────────
  function init() {
    cmdlinePopup = document.getElementById('nvim-cmdline-popup');
    cmdlineInput = document.getElementById('nvim-cmdline-input');
    whichKeyPopup = document.getElementById('which-key-popup');
    notifyContainer = document.getElementById('nvim-notify-container');

    telescopeModal = document.getElementById('telescope-modal');
    telescopeInput = document.getElementById('telescope-prompt-input');
    telescopeResultsEl = document.getElementById('telescope-results');
    telescopeCountEl = document.getElementById('telescope-count');
    telescopeTitleEl = document.getElementById('telescope-title-text');
    telescopeModeTag = document.getElementById('telescope-mode-tag');

    initTabOrder();
    initDragAndDrop();
    initNavClicks();

    // Telescope input live search listener
    if (telescopeInput) {
      telescopeInput.addEventListener('input', () => {
        performTelescopeSearch(telescopeInput.value);
      });
    }

    // Hover pause/resume and stop propagation on Which-Key popup
    if (whichKeyPopup) {
      whichKeyPopup.addEventListener('click', (e) => {
        e.stopPropagation();
      });
      whichKeyPopup.addEventListener('mouseenter', () => {
        clearTimeout(leaderTimeout);
      });
      whichKeyPopup.addEventListener('mouseleave', () => {
        if (whichKeyActive) {
          resetLeaderTimeout();
        }
      });
    }

    if (cmdlinePopup) {
      cmdlinePopup.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (telescopeModal) {
      telescopeModal.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    }

    if (cmdlineInput) {
      cmdlineInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCmdlineSubmit(cmdlineInput.value);
        }
      });
    }

    // Mobile touch buttons & statusline interactions
    const mobileSpaceBtn = document.getElementById('mobile-space-btn');
    if (mobileSpaceBtn) {
      mobileSpaceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (whichKeyActive) {
          closeWhichKey();
        } else {
          openWhichKey();
        }
      });
    }

    const mobileCmdBtn = document.getElementById('mobile-cmd-btn');
    if (mobileCmdBtn) {
      mobileCmdBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCmdline(':');
      });
    }

    const statModeBadge = document.getElementById('stat-mode-badge');
    if (statModeBadge) {
      statModeBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (whichKeyActive) {
          closeWhichKey();
        } else {
          openWhichKey();
        }
      });
    }

    // Close on click outside popups
    document.addEventListener('click', (e) => {
      if (cmdlinePopup && !cmdlinePopup.classList.contains('hidden') && !cmdlinePopup.contains(e.target)) {
        closeCmdline();
      }
      if (whichKeyActive && whichKeyPopup && !whichKeyPopup.contains(e.target)) {
        closeWhichKey();
      }
      if (telescopeActive && telescopeModal && !telescopeModal.contains(e.target)) {
        closeTelescope();
      }
    });

    document.addEventListener('keydown', onGlobalKeyDown);

    // Export helpers globally
    window.Nvim = {
      openCmdline,
      closeCmdline,
      openWhichKey,
      closeWhichKey,
      openTelescope,
      closeTelescope,
      openSplit,
      closeSplit,
      equalizeSplits,
      onlySplit,
      cycleSplitFocus,
      setActivePane,
      setPaneBuffer,
      nextTab,
      prevTab,
      goToTab,
      moveActiveTab,
      moveActiveTabTo,
      resetTabOrder,
      applyTabOrder,
      writeBuffer,
      markModified,
      isModified: () => isModified,
      getTabs: () => tabs,
      showNotify,
      clearNotifications,
      clearSearchHighlights
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
