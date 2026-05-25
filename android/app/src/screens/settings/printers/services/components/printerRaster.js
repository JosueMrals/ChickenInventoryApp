const RASTER_MAX_WIDTH_58MM = 384;
const RASTER_MAX_WIDTH_80MM = 576;
const RASTER_BAND_HEIGHT = 120;

const resolveRasterWidth = (paperWidthMm) => (Number(paperWidthMm) >= 75 ? RASTER_MAX_WIDTH_80MM : RASTER_MAX_WIDTH_58MM);
const resolveFontScale = (fontSize) => {
  const size = Math.max(1, (Number(fontSize) || 14) - 2);
  if (size <= 12) return 1;
  if (size <= 16) return 2;
  if (size <= 20) return 3;
  return 4;
};

const normalizeFontFamily = (fontFamily) => {
  if (!fontFamily || fontFamily === "System") return "sans";
  if (fontFamily === "sans-serif") return "sans";
  if (fontFamily === "serif") return "serif";
  if (fontFamily === "monospace") return "mono";
  return "sans";
};

const FONT_5X7 = {
  "A": ["01110","10001","10001","11111","10001","10001","10001"],
  "B": ["11110","10001","10001","11110","10001","10001","11110"],
  "C": ["01111","10000","10000","10000","10000","10000","01111"],
  "D": ["11110","10001","10001","10001","10001","10001","11110"],
  "E": ["11111","10000","10000","11110","10000","10000","11111"],
  "F": ["11111","10000","10000","11110","10000","10000","10000"],
  "G": ["01111","10000","10000","10111","10001","10001","01111"],
  "H": ["10001","10001","10001","11111","10001","10001","10001"],
  "I": ["11111","00100","00100","00100","00100","00100","11111"],
  "J": ["00111","00010","00010","00010","10010","10010","01100"],
  "K": ["10001","10010","10100","11000","10100","10010","10001"],
  "L": ["10000","10000","10000","10000","10000","10000","11111"],
  "M": ["10001","11011","10101","10101","10001","10001","10001"],
  "N": ["10001","11001","10101","10011","10001","10001","10001"],
  "O": ["01110","10001","10001","10001","10001","10001","01110"],
  "P": ["11110","10001","10001","11110","10000","10000","10000"],
  "Q": ["01110","10001","10001","10001","10101","10010","01101"],
  "R": ["11110","10001","10001","11110","10100","10010","10001"],
  "S": ["01111","10000","10000","01110","00001","00001","11110"],
  "T": ["11111","00100","00100","00100","00100","00100","00100"],
  "U": ["10001","10001","10001","10001","10001","10001","01110"],
  "V": ["10001","10001","10001","10001","10001","01010","00100"],
  "W": ["10001","10001","10001","10101","10101","11011","10001"],
  "X": ["10001","10001","01010","00100","01010","10001","10001"],
  "Y": ["10001","10001","01010","00100","00100","00100","00100"],
  "Z": ["11111","00001","00010","00100","01000","10000","11111"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","10000","11110","00001","00001","11110"],
  "6": ["01110","10000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00001","01110"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  ",": ["00000","00000","00000","00000","00000","01100","01000"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  "/": ["00001","00010","00100","01000","10000","00000","00000"],
  "#": ["01010","01010","11111","01010","11111","01010","01010"],
  "$": ["00100","01111","10100","01110","00101","11110","00100"],
};

function normalizeTestLine(line) {
  return line.toUpperCase().replace(/[^A-Z0-9 \-]/g, " ");
}

function normalizeRasterLine(line) {
  const cleaned = line
    .replace(/•/g, "-");

  return cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 \-.:/,$#]/g, " ");
}

function renderTextToMonoBitmap(lines, options = {}) {
  const scale = Math.max(1, Math.min(options.scale || 1, 4));
  const family = normalizeFontFamily(options.fontFamily);
  const charW = 5 * scale;
  const charH = 7 * scale;
  const baseSpacing = family === "serif" ? 2 : 1;
  const charSpacing = baseSpacing * scale;
  const lineSpacing = (family === "mono" ? 1 : 2) * scale;
  const maxWidth = options.maxWidth || RASTER_MAX_WIDTH_58MM;
  const addSerif = family === "serif";
  const boldLineIndexes = new Set(options.boldLineIndexes || []);

  const safeLines = lines;
  const maxChars = Math.max(1, ...safeLines.map((l) => l.length));
  const textWidth = maxChars * (charW + charSpacing) - charSpacing;
  const width = Math.min(maxWidth, textWidth);
  const height = safeLines.length * (charH + lineSpacing) - lineSpacing;

  const bitmap = new Uint8Array(width * height);
  const leftPad = Math.max(0, Math.floor((width - textWidth) / 2));

  safeLines.forEach((line, lineIndex) => {
    let xCursor = leftPad;
    const yCursor = lineIndex * (charH + lineSpacing);
    const isBold = boldLineIndexes.has(lineIndex);

    for (let i = 0; i < line.length; i++) {
      const glyph = FONT_5X7[line[i]] || FONT_5X7[" "];
      for (let y = 0; y < 7; y++) {
        const row = glyph[y];
        for (let x = 0; x < 5; x++) {
          if (row[x] !== "1") continue;
          const baseX = xCursor + x * scale;
          const baseY = yCursor + y * scale;
          for (let ys = 0; ys < scale; ys++) {
            for (let xs = 0; xs < scale; xs++) {
              const px = baseX + xs;
              const py = baseY + ys;
              if (px >= 0 && px < width && py >= 0 && py < height) {
                bitmap[py * width + px] = 1;
              }
              if (isBold) {
                const boldPx = px + 1;
                const boldPy = py + 1;
                if (boldPx >= 0 && boldPx < width) {
                  bitmap[py * width + boldPx] = 1;
                }
                if (boldPy >= 0 && boldPy < height) {
                  bitmap[boldPy * width + px] = 1;
                }
                if (boldPx >= 0 && boldPx < width && boldPy >= 0 && boldPy < height) {
                  bitmap[boldPy * width + boldPx] = 1;
                }
              }
              if (addSerif && y === 6) {
                const serifPx = px + 1;
                if (serifPx >= 0 && serifPx < width && py >= 0 && py < height) {
                  bitmap[py * width + serifPx] = 1;
                }
              }
            }
          }
        }
      }
      xCursor += charW + charSpacing;
      if (xCursor >= width) break;
    }
  });

  return { bitmap, width, height };
}

function buildRasterImageCommand(lines, normalizer = normalizeRasterLine, options = {}) {
  const normalized = lines.map((l) => normalizer(l || " "));
  const { bitmap, width, height } = renderTextToMonoBitmap(normalized, {
    maxWidth: options.maxWidth || RASTER_MAX_WIDTH_58MM,
    scale: options.scale || 1,
    fontFamily: options.fontFamily,
    boldLineIndexes: options.boldLineIndexes,
  });
  return buildRasterImageCommandFromBitmap(bitmap, width, height);
}

function buildRasterImageCommandFromBitmap(bitmap, width, height) {
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * height);

  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < width && bitmap[y * width + x]) {
          byte |= 0x80 >> bit;
        }
      }
      data[y * widthBytes + xByte] = byte;
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  return [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...Array.from(data)];
}

function buildImageTestPayload(type, printer) {
  const lines = [];
  if (type === "simple") {
    lines.push("HOLA MUNDO", "TEST 58MM");
  } else if (type === "feed") {
    lines.push("FEED", "PAPEL");
  } else {
    lines.push("TEST DE IMPRESION", "CHICKEN INVENTORY");
    if (printer?.name) {
      lines.push(`IMPRESORA ${printer.name}`);
    } else {
      lines.push("IMPRESORA BT");
    }
    lines.push("ESTADO OK");
  }

  const init = [0x1B, 0x40];
  const raster = buildRasterImageCommand(lines, normalizeTestLine);
  const feed = [0x1B, 0x64, 0x02];
  const cut = [0x1D, 0x56, 0x42, 0x00];

  return [...init, ...raster, ...feed, ...cut];
}

function buildImageReceiptPayloadFromText(text, options = {}) {
  const boldMarker = options.boldMarker || "";
  const detectedBoldIndexes = [];
  const lines = text
    .split("\n")
    .map((l, index) => {
      if (boldMarker && l.includes(boldMarker)) {
        detectedBoldIndexes.push(index);
        return l.replace(boldMarker, "");
      }
      return l;
    })
    .map((l) => (l.trim() ? l : " "));
  const init = [0x1B, 0x40];
  const normalized = lines.map((l) => normalizeRasterLine(l || " "));
  const maxWidth = options.maxWidth || RASTER_MAX_WIDTH_58MM;
  const textBitmap = renderTextToMonoBitmap(normalized, {
    maxWidth,
    scale: options.scale || 1,
    fontFamily: options.fontFamily,
    boldLineIndexes: options.boldLineIndexes?.length ? options.boldLineIndexes : detectedBoldIndexes,
  });
  const padded = padBitmapToWidth(textBitmap.bitmap, textBitmap.width, textBitmap.height, maxWidth);
  const raster = buildRasterImageCommandFromBitmap(padded.bitmap, padded.width, padded.height);
  // Feed 2 líneas antes del corte + corte parcial máxima compatibilidad
  const feed = [0x1B, 0x64, 0x02];
  const cut = [0x1D, 0x56, 0x42, 0x00];

  return [...init, ...raster, ...feed, ...cut];
}

function buildImageReceiptPayloadFromBitmap(bitmap, width, height, options = {}) {
  const init = [0x1B, 0x40];
  const maxWidth = options.maxWidth || width;
  const padded = padBitmapToWidth(bitmap, width, height, maxWidth);
  const raster = buildRasterImageCommandFromBitmap(padded.bitmap, padded.width, padded.height);
  // Feed 2 líneas antes del corte + corte parcial máxima compatibilidad
  const feed = [0x1B, 0x64, 0x02];
  const cut = [0x1D, 0x56, 0x42, 0x00];

  return [...init, ...raster, ...feed, ...cut];
}

async function buildImageReceiptPayloadFromTextWithHeader(text, headerImageUri, options = {}) {
  const maxWidth = options.maxWidth || RASTER_MAX_WIDTH_58MM;
  const rawLines = Array.isArray(text) ? text : text.split("\n");
  const boldMarker = options.boldMarker || "";
  const boldLineIndexes = [];
  const lines = rawLines
    .map((l, index) => {
      if (boldMarker && l.includes(boldMarker)) {
        boldLineIndexes.push(index);
        return l.replace(boldMarker, "");
      }
      return l;
    })
    .map((l) => (l.trim() ? l : " "));
  const normalized = lines.map((l) => normalizeRasterLine(l || " "));
  const textBitmap = renderTextToMonoBitmap(normalized, {
    maxWidth,
    scale: options.scale || 1,
    fontFamily: options.fontFamily,
    boldLineIndexes,
  });
  const headerBitmap = await (async () => {
    if (!headerImageUri) return { bitmap: new Uint8Array(0), width: 0, height: 0 };
    const response = await fetch(headerImageUri);
    const buffer = await response.arrayBuffer();
    const byteArray = new Uint8Array(buffer);
    const width = byteArray[0] + (byteArray[1] << 8);
    const height = byteArray[2] + (byteArray[3] << 8);
    const data = byteArray.slice(4);
    return { bitmap: data, width, height };
  })();
  const merged = concatBitmapsVertical([headerBitmap, textBitmap], maxWidth, 0);
  if (!merged.width || !merged.height) {
    return buildImageReceiptPayloadFromText(text, {
      ...options,
      boldLineIndexes,
    });
  }
  const raster = buildRasterImageCommandFromBitmap(merged.bitmap, merged.width, merged.height);
  const feed = [0x1B, 0x64, 0x04];
  const cut = [0x1D, 0x56, 0x42, 0x00];

  return [...raster, ...feed, ...cut];
}

function padBitmapToWidth(bitmap, width, height, targetWidth) {
  if (width === targetWidth) return { bitmap, width, height };
  const padded = new Uint8Array(targetWidth * height);
  const leftPad = Math.max(0, Math.floor((targetWidth - width) / 2));

  for (let y = 0; y < height; y++) {
    const srcRow = y * width;
    const dstRow = y * targetWidth + leftPad;
    for (let x = 0; x < width; x++) {
      padded[dstRow + x] = bitmap[srcRow + x];
    }
  }

  return { bitmap: padded, width: targetWidth, height };
}

function concatBitmapsVertical(bitmaps, targetWidth, gap = 0) {
  const safeBitmaps = bitmaps.filter((b) => b && b.bitmap && b.width && b.height);
  if (safeBitmaps.length === 0) return { bitmap: new Uint8Array(0), width: targetWidth, height: 0 };

  const totalHeight = safeBitmaps.reduce((sum, b) => sum + b.height, 0) + gap * (safeBitmaps.length - 1);
  const merged = new Uint8Array(targetWidth * totalHeight);

  let yOffset = 0;
  safeBitmaps.forEach((b, index) => {
    const padded = padBitmapToWidth(b.bitmap, b.width, b.height, targetWidth);
    for (let y = 0; y < padded.height; y++) {
      const srcRow = y * padded.width;
      const dstRow = (yOffset + y) * targetWidth;
      for (let x = 0; x < targetWidth; x++) {
        merged[dstRow + x] = padded.bitmap[srcRow + x];
      }
    }
    yOffset += padded.height + (index < safeBitmaps.length - 1 ? gap : 0);
  });

  return { bitmap: merged, width: targetWidth, height: totalHeight };
}

export {
  RASTER_MAX_WIDTH_58MM,
  RASTER_MAX_WIDTH_80MM,
  RASTER_BAND_HEIGHT,
  resolveRasterWidth,
  resolveFontScale,
  normalizeFontFamily,
  normalizeRasterLine,
  renderTextToMonoBitmap,
  buildRasterImageCommandFromBitmap,
  buildImageTestPayload,
  buildImageReceiptPayloadFromText,
  buildImageReceiptPayloadFromBitmap,
  padBitmapToWidth,
  concatBitmapsVertical,
};