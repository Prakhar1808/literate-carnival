/**
 * dither.js — Floyd-Steinberg canvas ditherer
 *
 * - If /assets/img/me.webp exists, fetch it, dither it in the active theme's
 *   accent + bg colors, and render to #dither-canvas.
 * - If no photo is found, draw a stylised ">_" ASCII placeholder.
 * - Re-renders automatically when the theme changes (listens for
 *   'themechange' custom event dispatched by themes.js).
 */

(function () {
  'use strict';

  const CANVAS_W = 260;
  const CANVAS_H = 320;
  const IMG_SRC  = 'assets/img/me.webp';

  // Reusable 1x1 canvas for robust parsing of ANY CSS color format (hex, rgb, hsl, named, etc.)
  let _colorCanvas = null;
  let _colorCtx = null;

  /** Parse any CSS colour string → [r, g, b, a] */
  function parseColor(str) {
    if (!str || str === 'transparent') return [0, 0, 0, 0];
    if (!_colorCanvas) {
      _colorCanvas = document.createElement('canvas');
      _colorCanvas.width = 1;
      _colorCanvas.height = 1;
      _colorCtx = _colorCanvas.getContext('2d', { willReadFrequently: true });
    }
    _colorCtx.clearRect(0, 0, 1, 1);
    _colorCtx.fillStyle = str;
    _colorCtx.fillRect(0, 0, 1, 1);
    const d = _colorCtx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }

  /** Read a CSS custom property from :root */
  function cssVar(name) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
  }

  /**
   * Floyd-Steinberg dither.
   * Converts imageData to 2-tone using bgRgba and fgRgba.
   * Supports custom threshold, contrast, and brightness offsets.
   * Returns a new ImageData.
   */
  function floydSteinberg(imageData, width, height, bgRgba, fgRgba, invert, threshold = 128, brightness = 0, contrast = 1.0) {
    // Work on a Float32 copy so error accumulation is precise
    const src = new Float32Array(width * height);

    // Greyscale pass with brightness & contrast adjustments
    for (let i = 0; i < width * height; i++) {
      const off = i * 4;
      let gray = 0.299 * imageData.data[off]
               + 0.587 * imageData.data[off + 1]
               + 0.114 * imageData.data[off + 2];

      if (contrast !== 1.0) {
        gray = ((gray - 128) * contrast) + 128;
      }
      if (brightness !== 0) {
        gray += brightness;
      }
      src[i] = Math.max(0, Math.min(255, gray));
    }

    // Dithering pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const old = src[idx];
        const nw  = old < threshold ? 0 : 255;
        const err = old - nw;
        src[idx]  = nw;

        if (x + 1 < width)              src[idx + 1]         += err * (7 / 16);
        if (y + 1 < height) {
          if (x > 0)                    src[idx + width - 1] += err * (3 / 16);
                                        src[idx + width]     += err * (5 / 16);
          if (x + 1 < width)            src[idx + width + 1] += err * (1 / 16);
        }
      }
    }

    // Write to output ImageData
    const out = new ImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const off = i * 4;
      const isDark = src[i] < threshold;
      const useFg = invert ? isDark : !isDark;
      const rgba = useFg ? fgRgba : bgRgba;
      
      out.data[off]     = rgba[0];
      out.data[off + 1] = rgba[1];
      out.data[off + 2] = rgba[2];
      out.data[off + 3] = rgba[3];
    }
    return out;
  }

  /** Draw placeholder ">_" art when no photo is available */
  function drawPlaceholder(canvas) {
    const ctx  = canvas.getContext('2d');
    const w    = canvas.width;
    const h    = canvas.height;
    
    const bgStr = cssVar('--dither-bg') || cssVar('--bg');
    const fgStr = cssVar('--dither-fg') || cssVar('--accent');
    const dim   = cssVar('--fg-dim');

    if (bgStr === 'transparent') {
      ctx.clearRect(0, 0, w, h);
    } else {
      ctx.fillStyle = bgStr;
      ctx.fillRect(0, 0, w, h);
    }

    // Dot grid
    ctx.fillStyle = dim;
    for (let y = 10; y < h; y += 14) {
      for (let x = 10; x < w; x += 14) {
        ctx.fillRect(x, y, 1.2, 1.2);
      }
    }

    // Big prompt symbol
    ctx.save();
    ctx.font      = 'bold 96px "JetBrains Mono", monospace';
    ctx.fillStyle = fgStr === 'transparent' ? cssVar('--accent') : fgStr;
    ctx.globalAlpha = 0.9;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('>_', w / 2, h / 2 - 20);
    ctx.restore();

    // Label
    ctx.font      = '12px "JetBrains Mono", monospace';
    ctx.fillStyle = dim;
    ctx.textAlign = 'center';
    ctx.fillText('// drop me.webp here', w / 2, h - 28);
    ctx.fillText('//   to enable dither', w / 2, h - 12);
  }

  /** Render dithered image onto canvas */
  function renderDither(canvas, imgEl) {
    const ctx = canvas.getContext('2d');
    const w   = canvas.width;
    const h   = canvas.height;

    // Draw image scaled to canvas with object-fit: cover (aspect-ratio preserving center-crop)
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tCtx = tmp.getContext('2d');

    const imgW = imgEl.naturalWidth || imgEl.width || w;
    const imgH = imgEl.naturalHeight || imgEl.height || h;
    const imgAspect = imgW / imgH;
    const canvasAspect = w / h;

    let sx = 0, sy = 0, sw = imgW, sh = imgH;
    if (imgAspect > canvasAspect) {
      // Image is wider than canvas — crop sides evenly
      sw = imgH * canvasAspect;
      sx = (imgW - sw) / 2;
    } else {
      // Image is taller than canvas — crop top & bottom evenly
      sh = imgW / canvasAspect;
      sy = (imgH - sh) / 2;
    }

    tCtx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, w, h);

    const imageData = tCtx.getImageData(0, 0, w, h);

    const bgStr      = cssVar('--dither-bg') || cssVar('--bg');
    const fgStr      = cssVar('--dither-fg') || cssVar('--accent');
    const invert     = (cssVar('--dither-invert') || '0').trim() === '1';
    const threshold  = parseFloat(cssVar('--dither-threshold')) || 128;
    const brightness = parseFloat(cssVar('--dither-brightness')) || 0;
    const contrast   = parseFloat(cssVar('--dither-contrast')) || 1.0;

    const bgRgba = parseColor(bgStr);
    const fgRgba = parseColor(fgStr);

    const dithered = floydSteinberg(imageData, w, h, bgRgba, fgRgba, invert, threshold, brightness, contrast);
    ctx.putImageData(dithered, 0, 0);
  }

  /** Main init — called on DOMContentLoaded */
  function init() {
    const canvas = document.getElementById('dither-canvas');
    if (!canvas) return;

    canvas.width  = CANVAS_W;
    canvas.height = CANVAS_H;

    const img = new Image();

    img.onload = function () {
      renderDither(canvas, img);

      // Re-render on theme change
      document.addEventListener('themechange', function () {
        // Small delay to let CSS vars update
        setTimeout(() => renderDither(canvas, img), 50);
      });
    };

    img.onerror = function () {
      drawPlaceholder(canvas);

      document.addEventListener('themechange', function () {
        setTimeout(() => drawPlaceholder(canvas), 50);
      });
    };

    img.src = IMG_SRC;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
