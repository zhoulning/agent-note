var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var main_exports = {};
__export(main_exports, {
  default: () => ZlnMarkdownFixPlugin,
  fixMarkdownBold: () => fixMarkdownBold
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
const CHINESE_PUNCT = "\uFF0C\u3002\uFF1A\uFF1B\uFF01\uFF1F\u3001\u300C\u300D\u300E\u300F\u300A\u300B";
const ENGLISH_PUNCT = `,.:;!?()[]{}'"<>-`;
const ALL_PUNCT = CHINESE_PUNCT + ENGLISH_PUNCT;
function isPunct(c) {
  return ALL_PUNCT.includes(c);
}
function isSpace(c) {
  return c === " " || c === "	";
}
function isIgnoredChar(c) {
  return isSpace(c) || isPunct(c);
}
function getIgnoredRegions(text) {
  const regions = [];
  let re = /```[\s\S]*?```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    regions.push({ start: m.index, end: m.index + m[0].length - 1 });
  }
  re = /`[^`\n]+`/g;
  while ((m = re.exec(text)) !== null) {
    regions.push({ start: m.index, end: m.index + m[0].length - 1 });
  }
  return regions;
}
function isIgnored(pos, regions) {
  return regions.some((r) => pos >= r.start && pos <= r.end);
}
function isHeadingLine(text, pos) {
  let lineStart = pos;
  while (lineStart > 0 && text[lineStart - 1] !== "\n") {
    lineStart--;
  }
  let p = lineStart;
  while (p < text.length && isSpace(text[p])) {
    p++;
  }
  return text[p] === "#";
}
function isLineIgnored(lineStart, line, regions) {
  if (line.length === 0) return isIgnored(lineStart, regions);
  return isIgnored(lineStart, regions) || isIgnored(lineStart + line.length - 1, regions);
}
function isEmptyHeadingLine(line) {
  return /^[ \t]{0,3}#{1,6}(?:[ \t]+#+)?[ \t]*\r?$/.test(line);
}
function isBlockquoteLine(line) {
  return /^[ \t]{0,3}>/.test(line);
}
function isEmptyBlockquoteLine(line) {
  return /^[ \t]{0,3}>[ \t]*\r?$/.test(line);
}
function isBlankLine(line) {
  return /^[ \t]*\r?$/.test(line);
}
function isUnorderedListLine(line) {
  return /^[ \t]{0,3}[-+*][ \t]+\S/.test(line);
}
function isOrderedListLine(line) {
  return /^[ \t]{0,3}\d{1,9}[.)][ \t]+\S/.test(line);
}
function isListLine(line) {
  return isUnorderedListLine(line) || isOrderedListLine(line);
}
function fixStructuralBlankLines(text, regions) {
  const lines = text.split("\n");
  const lineStarts = [];
  let pos = 0;
  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }
  for (let i = 0; i < lines.length; i++) {
    if (isLineIgnored(lineStarts[i], lines[i], regions)) continue;
    if (isEmptyHeadingLine(lines[i])) {
      lines[i] = "";
    }
  }
  for (let i = 0; i < lines.length; ) {
    if (isLineIgnored(lineStarts[i], lines[i], regions) || !isBlockquoteLine(lines[i])) {
      i++;
      continue;
    }
    const start = i;
    while (i < lines.length && !isLineIgnored(lineStarts[i], lines[i], regions) && isBlockquoteLine(lines[i])) {
      i++;
    }
    const end = i - 1;
    let firstContent = -1;
    let lastContent = -1;
    for (let j = start; j <= end; j++) {
      if (!isEmptyBlockquoteLine(lines[j])) {
        if (firstContent === -1) firstContent = j;
        lastContent = j;
      }
    }
    if (firstContent === -1) {
      for (let j = start; j <= end; j++) lines[j] = "";
      continue;
    }
    for (let j = start; j < firstContent; j++) lines[j] = "";
    for (let j = lastContent + 1; j <= end; j++) lines[j] = "";
  }
  const removedBlankLines = /* @__PURE__ */ new Set();
  for (let i = 0; i < lines.length; i++) {
    if (isLineIgnored(lineStarts[i], lines[i], regions) || !isListLine(lines[i])) continue;
    let previous = i - 1;
    while (previous >= 0 && isBlankLine(lines[previous])) {
      previous--;
    }
    if (previous === i - 1) continue;
    if (previous >= 0 && !isLineIgnored(lineStarts[previous], lines[previous], regions) && isListLine(lines[previous])) {
      continue;
    }
    for (let j = previous + 1; j < i; j++) {
      if (!isLineIgnored(lineStarts[j], lines[j], regions) && isBlankLine(lines[j])) {
        removedBlankLines.add(j);
      }
    }
  }
  if (removedBlankLines.size > 0) {
    return lines.filter((_, index) => !removedBlankLines.has(index)).join("\n");
  }
  return lines.join("\n");
}
function fixBoldPair(text, openStart, closeStart) {
  const contentStart = openStart + 2;
  const contentEnd = closeStart - 1;
  let newContentStart = contentStart;
  while (newContentStart <= contentEnd && isIgnoredChar(text[newContentStart])) {
    newContentStart++;
  }
  let newContentEnd = contentEnd;
  while (newContentEnd >= newContentStart && isIgnoredChar(text[newContentEnd])) {
    newContentEnd--;
  }
  if (newContentStart > contentEnd || newContentEnd < newContentStart) {
    const before2 = text.substring(0, openStart);
    const pollution = text.substring(contentStart, contentEnd + 1);
    let kept = "";
    for (let k = 0; k < pollution.length; k++) {
      if (!isSpace(pollution[k])) kept += pollution[k];
    }
    const after2 = text.substring(closeStart + 2);
    return before2 + kept + after2;
  }
  if (newContentStart === contentStart && newContentEnd === contentEnd) {
    return text;
  }
  const before = text.substring(0, openStart);
  const headPollution = text.substring(contentStart, newContentStart);
  const cleanContent = text.substring(newContentStart, newContentEnd + 1);
  let tailPollution = text.substring(newContentEnd + 1, contentEnd + 1);
  while (tailPollution.length > 0 && isSpace(tailPollution[tailPollution.length - 1])) {
    tailPollution = tailPollution.substring(0, tailPollution.length - 1);
  }
  const after = text.substring(closeStart + 2);
  return before + headPollution + "**" + cleanContent + "**" + tailPollution + after;
}
function optimizeBlankLines(text) {
  let result = text;
  while (result.endsWith("> ")) {
    let pos = result.length - 1;
    while (pos >= 0 && result[pos] !== "\n") {
      pos--;
    }
    result = result.substring(0, pos);
  }
  while (result.endsWith("\n")) {
    result = result.substring(0, result.length - 1);
  }
  const blankLineRegex = /\n{3,}/g;
  result = result.replace(blankLineRegex, "\n\n");
  return result;
}
function endsWithColon(lineStart, line, regions) {
  let end = line.length - 1;
  if (line[end] === "\r") end--;
  while (end >= 0 && isSpace(line[end])) {
    end--;
  }
  return end >= 0 && (line[end] === ":" || line[end] === "：") && !isIgnored(lineStart + end, regions);
}
function isTableSeparatorLine(line) {
  return /^[ \t]{0,3}\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*\r?$/.test(line);
}
function isTableHeaderLine(line) {
  const trimmed = line.trim();
  return trimmed.includes("|") && !isTableSeparatorLine(line);
}
function isTableStartLine(lines, lineStarts, index, regions) {
  return index + 1 < lines.length && !isLineIgnored(lineStarts[index], lines[index], regions) && !isLineIgnored(lineStarts[index + 1], lines[index + 1], regions) && isTableHeaderLine(lines[index]) && isTableSeparatorLine(lines[index + 1]);
}
function removeBlankLinesAfterColon(text, regions) {
  const lines = text.split("\n");
  const lineStarts = [];
  let pos = 0;
  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }
  const removedBlankLines = /* @__PURE__ */ new Set();
  for (let i = 0; i < lines.length - 1; i++) {
    if (!endsWithColon(lineStarts[i], lines[i], regions)) continue;
    let next = i + 1;
    const blankStart = next;
    while (next < lines.length && !isLineIgnored(lineStarts[next], lines[next], regions) && isBlankLine(lines[next])) {
      next++;
    }
    if (next === blankStart || isTableStartLine(lines, lineStarts, next, regions)) continue;
    for (let j = blankStart; j < next; j++) {
      removedBlankLines.add(j);
    }
  }
  if (removedBlankLines.size > 0) {
    return lines.filter((_, index) => !removedBlankLines.has(index)).join("\n");
  }
  return text;
}
function removeBlankLinesAfterHeading(text, regions) {
  const lines = text.split("\n");
  const lineStarts = [];
  let pos = 0;
  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }
  const removedBlankLines = /* @__PURE__ */ new Set();
  for (let i = 0; i < lines.length - 1; i++) {
    if (isLineIgnored(lineStarts[i], lines[i], regions)) continue;
    if (!/^[ \t]{0,3}#{1,6}[ \t]+\S/.test(lines[i])) continue;
    let next = i + 1;
    while (next < lines.length && !isLineIgnored(lineStarts[next], lines[next], regions) && isBlankLine(lines[next])) {
      removedBlankLines.add(next);
      next++;
    }
  }
  if (removedBlankLines.size > 0) {
    return lines.filter((_, index) => !removedBlankLines.has(index)).join("\n");
  }
  return text;
}
function fixMarkdownBold(text) {
  let regions = getIgnoredRegions(text);
  let result = text;
  result = fixStructuralBlankLines(result, regions);
  regions = getIgnoredRegions(result);
  for (let i = result.length - 1; i >= 0; i--) {
    if (isIgnored(i, regions)) continue;
    if (result[i] !== "*") continue;
    if (!isHeadingLine(result, i)) continue;
    let j = i;
    while (j >= 0 && result[j] === "*") {
      j--;
    }
    j++;
    if (i - j + 1 >= 2) {
      result = result.substring(0, j) + result.substring(i + 1);
    }
  }
  regions = getIgnoredRegions(result);
  const fixes = [];
  for (let i = 0; i < result.length - 1; i++) {
    if (isIgnored(i, regions)) continue;
    if (result.substring(i, i + 2) !== "**") continue;
    const openStart = i;
    const contentStart = openStart + 2;
    let j = contentStart;
    while (j < result.length - 1) {
      if (result[j] === "\n" && j + 1 < result.length && result[j + 1] === "\n") {
        break;
      }
      if (isIgnored(j, regions)) {
        j++;
        continue;
      }
      if (result.substring(j, j + 2) === "**") {
        fixes.push([openStart, j]);
        i = j + 1;
        break;
      }
      j++;
    }
  }
  fixes.sort((a, b) => b[0] - a[0]);
  for (const [openStart, closeStart] of fixes) {
    result = fixBoldPair(result, openStart, closeStart);
  }
  result = optimizeBlankLines(result);
  regions = getIgnoredRegions(result);
  result = removeBlankLinesAfterColon(result, regions);
  regions = getIgnoredRegions(result);
  result = removeBlankLinesAfterHeading(result, regions);
  return result;
}
class ZlnMarkdownFixPlugin extends import_obsidian.Plugin {
  async onload() {
    this.addCommand({
      id: "fix-markdown-syntax",
      name: "Fix Markdown Syntax",
      editorCallback: (editor) => {
        const content = editor.getValue();
        const fixed = fixMarkdownBold(content);
        if (fixed !== content) {
          editor.setValue(fixed);
          new import_obsidian.Notice("Markdown syntax fixed!");
        } else {
          new import_obsidian.Notice("No issues found.");
        }
      }
    });
    this.addRibbonIcon("bold", "Fix Markdown Syntax", () => {
      const editor = this.app.workspace.activeEditor?.editor;
      if (editor) {
        const content = editor.getValue();
        const fixed = fixMarkdownBold(content);
        if (fixed !== content) {
          editor.setValue(fixed);
          new import_obsidian.Notice("Markdown syntax fixed!");
        } else {
          new import_obsidian.Notice("No issues found.");
        }
      } else {
        new import_obsidian.Notice("Please open a note first.");
      }
    });
  }
  onunload() {
  }
}
