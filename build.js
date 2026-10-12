const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const outDir = path.join(__dirname, 'www');

// List of production files to bundle into www
const filesToCopy = [
    'index.html',
    'style.css',
    'script.js',
    'i18n.js',
    'app-lock.js',
    'audio-haptics.js',
    'capacitor-bridge.js',
    'poppins-font.js',
    'reset-password.html',
    'email-template.html',
    'logo-new.png',
    'manifest.json'
];

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

console.log('[Build] Packaging web assets into www/ ...');
let copiedCount = 0;

for (const file of filesToCopy) {
    const srcPath = path.join(srcDir, file);
    const destPath = path.join(outDir, file);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        copiedCount++;
        console.log(`  + Copied: ${file}`);
    } else {
        console.warn(`  ! Warning: File not found: ${file}`);
    }
}

console.log(`[Build] Successfully copied ${copiedCount} files to www/. Ready for Capacitor!`);
