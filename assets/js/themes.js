/**
 * themes.js — Theme engine + terminal command palette
 *
 * Themes:  green | amber | synthwave | paper
 * Storage: localStorage key 'ps-theme'
 *
 * Keybinding: press '/' to open palette, Escape to close.
 * Commands:
 *   help                  — list commands
 *   set theme <name>      — switch theme
 *   ls                    — list sections
 *   ls <section>          — scroll to section
 *   clear                 — clear output
 *   whoami                — print a fun fact
 *   uname                 — print system info
 *   exit / q              — close palette
 */

(function () {
  'use strict';

  const THEMES       = ['paper', 'green', 'amber', 'synthwave'];
  const STORAGE_KEY  = 'ps-theme';
  const DEFAULT      = 'paper';

  const SECTIONS = {
    about:    '#about',
    skills:   '#skills',
    projects: '#projects',
    hobbies:  '#hobbies',
    contact:  '#contact',
  };

  // ── State ───────────────────────────────────────
  let currentTheme = localStorage.getItem(STORAGE_KEY) || DEFAULT;
  let historyIdx   = -1;
  const cmdHistory = [];

  // ── DOM refs (resolved after DOMContentLoaded) ──
  let overlay, panel, output, input, themeBtn;

  // ── Theme engine ─────────────────────────────────

  function applyTheme(name, saveToStorage = false, notifyModified = true) {
    if (!THEMES.includes(name)) return false;
    currentTheme = name;
    document.documentElement.setAttribute('data-theme', name);
    if (saveToStorage) {
      try {
        localStorage.setItem(STORAGE_KEY, name);
      } catch (e) {}
    }
    document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: name } }));
    if (themeBtn) themeBtn.textContent = `[${name}]`;
    if (notifyModified && window.Nvim && typeof window.Nvim.markModified === 'function') {
      window.Nvim.markModified();
    }
    return true;
  }

  function cycleTheme() {
    const idx  = THEMES.indexOf(currentTheme);
    const next = THEMES[(idx + 1) % THEMES.length];
    applyTheme(next, false, true);
  }

  // ── Command palette ───────────────────────────────

  function openPalette() {
    overlay.classList.remove('hidden');
    input.focus();
  }

  function closePalette() {
    overlay.classList.add('hidden');
    input.blur();
  }

  function togglePalette() {
    if (overlay.classList.contains('hidden')) openPalette();
    else closePalette();
  }

  function appendOutput(text, cls = 'out-line') {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
  }

  function appendHTML(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    output.appendChild(div);
    output.scrollTop = output.scrollHeight;
  }

  function echoCmd(cmd) {
    appendOutput(`$ ${cmd}`, 'out-cmd');
  }

  // ── Command handlers ──────────────────────────────

  const HELP_TEXT = [
    '  set theme <name>   — switch theme: green | amber | synthwave | paper',
    '  ls                 — list all sections',
    '  ls <section>       — jump to section (about|skills|projects|hobbies|contact)',
    '  whoami             — who is this?',
    '  uname              — system info',
    '  clear              — clear this output',
    '  exit / q           — close palette',
    '  help               — show this message',
  ];

  function handleCommand(raw) {
    const cmd   = raw.trim();
    if (!cmd) return;

    // history
    if (cmdHistory[0] !== cmd) cmdHistory.unshift(cmd);
    if (cmdHistory.length > 40) cmdHistory.pop();
    historyIdx = -1;

    echoCmd(cmd);
    const parts = cmd.toLowerCase().split(/\s+/);
    const verb  = parts[0];

    switch (verb) {

      case 'help':
        appendOutput('Available commands:', 'out-acc');
        HELP_TEXT.forEach(l => appendOutput(l));
        break;

      case 'set':
        if (parts[1] === 'theme') {
          const name = parts[2];
          if (!name) {
            appendOutput(`Current theme: ${currentTheme}`, 'out-acc');
            appendOutput(`Available: ${THEMES.join(' | ')}`);
          } else if (applyTheme(name)) {
            appendOutput(`Theme set to [${name}]`, 'out-acc');
          } else {
            appendOutput(`Unknown theme: "${name}". Try: ${THEMES.join(' | ')}`, 'out-err');
          }
        } else {
          appendOutput(`Unknown setting. Try: set theme <name>`, 'out-err');
        }
        break;

      case 'ls': {
        const target = parts[1];
        if (!target) {
          appendOutput('Sections:', 'out-acc');
          Object.keys(SECTIONS).forEach(s => appendOutput(`  /${s}`));
        } else if (SECTIONS[target]) {
          appendOutput(`Navigating to /${target}...`, 'out-acc');
          setTimeout(() => {
            document.querySelector(SECTIONS[target])
              ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            closePalette();
          }, 300);
        } else {
          appendOutput(`Section not found: "${target}"`, 'out-err');
          appendOutput(`Try: ${Object.keys(SECTIONS).join(' | ')}`);
        }
        break;
      }

      case 'whoami':
        appendOutput('Prakhar Sharma', 'out-acc');
        appendOutput('  B.Tech CSE AIML student @ DTC, Greater Noida');
        appendOutput('  Linux nerd · ML aspirant · gamer');
        appendOutput('  Currently seeking: Machine Learning Internship');
        break;

      case 'uname':
        appendOutput('PrakharOS 1.0 (arch-based-btw)', 'out-acc');
        appendOutput(`  Kernel:    Linux`);
        appendOutput(`  Stack:     Python · C/C++ · Rust · JS`);
        appendOutput(`  Shell:     /bin/fish (obviously)`);
        appendOutput(`  Uptime:    ${Math.floor(Math.random() * 300) + 50} days, ${Math.floor(Math.random()*24)}h`);
        break;

      case 'clear':
        output.innerHTML = '';
        break;

      case 'exit':
      case 'q':
        appendOutput('bye.', 'out-acc');
        setTimeout(closePalette, 400);
        break;

      case 'sudo':
        appendOutput(`[sudo] password for prakhar: `, 'out-acc');
        setTimeout(() => appendOutput('sudo: you are not in the sudoers file. This incident will be reported.', 'out-err'), 800);
        break;

      case 'rm':
        if (parts.includes('-rf') || parts.includes('-rf/')) {
          appendOutput('Nice try. :)', 'out-err');
        } else {
          appendOutput(`rm: cannot remove '${parts[1] || ''}': Permission denied`, 'out-err');
        }
        break;

      case 'vim':
      case 'nvim':
        appendOutput('Opening vim... (good luck exiting)', 'out-acc');
        setTimeout(() => appendOutput('[Normal] -- Press :wq to exit (you probably knew that)', 'out-line'), 600);
        break;

      default:
        appendOutput(`command not found: ${verb}`, 'out-err');
        appendOutput(`Type 'help' for available commands.`);
    }
  }

  // ── Keyboard handling ─────────────────────────────

  function onKeyDown(e) {
    if (overlay.classList.contains('hidden')) return;

    if (e.key === 'Escape') {
      closePalette();
      return;
    }
  }

  function onInputKeyDown(e) {
    if (e.key === 'Enter') {
      const val = input.value.trim();
      input.value = '';
      if (val) handleCommand(val);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      historyIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      if (cmdHistory[historyIdx] !== undefined) {
        input.value = cmdHistory[historyIdx];
        // Move cursor to end
        setTimeout(() => input.setSelectionRange(9999, 9999), 0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      historyIdx = Math.max(historyIdx - 1, -1);
      input.value = historyIdx >= 0 ? cmdHistory[historyIdx] : '';
      return;
    }

    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      const val  = input.value.toLowerCase().trim();
      const cmds = ['help', 'set theme ', 'ls ', 'clear', 'whoami', 'uname', 'exit'];
      const themeCompletions = THEMES.map(t => `set theme ${t}`);
      const sectionCompletions = Object.keys(SECTIONS).map(s => `ls ${s}`);
      const all = [...cmds, ...themeCompletions, ...sectionCompletions];
      const match = all.find(c => c.startsWith(val) && c !== val);
      if (match) {
        input.value = match;
        input.setSelectionRange(9999, 9999);
      }
    }
  }

  // ── Init ──────────────────────────────────────────

  function init() {
    overlay  = document.getElementById('cmd-overlay');
    panel    = document.getElementById('cmd-panel');
    output   = document.getElementById('cmd-output');
    input    = document.getElementById('cmd-input');
    themeBtn = document.getElementById('theme-toggle');

    if (!overlay || !input) return;

    // Apply saved/default theme (without marking modified)
    applyTheme(currentTheme, false, false);

    // Theme cycle button
    if (themeBtn) {
      themeBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        cycleTheme();
      });
    }

    // Click outside palette to close
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closePalette();
    });

    // Input handlers
    input.addEventListener('keydown', onInputKeyDown);
    document.addEventListener('keydown', onKeyDown);

    // Welcome message in output
    appendOutput('Portfolio Terminal — type \'help\' for commands', 'out-acc');
    appendOutput('Press Escape or click outside to close.');

    // Programmatic API for Neovim commands & keymaps
    window.PortfolioTerminal = {
      open: openPalette,
      close: closePalette,
      isOpen: () => overlay && !overlay.classList.contains('hidden'),
      applyTheme: (name, save = false) => applyTheme(name, save, true),
      cycleTheme: cycleTheme,
      getThemes: () => THEMES,
      getCurrentTheme: () => currentTheme,
      saveThemeToStorage: () => {
        try {
          localStorage.setItem(STORAGE_KEY, currentTheme);
          return true;
        } catch (e) {
          return false;
        }
      },
      handleCommand: handleCommand,
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
