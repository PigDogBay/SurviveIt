// Turns the Vite build in dist/ into one HTML file that runs by double-clicking
// it. Browsers refuse to load separate script and style files for a page opened
// from disk, so the game's code and styles go inside the page itself.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const OUTPUT = 'survive-it.html';

const asset = (extension) => {
  const files = readdirSync('dist/assets').filter((file) => file.endsWith(extension));
  if (files.length !== 1) {
    throw new Error(`Expected one ${extension} file in dist/assets, found ${files.length}`);
  }
  return readFileSync(`dist/assets/${files[0]}`, 'utf8');
};

// Text that would end the tag it's now inside, or confuse the HTML parser.
const safeScript = asset('.js').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const styles = asset('.css');

// Replacer functions, because the code contains $ patterns that a plain
// replacement string would treat as special.
const html = readFileSync('dist/index.html', 'utf8')
  .replace(/<script type="module"[^>]*><\/script>/, () => `<script type="module">${safeScript}</script>`)
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>${styles}</style>`);

const stillLinked = html.match(/(?:src|href)="\.\/assets\/[^"]*"/);
if (stillLinked) throw new Error(`Not inlined: ${stillLinked[0]}`);

writeFileSync(OUTPUT, html);
console.log(`Wrote ${OUTPUT} (${Math.round(html.length / 1024)} kB)`);
