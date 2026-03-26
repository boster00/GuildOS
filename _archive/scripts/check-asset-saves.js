// ARCHIVED: Original path was scripts/check-asset-saves.js

#!/usr/bin/env node
/**
 * CI Check: Enforce single write path for article assets
 * 
 * Ensures all asset saves go through monkey.articleAssets.savePatch/saveReplace
 * Prevents direct fetch calls to /api/content-magic/save-assets outside Monkey
 * 
 * Usage: node scripts/check-asset-saves.js
 * Exit code: 0 = pass, 1 = violations found
 */

const { execSync } = require('child_process');
const path = require('path');

const SAVE_ASSETS_PATTERN = 'fetch\\(["\'].*\\/api\\/content-magic\\/save-assets';
const ALLOWED_FILE = 'libs/monkey/article-assets.js';

console.log('🔍 Checking for direct fetch calls to save-assets endpoint...\n');

try {
  // Use ripgrep for fast searching
  const result = execSync(
    `rg --type js --type ts "${SAVE_ASSETS_PATTERN}" --files-with-matches`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  const violations = result
    .trim()
    .split('\n')
    .filter(file => file && !file.includes(ALLOWED_FILE))
    .map(file => path.normalize(file));

  if (violations.length > 0) {
    console.error('❌ VIOLATIONS FOUND:\n');
    console.error('The following files contain direct fetch calls to save-assets:');
    violations.forEach(file => console.error(`  - ${file}`));
    console.error('\n⚠️  All asset saves MUST use:');
    console.error('  - monkey.articleAssets.savePatch() for partial updates');
    console.error('  - monkey.articleAssets.saveReplace() for full replacement\n');
    process.exit(1);
  }

  console.log('✅ No violations found. All asset saves use centralized methods.\n');
  process.exit(0);

} catch (error) {
  // If ripgrep finds nothing, it exits with code 1
  if (error.status === 1) {
    console.log('✅ No violations found. All asset saves use centralized methods.\n');
    process.exit(0);
  }

  console.error('❌ Error running check:', error.message);
  process.exit(1);
}
