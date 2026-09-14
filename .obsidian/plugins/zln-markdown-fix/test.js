"use strict";
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
function isLineIgnored(lineStart, line, regions) {
    if (line.length === 0) return isIgnored(lineStart, regions);
    return isIgnored(lineStart, regions) || isIgnored(lineStart + line.length - 1, regions);
}
function isEmptyHeadingLine(line) { return /^[ \t]{0,3}#{1,6}(?:[ \t]+#+)?[ \t]*\r?$/.test(line); }
function isBlockquoteLine(line) { return /^[ \t]{0,3}>/.test(line); }
function isEmptyBlockquoteLine(line) { return /^[ \t]{0,3}>[ \t]*\r?$/.test(line); }
function isBlankLine(line) { return /^[ \t]*\r?$/.test(line); }
function isUnorderedListLine(line) { return /^[ \t]{0,3}[-+*][ \t]+\S/.test(line); }
function isOrderedListLine(line) { return /^[ \t]{0,3}\d{1,9}[.)][ \t]+\S/.test(line); }
function isListLine(line) { return isUnorderedListLine(line) || isOrderedListLine(line); }
function fixStructuralBlankLines(text, regions) {
    const lines = text.split('\n');
    const lineStarts = [];
    let pos = 0;
    for (const line of lines) {
        lineStarts.push(pos);
        pos += line.length + 1;
    }
    for (let i = 0; i < lines.length; i++) {
        if (isLineIgnored(lineStarts[i], lines[i], regions)) continue;
        if (isEmptyHeadingLine(lines[i])) lines[i] = '';
    }
    for (let i = 0; i < lines.length;) {
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
            for (let j = start; j <= end; j++) lines[j] = '';
            continue;
        }
        for (let j = start; j < firstContent; j++) lines[j] = '';
        for (let j = lastContent + 1; j <= end; j++) lines[j] = '';
    }
    const removedBlankLines = new Set();
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
function fixBoldPair(text, openStart, closeStart) {
    const contentStart = openStart + 2;
    const contentEnd = closeStart - 1;
    let newContentStart = contentStart;
    while (newContentStart <= contentEnd && isIgnoredChar(text[newContentStart])) { newContentStart++; }
    let newContentEnd = contentEnd;
    while (newContentEnd >= newContentStart && isIgnoredChar(text[newContentEnd])) { newContentEnd--; }
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
function optimizeBlankLines(text) {
    let result = text;

    // 1. 移除尾部的空引用行（"> " 或 ">   " 等纯空白引用行）
    while (result.endsWith('> ')) {
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

function endsWithColon(lineStart, line, regions) {
    let end = line.length - 1;
    if (line[end] === '\r') end--;
    while (end >= 0 && isSpace(line[end])) {
        end--;
    }
    return end >= 0 && (line[end] === ':' || line[end] === '：') && !isIgnored(lineStart + end, regions);
}
function isTableSeparatorLine(line) {
    return /^[ \t]{0,3}\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*\r?$/.test(line);
}
function isTableHeaderLine(line) {
    const trimmed = line.trim();
    return trimmed.includes('|') && !isTableSeparatorLine(line);
}
function isTableStartLine(lines, lineStarts, index, regions) {
    return (
        index + 1 < lines.length &&
        !isLineIgnored(lineStarts[index], lines[index], regions) &&
        !isLineIgnored(lineStarts[index + 1], lines[index + 1], regions) &&
        isTableHeaderLine(lines[index]) &&
        isTableSeparatorLine(lines[index + 1])
    );
}
function removeBlankLinesAfterColon(text, regions) {
    const lines = text.split('\n');
    const lineStarts = [];
    let pos = 0;
    for (const line of lines) {
        lineStarts.push(pos);
        pos += line.length + 1;
    }
    const removedBlankLines = new Set();
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

function removeBlankLinesAfterHeading(text, regions) {
    const lines = text.split('\n');
    const lineStarts = [];
    let pos = 0;
    for (const line of lines) {
        lineStarts.push(pos);
        pos += line.length + 1;
    }
    const removedBlankLines = new Set();
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

function fixMarkdownBold(text) {
    let regions = getIgnoredRegions(text);
    let result = text;

    // 空标题和引用块边缘空引用行换成空行
    result = fixStructuralBlankLines(result, regions);
    regions = getIgnoredRegions(result);

    // 规则 7：标题行中连续 2+ 个 * → 删除
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
    regions = getIgnoredRegions(result);

    // 修复加粗对边界
    const fixes = [];
    for (let i = 0; i < result.length - 1; i++) {
        if (isIgnored(i, regions)) continue;
        if (result.substring(i, i + 2) !== '**') continue;
        const openStart = i;
        const contentStart = openStart + 2;
        let j = contentStart;
        while (j < result.length - 1) {
            if (result[j] === '\n' && j + 1 < result.length && result[j + 1] === '\n') {
                break;
            }
            if (isIgnored(j, regions)) { j++; continue; }
            if (result.substring(j, j + 2) === '**') {
                fixes.push([openStart, j]);
                i = j + 1; // 跳过已匹配的位置
                break;
            }
            j++;
        }
    }
    fixes.sort((a, b) => b[0] - a[0]);
    for (const [openStart, closeStart] of fixes) {
        result = fixBoldPair(result, openStart, closeStart);
    }

    // 规则 9：优化空行
    result = optimizeBlankLines(result);
    regions = getIgnoredRegions(result);

    // 规则 14：删除冒号后空行
    result = removeBlankLinesAfterColon(result, regions);
    regions = getIgnoredRegions(result);

    // 规则 15：删除标题后空行
    result = removeBlankLinesAfterHeading(result, regions);

    return result;
}

// ===== 测试用例 =====
const tests = [
    // 规则 1：尾部空格 → 移除
    { input: '**Mitchell Hashimoto **', expected: '**Mitchell Hashimoto**', rule: 1 },

    // 规则 2：尾部标点 → 移到 ** 外面
    { input: '**Agent 看不到的，就不存在。 **', expected: '**Agent 看不到的，就不存在**。', rule: 2 },

    // 规则 3：头部标点 → 移到 ** 外面
    { input: '**：你知道 Agent 犯错了。**', expected: '：**你知道 Agent 犯错了**。', rule: 3 },

    // 规则 4：中间标点 → 不管
    { input: '**一个 capability 内做对**（WHEN/THEN Scenario', expected: '**一个 capability 内做对**（WHEN/THEN Scenario', rule: 4 },

    // 规则 5：忽略代码块
    { input: '```\n**Mitchell Hashimoto **\n```', expected: '```\n**Mitchell Hashimoto **\n```', rule: 5 },

    // 规则 6：忽略行内代码
    { input: '`const x = **Mitchell Hashimoto **`', expected: '`const x = **Mitchell Hashimoto **`', rule: 6 },

    // 规则 7：标题行中连续 2+ 个 * → 删除
    { input: '## **Mitchell Hashimoto **的博客', expected: '## Mitchell Hashimoto 的博客', rule: 7 },

    // 组合：前后都有标点
    { input: '**：Mitchell Hashimoto **：', expected: '：**Mitchell Hashimoto**：', rule: '组合' },

    // 规则 8：加粗对内容全是标点 → 移除 ** 标记
    { input: '**高成本对话****：**token 消耗超过阈值的，优先审查，往往代表 Agent 在绕圈子', expected: '**高成本对话**：token 消耗超过阈值的，优先审查，往往代表 Agent 在绕圈子', rule: 8 },

    // 规则 8：纯标点加粗对
    { input: '**：**', expected: '：', rule: 8 },

    // 规则 8：纯空格加粗对
    { input: '** **', expected: '', rule: 8 },

    // 规则 8：空加粗对 ****
    { input: '文本****更多文本', expected: '文本更多文本', rule: 8 },

    // 规则 9：>=2 个空行压缩为 1 个空行
    { input: '第一行\n\n\n第二行', expected: '第一行\n\n第二行', rule: 9 },
    { input: '第一行\n\n\n\n\n第二行', expected: '第一行\n\n第二行', rule: 9 },

    // 规则 9：只有一行空行不变
    { input: '第一行\n\n第二行', expected: '第一行\n\n第二行', rule: 9 },

    // 规则 9：尾部空行移除
    { input: '第一行\n\n\n', expected: '第一行', rule: 9 },

    // 规则 9：尾部空引用移除
    { input: '第一行\n> \n> ', expected: '第一行', rule: 9 },

    // 空 markdown 标题 → 空行
    { input: '第一行\n##   \n第二行', expected: '第一行\n\n第二行', rule: 11 },
    { input: '```\n##   \n```', expected: '```\n##   \n```', rule: 11 },

    // 引用块前后的空引用行 → 空行，内部空引用行保留
    {
        input: 'AAA\n> \n> sss\n>\n> \n>\n> s\n>\n\n123333',
        expected: 'AAA\n\n> sss\n>\n> \n>\n> s\n\n123333',
        rule: 12
    },
    {
        input: 'AAA\n>\n>\nBBB',
        expected: 'AAA\n\nBBB',
        rule: 12
    },

    // 无序列表第一项上方空行 → 删除
    {
        input: 'AAAA：\n\n+ sss\n+ ccc',
        expected: 'AAAA：\n+ sss\n+ ccc',
        rule: 13
    },
    {
        input: 'AAAA：\n\n- sss\n- ccc',
        expected: 'AAAA：\n- sss\n- ccc',
        rule: 13
    },
    {
        input: 'AAAA：\n\n\n* sss\n* ccc',
        expected: 'AAAA：\n* sss\n* ccc',
        rule: 13
    },
    {
        input: 'AAAA：\n+ sss\n+ ccc',
        expected: 'AAAA：\n+ sss\n+ ccc',
        rule: 13
    },
    {
        input: '+ sss\n\n+ ccc',
        expected: '+ sss\n\n+ ccc',
        rule: 13
    },
    {
        input: '```\nAAAA：\n\n+ sss\n```',
        expected: '```\nAAAA：\n\n+ sss\n```',
        rule: 13
    },
    {
        input: '教训是：\n\n1. 这个值**源头**是什么？\n2. 如果用 DB 字段代替它，那个 DB 字段**还可能被谁写**？',
        expected: '教训是：\n1. 这个值**源头**是什么？\n2. 如果用 DB 字段代替它，那个 DB 字段**还可能被谁写**？',
        rule: 13
    },
    {
        input: '教训是：\n\n1) 这个值源头是什么？\n2) DB 字段还可能被谁写？',
        expected: '教训是：\n1) 这个值源头是什么？\n2) DB 字段还可能被谁写？',
        rule: 13
    },
    {
        input: '1. 这个值源头是什么？\n\n2. DB 字段还可能被谁写？',
        expected: '1. 这个值源头是什么？\n\n2. DB 字段还可能被谁写？',
        rule: 13
    },

    // 冒号后空行 → 删除
    {
        input: 'AAAA：\n\nsss',
        expected: 'AAAA：\nsss',
        rule: 14
    },
    {
        input: 'AAAA:\n\nsss',
        expected: 'AAAA:\nsss',
        rule: 14
    },
    {
        input: 'AAAA：\nsss',
        expected: 'AAAA：\nsss',
        rule: 14
    },
    {
        input: 'AAAA：\n\n\nsss',
        expected: 'AAAA：\nsss',
        rule: 14
    },
    {
        input: 'AAAAA：\n\n1.\n2.\n3.',
        expected: 'AAAAA：\n1.\n2.\n3.',
        rule: 14
    },
    {
        input: 'AAAA：   \n\nsss',
        expected: 'AAAA：   \nsss',
        rule: 14
    },
    {
        input: '```\nAAAA：\n\nsss\n```',
        expected: '```\nAAAA：\n\nsss\n```',
        rule: 14
    },
    {
        input: '`AAAA：`\n\nsss',
        expected: '`AAAA：`\n\nsss',
        rule: 14
    },
    {
        input: '`SKILL.md` 的 description 字段是触发机制。我写得相当具体：\n\n```plain\ndescription: 严谨多轮交叉验证的通用特性开发工作流。\n以下任一信号时，也应主动建议本工作流：\n并发控制/分布式锁/数据一致性/幂等重试/\n```',
        expected: '`SKILL.md` 的 description 字段是触发机制。我写得相当具体：\n```plain\ndescription: 严谨多轮交叉验证的通用特性开发工作流。\n以下任一信号时，也应主动建议本工作流：\n并发控制/分布式锁/数据一致性/幂等重试/\n```',
        rule: 14
    },
    {
        input: '在这次实施中，我用了 4 种独立视角，每种产出的信号几乎不重叠：\n\n| **视角** | **是否看设计文档** | **关注什么** | **典型产出** |\n| :--- | :--- | :--- | :--- |\n| Systematic Debugging（自查） | 看 | 自己代码的潜在 bug | 1-3 个次要问题 |',
        expected: '在这次实施中，我用了 4 种独立视角，每种产出的信号几乎不重叠：\n\n| **视角** | **是否看设计文档** | **关注什么** | **典型产出** |\n| :--- | :--- | :--- | :--- |\n| Systematic Debugging（自查） | 看 | 自己代码的潜在 bug | 1-3 个次要问题 |',
        rule: 14
    },

    // 规则 15：标题后空行 → 删除
    { input: '## 标题\n\n内容', expected: '## 标题\n内容', rule: 15 },
    { input: '## 标题\n内容', expected: '## 标题\n内容', rule: 15 },
    { input: '## 标题一\n\n## 标题二', expected: '## 标题一\n## 标题二', rule: 15 },
    { input: '## 标题\n\n\n内容', expected: '## 标题\n内容', rule: 15 },
    { input: '```\n## 标题\n\n内容\n```', expected: '```\n## 标题\n\n内容\n```', rule: 15 },
    { input: '## 标题', expected: '## 标题', rule: 15 },
    { input: '# 一级标题\n\n## 二级标题\n\n内容', expected: '# 一级标题\n## 二级标题\n内容', rule: 15 },
    { input: '### 三级标题\n\n+ 列表项', expected: '### 三级标题\n+ 列表项', rule: 15 },
];

let allPass = true;
for (const t of tests) {
    const out = fixMarkdownBold(t.input);
    const pass = out === t.expected;
    if (!pass) allPass = false;
    console.log(`规则${t.rule}: ${pass ? 'PASS' : 'FAIL'}`);
    if (!pass) {
        console.log(`  INPUT:    "${t.input}"`);
        console.log(`  EXPECTED: "${t.expected}"`);
        console.log(`  GOT:      "${out}"`);
    }
}
console.log(allPass ? '\n全部通过' : '\n存在失败');
