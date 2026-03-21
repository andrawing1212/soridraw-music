const axios = require('axios');
const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const fileId = '1atJNSip_kBm_tT1D72pv-Y5eRA-U6sLz';
const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1024-h1024`;

async function processIcons() {
  try {
    console.log('Downloading image from Google Drive...');
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    console.log('Response Status:', response.status);
    console.log('Content Type:', response.headers['content-type']);
    console.log('Buffer Length:', response.data.length);

    const buffer = Buffer.from(response.data);
    const image = await Jimp.read(buffer);

    console.log('Processing 192x192 icon...');
    await image.clone().resize(192, 192).writeAsync('public/icon-192.png');

    console.log('Processing 512x512 icon...');
    await image.clone().resize(512, 512).writeAsync('public/icon-512.png');

    console.log('Processing 32x32 favicon...');
    await image.clone().resize(32, 32).writeAsync('public/favicon.png');

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
