/*
  Script de limpieza: elimina/normaliza entradas inválidas en `products[].bonuses`
  - Remueve entradas donde enabled !== true
  - Remueve entradas con bonusProductId faltante
  - Remueve entradas con threshold <= 0 o bonusQuantity <= 0

  Uso: node cleanup_invalid_bonuses.js
*/

const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

async function clean() {
  console.log('Iniciando limpieza de bonificaciones inválidas');
  const snap = await db.collection('products').get();
  console.log(`Productos a revisar: ${snap.size}`);
  let updated = 0;
  const batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const bonuses = data.bonuses;
    if (!Array.isArray(bonuses) || bonuses.length === 0) continue;

    const cleaned = bonuses.filter(b => {
      if (!b) return false;
      if (!b.enabled) return false;
      if (!b.bonusProductId) return false;
      const th = Number(b.threshold || 0);
      const q = Number(b.bonusQuantity || 0);
      if (th <= 0 || q <= 0) return false;
      return true;
    }).map(b => ({
      enabled: true,
      threshold: Number(b.threshold),
      bonusProductId: b.bonusProductId,
      bonusProductName: b.bonusProductName || '',
      bonusQuantity: Number(b.bonusQuantity),
    }));

    // Si no hay cambios, continuar
    if (JSON.stringify(cleaned) === JSON.stringify(bonuses)) continue;

    batch.update(doc.ref, { bonuses: cleaned });
    updated++;
    ops++;

    if (ops >= 400) {
      await batch.commit();
      console.log('Commit parcial');
      ops = 0;
    }
  }

  if (ops > 0) await batch.commit();
  console.log(`Limpieza finalizada. Documentos actualizados: ${updated}`);
}

clean().catch(err => { console.error('Error cleanup:', err); process.exit(1); });
