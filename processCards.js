const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const modifyJsonFile = require('./Script_MTG.js'); // ou mets le code ici directement

const pipelineAsync = promisify(pipeline);

async function fetchScryfallData() {
  const API_URL = 'https://api.scryfall.com/bulk-data';

  return new Promise((resolve, reject) => {
    https.get(API_URL, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);

          if (!json || !Array.isArray(json.data)) {
            return reject(new Error("La réponse de Scryfall n'est pas valide"));
          }

          const oracle = json.data.find(d => d.type === 'oracle_cards');
          const defaultCards = json.data.find(d => d.type === 'default_cards');

          if (!oracle || !defaultCards) {
            return reject(new Error("oracle_cards ou default_cards non trouvés dans la réponse Scryfall"));
          }

          resolve({
            oracleURL: oracle.download_uri,
            defaultURL: defaultCards.download_uri,
          });
        } catch (e) {
          reject(new Error(`Erreur JSON.parse: ${e.message}`));
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
      if (res.statusCode !== 200) {
        return reject(new Error(`Téléchargement échoué depuis ${url}. Code HTTP: ${res.statusCode}`));
      }

      res.pipe(file);
      file.on('finish', async () => {
        file.close();

        try {
          const inp = fs.createReadStream(tempGz);
          const out = fs.createWriteStream(destPath);
          await pipelineAsync(inp, zlib.createGunzip(), out);
          fs.unlinkSync(tempGz); // supprime le .gz
          resolve();
        } catch (err) {
          reject(new Error(`Erreur de décompression: ${err.message}`));
        }
      });
    }).on('error', (err) => {
      reject(new Error(`Erreur réseau: ${err.message}`));
    });
  });
}

async function main() {
  try {
    console.log('📡 Récupération des URLs depuis Scryfall...');
    const { oracleURL, defaultURL } = await fetchScryfallData();

    console.log('⬇️ Téléchargement des fichiers...');
    console.log(`- oracle.json: ${oracleURL}`);
    console.log(`- all.json: ${defaultURL}`);

    await downloadAndExtractJSON(oracleURL, 'oracle.json');
    await downloadAndExtractJSON(defaultURL, 'all.json');

    console.log('⚙️ Traitement avec modifyJsonFile...');
    modifyJsonFile('oracle.json', 'MTGCards.json', 'all.json');
  } catch (err) {
    console.error('❌ Erreur dans le processus:', err.message);
    process.exit(1);
  }
}

main();
