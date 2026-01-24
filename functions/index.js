const functions = require("firebase-functions");
const admin = require("firebase-admin");
const util = require("util"); // Importar para inspección avanzada

// Asegúrate de inicializar admin solo una vez
if (admin.apps.length === 0) {
  admin.initializeApp();
}

exports.updateUserPassword = functions.https.onCall(async (data, context) => {
  // --- INICIO DE DEPURACIÓN ---
  console.log("--- Invocación de 'updateUserPassword' ---");

  // 1. Verificar si el contexto de autenticación existe
  if (!context.auth) {
    console.error("Error: La función fue llamada sin un contexto de autenticación.");
    throw new functions.https.HttpsError(
      "unauthenticated",
      "La función debe ser llamada por un usuario autenticado."
    );
  }

  // 2. Inspeccionar el token completo del usuario que llama
  console.log("Token del usuario que llama:", JSON.stringify(context.auth.token, null, 2));
  console.log("Rol del usuario:", context.auth.token.role);
  // --- FIN DE DEPURACIÓN ---

  // 1. Verificar que el que llama es un admin
  if (context.auth.token.role !== "admin") {
    console.error(`Fallo de permisos. Rol encontrado: '${context.auth.token.role}'. Se requiere 'admin'.`);
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo los administradores pueden cambiar contraseñas."
    );
  }

  // Los datos de la contraseña vienen en data.data
  const { uid, password } = data.data;
  console.log(`Intentando cambiar contraseña para UID: ${uid}`);

  // 2. Validar datos de entrada
  if (!uid || !password || password.length < 6) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Se requiere UID y una contraseña de al menos 6 caracteres."
    );
  }

  try {
    // 3. Actualizar la contraseña usando el Admin SDK
    await admin.auth().updateUser(uid, {
      password: password,
    });

    return { message: `Contraseña actualizada correctamente para el usuario ${uid}` };
  } catch (error) {
    // 4. Registrar el error específico del Admin SDK
    console.error("Error específico de admin.auth().updateUser():", error);
    throw new functions.https.HttpsError(
      "internal",
      "No se pudo actualizar la contraseña."
    );
  }
});

exports.setUserRole = functions.https.onCall(async (data, context) => {
  // Se reactiva la guarda de seguridad
  if (context.auth.token.role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo los administradores pueden asignar roles."
    );
  }

  // Extraer 'email' y 'role' del objeto anidado 'data.data'
  const { email, role } = data.data;

  if (!email || !role) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Se requiere 'email' y 'role'."
    );
  }

  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role: role });
    return { message: `Éxito. El usuario ${email} ahora tiene el rol de ${role}.` };
  } catch (error) {
    console.error("Error dentro del bloque try/catch al asignar rol:", error);
    throw new functions.https.HttpsError("internal", "No se pudo asignar el rol.");
  }
});
