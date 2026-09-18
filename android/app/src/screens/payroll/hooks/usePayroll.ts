import { useEffect, useMemo, useState } from 'react';
import {
  buildStaffAccount,
  subscribeOwnAdvances,
  subscribeOwnPurchases,
  subscribeOwnShortages,
  subscribePendingAdvances,
  subscribePendingPurchases,
  subscribePendingShortages,
  subscribeStaff,
  subscribeStaffMember,
} from '../services/payrollService';
import { Advance, Shortage, StaffAccount, StaffPurchase, StaffMember } from '../types';

/**
 * Estado de cuenta de TODOS los trabajadores en el periodo abierto.
 *
 * Una sola suscripción por colección para toda la pantalla: cada trabajador
 * filtra de esas listas en memoria (buildStaffAccount). Abrir una consulta por
 * trabajador multiplicaría los listeners por la plantilla sin traer un dato que
 * no esté ya aquí.
 */
export const usePayroll = () => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [purchases, setPurchases] = useState<StaffPurchase[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Cada colección avisa por separado cuándo llegó: sin esto la pantalla se
  // quedaba en "cargando" si una de las cuatro fallaba.
  const [ready, setReady] = useState({
    staff: false,
    advances: false,
    purchases: false,
    shortages: false,
  });

  useEffect(() => {
    const done = (key: keyof typeof ready) =>
      setReady((prev) => (prev[key] ? prev : { ...prev, [key]: true }));

    const fail = (e: Error) => setError(e?.message || 'No se pudieron cargar los datos de nómina.');

    const unsubStaff = subscribeStaff(
      (list) => { setStaff(list); done('staff'); },
      (e) => { fail(e); done('staff'); },
    );
    const unsubAdvances = subscribePendingAdvances(
      (list) => { setAdvances(list); done('advances'); },
      (e) => { fail(e); done('advances'); },
    );
    const unsubPurchases = subscribePendingPurchases(
      (list) => { setPurchases(list); done('purchases'); },
      (e) => { fail(e); done('purchases'); },
    );
    const unsubShortages = subscribePendingShortages(
      (list) => { setShortages(list); done('shortages'); },
      (e) => { fail(e); done('shortages'); },
    );

    return () => {
      unsubStaff();
      unsubAdvances();
      unsubPurchases();
      unsubShortages();
    };
  }, []);

  const accounts: StaffAccount[] = useMemo(
    () => staff.map((member) => buildStaffAccount(member, advances, purchases, shortages)),
    [staff, advances, purchases, shortages],
  );

  const totals = useMemo(
    () => ({
      staffCount: accounts.length,
      salaries: Number(accounts.reduce((sum, a) => sum + (a.staff.salary || 0), 0).toFixed(2)),
      deductions: Number(accounts.reduce((sum, a) => sum + a.deductionsTotal, 0).toFixed(2)),
      netPay: Number(accounts.reduce((sum, a) => sum + a.netPay, 0).toFixed(2)),
      missingSalary: accounts.filter((a) => a.staff.salary == null).length,
    }),
    [accounts],
  );

  const loading = !ready.staff || !ready.advances || !ready.purchases || !ready.shortages;

  return { accounts, totals, loading, error };
};

/** Cuenta de un solo trabajador, derivada de la misma suscripción (uso del admin). */
export const useStaffAccount = (uid: string): { account: StaffAccount | null; loading: boolean; error: string | null } => {
  const { accounts, loading, error } = usePayroll();
  const account = useMemo(
    () => accounts.find((a) => a.staff.uid === uid) || null,
    [accounts, uid],
  );
  return { account, loading, error };
};

/**
 * Cuenta de UN trabajador, consultando solo lo suyo (`where uid == ...`).
 *
 * A diferencia de `useStaffAccount`, no pasa por `usePayroll()`: no puede
 * abrir las 4 suscripciones sin filtro que traen a toda la plantilla, porque
 * esto es lo que usa el propio trabajador (no admin) para ver su nómina, y
 * ahí sí importa que no vea salarios ni adelantos ajenos.
 */
export const useOwnStaffAccount = (
  uid: string | null,
): { account: StaffAccount | null; loading: boolean; error: string | null } => {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [purchases, setPurchases] = useState<StaffPurchase[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState({ staff: false, advances: false, purchases: false, shortages: false });

  useEffect(() => {
    if (!uid) return undefined;
    const done = (key: keyof typeof ready) =>
      setReady((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
    const fail = (e: Error) => setError(e?.message || 'No se pudo cargar tu nómina.');

    const unsubStaff = subscribeStaffMember(uid, (s) => { setStaff(s); done('staff'); }, (e) => { fail(e); done('staff'); });
    const unsubAdvances = subscribeOwnAdvances(uid, (l) => { setAdvances(l); done('advances'); }, (e) => { fail(e); done('advances'); });
    const unsubPurchases = subscribeOwnPurchases(uid, (l) => { setPurchases(l); done('purchases'); }, (e) => { fail(e); done('purchases'); });
    const unsubShortages = subscribeOwnShortages(uid, (l) => { setShortages(l); done('shortages'); }, (e) => { fail(e); done('shortages'); });

    return () => { unsubStaff(); unsubAdvances(); unsubPurchases(); unsubShortages(); };
  }, [uid]);

  const account = useMemo(
    () => (staff ? buildStaffAccount(staff, advances, purchases, shortages) : null),
    [staff, advances, purchases, shortages],
  );

  const loading = !uid || !ready.staff || !ready.advances || !ready.purchases || !ready.shortages;

  return { account, loading, error };
};
