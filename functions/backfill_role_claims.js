/*
  Backfill de custom claims de rol (una sola vez).

  Copia `users/{uid}.role` de Firestore al custom claim `role` del token de Auth.
  Es el equivalente local de la callable `syncAllRoleClaims`, para cuando no se
  quiere (o no se puede) invocarla desde una sesión de admin en la app.

  Por qué existe: firestore.rules leía el rol con un get() a users/{uid} en CADA
  evaluación de regla — una lectura extra facturada por request, contra todas las
  colecciones. Ahora el rol viaja en el token; el get() quedó solo como fallback
  (legacyHasRole) para los usuarios que aún no tienen el claim puesto. Este script
  es lo que vacía ese fallback.

  De aquí en adelante el trigger `syncUserRoleClaim` (index.js) mantiene el claim
  al día solo. Este script es únicamente para los usuarios que ya existían.

  Uso (desde functions/):

    # 1. Ver qué haría, sin escribir nada (por defecto):
    node backfill_role_claims.js --serviceAccount=./service-account.json

    # 2. Aplicar de verdad:
    node backfill_role_claims.js --serviceAccount=./service-account.json --apply

  También sirve exportar GOOGLE_APPLICATION_CREDENTIALS, o tener credenciales de
  aplicación por defecto (gcloud auth application-default login).

  Es idempotente: los usuarios cuyo claim ya coincide se saltan sin escribir.
*/

const admin = require('firebase-admin');
const fs = require('fs');

const argv = require('minimist')(process.argv.slice(2));
const serviceAccountPath = argv.serviceAccount || process.env.GOOGLE_APPLICATION_CREDENTIALS || null;
const projectIdArg = argv.projectId || process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT || null;

// Dry-run por defecto: este script corre con credenciales de producción y
// reescribe permisos. Escribir requiere pedirlo explícitamente.
const APPLY = Boolean(argv.apply);

// Mismos cuatro roles que index.js y firestore.rules. Si se agrega uno, hay que
// tocarlo en los tres lados.
const VALID_ROLES = ['admin', 'vendedor', 'entregador', 'bodeguero'];

function initAdmin() {
  if (admin.apps.length) return;
  if (serviceAccountPath) {
    if (!fs.existsSync(serviceAccountPath)) {
      console.error('[backfill] No se encontró el service account:', serviceAccountPath);
      process.exit(1);
    }
    const sa = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(sa),
      projectId: projectIdArg || sa.project_id || undefined,
    });
    console.log('[backfill] Admin inicializado con el service account provisto.');
  } else {
    try {
      admin.initializeApp();
      console.log('[backfill] Admin inicializado con credenciales de aplicación por defecto.');
    } catch (err) {
      console.error('[backfill] Sin credenciales. Usa --serviceAccount o exporta GOOGLE_APPLICATION_CREDENTIALS.');
      throw err;
    }
  }
}

try {
  initAdmin();
} catch (err) {
  console.error('[backfill] Falló la inicialización:', err.message || err);
  process.exit(1);
}

const db = admin.firestore();

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Decide, para cada usuario, si hay que escribirle el claim.
 *
 * Puro y exportado a propósito: es lo que decide un cambio de permisos en
 * producción, y la salida del dry-run solo vale si esto es correcto.
 *
 * @param docs           [{ uid, role }] leídos de Firestore
 * @param existingClaims Map<uid, customClaims> tal como están hoy en Auth
 * @param missingInAuth  Set<uid> con documento en Firestore pero sin cuenta de Auth
 */
function planClaimUpdates(docs, existingClaims, missingInAuth) {
  const plan = { toUpdate: [], alreadyOk: [], skipped: [] };

  for (const { uid, role } of docs) {
    if (missingInAuth.has(uid)) {
      plan.skipped.push({ uid, reason: 'no existe la cuenta en Auth' });
      continue;
    }
    if (!VALID_ROLES.includes(role)) {
      plan.skipped.push({ uid, reason: `rol inválido: ${JSON.stringify(role)}` });
      continue;
    }
    if (existingClaims.get(uid)?.role === role) {
      plan.alreadyOk.push({ uid, role });
      continue;
    }
    plan.toUpdate.push({ uid, role, from: existingClaims.get(uid)?.role ?? null });
  }

  return plan;
}

async function backfill() {
  console.log(`\n[backfill] Modo: ${APPLY ? 'APLICAR (escribe)' : 'SIMULACIÓN (no escribe)'}\n`);

  const snapshot = await db.collection('users').get();
  console.log(`[backfill] Documentos en users: ${snapshot.size}`);

  const docs = snapshot.docs.map((d) => ({ uid: d.id, role: d.data().role }));

  // getUsers acepta 100 identificadores por llamada. Se piden los claims actuales
  // para no reescribir lo que ya está bien.
  const existingClaims = new Map();
  const missingInAuth = new Set();

  for (const group of chunk(docs, 100)) {
    const result = await admin.auth().getUsers(group.map(({ uid }) => ({ uid })));
    result.users.forEach((u) => existingClaims.set(u.uid, u.customClaims || {}));
    result.notFound.forEach((id) => missingInAuth.add(id.uid));
  }

  const plan = planClaimUpdates(docs, existingClaims, missingInAuth);

  console.log(`[backfill] Ya correctos : ${plan.alreadyOk.length}`);
  console.log(`[backfill] Por actualizar: ${plan.toUpdate.length}`);
  console.log(`[backfill] Omitidos     : ${plan.skipped.length}\n`);

  plan.toUpdate.forEach(({ uid, role, from }) => {
    console.log(`  ${APPLY ? '→' : '·'} ${uid}  ${from ?? '(sin claim)'} → ${role}`);
  });
  plan.skipped.forEach(({ uid, reason }) => {
    console.log(`  ! ${uid}  omitido: ${reason}`);
  });

  if (!APPLY) {
    console.log('\n[backfill] Simulación: no se escribió nada. Repetí con --apply para aplicar.');
    return;
  }

  let updated = 0;
  const failed = [];

  // En serie a propósito: son decenas de usuarios y la API de Auth tiene cuota.
  // ponytail: si algún día son miles, agrupar de a ~10 en paralelo.
  for (const { uid, role } of plan.toUpdate) {
    try {
      // Se preservan otros claims que pudieran existir; solo se toca `role`.
      const claims = { ...(existingClaims.get(uid) || {}), role };
      await admin.auth().setCustomUserClaims(uid, claims);
      updated += 1;
    } catch (err) {
      failed.push({ uid, error: err.code || err.message });
    }
  }

  console.log(`\n[backfill] Actualizados: ${updated}`);
  if (failed.length) {
    console.log(`[backfill] Fallaron: ${failed.length}`);
    failed.forEach(({ uid, error }) => console.log(`  ✗ ${uid}: ${error}`));
  }

  console.log(
    '\n[backfill] Los claims se aplican al refrescarse el token: hasta 1 hora, o\n' +
    '           inmediato si el usuario cierra y vuelve a iniciar sesión.\n' +
    '           Cuando todos tengan claim, se puede borrar legacyHasRole() de\n' +
    '           firestore.rules y su llamada en hasRole().'
  );
}

// initializeApp() no falla cuando no hay credenciales: el error recién aparece al
// consultar, como un stack de OpenTelemetry de 40 líneas. Se traduce a algo legible.
const CREDENTIAL_HINTS = ['Unable to detect a Project Id', 'Could not load the default credentials', 'invalid_grant'];

// Solo corre si se invoca directamente. Importarlo (por ejemplo desde un test de
// planClaimUpdates) no debe tocar Firestore ni Auth.
if (require.main !== module) {
  module.exports = { planClaimUpdates, VALID_ROLES };
} else {
  backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    const message = err?.message || String(err);
    if (CREDENTIAL_HINTS.some((hint) => message.includes(hint))) {
      console.error(
        '\n[backfill] No hay credenciales utilizables.\n\n' +
        '  Opción A — service account (la más directa):\n' +
        '    node backfill_role_claims.js --serviceAccount=./service-account.json\n' +
        '    (Consola de Firebase → Configuración → Cuentas de servicio → Generar clave)\n\n' +
        '  Opción B — credenciales de aplicación por defecto:\n' +
        '    gcloud auth application-default login\n' +
        '    node backfill_role_claims.js --projectId=chickeninventoryapp\n'
      );
      process.exit(1);
    }
    console.error('[backfill] Error:', err);
    process.exit(1);
  });
}
