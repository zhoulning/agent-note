const fs = require('fs');
const path = require('path');
const vm = require('vm');

const targetFilePath = process.argv[2];
if (!targetFilePath) {
    console.error('Error: Please specify the target file path.');
    process.exit(1);
}

const absoluteTarget = path.resolve(targetFilePath);
if (!fs.existsSync(absoluteTarget)) {
    console.error(`Error: Target file not found at ${absoluteTarget}`);
    process.exit(1);
}

const pluginTestJsPath = path.join(__dirname, 'test.js');
if (!fs.existsSync(pluginTestJsPath)) {
    console.error(`Error: test.js not found at ${pluginTestJsPath}`);
    process.exit(1);
}

const testJsContent = fs.readFileSync(pluginTestJsPath, 'utf8');
const separator = '// ===== 测试用例 =====';
const codePart = testJsContent.split(separator)[0];

const sandbox = {
    fs,
    console,
    targetFilePath: absoluteTarget,
};

vm.createContext(sandbox);
try {
    vm.runInContext(codePart + `
const targetContent = fs.readFileSync(targetFilePath, 'utf8');
const formattedContent = fixMarkdownBold(targetContent);
fs.writeFileSync(targetFilePath, formattedContent, 'utf8');
`, sandbox);
    console.log('Successfully formatted the file using ZLN Markdown Fix!');
} catch (e) {
    console.error('Error formatting file:', e);
    process.exit(1);
}
