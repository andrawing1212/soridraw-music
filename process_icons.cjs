const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const inputPath = 'public/new_icon_source.png';

async function processIcons() {
  try {
    console.log(`Reading image from ${inputPath}...`);
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    
    const image = await Jimp.read(inputPath);

    console.log('Processing 192x192 icon...');
    await image.clone().resize(192, 192).writeAsync('public/icon-192.png');

    console.log('Processing 512x512 icon...');
    await image.clone().resize(512, 512).writeAsync('public/icon-512.png');

    console.log('Processing 32x32 favicon...');
    await image.clone().resize(32, 32).writeAsync('public/favicon.png');
    await image.clone().resize(32, 32).writeAsync('public/favicon.ico');

    console.log('Icons processed successfully!');
  } catch (error) {
    console.error('Error processing icons:', error);
    process.exit(1);
  }
}

// Ensure public directory exists
if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

processIcons();
