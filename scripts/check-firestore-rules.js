import fs from 'fs';
import path from 'path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');

if (!fs.existsSync(rulesPath)) {
  console.error(`Error: firestore.rules file not found at ${rulesPath}`);
  process.exit(1);
}

const content = fs.readFileSync(rulesPath, 'utf8');

const matchKeywordRegex = /match\s+/g;
let matchResult;
const missingTokenEmailRule = [];
let checkedCount = 0;

while ((matchResult = matchKeywordRegex.exec(content)) !== null) {
  const matchStartIndex = matchResult.index;
  let openBraceIndex = -1;
  let cursor = matchStartIndex + matchResult[0].length;

  while (cursor < content.length) {
    if (content[cursor] === '{') {
      const rest = content.slice(cursor);
      // Check if '{' is part of path wildcard like {document} or {document=**}
      if (!/^{([a-zA-Z0-9_]+(=[*]+)?)}/.test(rest)) {
        openBraceIndex = cursor;
        break;
      }
    }
    cursor++;
  }

  if (openBraceIndex === -1) continue;

  const headerText = content.slice(matchStartIndex, openBraceIndex).trim();
  const matchPath = headerText.replace(/^match\s+/, '').trim();

  // Skip top-level databases match and fallback rule
  if (matchPath.includes('/databases/') || matchPath.includes('{document=**}')) {
    continue;
  }

  let depth = 1;
  let blockEnd = openBraceIndex + 1;
  while (blockEnd < content.length && depth > 0) {
    if (content[blockEnd] === '{') depth++;
    else if (content[blockEnd] === '}') depth--;
    blockEnd++;
  }

  const blockBody = content.slice(openBraceIndex + 1, blockEnd - 1);
  checkedCount++;

  if (!blockBody.includes('token.email.lower()')) {
    missingTokenEmailRule.push(matchPath);
  }

  matchKeywordRegex.lastIndex = openBraceIndex + 1;
}

if (missingTokenEmailRule.length > 0) {
  console.error(`❌ Firestore rules verification failed! The following collection block(s) are missing 'token.email.lower()':`);
  missingTokenEmailRule.forEach((col) => console.error(`  - ${col}`));
  process.exit(1);
}

console.log(`✅ Firestore rules verification passed: All ${checkedCount} collection rule blocks contain 'token.email.lower()'.`);
process.exit(0);
