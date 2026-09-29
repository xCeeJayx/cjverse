const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('./node_modules/@napi-rs/canvas');

async function convert(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source file does not exist: ${src}`);
    process.exit(1);
  }
  const img = await loadImage(src);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const targetDir = path.dirname(dest);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  fs.writeFileSync(dest, canvas.toBuffer('image/png'));
  console.log(`Converted ${src} -> ${dest} (${img.width}x${img.height})`);
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node convert_helper.js <src_jpg> <dest_png>');
  process.exit(1);
}
convert(args[0], args[1]);
