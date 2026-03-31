const fs = require('fs');
const path = require('path');

const publicCssDir = path.join(__dirname, '../public/css');
const mainCssFile = path.join(publicCssDir, 'main.css');
const bundleFile = path.join(publicCssDir, 'main.bundle.css');

function bundleCss() {
  console.log('📦 Starting CSS bundling...');
  
  if (!fs.existsSync(mainCssFile)) {
    console.error('❌ main.css not found:', mainCssFile);
    return;
  }

  let content = fs.readFileSync(mainCssFile, 'utf8');
  const importRegex = /@import\s+url\(['"](.+?)['"]\);/g;
  let match;
  let bundledContent = '/* Bundled CSS - Do not edit directly */\n';

  // Find all imports
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    const absolutePath = path.resolve(publicCssDir, importPath);
    
    if (fs.existsSync(absolutePath)) {
      console.log(`  ➕ Adding: ${importPath}`);
      const fileContent = fs.readFileSync(absolutePath, 'utf8');
      bundledContent += `/* Source: ${importPath} */\n${fileContent}\n`;
    } else {
      console.warn(`  ⚠️  File skiped (not found): ${importPath}`);
    }
  }

  // Remove all @import lines and add the combined content
  const finalContent = content.replace(importRegex, '') + '\n' + bundledContent;

  fs.writeFileSync(bundleFile, finalContent);
  console.log('✅ Bundling complete:', bundleFile);
}

bundleCss();
