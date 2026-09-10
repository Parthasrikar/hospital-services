const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../src/assets');
const outputFile = path.join(__dirname, '../src/assets/icons.ts');

function walkSync(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      walkSync(filePath, fileList);
    } else if (file.endsWith('.svg')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function generateIcons() {
  console.log('Generating icons map from SVG assets...');
  const svgFiles = walkSync(assetsDir);
  const iconsMap = {};

  svgFiles.forEach((filePath) => {
    const fileName = path.basename(filePath);
    const content = fs
      .readFileSync(filePath, 'utf8')
      .replace(/\r?\n|\r/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    iconsMap[fileName] = content;

    // Also store relative path key without domain for flexible lookups (e.g. 'master-data/add.svg')
    const relativePath = path.relative(assetsDir, filePath).replace(/\\/g, '/');
    iconsMap[relativePath] = content;
  });

  const tsContent = `// auto-generated, do not edit manually\nexport const DEFAULT_ICONS: Record<string, string> = ${JSON.stringify(
    iconsMap,
    null,
    2
  )};\n`;

  fs.writeFileSync(outputFile, tsContent, 'utf8');
  console.log(`Successfully generated ${outputFile} with ${Object.keys(iconsMap).length} entries.`);
}

generateIcons();
