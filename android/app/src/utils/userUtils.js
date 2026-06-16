/**
 * Utilidades para resolución de nombres de usuario a partir de emails.
 *
 * Los documentos de venta guardan vendedor/entregador como emails.
 * Esta utilidad permite mostrar el nombre completo consultando la colección `users`.
 */

/**
 * Construye un mapa email → usuario a partir de un array de docs de Firestore.
 * @param {Array} usersArray - Array de objetos de usuario { id, nombre, apellido, email, ... }
 * @returns {Object} Mapa { "email@example.com": { nombre, apellido, email, ... } }
 */
export function buildUsersByEmailMap(usersArray = []) {
  return usersArray.reduce((map, u) => {
    if (u.email) {
      map[u.email.toLowerCase()] = u;
    }
    return map;
  }, {});
}

/**
 * Resuelve el nombre completo de un usuario a partir de su email.
 * Si no se encuentra en el mapa, devuelve el valor original (email o lo que sea).
 *
 * @param {string|null} emailOrValue - Email del usuario (o cualquier string)
 * @param {Object} usersByEmail - Mapa email → usuario (de buildUsersByEmailMap)
 * @returns {string|null} Nombre completo si se encontró, o el valor original
 */
export function resolveUserDisplayName(emailOrValue, usersByEmail = {}) {
  if (!emailOrValue) return null;

  const key = String(emailOrValue).toLowerCase().trim();
  const user = usersByEmail[key];

  if (user) {
    const nombre = (user.nombre || '').trim();
    const apellido = (user.apellido || '').trim();
    const fullName = [nombre, apellido].filter(Boolean).join(' ');
    if (fullName) return fullName;
  }

  // Fallback: si el valor es un email, devolver la parte antes del @
  // para no mostrar el dominio completo en el ticket
  if (emailOrValue.includes('@')) {
    return emailOrValue.split('@')[0];
  }

  return emailOrValue;
}

