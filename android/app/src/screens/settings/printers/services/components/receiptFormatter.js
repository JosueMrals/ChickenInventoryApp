import { normalizeFontFamily } from "./printerRaster";

const DEFAULT_CURRENCY = "C$";

function resolveCharsPerLine(maxWidth, scale, fontFamily) {
  const family = normalizeFontFamily(fontFamily);
  const charW = 5 * scale;
  const baseSpacing = family === "serif" ? 2 : 1;
  const charSpacing = baseSpacing * scale;
  const cell = charW + charSpacing;
  return Math.max(1, Math.floor((maxWidth + charSpacing) / cell));
}

function resolveColumns(maxChars) {
  let totalWidth = 9;
  const gap = 1;
  let nameWidth = maxChars - totalWidth - gap;

  if (nameWidth < 10) {
    const shrink = 10 - nameWidth;
    totalWidth = Math.max(7, totalWidth - shrink);
    nameWidth = maxChars - totalWidth - gap;
  }

  return { nameWidth: Math.max(8, nameWidth), totalWidth, gap, maxChars };
}

function clampLine(text, maxChars) {
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function wrapText(text, width) {
  if (!text) return [" "];
  const words = text.split(" ");
  const lines = [];
  let current = "";

  words.forEach((word) => {
    if (!current) {
      current = word;
      return;
    }
    if ((current.length + 1 + word.length) <= width) {
      current += ` ${word}`;
      return;
    }
    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.map((line) => line.slice(0, width));
}

function formatHeaderLine(columns, labels = {}) {
  const nameLabel = labels.name || "Producto";
  const totalLabel = labels.total || "Total";
  const name = nameLabel.padEnd(columns.nameWidth, " ");
  const total = totalLabel.padStart(columns.totalWidth, " ");
  const line = `${name}${" ".repeat(columns.gap)}${total}`;
  return clampLine(line, columns.maxChars);
}

function formatMoney(value, currency = DEFAULT_CURRENCY) {
  const numeric = Number(value || 0);
  return `${currency}${numeric.toFixed(2)}`;
}

function formatItemLines(item, columns, options = {}) {
  const rawName = item.productName || item.name || item.product?.name || "Item";
  const name = (options.sanitize ? options.sanitize(rawName) : rawName) || "Item";
  const qtyValue = item.quantity || item.qty || 0;
  const unitPriceValue = item.unitPrice || item.price || 0;
  const totalValue = item.total || (unitPriceValue * qtyValue);

  const totalStr = formatMoney(totalValue, options.currency).padStart(columns.totalWidth, " ");
  const nameLines = wrapText(name, columns.nameWidth);

  const firstName = (nameLines[0] || "").padEnd(columns.nameWidth, " ");
  const firstLine = `${firstName}${" ".repeat(columns.gap)}${totalStr}`;

  const lines = [clampLine(firstLine, columns.maxChars)];
  for (let i = 1; i < nameLines.length; i++) {
    lines.push(clampLine(nameLines[i], columns.maxChars));
  }

  const unitPrice = formatMoney(unitPriceValue, options.currency);
  const detailLine = `Cant: ${qtyValue} X ${unitPrice}`;
  lines.push(clampLine(detailLine, columns.maxChars));

  return lines;
}

function aggregateBonuses(bonuses = []) {
  const map = new Map();

  bonuses.forEach((bonus, idx) => {
    const qtyValue = Number(bonus?.quantity || bonus?.qty || 0);
    const name = bonus?.productName || bonus?.name || "Bonif";
    const key = `${String(bonus?.productId || name || idx)}::${String(name)}`;

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        productName: name,
        quantity: qtyValue,
      });
      return;
    }

    const prev = map.get(key);
    prev.quantity += qtyValue;
    map.set(key, prev);
  });

  return Array.from(map.values());
}

function formatBonusLine(bonus, columns, options = {}) {
  const rawName = bonus.productName || bonus.name || "Bonif";
  const name = (options.sanitize ? options.sanitize(rawName) : rawName) || "Bonif";
  const qtyValue = Number(bonus.quantity || bonus.qty || 0);
  const label = `Regalo: +${qtyValue} ${name}`;
  return clampLine(label, columns.maxChars);
}

function buildItemsWithBonusesBlock(items, bonuses, columns, options = {}) {
  if (!items || items.length === 0) return [];
  const byLinkedId = new Map();
  const unlinked = [];

  (bonuses || []).forEach((bonus) => {
    const key = bonus.linkedTo || bonus.linkedToId || bonus.linkedItemId || bonus.linkedProductId || "";
    if (key) {
      const list = byLinkedId.get(key) || [];
      list.push(bonus);
      byLinkedId.set(key, list);
      return;
    }
    unlinked.push(bonus);
  });

  const lines = [];
  items.forEach((item) => {
    const itemLines = formatItemLines(item, columns, options);
    itemLines.forEach((line) => lines.push(line));

    const itemKey = item.id || item.productId || item.product?.id || "";
    const matched = itemKey ? (byLinkedId.get(itemKey) || []) : [];
    const compactMatched = aggregateBonuses(matched);

    compactMatched.forEach((bonus) => {
      lines.push(formatBonusLine(bonus, columns, options));
    });

    lines.push("");
  });

  if (unlinked.length > 0) {
    lines.push("Bonificaciones:");
    const compactUnlinked = aggregateBonuses(unlinked);
    compactUnlinked.forEach((bonus) => {
      lines.push(formatBonusLine(bonus, columns, options));
    });
    lines.push("");
  }

  return lines;
}

function buildItemsBlock(items, columns, options = {}) {
  if (!items || items.length === 0) return [];
  const lines = [];
  items.forEach((item) => {
    const itemLines = formatItemLines(item, columns, options);
    itemLines.forEach((line) => lines.push(line));
    lines.push("");
  });
  return lines;
}

export {
  resolveCharsPerLine,
  resolveColumns,
  formatHeaderLine,
  formatItemLines,
  buildItemsBlock,
  buildItemsWithBonusesBlock,
};
