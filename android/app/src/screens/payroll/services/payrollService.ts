import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {
  Advance,
  Settlement,
  Shortage,
  StaffAccount,
  StaffMember,
  StaffPurchase,
  StaffPurchaseItem,
  STAFF_ROLES,
  SHORTAGE_PAYROLL_DEDUCTED,
  StaffRole,
} from '../types';

const usersCollection = firestore().collection('users');
const advancesCollection = firestore().collection('payrollAdvances');
const purchasesCollection = firestore().collection('staffPurchases');
const shortagesCollection = firestore().collection('deliveryShortages');
const settlementsCollection = firestore().collection('payrollSettlements');
const productsCollection = firestore().collection('products');
// S1.10-F1: el salario vive aparte de `users` — ese documento lo lee
// cualquier rol operativo (`users.read: isOperativo()`), y Firestore no puede
// ocultar un campo suyo sin ocultar el documento entero. `staffSalaries/{uid}`
// tiene su propia regla de lectura (admin o el propio trabajador).
const salariesCollection = firestore().collection('staffSalaries');

const toNumber = (value: any): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Redondeo a 2 decimales: son montos de dinero, no flotantes crudos. */
const money = (value: number): number => Number(value.toFixed(2));

/**
 * Precio real de un producto para una entrega a personal. Mismo criterio que
 * `useStaffPurchaseCart.resolvePrice` (`salePrice` manda, `price` es el
 * respaldo) — se duplica aquí, no se importa, porque ese hook vive en la capa
 * de UI y este archivo es el que factura contra nómina: el precio que se
 * cobra tiene que salir del documento releído en la transacción, no de lo que
 * el carrito calculó en pantalla.
 */
const resolveProductPrice = (product: any): number => {
  const value = product?.salePrice ?? product?.price;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Hash corto y determinístico (djb2) de una cadena — sin dependencia nueva
 * (no hay `crypto` fiable en React Native sin un polyfill). S1.10-F6 lo usa
 * para construir el id del settlement a partir de QUÉ se está liquidando, no
 * de un contador: ver `settleStaffPeriod`.
 */
const hashKey = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash * 33) + value.charCodeAt(i)) % 1000000007;
  }
  return Math.abs(hash).toString(36);
};

export const buildStaffName = (data: any): string => {
  const nombre = typeof data?.nombre === 'string' ? data.nombre.trim() : '';
  const apellido = typeof data?.apellido === 'string' ? data.apellido.trim() : '';
  const full = [nombre, apellido].filter(Boolean).join(' ').trim();
  return full || data?.email || 'Trabajador';
};

// ── Trabajadores ──────────────────────────────────────────────────────────────

/**
 * Trabajadores con rol operativo. `salary` es `null` mientras el admin no lo
 * configure — no 0, que se leería como "trabaja gratis".
 *
 * S1.10-F1: `salary` ya no vive en `users` — se combina aquí con
 * `staffSalaries` (dos suscripciones independientes, unidas en memoria) para
 * que el resto del módulo siga recibiendo el mismo `StaffMember[]` de antes.
 */
export const subscribeStaff = (
  onUpdate: (staff: StaffMember[]) => void,
  onError?: (e: Error) => void,
): (() => void) => {
  let users: Omit<StaffMember, 'salary'>[] = [];
  let salaryByUid: Record<string, number> = {};
  let usersReady = false;
  let salariesReady = false;

  const emit = () => {
    if (!usersReady || !salariesReady) return;
    const list = users.map((u) => ({
      ...u,
      salary: u.uid in salaryByUid ? salaryByUid[u.uid] : null,
    })) as StaffMember[];
    list.sort((a, b) => buildStaffName(a).localeCompare(buildStaffName(b), 'es'));
    onUpdate(list);
  };

  const unsubUsers = usersCollection
    .where('role', 'in', STAFF_ROLES)
    .onSnapshot(
      (snapshot) => {
        users = (snapshot?.docs || []).map((doc) => {
          const data = doc.data() || {};
          return {
            uid: doc.id,
            nombre: data.nombre,
            apellido: data.apellido,
            email: data.email,
            role: data.role as StaffRole,
          };
        });
        usersReady = true;
        emit();
      },
      (error) => {
        console.error('[payrollService] subscribeStaff (users):', error);
        onError?.(error as Error);
        onUpdate([]);
      },
    );

  const unsubSalaries = salariesCollection.onSnapshot(
    (snapshot) => {
      salaryByUid = {};
      (snapshot?.docs || []).forEach((doc) => {
        salaryByUid[doc.id] = toNumber(doc.data()?.salary);
      });
      salariesReady = true;
      emit();
    },
    (error) => {
      console.error('[payrollService] subscribeStaff (salaries):', error);
      onError?.(error as Error);
      onUpdate([]);
    },
  );

  return () => {
    unsubUsers();
    unsubSalaries();
  };
};

export const setSalary = async (uid: string, salary: number): Promise<void> => {
  if (!uid) throw new Error('Trabajador inválido.');
  if (!Number.isFinite(salary) || salary < 0) {
    throw new Error('El salario debe ser un monto válido mayor o igual a cero.');
  }
  // `.set()`, no `.update()`: la primera vez que se configura el salario de un
  // trabajador, `staffSalaries/{uid}` todavía no existe.
  await salariesCollection.doc(uid).set({
    salary: money(salary),
    updatedAt: firestore.FieldValue.serverTimestamp(),
    updatedBy: auth().currentUser?.email || 'N/A',
  });
};

// ── Adelantos de salario ──────────────────────────────────────────────────────

/** Solo los del periodo abierto: `settlementId == null`. */
export const subscribePendingAdvances = (
  onUpdate: (advances: Advance[]) => void,
  onError?: (e: Error) => void,
) =>
  advancesCollection
    .where('settlementId', '==', null)
    .onSnapshot(
      (snapshot) => {
        const list = (snapshot?.docs || []).map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        })) as Advance[];
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        onUpdate(list);
      },
      (error) => {
        console.error('[payrollService] subscribePendingAdvances:', error);
        onError?.(error as Error);
        onUpdate([]);
      },
    );

export const addAdvance = async ({
  uid,
  userName,
  amount,
  note,
}: {
  uid: string;
  userName: string;
  amount: number;
  note?: string;
}): Promise<string> => {
  if (!uid) throw new Error('Trabajador inválido.');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('El monto del adelanto debe ser mayor a cero.');
  }

  const ref = advancesCollection.doc();
  await ref.set({
    uid,
    userName,
    amount: money(amount),
    note: note?.trim() || null,
    createdAt: firestore.FieldValue.serverTimestamp(),
    createdBy: auth().currentUser?.email || 'N/A',
    // `null` explícito (no ausente): las consultas del periodo abierto filtran
    // por `settlementId == null`, y Firestore no indexa campos inexistentes.
    settlementId: null,
  });
  return ref.id;
};

/**
 * Elimina un adelanto que todavía no se pagó. Relee dentro de la transacción:
 * si el cierre de periodo ya lo saldó, borrarlo descuadraría ese pago.
 */
export const deleteAdvance = async (advanceId: string): Promise<void> => {
  const ref = advancesCollection.doc(advanceId);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    if (snap.data()?.settlementId) {
      throw new Error('Este adelanto ya fue incluido en un pago y no se puede eliminar.');
    }
    tx.delete(ref);
  });
};

// ── Productos solicitados a bodega ────────────────────────────────────────────

export const subscribePendingPurchases = (
  onUpdate: (purchases: StaffPurchase[]) => void,
  onError?: (e: Error) => void,
) =>
  purchasesCollection
    .where('settlementId', '==', null)
    .onSnapshot(
      (snapshot) => {
        const list = (snapshot?.docs || []).map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        })) as StaffPurchase[];
        list.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
        onUpdate(list);
      },
      (error) => {
        console.error('[payrollService] subscribePendingPurchases:', error);
        onError?.(error as Error);
        onUpdate([]);
      },
    );

/**
 * Entrega de bodega a un trabajador para uso personal. Es una venta sin cobro:
 * descuenta stock igual que una venta, pero en vez de pedir pago deja la deuda
 * para el día de pago.
 *
 * Toda la operación va en una transacción que valida existencias contra el stock
 * releído: sin eso, dos entregas simultáneas del mismo producto podrían dejar el
 * inventario en negativo.
 */
export const createStaffPurchase = async ({
  uid,
  userName,
  items,
}: {
  uid: string;
  userName: string;
  items: StaffPurchaseItem[];
}): Promise<string> => {
  if (!uid) throw new Error('Selecciona el trabajador que recibe los productos.');
  const lines = (items || []).filter((i) => i.productId && toNumber(i.quantity) > 0);
  if (lines.length === 0) {
    throw new Error('Agrega al menos un producto con cantidad.');
  }

  // Un mismo producto puede venir en varias líneas: se agrupa por producto
  // para pedir stock/precio una sola vez por id, no por línea.
  const qtyByProduct = lines.reduce<Record<string, number>>((acc, line) => {
    acc[line.productId] = (acc[line.productId] || 0) + toNumber(line.quantity);
    return acc;
  }, {});

  const purchaseRef = purchasesCollection.doc();
  const user = auth().currentUser;

  await firestore().runTransaction(async (tx) => {
    const productIds = Object.keys(qtyByProduct);
    const refs = productIds.map((id) => productsCollection.doc(id));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    snaps.forEach((snap, idx) => {
      const needed = qtyByProduct[productIds[idx]];
      if (!snap.exists()) {
        throw new Error(`Producto no encontrado: ${productIds[idx]}`);
      }
      const stock = toNumber(snap.data()?.stock);
      if (stock < needed) {
        throw new Error(
          `Stock insuficiente para ${snap.data()?.name || productIds[idx]}. Disponible: ${stock}, requerido: ${needed}`,
        );
      }
    });

    // El precio se cobra contra nómina, así que sale del producto REAL
    // releído en esta misma transacción — nunca de `item.unitPrice`/`.total`,
    // que el cliente pudo declarar arbitrariamente (S1.10-F5).
    const priceByProduct: Record<string, number> = {};
    snaps.forEach((snap, idx) => {
      priceByProduct[productIds[idx]] = resolveProductPrice(snap.data());
    });

    const verifiedLines: StaffPurchaseItem[] = lines.map((line) => {
      const unitPrice = priceByProduct[line.productId];
      return {
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        unitPrice,
        total: money(unitPrice * toNumber(line.quantity)),
      };
    });
    const total = money(verifiedLines.reduce((sum, line) => sum + line.total, 0));

    refs.forEach((ref, idx) => {
      tx.update(ref, {
        stock: firestore.FieldValue.increment(-qtyByProduct[productIds[idx]]),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    tx.set(purchaseRef, {
      uid,
      userName,
      items: verifiedLines,
      total,
      createdAt: firestore.FieldValue.serverTimestamp(),
      createdBy: user?.email || 'N/A',
      createdByUid: user?.uid || null,
      settlementId: null,
    });
  });

  return purchaseRef.id;
};

/** Anula una entrega aún no pagada y devuelve los productos al inventario. */
export const cancelStaffPurchase = async (purchaseId: string): Promise<void> => {
  const ref = purchasesCollection.doc(purchaseId);
  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data() || {};
    if (data.settlementId) {
      throw new Error('Esta entrega ya fue incluida en un pago y no se puede anular.');
    }

    const lines: StaffPurchaseItem[] = data.items || [];
    const qtyByProduct = lines.reduce<Record<string, number>>((acc, line) => {
      if (!line.productId) return acc;
      acc[line.productId] = (acc[line.productId] || 0) + toNumber(line.quantity);
      return acc;
    }, {});

    Object.keys(qtyByProduct).forEach((productId) => {
      tx.update(productsCollection.doc(productId), {
        stock: firestore.FieldValue.increment(qtyByProduct[productId]),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    tx.delete(ref);
  });
};

// ── Faltantes (los registra la aprobación de devoluciones) ────────────────────

/**
 * Faltantes todavía a cargo del trabajador. `status == 'pending'` excluye los
 * que ya repuso en producto (`fulfilled`) y los ya descontados de un pago
 * anterior (`payroll_deducted`).
 */
export const subscribePendingShortages = (
  onUpdate: (shortages: Shortage[]) => void,
  onError?: (e: Error) => void,
) =>
  shortagesCollection
    .where('status', '==', 'pending')
    .onSnapshot(
      (snapshot) => {
        const list = (snapshot?.docs || []).map((doc) => ({
          id: doc.id,
          ...(doc.data() as any),
        })) as Shortage[];
        list.sort((a, b) => (b.recordedAt?.toMillis?.() ?? 0) - (a.recordedAt?.toMillis?.() ?? 0));
        onUpdate(list);
      },
      (error) => {
        console.error('[payrollService] subscribePendingShortages:', error);
        onError?.(error as Error);
        onUpdate([]);
      },
    );

// ── Consulta acotada a un trabajador (su propia nómina) ───────────────────────
// A diferencia de subscribeStaff/subscribePendingAdvances/etc. (traen TODA la
// plantilla, uso exclusivo del admin), estas filtran por uid en el servidor:
// es lo único que puede ver quien abre su nómina sin ser admin.

/** S1.10-F1: mismo criterio de combinación que `subscribeStaff`, para un solo uid. */
export const subscribeStaffMember = (
  uid: string,
  onUpdate: (staff: StaffMember | null) => void,
  onError?: (e: Error) => void,
): (() => void) => {
  let userData: any; // undefined = no ha llegado, null = no existe
  let salaryValue: number | null = null;
  let salaryReady = false;

  const emit = () => {
    if (userData === undefined || !salaryReady) return;
    if (userData === null) return onUpdate(null);
    onUpdate({
      uid,
      nombre: userData.nombre,
      apellido: userData.apellido,
      email: userData.email,
      role: userData.role as StaffRole,
      salary: salaryValue,
    });
  };

  const unsubUser = usersCollection.doc(uid).onSnapshot(
    (doc: any) => {
      userData = doc.exists() ? doc.data() || {} : null;
      emit();
    },
    (error: Error) => {
      console.error('[payrollService] subscribeStaffMember (user):', error);
      onError?.(error);
      onUpdate(null);
    },
  );

  const unsubSalary = salariesCollection.doc(uid).onSnapshot(
    (doc: any) => {
      salaryValue = doc.exists() ? toNumber(doc.data()?.salary) : null;
      salaryReady = true;
      emit();
    },
    (error: Error) => {
      console.error('[payrollService] subscribeStaffMember (salary):', error);
      onError?.(error);
      onUpdate(null);
    },
  );

  return () => {
    unsubUser();
    unsubSalary();
  };
};

export const subscribeOwnAdvances = (
  uid: string,
  onUpdate: (advances: Advance[]) => void,
  onError?: (e: Error) => void,
) =>
  advancesCollection.where('uid', '==', uid).where('settlementId', '==', null).onSnapshot(
    (snapshot: any) =>
      onUpdate((snapshot?.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() })) as Advance[]),
    (error: Error) => {
      console.error('[payrollService] subscribeOwnAdvances:', error);
      onError?.(error);
      onUpdate([]);
    },
  );

export const subscribeOwnPurchases = (
  uid: string,
  onUpdate: (purchases: StaffPurchase[]) => void,
  onError?: (e: Error) => void,
) =>
  purchasesCollection.where('uid', '==', uid).where('settlementId', '==', null).onSnapshot(
    (snapshot: any) =>
      onUpdate((snapshot?.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() })) as StaffPurchase[]),
    (error: Error) => {
      console.error('[payrollService] subscribeOwnPurchases:', error);
      onError?.(error);
      onUpdate([]);
    },
  );

export const subscribeOwnShortages = (
  uid: string,
  onUpdate: (shortages: Shortage[]) => void,
  onError?: (e: Error) => void,
) =>
  shortagesCollection.where('entregadorId', '==', uid).where('status', '==', 'pending').onSnapshot(
    (snapshot: any) =>
      onUpdate((snapshot?.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() })) as Shortage[]),
    (error: Error) => {
      console.error('[payrollService] subscribeOwnShortages:', error);
      onError?.(error);
      onUpdate([]);
    },
  );

// ── Cálculo del estado de cuenta ──────────────────────────────────────────────

/**
 * Arma el estado de cuenta de un trabajador. Pura (sin Firestore) para poder
 * probarla: recibe las listas del periodo abierto y devuelve los totales.
 */
export const buildStaffAccount = (
  staff: StaffMember,
  advances: Advance[],
  purchases: StaffPurchase[],
  shortages: Shortage[],
): StaffAccount => {
  const own = <T extends { uid?: string }>(list: T[]) => (list || []).filter((i) => i.uid === staff.uid);

  const staffAdvances = own(advances);
  const staffPurchases = own(purchases);
  // Los faltantes se registran contra el entregador, con otro nombre de campo.
  const staffShortages = (shortages || []).filter((s) => s.entregadorId === staff.uid);

  const advancesTotal = money(staffAdvances.reduce((sum, a) => sum + toNumber(a.amount), 0));
  const purchasesTotal = money(staffPurchases.reduce((sum, p) => sum + toNumber(p.total), 0));
  const shortagesTotal = money(
    staffShortages.reduce((sum, s) => sum + toNumber(s.totalMissingValue), 0),
  );

  const deductionsTotal = money(advancesTotal + purchasesTotal + shortagesTotal);

  return {
    staff,
    advances: staffAdvances,
    purchases: staffPurchases,
    shortages: staffShortages,
    advancesTotal,
    purchasesTotal,
    shortagesTotal,
    deductionsTotal,
    // Un neto negativo es información real: el trabajador debe más de lo que
    // gana en el periodo. No se recorta a 0 para no ocultar el saldo en contra.
    netPay: money(toNumber(staff.salary) - deductionsTotal),
  };
};

// ── Cierre de periodo (día de pago) ───────────────────────────────────────────

/**
 * Cierra el periodo de un trabajador: registra el pago y marca como saldados sus
 * adelantos, entregas de bodega y faltantes, dejando el siguiente periodo en cero.
 *
 * Todo se relee DENTRO de la transacción y solo se incluye lo que siga
 * pendiente: la pantalla puede traer datos de la caché offline y, si un adelanto
 * ya se pagó en otro cierre, contarlo de nuevo lo descontaría dos veces del
 * sueldo. Los totales del documento se calculan con lo releído, nunca con lo que
 * mostraba la UI.
 */
export const settleStaffPeriod = async (account: StaffAccount): Promise<Settlement> => {
  const { staff } = account;
  if (!staff?.uid) throw new Error('Trabajador inválido.');
  if (staff.salary == null) {
    throw new Error('Configura el salario del trabajador antes de cerrar el periodo.');
  }

  // S1.10-F6: el id del settlement sale de QUÉ se está liquidando (el
  // conjunto de adelantos/compras/faltantes que trae `account`, tal como
  // estaban al presionar "pagar"), no de un contador ni de un id aleatorio.
  // Dos intentos que parten del MISMO estado visible (doble tap, dos
  // dispositivos mirando la misma cuenta, un reintento que reusa el mismo
  // `account` en memoria) calculan el MISMO id — Firestore solo deja que UNO
  // de los dos lo cree; el otro lo encuentra ya existente (ver el `tx.get()`
  // de abajo) y se rechaza con un error claro en vez de duplicar el pago.
  // Límite conocido, aceptado explícitamente (ver informe de cierre): un
  // reintento MANUAL, más tarde, después de que la pantalla ya se refrescó
  // mostrando el periodo en cero, calcula un id "vacío" distinto y SÍ podría
  // crear un segundo pago de salario completo — el negocio no tiene un
  // concepto de periodo con fecha que permita distinguir ese caso de un
  // segundo periodo real sin deducciones.
  const dedupSource = [
    ...account.advances.map((a) => a.id),
    ...account.purchases.map((p) => p.id),
    ...account.shortages.map((s) => s.id),
  ].sort().join(',') || 'empty';
  const settlementRef = settlementsCollection.doc(`${staff.uid}_${hashKey(dedupSource)}`);
  const user = auth().currentUser;

  const advanceRefs = account.advances.map((a) => advancesCollection.doc(a.id));
  const purchaseRefs = account.purchases.map((p) => purchasesCollection.doc(p.id));
  const shortageRefs = account.shortages.map((s) => shortagesCollection.doc(s.id));

  return firestore().runTransaction(async (tx) => {
    // Todas las lecturas antes de cualquier escritura (requisito de Firestore).
    const existingSettlementSnap = await tx.get(settlementRef);
    if (existingSettlementSnap.exists()) {
      throw new Error(
        'Ya se registró un pago para estas deducciones. Actualiza la pantalla antes de reintentar.',
      );
    }

    const staffSnap = await tx.get(usersCollection.doc(staff.uid));
    // `exists` es un MÉTODO en @react-native-firebase v23: `snap.exists` a secas
    // devuelve la función, que siempre es truthy, y la guarda nunca dispararía.
    if (!staffSnap.exists()) throw new Error('El trabajador ya no existe.');

    // S1.10-F1: el salario real sale de `staffSalaries`, no de `users`.
    const salarySnap = await tx.get(salariesCollection.doc(staff.uid));
    if (!salarySnap.exists()) {
      throw new Error('Configura el salario del trabajador antes de cerrar el periodo.');
    }

    const [advanceSnaps, purchaseSnaps, shortageSnaps] = await Promise.all([
      Promise.all(advanceRefs.map((ref) => tx.get(ref))),
      Promise.all(purchaseRefs.map((ref) => tx.get(ref))),
      Promise.all(shortageRefs.map((ref) => tx.get(ref))),
    ]);

    // El salario que se paga es el del servidor, no el que traía la pantalla.
    const salary = money(toNumber(salarySnap.data()?.salary));

    // `s.data()?.uid`/`entregadorId` releído del servidor decide si el
    // documento pertenece a ESTE trabajador — no basta con que `account`
    // (armado en pantalla) lo incluyera: un cliente modificado podría colar
    // el id de un adelanto/compra/faltante ajeno (S1.10-F4).
    const liveAdvances = advanceSnaps.filter(
      (s) => s.exists() && !s.data()?.settlementId && s.data()?.uid === staff.uid,
    );
    const livePurchases = purchaseSnaps.filter(
      (s) => s.exists() && !s.data()?.settlementId && s.data()?.uid === staff.uid,
    );
    const liveShortages = shortageSnaps.filter(
      (s) => s.exists() && s.data()?.status === 'pending' && s.data()?.entregadorId === staff.uid,
    );

    const advancesTotal = money(
      liveAdvances.reduce((sum, s) => sum + toNumber(s.data()?.amount), 0),
    );
    const purchasesTotal = money(
      livePurchases.reduce((sum, s) => sum + toNumber(s.data()?.total), 0),
    );
    const shortagesTotal = money(
      liveShortages.reduce((sum, s) => sum + toNumber(s.data()?.totalMissingValue), 0),
    );
    const deductionsTotal = money(advancesTotal + purchasesTotal + shortagesTotal);

    const settlement: Omit<Settlement, 'id'> = {
      uid: staff.uid,
      userName: buildStaffName(staffSnap.data()),
      role: staff.role,
      salary,
      advancesTotal,
      purchasesTotal,
      shortagesTotal,
      deductionsTotal,
      netPay: money(salary - deductionsTotal),
      advanceIds: liveAdvances.map((s) => s.id),
      purchaseIds: livePurchases.map((s) => s.id),
      shortageIds: liveShortages.map((s) => s.id),
      paidAt: firestore.FieldValue.serverTimestamp(),
      paidBy: user?.email || 'N/A',
    };

    tx.set(settlementRef, settlement);

    // Marcar (no borrar): el detalle de qué se descontó y por qué tiene que
    // seguir siendo auditable después del pago.
    liveAdvances.forEach((snap) => tx.update(snap.ref, { settlementId: settlementRef.id }));
    livePurchases.forEach((snap) => tx.update(snap.ref, { settlementId: settlementRef.id }));
    liveShortages.forEach((snap) =>
      tx.update(snap.ref, {
        status: SHORTAGE_PAYROLL_DEDUCTED,
        payrollSettlementId: settlementRef.id,
        payrollDeductedAt: firestore.FieldValue.serverTimestamp(),
      }),
    );

    return { id: settlementRef.id, ...settlement } as Settlement;
  });
};

/** Historial de pagos. `uid` lo acota a un trabajador. */
export const subscribeSettlements = (
  onUpdate: (settlements: Settlement[]) => void,
  uid: string | null = null,
  limit = 50,
  onError?: (e: Error) => void,
) => {
  let query = settlementsCollection as any;
  if (uid) query = query.where('uid', '==', uid);

  return query
    .orderBy('paidAt', 'desc')
    .limit(limit)
    .onSnapshot(
      (snapshot: any) => {
        onUpdate(
          (snapshot?.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() })) as Settlement[],
        );
      },
      (error: Error) => {
        console.error('[payrollService] subscribeSettlements:', error);
        onError?.(error);
        onUpdate([]);
      },
    );
};
