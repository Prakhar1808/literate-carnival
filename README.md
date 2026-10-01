# my Portfolio

Personal portfolio site for [satyanveshi.xyz](https://satyanveshi.xyz).

Built with pure **HTML + CSS + vanilla JS** — no build step, no dependencies, GitHub Pages ready.
for anyone who to wants know more about this and maybe even make one for themselves

## Stack

| Layer | Tech |
|---|---|
| Markup | HTML5 |
| Styles | CSS3 (custom properties, grid, animations) |
| Logic | Vanilla JS (ES6+, no frameworks) |
| Fonts | JetBrains Mono via Google Fonts |
| Hosting | GitHub Pages + custom domain (`satyanveshi.xyz`) |


## Project Structure

```
.
├── index.html                              # Single-page site
├── CNAME                                   # Custom domain
├── favicon.ico                             # Multi-res browser favicon (16/32/48)
├── resume_prakhar.pdf
├── assets/
│   ├── css/
│   │   ├── themes.css      # 4 colour theme definitions
│   │   ├── base.css        # Reset, layout, scanlines, utilities
│   │   └── components.css  # Nav, hero, skills, cards, palette
│   ├── js/
│   │   ├── dither.js       # Floyd-Steinberg canvas ditherer
│   │   ├── themes.js       # Theme engine + terminal palette
│   │   ├── main.js         # Typewriter, scroll-spy, skill bars
│   │   └── nvim.js         # Neovim cmdline (:), Which-Key (<Space>), tabs
│   └── img/
│       ├── apple.png       # Original favicon source
│       ├── apple-touch-icon.png # Touch icon (180x180)
│       ├── favicon-32x32.png    # PNG favicon (32x32)
│       ├── favicon-16x16.png    # PNG favicon (16x16)
│       └── me.webp         # ← Photo (converted via cwebp)
└── README.md
```


## Colour Themes

Press the `[theme]` button in the statusline, or press `:` and type `colorscheme <name>` (or `<Space>ths`).

| Theme | BG | Accent | Vibe |
|---|---|---|---|
| `paper` | `#faf7f0` | `#b03020` | College-ruled notebook page (default) |
| `green` | `#0a0f0a` | `#39ff14` | Green phosphor CRT |
| `amber` | `#0f0a00` | `#ff9900` | Amber CRT monitor |
| `synthwave` | `#0d0017` | `#bf00ff` | Neon purple/synthwave |

Theme choice is saved to `localStorage` and persists on reload.

---

## Neovim Keymaps & Controls
The portfolio operates with authentic **Neovim modal ergonomics** and keybindings sourced from my Neovim configuration:

### Which-Key Leader Keymaps (`<Space>`)

Press <kbd>Space</kbd> anywhere on the page to open the **Which-Key** popup:

| Keybinding | Action | Neovim Origin / Description |
|---|---|---|
| `<Space>tn` | Move to next tab | `:tabn` (Next buffer / section) |
| `<Space>tp` | Move to previous tab | `:tabp` (Previous buffer / section) |
| `<Space>th` or `<Space>t<` | Move active tab **left** in order | `:tabmove -1` (Live section swap) |
| `<Space>tl` or `<Space>t>` | Move active tab **right** in order | `:tabmove +1` (Live section swap) |
| `<Space>to` | Open new tab | `:tabnew` (Simulated buffer) |
| `<Space>tx` | Close tab | `:tabclose` |
| `<Space>tmr` | Reset tab order | Reset layout to original defaults (mark `[+]`) |
| `<Space>sv` | Split window vertically | Real `:vsp` side-by-side split |
| `<Space>sh` | Split window horizontally | Real `:sp` top/bottom split |
| `<Space>sw` | Switch focus between splits | Focus other window (`<C-w>w` / `gww`) |
| `<Space>se` | Equalize split sizes | Equal 50%/50% panes (`<C-w>=` / `gw=`) |
| `<Space>sx` | Close active split window | Closes active pane (`:close` / `<C-w>c` / `gwc`) |
| `<Space>so` | Only keep active split | Maximizes active pane (`:only` / `<C-w>o` / `gwo`) |
| `<Space>fw` | Save / write buffer (:w) | **Persist tab layout & theme to localStorage** (clears `[+]`) |
| `<Space>ff` | Format buffer with LSP | `vim.lsp.buf.format` |
| `<Space>fp` | Copy current file path / URL | `vim.fn.setreg('+', filePath)` |
| `<Space>pw` | Telescope grep word under cursor | **Real live grep** for selected/hovered word across all buffers |
| `<Space>pg` | Telescope live grep | Open interactive live grep finder modal across buffers |
| `<Space>pf` | Telescope find files | Open interactive fuzzy file finder modal (:find) |
| `<Space>pr` | Telescope recent files | Recent files / buffers |
| `<Space>pn` | Telescope notifications | Notification history |
| `<Space>pt` | Telescope colorschemes | Cycle colorscheme |
| `<Space>Tn` / `Tp` / `Tg` / `Ta` / `Ts` | Direct Theme Picker | Switch theme (`paper`, `green`, `amber`, `synthwave`) |
| `<Space>r` | Replace word globally | `:%s/<cword>/<cword>/gI` |
| `<Space>e` | Open MiniFiles explorer | `MiniFiles.open()` |
| `<Space>cn` | Clear all notifications | `require('notify').dismiss()` |
| `<Space>ch` | Clear search highlights | Clear `.search-target-flash` (`:nohl`) |
| `<Space>:` | Open Neovim commandline | `: ` commandline prompt |
| `<Esc>` | Dismiss Which-Key | Close popup |


### Global Keyboard Shortcuts

| Shortcut | Action | Notes |
|---|---|---|
| <kbd>:</kbd> | Open Neovim commandline | Ex-commands (`:w`, `:vsp`, `:sp`, `:grep`, `:close`, `:only`, etc.) |
| <kbd>Space</kbd> | Open Which-Key menu | Interactive leader keymap viewer (extended timeout + hover pause) |
| <kbd>Ctrl</kbd>+<kbd>w</kbd> or <kbd>gw</kbd> | Window split prefix | Follow with <kbd>v</kbd>, <kbd>s</kbd>, <kbd>w</kbd>, <kbd>c</kbd>, <kbd>=</kbd>, <kbd>o</kbd>, <kbd>h</kbd>, <kbd>l</kbd> |
| <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | Move active tab & section left / right | Single modifier, works on all platforms |
| <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | Move active tab & section left / right | Classic IDE shortcut |
| <kbd>Alt</kbd> + <kbd>←</kbd> / <kbd>→</kbd> | Move active tab & section left / right | Standard tab mover |
| <kbd>&lt;</kbd> / <kbd>&gt;</kbd> | Move active tab & section left / right | Vim visual shift normal mode |
| <kbd>H</kbd> / <kbd>L</kbd> | Move active tab & section left / right | Vim left/right normal mode |
| <kbd>[</kbd> / <kbd>]</kbd> | Move active tab & section left / right | Buffer navigation normal mode |
| <kbd>g</kbd><kbd>t</kbd> / <kbd>g</kbd><kbd>T</kbd> | Jump to next / previous buffer | Standard Vim tab jump |
| <kbd>Shift</kbd> + <kbd>PageUp</kbd> / <kbd>PageDown</kbd> | Move active tab & section left / right | Page-step tab moving |
| <kbd>Esc</kbd> | Dismiss popup, Which-Key or cmdline | Returns to normal mode |


### Command Line (`:`)

Press <kbd>:</kbd> to open the Neovim commandline. Supports <kbd>Tab</kbd> auto-completion:

| Command | Action |
|---|---|
| `:w` or `:write` | **Write buffer to localStorage** (persists tab order & theme, turns `[+]` into `[RO]`) |
| `:wq` or `:x` | Write buffer and close terminal / split |
| `:grep <query>` or `:live_grep` | Open Telescope live grep modal across all buffers |
| `:find <file>` or `:files` | Open Telescope find files modal |
| `:nohl` or `:nohlsearch` | Clear search highlight glow from elements |
| `:vsplit` or `:vsp [tab]` | Open vertical split window side-by-side |
| `:split` or `:sp [tab]` | Open horizontal split window top/bottom |
| `:close` or `:clo` | Close active split window (or `:q` in split) |
| `:only` or `:on` | Maximize active split window, closing others |
| `:terminal` or `:term` | Open the interactive terminal shell |
| `:tabn` / `:tabnext` | Jump to the next tab (in split mode: changes active pane buffer) |
| `:tabp` / `:tabprev` | Jump to the previous tab |
| `:tabmove +1` / `:tabm +1` / `:tabm >` | Move current tab & section to the right |
| `:tabmove -1` / `:tabm -1` / `:tabm <` | Move current tab & section to the left |
| `:tabmove <1-5>` / `:tabm <1-5>` | Move current tab directly to 1-based index |
| `:tabreset` | Reset tabs & page layout to default (type `:w` to persist) |
| `:colorscheme <theme>` or `:theme <name>` | Switch theme (`green`, `amber`, `synthwave`, `paper`) |
| `:w` | Write buffer simulation |
| `:q` / `:quit` / `:exit` | Close split window, terminal, or dismiss commandline |
| `:help` / `:h` | Open terminal with help commands |


### Tab Reordering (Drag & Drop)

- **Hold and Move**: Click and drag any tab in the navbar (`about.md`, `skills.sh`, `projects.rs`, `hobbies.txt`, `contact.cfg`).
- Dropping the tab reorders the tabline **and physically reorders the `<section>` elements in the DOM on screen**.
- Custom tab orders persist automatically in `localStorage`.


### Dragon Scrollbar

- The ASCII dragon on the right margin serves as the **draggable scrollbar thumb**.
- Drag the dragon up and down to glide and scroll through the page with zero latency.
- Click anywhere on the vertical guide pole track to jump straight to that scroll position.
- Flaps wings with rapid energy (90ms) while scrolling or dragging, settling into a gentle glide (320ms) when idle.


## Terminal Shell

Open via `:` then typing `terminal` (or via `<Space>:`).

```
$ help
```

| Command | Description |
|---|---|
| `set theme <name>` | Switch theme: `green \| amber \| synthwave \| paper` |
| `ls` | List sections |
| `ls <section>` | Jump to a section |
| `whoami` | Print info about Prakhar |
| `uname` | Print "system" info |
| `clear` | Clear output |
| `exit` / `q` | Close palette |

Arrow keys navigate command history. **Tab** auto-completes commands.

---

## Adding Your Photo

Drop a file named `me.webp` into `assets/img/`. You can convert any photo using `cwebp`:

```bash
cwebp -q 90 photo.jpg -o assets/img/me.webp
```

The site will automatically:

1. Load and dither it using the Floyd-Steinberg algorithm
2. Render it in the active theme's accent colour (or hand-drawn ink stipple on paper theme)
3. Re-render when the theme changes

Without a photo, a `>_` placeholder is shown.

### Customizing Dither per Theme

You can fine-tune dithering in `assets/css/themes.css` under each `[data-theme="..."]` block:

| Variable | Description | Default |
|---|---|---|
| `--dither-bg` | Background behind the dots (`var(--bg)`, `transparent`, or hex) | `var(--bg)` / `transparent` |
| `--dither-fg` | Dot foreground color (`var(--accent)`, `var(--fg)`, or hex) | `var(--accent)` / `var(--fg)` |
| `--dither-invert` | `0` = phosphor glow on highlights; `1` = ink mode for shadows/hair | `0` (`1` on paper) |
| `--dither-threshold` | Midtone cutoff threshold (`0`–`255`) | `128` |
| `--dither-contrast` | Contrast multiplier (`>1.0` punchier, `<1.0` softer) | `1.0` |
| `--dither-brightness` | Brightness offset (`-100` to `100`) | `0` |


## Adding Projects

Edit the `.project-card` blocks in `index.html`. Each card has:
- `project-card-title` — name (shown in the terminal titlebar)
- `project-card-desc` — description
- `project-card-tags` — `<span class="tag">` elements
- `project-card-links` — links to GitHub, live demo, etc.
- `wip-badge` — add `<span class="wip-badge">WIP</span>` inside `.project-card-header` if in progress

---

## GitHub Pages Setup

1. Go to repo **Settings → Pages**
2. Set source to `Deploy from branch` → `main` → `/ (root)`
3. Add `satyanveshi.xyz` as the custom domain
4. In your domain registrar's DNS, add `A` records pointing to GitHub's IPs:
   ```
   185.199.108.153
   185.199.109.153
   185.199.110.153
   185.199.111.153
   ```
5. Add a `CNAME` record: `www → Prakhar1808.github.io`


## Running Locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Or with `live-server` if you have Node:

```bash
npx live-server
```

---

## License

MIT — feel free to fork and adapt.
