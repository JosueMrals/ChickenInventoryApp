const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  // Verificar que haya un usuario autenticado
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Solo usuarios autenticados pueden realizar esta acción."
    );
  }

  const requesterUid = context.auth.uid;

  // Verificar si el usuario es admin
  const requesterDoc = await admin.firestore().collection("users").doc(requesterUid).get();
  if (!requesterDoc.exists || requesterDoc.data().role !== "admin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Solo administradores pueden eliminar usuarios."
    );
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError("invalid-argument", "Se requiere el UID del usuario.");
  }

  try {
    // 1️⃣ Eliminar de Authentication
    await admin.auth().deleteUser(uid);

    // 2️⃣ Eliminar de Firestore
    await admin.firestore().collection("users").doc(uid).delete();

    return { success: true, message: `Usuario ${uid} eliminado correctamente.` };
  } catch (error) {
    console.error("🔥 Error eliminando usuario:", error);
    throw new functions.https.HttpsError("unknown", error.message);
  }
});
