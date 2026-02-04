// src/hooks/useProductForm.js
import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * useProductForm — Singleton store sin Context
 * Ahora con recalculo seguro de salePrice cuando autoSalePrice === true.
 */

// ------ ESTADO GLOBAL (singleton) ------
const initialState = {
  name: '',
  barcode: '',
  description: '',
  purchasePrice: '',    // string or number
  profitMargin: '',     // string or number (porcentaje)
  autoSalePrice: true,
  salePrice: '',        // string or number
  measureType: 'unit',
  wholesalePrice: '',
  wholesaleThreshold: '',
  stock: 0,
};

let store = {
  values: { ...initialState },
  subscribers: new Set(),
};

// ------ Helpers ------
function safeNumber(v) {
  if (v === '' || v === null || v === undefined) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function calculateSalePriceIfNeeded(values) {
  // returns the computed salePrice number or null if not computable
  if (!values.autoSalePrice) return null;
  const cost = safeNumber(values.purchasePrice);
  const margin = safeNumber(values.profitMargin);
  if (Number.isNaN(cost) || Number.isNaN(margin)) return null;
  if (margin >= 100) return null;
  const sale = Number((cost / (1 - margin / 100)).toFixed(2));
  return sale;
}

// ------ NOTIFICAR SUSCRIPTORES ------
function notifySubscribers() {
  for (const fn of store.subscribers) {
    try {
      fn(store.values);
    } catch (err) {
      console.warn('Subscriber error:', err);
    }
  }
}

// ------ MUTACIONES DEL STORE (con recalculo) ------
function setFieldInStore(field, value) {
  // build prospective next values
  const next = { ...store.values, [field]: value };

  // if we changed fields that affect salePrice or autoSalePrice itself, compute new salePrice
  const computed = calculateSalePriceIfNeeded(next);
  if (computed !== null) {
    // only set if different from next.salePrice (compare numbers or strings)
    const currentSale = next.salePrice;
    // normalize to number for comparison when possible
    const curNum = safeNumber(currentSale);
    if (Number.isNaN(curNum) || curNum !== computed) {
      next.salePrice = computed;
    } else {
      // keep existing (might be string same numeric)
      next.salePrice = currentSale;
    }
  } else {
    // If autoSalePrice is false, don't override salePrice (leave as user set)
    // If computed === null because inputs invalid, do not change salePrice
  }

  // shallow compare to avoid needless notifications
  let changed = false;
  const keys = Object.keys(next);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (store.values[k] !== next[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return false;

  store.values = next;
  notifySubscribers();
  return true;
}

function setValuesInStore(obj) {
  const next = { ...store.values, ...obj };

  // recalc salePrice if necessary
  const computed = calculateSalePriceIfNeeded(next);
  if (computed !== null) {
    const curNum = safeNumber(next.salePrice);
    if (Number.isNaN(curNum) || curNum !== computed) {
      next.salePrice = computed;
    }
  }

  // detect change
  let changed = false;
  const keys = Object.keys(next);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (store.values[k] !== next[k]) {
      changed = true;
      break;
    }
  }
  if (!changed) return false;

  store.values = next;
  notifySubscribers();
  return true;
}

function resetStore() {
  store.values = { ...initialState };
  notifySubscribers();
}

function getValuesFromStore() {
  return store.values;
}

function subscribeToStore(callback) {
  store.subscribers.add(callback);
  // send initial snapshot synchronously
  try {
    callback(store.values);
  } catch (e) {
    /* ignore */
  }
  return () => store.subscribers.delete(callback);
}

// ------ HOOK PRINCIPAL ------
export function useProductForm() {
  const [values, reactSetValues] = useState(() => ({ ...store.values }));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const unsubscribe = subscribeToStore((v) => {
      if (!mounted.current) return;

      reactSetValues((prev) => {
        // shallow compare to avoid unnecessary rerenders
        const keys = Object.keys(v);
        for (let k of keys) {
          if (prev[k] !== v[k]) return { ...v };
        }
        return prev;
      });
    });

    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, []);

  // Métodos públicos (estable)
  const setField = useCallback((field, value) => {
    return setFieldInStore(field, value);
  }, []);

  const setFormValues = useCallback((obj) => {
    return setValuesInStore(obj);
  }, []);

  const reset = useCallback(() => {
    resetStore();
  }, []);

  const getValues = useCallback(() => {
    return getValuesFromStore();
  }, []);

  return {
    values,
    setField,
    setFormValues,
    reset,
    getValues,
  };
}

// helpers expuestos
export const getProductFormValues = () => getValuesFromStore();
export const resetProductForm = () => resetStore();
export const setProductFormValues = (obj) => setValuesInStore(obj);
