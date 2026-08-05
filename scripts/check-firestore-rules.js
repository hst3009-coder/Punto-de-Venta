import fs from 'fs';
import path from 'path';

try {
  const rulesPath = path.join(process.cwd(), 'firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    console.error('❌ firestore.rules file not found.');
    process.exit(1);
  }

  const content = fs.readFileSync(rulesPath, 'utf8');
  const lines = content.split('\n');

  let currentCollection = null;
  let currentBlockLines = [];
  const collections = [];

  for (const line of lines) {
    const matchHeader = line.match(/match\s+\/(.*?)\s*\{\s*$/);
    if (matchHeader) {
      if (currentCollection) {
        collections.push({
          path: currentCollection,
          block: currentBlockLines.join('\n'),
        });
      }
      currentCollection = matchHeader[1];
      currentBlockLines = [line];
    } else if (currentCollection) {
      currentBlockLines.push(line);
    }
  }

  if (currentCollection) {
    collections.push({
      path: currentCollection,
      block: currentBlockLines.join('\n'),
    });
  }

  let verifiedCount = 0;
  const missingCollections = [];

  for (const item of collections) {
    const { path: matchPath, block } = item;

    // Skip root database wrapper and default fallback rule {document=**}
    if (matchPath.includes('databases/') || matchPath.includes('{document=**}')) {
      continue;
    }

    if (matchPath.endsWith('/{document}')) {
      const collectionName = matchPath.replace('/{document}', '');
      if (!block.includes('token.email.lower()')) {
        missingCollections.push(collectionName);
      } else {
        verifiedCount++;
      }
    }
  }

  if (missingCollections.length > 0) {
    console.error(`❌ Firestore rules check failed! Missing 'token.email.lower()' in collections: ${missingCollections.join(', ')}`);
    process.exit(1);
  }

  console.log(`✅ Firestore rules verification passed: All ${verifiedCount} collection rule blocks contain 'token.email.lower()'.`);
  process.exit(0);
} catch (error) {
  console.error('❌ Unexpected error during firestore.rules check:', error);
  process.exit(1);
}
