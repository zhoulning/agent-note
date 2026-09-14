"use strict";
const fs = require('fs');
const CHINESE_PUNCT = '，。：；！？、「」『』《》';
const ENGLISH_PUNCT = ',.:;!?()[]{}\'"<>-';
const ALL_PUNCT = CHINESE_PUNCT + ENGLISH_PUNCT;
function isPunct(c) { return ALL_PUNCT.includes(c); }
function isSpace(c) { return c === ' ' || c === '\t'; }
function isIgnoredChar(c) { return isSpace(c) || isPunct(c); }
function getIgnoredRegions(text) {
    const regions = [];
    let re = /```[\s\S]*?```/g;
    let m;
    while ((m = re.exec(text)) !== null) { regions.push({ start: m.index, end: m.index + m[0].length - 1 }); }
    re = /`[^`\n]+`/g;
    while ((m = re.exec(text)) !== null) { regions.push({ start: m.index, end: m.index + m[0].length - 1 }); }
    return regions;
}
function isIgnored(pos, regions) { return regions.some(r => pos >= r.start && pos <= r.end); }
function isHeadingLine(text, pos) {
    let lineStart = pos;
    while (lineStart > 0 && text[lineStart - 1] !== '\n') { lineStart--; }
    let p = lineStart;
    while (p < text.length && isSpace(text[p])) { p++; }
    return text[p] === '#';
}
function fixBoldPair(text, openStart, closeStart) {
    const contentStart = openStart + 2;
    const contentEnd = closeStart - 1;
    let newContentStart = contentStart;
    while (newContentStart <= contentEnd && isIgnoredChar(text[newContentStart])) { newContentStart++; }
    let newContentEnd = contentEnd;
    while (newContentEnd >= newContentStart && isIgnoredChar(text[newContentEnd])) { newContentEnd--; }
    if (newContentStart > contentEnd || newContentEnd < newContentStart) return text;
    if (newContentStart === contentStart && newContentEnd === contentEnd) return text;
    const before = text.substring(0, openStart);
    const headPollution = text.substring(contentStart, newContentStart);
    const cleanContent = text.substring(newContentStart, newContentEnd + 1);
    let tailPollution = text.substring(newContentEnd + 1, contentEnd + 1);
    while (tailPollution.length > 0 && isSpace(tailPollution[tailPollution.length - 1])) {
        tailPollution = tailPollution.substring(0, tailPollution.length - 1);
    }
    const after = text.substring(closeStart + 2);
    return before + headPollution + '**' + cleanContent + '**' + tailPollution + after;
}
function fixMarkdownBold(text) {
    const regions = getIgnoredRegions(text);
    let result = text;
    for (let i = result.length - 1; i >= 0; i--) {
        if (isIgnored(i, regions)) continue;
        if (result[i] !== '*') continue;
        if (!isHeadingLine(result, i)) continue;
        let j = i;
        while (j >= 0 && result[j] === '*') { j--; }
        j++;
        if (i - j + 1 >= 2) {
            result = result.substring(0, j) + result.substring(i + 1);
        }
    }
    const fixes = [];
    for (let i = 0; i < result.length - 1; i++) {
        if (isIgnored(i, regions)) continue;
        if (result.substring(i, i + 2) !== '**') continue;
        const openStart = i;
        const contentStart = openStart + 2;
        let j = contentStart;
        while (j < result.length - 1) {
            if (isIgnored(j, regions)) { j++; continue; }
            if (result.substring(j, j + 2) === '**') {
                fixes.push([openStart, j]);
                break;
            }
            j++;
        }
    }
    fixes.sort((a, b) => b[0] - a[0]);
    for (const [openStart, closeStart] of fixes) {
        result = fixBoldPair(result, openStart, closeStart);
    }
    return result;
}

// 测试实际文件
const path = 'E:/Obsidian知识库/obsidian-技术文章/AI/开发/Vibe Coding/Vibe Coding范式/Harness/腾讯云技术：Harness Engineering 来了，SDD 还有意义吗？.md';
const content = fs.readFileSync(path, 'utf8');
const fixed = fixMarkdownBold(content);
const changed = fixed !== content;
console.log('文件长度:', content.length);
console.log('修复后长度:', fixed.length);
console.log('是否有变化:', changed);

// 检查具体问题是否修复
const problemPatterns = [
    '**Mitchell Hashimoto **',
    '**Agent 看不到的，就不存在。 **',
];
for (const p of problemPatterns) {
    console.log('修复前包含 "' + p + '":', content.includes(p));
    console.log('修复后包含 "' + p + '":', fixed.includes(p));
}

// 输出修复后的相关片段
if (changed) {
    console.log('\n修复后的片段:');
    const idx = fixed.indexOf('Mitchell Hashimoto');
    if (idx >= 0) console.log(fixed.substring(idx - 20, idx + 40));
}