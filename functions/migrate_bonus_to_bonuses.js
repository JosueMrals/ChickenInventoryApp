/*
  Script de migración (opcional): convierte documentos en la colección `products`
  que tengan el campo `bonus` (objeto legacy) agregándolo como array `bonuses`.

  Uso (desde la carpeta functions/):
    node migrate_bonus_to_bonuses.js --serviceAccount=./service-account.json --projectId=my-project-id
  O exportar GOOGLE_APPLICATION_CREDENTIALS y ejecutar:
    setx GOOGLE_APPLICATION_CREDENTIALS "C:\path\to\service-account.json"
    node migrate_bonus_to_bonuses.js

*/

const admin = require('firebase-admin');
const fs = require('fs');

// Parse CLI args simples
const argv = require('minimist')(process.argv.slice(2));
const serviceAccountPath = argv.serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
const projectIdArg = argv.projectId || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || null;

function initAdmin() {
  if (admin.apps.length) return;
  if (serviceAccountPath) {
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('[migrate] Service account file not found:', serviceAccountPath);
      process.exit(1);
    }
    const sa = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: projectIdArg || sa.project_id || undefined,
    });
    console.log('[migrate] Initialized Firebase Admin with provided service account.');
  } else {
    try {
      admin.initializeApp();
      console.log('[migrate] Initialized Firebase Admin with application default credentials.');
    } catch (err) {
      console.error('[migrate] No credentials found. Provide --serviceAccount or set GOOGLE_APPLICATION_CREDENTIALS.');
      throw err;
    }
  }
}

try {
  initAdmin();
} catch (err) {
  console.error('[migrate] Initialization failed:', err.message || err);
  process.exit(1);
}

const db = admin.firestore();

async function migrate() {
  console.log('Iniciando migración bonus -> bonuses');
  const snapshot = await db.collection('products').get();
  console.log(`Productos encontrados: ${snapshot.size}`);

  let updated = 0;
  const batchSize = 500;
  let batch = db.batch();
  let ops = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.bonuses && Array.isArray(data.bonuses)) continue; // ya migrado
    if (data.bonus && typeof data.bonus === 'object' && Object.keys(data.bonus).length > 0) {
      const bonuses = [ data.bonus ];
      batch.update(doc.ref, { bonuses });
      ops++;
      updated++;
    }

    if (ops >= batchSize) {
      await batch.commit();
      batch = db.batch();
      ops = 0;
      console.log(`Commit parcial realizado. Total actualizado hasta ahora: ${updated}`);
    }
  }

  if (ops > 0) {
    await batch.commit();
    console.log(`Commit final realizado. Total actualizado: ${updated}`);
  }

  console.log('Migración finalizada.');
}

migrate().catch(err => {
  console.error('Error en migración:', err);
  process.exit(1);
});
