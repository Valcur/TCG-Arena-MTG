const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const modifyJsonFile = require('./your-script'); // ou mets le code ici directement

const pipelineAsync = promisify(pipeline);

async function fetchScryfallData() {
  const API_URL = 'https://api.scryfall.com/bulk-data';

  return new Promise((resolve, reject) => {
    https.get(API_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const oracle = json.data.find(d => d.type === 'oracle_cards');
          const defaults = json.data.find(d => d.type === 'default_cards');
          resolve({
            oracleURL: oracle.download_uri,
            defaultURL: defaults.download_uri,
          });
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

async function downloadAndExtractJSON(url, destPath) {
  const tempGz = destPath + '.gz';
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tempGz);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close(async () => {
          const inp = fs.createReadStream(tempGz);
          const out = fs.createWriteStream(destPath);
          await pipelineAsync(inp, zlib.createGunzip(), out);
          fs.unlinkSync(tempGz); // Supprime le .gz
          resolve();
        });
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    const { oracleURL, defaultURL } = await fetchScryfallData();

    console.log('Téléchargement en cours...');
    await downloadAndExtractJSON(oracleURL, 'oracle.json');
    await downloadAndExtractJSON(defaultURL, 'all.json');

    console.log('Traitement des cartes...');
    modifyJsonFile('oracle.json', 'MTGCards.json', 'all.json');
  } catch (err) {
    console.error('Erreur dans le processus:', err);
    process.exit(1);
  }
}

main();
