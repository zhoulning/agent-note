import { Plugin, Editor, Notice } from 'obsidian';

// ==================== 字符分类 ====================

const CHINESE_PUNCT = '，。：；！？、「」『』《》';
const ENGLISH_PUNCT = ',.:;!?()[]{}\'"<>-';
const ALL_PUNCT = CHINESE_PUNCT + ENGLISH_PUNCT;

function isPunct(c: string): boolean {
  return ALL_PUNCT.includes(c);
}

function isSpace(c: string): boolean {
  return c === ' ' || c === '\t';
}

function isIgnoredChar(c: string): boolean {
  return isSpace(c) || isPunct(c);
}

// ==================== 忽略区域 ====================

function getIgnoredRegions(text: string): Array<{ start: number; end: number }> {
  const regions: Array<{ start: number; end: number }> = [];

  // 代码块 ```
  let re = /```[\s\S]*?```/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    regions.push({ start: m.index, end: m.index + m[0].length - 1 });
  }

  // 行内代码 `
  re = /`[^`\n]+`/g;
  while ((m = re.exec(text)) !== null) {
    regions.push({ start: m.index, end: m.index + m[0].length - 1 });
  }

  return regions;
}

function isIgnored(pos: number, regions: Array<{ start: number; end: number }>): boolean {
  return regions.some(r => pos >= r.start && pos <= r.end);
}

// ==================== 标题行检测 ====================

function isHeadingLine(text: string, pos: number): boolean {
  let lineStart = pos;
  while (lineStart > 0 && text[lineStart - 1] !== '\n') {
    lineStart--;
  }
  let p = lineStart;
  while (p < text.length && isSpace(text[p])) {
    p++;
  }
  return text[p] === '#';
}

function isLineIgnored(lineStart: number, line: string, regions: Array<{ start: number; end: number }>): boolean {
  if (line.length === 0) return isIgnored(lineStart, regions);
  return isIgnored(lineStart, regions) || isIgnored(lineStart + line.length - 1, regions);
}

function isEmptyHeadingLine(line: string): boolean {
  return /^[ \t]{0,3}#{1,6}(?:[ \t]+#+)?[ \t]*\r?$/.test(line);
}

function isBlockquoteLine(line: string): boolean {
  return /^[ \t]{0,3}>/.test(line);
}

function isEmptyBlockquoteLine(line: string): boolean {
  return /^[ \t]{0,3}>[ \t]*\r?$/.test(line);
}

function isBlankLine(line: string): boolean {
  return /^[ \t]*\r?$/.test(line);
}

function isUnorderedListLine(line: string): boolean {
  return /^[ \t]{0,3}[-+*][ \t]+\S/.test(line);
}

function isOrderedListLine(line: string): boolean {
  return /^[ \t]{0,3}\d{1,9}[.)][ \t]+\S/.test(line);
}

function isListLine(line: string): boolean {
  return isUnorderedListLine(line) || isOrderedListLine(line);
}

// ==================== 结构化空行修复 ====================

function fixStructuralBlankLines(text: string, regions: Array<{ start: number; end: number }>): string {
  const lines = text.split('\n');
  const lineStarts: number[] = [];
  let pos = 0;

  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }

  for (let i = 0; i < lines.length; i++) {
    if (isLineIgnored(lineStarts[i], lines[i], regions)) continue;
    if (isEmptyHeadingLine(lines[i])) {
      lines[i] = '';
    }
  }

  for (let i = 0; i < lines.length;) {
    if (isLineIgnored(lineStarts[i], lines[i], regions) || !isBlockquoteLine(lines[i])) {
      i++;
      continue;
    }

    const start = i;
    while (
      i < lines.length &&
      !isLineIgnored(lineStarts[i], lines[i], regions) &&
      isBlockquoteLine(lines[i])
    ) {
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
      for (let j = start; j <= end; j++) lines[j] = '';
      continue;
    }

    for (let j = start; j < firstContent; j++) lines[j] = '';
    for (let j = lastContent + 1; j <= end; j++) lines[j] = '';
  }

  const removedBlankLines = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    if (isLineIgnored(lineStarts[i], lines[i], regions) || !isListLine(lines[i])) continue;

    let previous = i - 1;
    while (previous >= 0 && isBlankLine(lines[previous])) {
      previous--;
    }

    if (previous === i - 1) continue;
    if (
      previous >= 0 &&
      !isLineIgnored(lineStarts[previous], lines[previous], regions) &&
      isListLine(lines[previous])
    ) {
      continue;
    }

    for (let j = previous + 1; j < i; j++) {
      if (!isLineIgnored(lineStarts[j], lines[j], regions) && isBlankLine(lines[j])) {
        removedBlankLines.add(j);
      }
    }
  }

  if (removedBlankLines.size > 0) {
    return lines.filter((_, index) => !removedBlankLines.has(index)).join('\n');
  }

  return lines.join('\n');
}

// ==================== 修复加粗对 ====================

/**
 * 修复一对 **...** 的边界
 * 头部标点移到 ** 前面，尾部标点和空格移到 ** 后面
 */
function fixBoldPair(
  text: string,
  openStart: number,
  closeStart: number
): string {
  const contentStart = openStart + 2;
  const contentEnd = closeStart - 1;

  // 头部：从 contentStart 向右找第一个非空非标点
  let newContentStart = contentStart;
  while (newContentStart <= contentEnd && isIgnoredChar(text[newContentStart])) {
    newContentStart++;
  }

  // 尾部：从 contentEnd 向左找第一个非空非标点
  let newContentEnd = contentEnd;
  while (newContentEnd >= newContentStart && isIgnoredChar(text[newContentEnd])) {
    newContentEnd--;
  }

  // 内容全是标点/空格 → 移除 ** 标记，保留标点
  if (newContentStart > contentEnd || newContentEnd < newContentStart) {
    const before = text.substring(0, openStart);
    const pollution = text.substring(contentStart, contentEnd + 1);
    let kept = '';
    for (let k = 0; k < pollution.length; k++) {
      if (!isSpace(pollution[k])) kept += pollution[k];
    }
    const after = text.substring(closeStart + 2);
    return before + kept + after;
  }

  // 内容范围没变，不需要处理
  if (newContentStart === contentStart && newContentEnd === contentEnd) {
    return text;
  }

  // 提取各部分
  const before = text.substring(0, openStart);
  const headPollution = text.substring(contentStart, newContentStart); // 头部标点
  const cleanContent = text.substring(newContentStart, newContentEnd + 1);
  let tailPollution = text.substring(newContentEnd + 1, contentEnd + 1); // 尾部标点+空格

  // 移除尾部空格（规则 1）
  while (tailPollution.length > 0 && isSpace(tailPollution[tailPollution.length - 1])) {
    tailPollution = tailPollution.substring(0, tailPollution.length - 1);
  }

  const after = text.substring(closeStart + 2);

  return before + headPollution + '**' + cleanContent + '**' + tailPollution + after;
}

// ==================== 优化空行 ====================

/**
 * 压缩连续空行：>=2 个空行压缩为 1 个
 * 同时移除尾部的空行和空引用（"> " 类似格式）
 */
function optimizeBlankLines(text: string): string {
  let result = text;

  // 1. 移除尾部的空引用行（"> " 或 ">   " 等纯空白引用行）
  // 从后往前，先移除空引用行
  while (result.endsWith('> ')) {
    // 找到上一个换行符的位置
    let pos = result.length - 1;
    while (pos >= 0 && result[pos] !== '\n') {
      pos--;
    }
    result = result.substring(0, pos);
  }

  // 2. 移除尾部的空行
  while (result.endsWith('\n')) {
    result = result.substring(0, result.length - 1);
  }

  // 3. 压缩连续空行（>=2 个空行 → 1 个空行）
  const blankLineRegex = /\n{3,}/g;
  result = result.replace(blankLineRegex, '\n\n');

  return result;
}

// ==================== 删除冒号后空行 ====================

function endsWithColon(lineStart: number, line: string, regions: Array<{ start: number; end: number }>): boolean {
  let end = line.length - 1;
  if (line[end] === '\r') end--;
  while (end >= 0 && isSpace(line[end])) {
    end--;
  }

  return end >= 0 && (line[end] === ':' || line[end] === '：') && !isIgnored(lineStart + end, regions);
}

function isTableSeparatorLine(line: string): boolean {
  return /^[ \t]{0,3}\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*\r?$/.test(line);
}

function isTableHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes('|') && !isTableSeparatorLine(line);
}

function isTableStartLine(
  lines: string[],
  lineStarts: number[],
  index: number,
  regions: Array<{ start: number; end: number }>
): boolean {
  return (
    index + 1 < lines.length &&
    !isLineIgnored(lineStarts[index], lines[index], regions) &&
    !isLineIgnored(lineStarts[index + 1], lines[index + 1], regions) &&
    isTableHeaderLine(lines[index]) &&
    isTableSeparatorLine(lines[index + 1])
  );
}

function removeBlankLinesAfterColon(text: string, regions: Array<{ start: number; end: number }>): string {
  const lines = text.split('\n');
  const lineStarts: number[] = [];
  let pos = 0;

  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }

  const removedBlankLines = new Set<number>();
  for (let i = 0; i < lines.length - 1; i++) {
    if (!endsWithColon(lineStarts[i], lines[i], regions)) continue;

    let next = i + 1;
    const blankStart = next;
    while (
      next < lines.length &&
      !isLineIgnored(lineStarts[next], lines[next], regions) &&
      isBlankLine(lines[next])
    ) {
      next++;
    }
    if (next === blankStart || isTableStartLine(lines, lineStarts, next, regions)) continue;

    for (let j = blankStart; j < next; j++) {
      removedBlankLines.add(j);
    }
  }

  if (removedBlankLines.size > 0) {
    return lines.filter((_, index) => !removedBlankLines.has(index)).join('\n');
  }

  return text;
}

// ==================== 删除标题后空行 ====================

function removeBlankLinesAfterHeading(text: string, regions: Array<{ start: number; end: number }>): string {
  const lines = text.split('\n');
  const lineStarts: number[] = [];
  let pos = 0;

  for (const line of lines) {
    lineStarts.push(pos);
    pos += line.length + 1;
  }

  const removedBlankLines = new Set<number>();

  for (let i = 0; i < lines.length - 1; i++) {
    if (isLineIgnored(lineStarts[i], lines[i], regions)) continue;
    if (!/^[ \t]{0,3}#{1,6}[ \t]+\S/.test(lines[i])) continue;

    let next = i + 1;
    while (
      next < lines.length &&
      !isLineIgnored(lineStarts[next], lines[next], regions) &&
      isBlankLine(lines[next])
    ) {
      removedBlankLines.add(next);
      next++;
    }
  }

  if (removedBlankLines.size > 0) {
    return lines.filter((_, index) => !removedBlankLines.has(index)).join('\n');
  }

  return text;
}

// ==================== 主逻辑 ====================

export function fixMarkdownBold(text: string): string {
  let regions = getIgnoredRegions(text);
  let result = text;

  // ===== 规则：结构化空行修复 =====
  result = fixStructuralBlankLines(result, regions);
  regions = getIgnoredRegions(result);

  // ===== 规则 7：标题行中连续 2+ 个 * → 删除 =====
  for (let i = result.length - 1; i >= 0; i--) {
    if (isIgnored(i, regions)) continue;
    if (result[i] !== '*') continue;
    if (!isHeadingLine(result, i)) continue;

    // 向左找连续 * 的起点
    let j = i;
    while (j >= 0 && result[j] === '*') {
      j--;
    }
    j++;

    // 连续 2 个及以上才删除
    if (i - j + 1 >= 2) {
      result = result.substring(0, j) + result.substring(i + 1);
    }
  }
  regions = getIgnoredRegions(result);

  // ===== 修复加粗对边界 =====
  // 从左往右找所有 ** 对，跳过已匹配的位置
  const fixes: Array<[number, number]> = []; // [openStart, closeStart]

  for (let i = 0; i < result.length - 1; i++) {
    if (isIgnored(i, regions)) continue;
    if (result.substring(i, i + 2) !== '**') continue;

    const openStart = i;
    const contentStart = openStart + 2;

    // 找结束 **（不跨段落边界）
    let j = contentStart;
    while (j < result.length - 1) {
      // 遇到空行（段落边界）停止，避免跨段落错误配对
      if (result[j] === '\n' && j + 1 < result.length && result[j + 1] === '\n') {
        break;
      }
      if (isIgnored(j, regions)) {
        j++;
        continue;
      }
      if (result.substring(j, j + 2) === '**') {
        fixes.push([openStart, j]);
        i = j + 1; // 跳过已匹配的位置，下次从闭合 ** 之后继续
        break;
      }
      j++;
    }
  }

  // 从后往前应用修复（避免索引偏移）
  fixes.sort((a, b) => b[0] - a[0]);

  for (const [openStart, closeStart] of fixes) {
    result = fixBoldPair(result, openStart, closeStart);
  }

  // ===== 规则 9：优化空行 =====
  result = optimizeBlankLines(result);
  regions = getIgnoredRegions(result);

  // ===== 规则 14：删除冒号后空行 =====
  result = removeBlankLinesAfterColon(result, regions);
  regions = getIgnoredRegions(result);

  // ===== 规则 15：删除标题后空行 =====
  result = removeBlankLinesAfterHeading(result, regions);

  return result;
}

// ==================== Obsidian 插件 ====================

export default class ZlnMarkdownFixPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'fix-markdown-syntax',
      name: 'Fix Markdown Syntax',
      editorCallback: (editor: Editor) => {
        const content = editor.getValue();
        const fixed = fixMarkdownBold(content);
        if (fixed !== content) {
          editor.setValue(fixed);
          new Notice('Markdown syntax fixed!');
        } else {
          new Notice('No issues found.');
        }
      }
    });

    this.addRibbonIcon('bold', 'Fix Markdown Syntax', () => {
      const editor = this.app.workspace.activeEditor?.editor;
      if (editor) {
        const content = editor.getValue();
        const fixed = fixMarkdownBold(content);
        if (fixed !== content) {
          editor.setValue(fixed);
          new Notice('Markdown syntax fixed!');
        } else {
          new Notice('No issues found.');
        }
      } else {
        new Notice('Please open a note first.');
      }
    });
  }

  onunload() {}
}
