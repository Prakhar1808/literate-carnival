/**
 * nvim.js — Neovim command-line, tab navigation, tab reordering & which-key system
 *
 * Implements:
 * 1. Neovim Commandline (triggered with ':')
 *    - Type 'terminal' to open terminal
 *    - Type 'tabn' / 'tabp' to navigate tabs
 *    - Type 'tabmove +1' / 'tabmove -1' / 'tabm <pos>' to reorder tabs
 *    - Type 'tabreset' to reset order
 *    - Type 'colorscheme <theme>' or 'set theme <theme>'
 *    - Type 'w', 'q', etc.
 * 2. Tab Navigation & Moving
 *    - <Space> + t + p -> previous tab
 *    - <Space> + t + n -> next tab
 *    - <Space> + t + h or <Space> + t + < -> move active tab left
 *    - <Space> + t + l or <Space> + t + > -> move active tab right
 *    - Alt+Shift+Left / Alt+Shift+Right -> move active tab left / right
 *    - Mouse Hold & Drag: click and drag any tab in the navbar to reorder
 *      (immediately reorders the tabs AND the actual sections on screen!)
 * 3. Which-Key System (triggered with <Space> / Leader)
 *    - Displays keymaps defined in /reference/nvim
 * 4. nvim-notify notifications
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

  // ── Keymap Tree (from /reference/nvim) ───────────────
  const KEYMAPS = {
    title: '<leader>',
    items: [
      { key: 't', desc: '+tabs', sub: 'tabs' },
      { key: 's', desc: '+splits', sub: 'splits' },
      { key: 'p', desc: '+telescope', sub: 'telescope' },
      { key: 'c', desc: '+clear', sub: 'clear' },
      { key: 'f', desc: 'Format buffer (LSP)', action: () => formatBuffer() },
      { key: 'fp', desc: 'Copy file path', action: () => copyFilePath() },
      { key: 'r', desc: 'Replace word globally', action: () => showNotify('Replace', ':%s/<cword>/<cword>/gI', '󰑕') },
      { key: 'e', desc: 'MiniFiles explorer', action: () => toggleMiniFiles() },
      { key: 'ths', desc: 'Telescope themes', action: () => switchThemeNext() },
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
          { key: 'o', desc: 'Open new tab (tabnew)', action: () => showNotify('Tab', 'tabnew: Cannot open new buffer (read-only)', '󰓩') },
          { key: 'x', desc: 'Close current tab (tabclose)', action: () => showNotify('Tab', 'tabclose: Cannot close main portfolio buffer', '󰅙') }
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
          { key: 'v', desc: 'Split window vertically', action: () => showNotify('Window', '<C-w>v Split vertical (simulated)', '󰤼') },
          { key: 'h', desc: 'Split window horizontally', action: () => showNotify('Window', '<C-w>s Split horizontal (simulated)', '󰤻') },
          { key: 'e', desc: 'Make splits equal size', action: () => showNotify('Window', '<C-w>= Splits equalized', '󰕰') },
          { key: 'x', desc: 'Close current split', action: () => showNotify('Window', 'close: Only one window exists', '󰅙') }
        ]
      },
      telescope: {
        title: '<leader> p',
        items: [
          { key: 'r', desc: 'Fuzzy find recent files', action: () => showNotify('Telescope', 'Recent files: index.html, themes.css, nvim.js', '󰍉') },
          { key: 'n', desc: 'Fuzzy find notifications', action: () => showNotify('Telescope', 'No history in notification ring', '󰍉') },
          { key: 'Ws', desc: 'Find words under cursor', action: () => showNotify('Telescope', 'grep_string("<cWORD>") executed', '󰍉') }
        ]
      },
      clear: {
        title: '<leader> c',
        items: [
          { key: 'n', desc: 'Clear notifications', action: () => clearNotifications() },
          { key: 'C', desc: 'Clear search highlight', action: () => showNotify('Search', ':nohl Search highlight cleared', '󰱐') }
        ]
      }
    }
  };

  // ── State ──────────────────────────────────────────
  let whichKeyActive = false;
  let currentSubmenu = null;
  let keySequence = '';
  let leaderTimeout = null;
  const TIMEOUT_LEN = 2000;

  // DOM Elements
  let cmdlinePopup, cmdlineInput, whichKeyPopup, notifyContainer;

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
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  // ── Tab Order Management & Website Reordering ────────

  function applyTabOrder(newOrder, notifyMsg = null, shouldScroll = false, activeIdToKeep = null) {
    // Determine which tab should be active
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
          navLinksContainer.appendChild(link); // Moves to end in specified order
        }
      });
    }

    // 2. Reorder <section> elements in <main> so website content updates on screen!
    if (main) {
      tabs.forEach((tab) => {
        const section = document.getElementById(tab.id);
        if (section) {
          if (siteFooter) {
            main.insertBefore(section, siteFooter);
          } else {
            main.appendChild(section);
          }
          // Flash animation to indicate order change
          section.classList.remove('section-reordered');
          void section.offsetWidth; // Reflow
          section.classList.add('section-reordered');
        }
      });
    }

    // 3. Persist order in localStorage
    try {
      localStorage.setItem('ps-tab-order', JSON.stringify(tabs.map(t => t.id)));
    } catch (e) {
      // Ignored if storage disabled
    }

    // 4. Update statusline current file
    const statFile = document.querySelector('.stat-file');
    if (statFile && activeId) {
      const activeTabObj = tabs.find(t => t.id === activeId);
      if (activeTabObj) statFile.textContent = activeTabObj.file;
    }

    // 5. Scroll active section into view if requested
    if (shouldScroll && activeId) {
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
          // Add any missing default tabs
          DEFAULT_TABS.forEach(t => {
            if (!reordered.find(r => r.id === t.id)) reordered.push(t);
          });
          applyTabOrder(reordered, null, false);
          return;
        }
      }
    } catch (e) {
      // Fallback to default
    }
    applyTabOrder(DEFAULT_TABS, null, false);
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

    applyTabOrder(newTabs, `Moved "${movedTab.file}" to position ${targetIdx + 1}`, true, movedTab.id);
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

    applyTabOrder(newTabs, `Moved "${movedTab.file}" to position ${bounded + 1}`, true, movedTab.id);
  }

  function resetTabOrder() {
    try {
      localStorage.removeItem('ps-tab-order');
    } catch (e) {}
    applyTabOrder(DEFAULT_TABS, 'Reset tabs to original order', true);
  }

  // ── Drag & Drop (Hold and Move Tabs) ────────────────

  function initDragAndDrop() {
    const container = document.querySelector('.nav-links');
    if (!container) return;

    let draggedTabId = null;

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
      if (draggedTabId === targetId) return;

      const rect = targetLink.getBoundingClientRect();
      const midX = rect.left + rect.width / 2;
      const insertAfter = e.clientX >= midX;

      const currentOrder = [...tabs];
      const sourceIdx = currentOrder.findIndex(t => t.id === draggedTabId);
      if (sourceIdx < 0) return;

      const [movedTab] = currentOrder.splice(sourceIdx, 1);
      let targetIdx = currentOrder.findIndex(t => t.id === targetId);
      if (insertAfter) {
        targetIdx += 1;
      }
      currentOrder.splice(targetIdx, 0, movedTab);

      applyTabOrder(currentOrder, `Moved "${movedTab.file}" to position ${targetIdx + 1}`, false);
      draggedTabId = null;
    });

    container.addEventListener('dragend', () => {
      container.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('is-dragging', 'drag-target-left', 'drag-target-right');
      });
      draggedTabId = null;
    });
  }

  // ── Tab Navigation ──────────────────────────────────

  function getCurrentTabIndex() {
    const activeLink = document.querySelector('.nav-link.active');
    if (!activeLink) return 0;
    const href = activeLink.getAttribute('href').replace('#', '');
    const idx = tabs.findIndex(t => t.id === href);
    return idx >= 0 ? idx : 0;
  }

  function goToTab(index) {
    const boundedIdx = (index + tabs.length) % tabs.length;
    const target = tabs[boundedIdx];
    const targetEl = document.getElementById(target.id);

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${target.id}`);
      });

      // Update active file in statusline
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
      showNotify('Colorscheme', `Theme switched to "${newTheme}"`, '󰔎');
    }
  }

  // ── Neovim Commandline Popup (:) ────────────────────
  function openCmdline(initialVal = '') {
    closeWhichKey();
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

    // Strip optional leading colon
    const cleanCmd = cmd.replace(/^:+/, '').trim();
    const parts = cleanCmd.toLowerCase().split(/\s+/);
    const verb = parts[0];

    switch (verb) {
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
            showNotify('Colorscheme', `Applied colorscheme "${parts[1]}"`, '󰔎');
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
            showNotify('Colorscheme', `Theme set to "${parts[2]}"`, '󰔎');
          } else {
            showNotify('Error', `Unknown theme "${parts[2]}"`, '󰅙');
          }
        } else {
          showNotify('Option', `:set ${cleanCmd.slice(4)}`, '󰒓');
        }
        break;

      case 'w':
      case 'write':
        showNotify('Write', '"index.html" [w] written', '󰆓');
        break;

      case 'q':
      case 'quit':
      case 'q!':
        if (window.PortfolioTerminal && window.PortfolioTerminal.isOpen()) {
          window.PortfolioTerminal.close();
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
        // If unknown, pass to terminal emulator
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
      // Default :tabmove moves active tab to end
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
        moveActiveTabTo(pos - 1); // 1-based to 0-based
      } else {
        showNotify('Error', `Invalid tabmove argument: ${arg}`, '󰅙');
      }
    }
  }

  // ── Which-Key System (<Space> / Leader) ─────────────
  function openWhichKey(submenu = null) {
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
    keySequence = '';
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

    let itemsHtml = items.map(item => `
      <div class="which-key-item" data-key="${item.key}" role="button" tabindex="0">
        <span class="which-key-key">${item.key}</span>
        <span class="which-key-desc">${escapeHTML(item.desc)}</span>
      </div>
    `).join('');

    whichKeyPopup.innerHTML = `
      <div class="which-key-header">
        <span class="which-key-title">${title}</span>
        <span class="which-key-hint dim">press key or [Esc] to cancel</span>
      </div>
      <div class="which-key-grid">
        ${itemsHtml}
      </div>
    `;

    // Make items clickable
    whichKeyPopup.querySelectorAll('.which-key-item').forEach(el => {
      el.addEventListener('click', () => {
        const key = el.getAttribute('data-key');
        handleWhichKeyPress(key);
      });
    });
  }

  function handleWhichKeyPress(key) {
    resetLeaderTimeout();

    // In root leader mode
    if (!currentSubmenu) {
      if (key === 't') {
        openWhichKey('tabs');
        return;
      }
      if (key === 's') {
        openWhichKey('splits');
        return;
      }
      if (key === 'p') {
        openWhichKey('telescope');
        return;
      }
      if (key === 'c') {
        openWhichKey('clear');
        return;
      }

      // Check for direct actions
      const match = KEYMAPS.items.find(i => i.key === key);
      if (match && typeof match.action === 'function') {
        closeWhichKey();
        match.action();
        return;
      }
    } else {
      // In submenu (e.g. 'tabs')
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

    // If key not handled, dismiss
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
      return; // Let cmdlineInput handle text
    }

    // 2. If terminal overlay is open, only listen for Escape
    if (window.PortfolioTerminal && window.PortfolioTerminal.isOpen()) {
      return;
    }

    // 3. Ignore keys if user is typing in any input
    if (isInputActive()) {
      return;
    }

    // 4. Tab move keyboard shortcuts
    const k = e.key;
    const c = e.code;
    const isLeft = k === 'ArrowLeft' || k === 'Left' || c === 'ArrowLeft';
    const isRight = k === 'ArrowRight' || k === 'Right' || c === 'ArrowRight';
    const isPageUp = k === 'PageUp' || c === 'PageUp';
    const isPageDown = k === 'PageDown' || c === 'PageDown';

    // A) Combination with Shift + Arrows (e.g. Shift+Left, Alt+Shift+Left, Ctrl+Shift+Left)
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

    // C) PageUp / PageDown with any modifier (Shift / Ctrl / Alt)
    if ((e.shiftKey || e.ctrlKey || e.altKey) && (isPageUp || isPageDown)) {
      e.preventDefault();
      e.stopPropagation();
      moveActiveTab(isPageUp ? -1 : 1);
      return;
    }

    // D) Normal Mode single-key shortcuts (when Which-Key is NOT open and no modifier held):
    // '<' moves tab left, '>' moves tab right (matches vim visual shift)
    // '[' or 'H' moves tab left, ']' or 'L' moves tab right
    if (!whichKeyActive && !e.ctrlKey && !e.altKey && !e.metaKey) {
      if (k === '<' || k === ',' || k === '[' || k === 'H') {
        e.preventDefault();
        moveActiveTab(-1);
        return;
      }
      if (k === '>' || k === '.' || k === ']' || k === 'L') {
        e.preventDefault();
        moveActiveTab(1);
        return;
      }
    }

    // 5. Which-Key interaction
    if (whichKeyActive) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeWhichKey();
        return;
      }

      // Handle which-key keys
      if (e.key.length === 1) {
        e.preventDefault();
        handleWhichKeyPress(e.key);
        return;
      }
    }

    // 6. Leader key trigger: Space
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      openWhichKey();
      return;
    }

    // 7. Neovim Commandline trigger: ':'
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

    initTabOrder();
    initDragAndDrop();

    if (cmdlineInput) {
      cmdlineInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCmdlineSubmit(cmdlineInput.value);
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
    });

    document.addEventListener('keydown', onGlobalKeyDown);

    // Export helpers globally
    window.Nvim = {
      openCmdline,
      closeCmdline,
      openWhichKey,
      closeWhichKey,
      nextTab,
      prevTab,
      goToTab,
      moveActiveTab,
      moveActiveTabTo,
      resetTabOrder,
      applyTabOrder,
      getTabs: () => tabs,
      showNotify,
      clearNotifications
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
