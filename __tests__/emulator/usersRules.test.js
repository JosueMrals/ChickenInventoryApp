/**
 * Regresión de las reglas de `users` contra Firestore Emulator real
 * (FASE S1.1 — corrección de S1-02, auto-escalación de rol).
 *
 * Antes de esta fase, `users.create` no validaba `role` en absoluto: un
 * usuario autenticado podía crear su propio documento con `role: 'admin'`
 * (o cualquier otro rol), y el trigger `syncUserRoleClaim` lo propagaba a un
 * Custom Claim real. Ningún flujo legítimo de la app se auto-registra hoy
 * (`createUser` es la única alta real, vía Admin SDK, que no pasa por estas
 * Rules) — así que cerrar el auto-registro sin rol no quita ninguna
 * capacidad existente.
 */
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'chickeninventoryapp-emulator-test-users',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

afterEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

const asFreshUser = (uid) => testEnv.authenticatedContext(uid).firestore(); // sin custom claim todavía
const asAdmin = () => testEnv.authenticatedContext('admin-1', { role: 'admin' }).firestore();

const seedUser = async (uid, data) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection('users').doc(uid).set(data);
  });
};

describe('users — Rules (FASE S1.1, corrección de S1-02)', () => {
  // Test A
  test('un usuario normal NO puede auto-registrarse con role=admin', async () => {
    await assertFails(
      asFreshUser('user-A').collection('users').doc('user-A').set({
        email: 'a@test.com', nombre: 'A', apellido: 'A', user: 'usera',
        role: 'admin',
        createdAt: new Date(),
      })
    );
  });

  test('un usuario normal NO puede auto-registrarse con ningún otro rol privilegiado (vendedor/entregador/bodeguero)', async () => {
    for (const role of ['vendedor', 'entregador', 'bodeguero']) {
      await assertFails(
        asFreshUser(`user-${role}`).collection('users').doc(`user-${role}`).set({
          email: `${role}@test.com`, nombre: 'A', apellido: 'A', user: role,
          role,
          createdAt: new Date(),
        })
      );
    }
  });

  // Test B
  test('el auto-registro legítimo (sin rol) SÍ está permitido', async () => {
    await assertSucceeds(
      asFreshUser('user-B').collection('users').doc('user-B').set({
        email: 'b@test.com', nombre: 'B', apellido: 'B', user: 'userb',
        createdAt: new Date(),
      })
    );
  });

  test('el auto-registro con role explícitamente null también está permitido', async () => {
    await assertSucceeds(
      asFreshUser('user-B2').collection('users').doc('user-B2').set({
        email: 'b2@test.com', nombre: 'B2', apellido: 'B2', user: 'userb2',
        role: null,
        createdAt: new Date(),
      })
    );
  });

  // Test C
  test('admin puede crear un usuario con un rol permitido (vendedor)', async () => {
    await assertSucceeds(
      asAdmin().collection('users').doc('user-C').set({
        email: 'c@test.com', nombre: 'C', apellido: 'C', user: 'userc',
        role: 'vendedor',
        createdAt: new Date(),
      })
    );
  });

  // Test D — la rama isAdmin() no se tocó: sigue sin restricción de rol.
  test('admin puede crear otro admin (capacidad existente, sin cambios)', async () => {
    await assertSucceeds(
      asAdmin().collection('users').doc('user-D').set({
        email: 'd@test.com', nombre: 'D', apellido: 'D', user: 'userd',
        role: 'admin',
        createdAt: new Date(),
      })
    );
  });

  // Test E
  test('un usuario NO puede modificar su propio role (update sigue exigiendo admin, sin cambios de esta fase)', async () => {
    await seedUser('user-E', { email: 'e@test.com', role: null });
    await assertFails(
      asFreshUser('user-E').collection('users').doc('user-E').update({ role: 'admin' })
    );
  });

  // Test F
  test('un usuario NO puede modificar el role de otro usuario', async () => {
    await seedUser('user-F', { email: 'f@test.com', role: null });
    await assertFails(
      asFreshUser('user-other').collection('users').doc('user-F').update({ role: 'admin' })
    );
  });

  // Test G — corolario lógico de Test A, documentado explícitamente: no se
  // puede probar el trigger syncUserRoleClaim en este entorno (el proyecto
  // solo levanta `--only firestore,auth`, sin el emulador de Functions), pero
  // el resultado es una garantía MÁS fuerte que probar el trigger: un
  // Cloud Function `onWrite` solo se dispara sobre una escritura que
  // realmente ocurrió. Si Firestore rechaza el `create` (Test A, ya
  // verificado arriba), el documento con `role: 'admin'` nunca se persiste,
  // así que `syncUserRoleClaim` nunca se ejecuta para ese intento — no hay
  // ningún camino por el que el claim pueda terminar siendo 'admin'.
  test('un intento de auto-escalación no deja ningún documento con role=admin en Firestore (nada que el trigger pueda propagar)', async () => {
    await assertFails(
      asFreshUser('user-G').collection('users').doc('user-G').set({
        email: 'g@test.com', role: 'admin', createdAt: new Date(),
      })
    );

    let exists = null;
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const snap = await ctx.firestore().collection('users').doc('user-G').get();
      exists = snap.exists;
    });
    expect(exists).toBe(false); // ni siquiera con role=admin rechazado quedó un documento a medias
  });
});
