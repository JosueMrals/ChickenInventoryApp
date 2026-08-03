// Tipos del módulo de Nómina.
//
// El salario NO vive en una colección propia: es un campo de `users/{uid}`, que
// ya existe y cuyas reglas solo dejan escribir al admin. Los faltantes tampoco
// se re-registran: son los `deliveryShortages` que ya crea la aprobación de
// devoluciones (services/returnService.js).

export type StaffRole = 'vendedor' | 'entregador' | 'bodeguero';

export const STAFF_ROLES: StaffRole[] = ['vendedor', 'entregador', 'bodeguero'];

export const ROLE_LABELS: Record<StaffRole, string> = {
  vendedor: 'Vendedor',
  entregador: 'Entregador',
  bodeguero: 'Bodeguero',
};

/** Trabajador con salario configurado (documento de `users`). */
export interface StaffMember {
  uid: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  role: StaffRole;
  /** Salario base del periodo. `null` mientras el admin no lo configure. */
  salary: number | null;
}

/** Adelanto de salario (`payrollAdvances`). */
export interface Advance {
  id: string;
  uid: string;
  userName: string;
  amount: number;
  note: string | null;
  createdAt?: any;
  createdBy?: string;
  /** Id del cierre que lo saldó; `null` mientras siga pendiente. */
  settlementId: string | null;
}

/** Línea de una solicitud de productos a bodega. */
export interface StaffPurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Producto solicitado a bodega para uso personal (`staffPurchases`). */
export interface StaffPurchase {
  id: string;
  uid: string;
  userName: string;
  items: StaffPurchaseItem[];
  total: number;
  createdAt?: any;
  /** Bodeguero que entregó los productos. */
  createdBy?: string;
  settlementId: string | null;
}

/** Faltante a cargo del trabajador (`deliveryShortages`, ya existente). */
export interface Shortage {
  id: string;
  entregadorId: string | null;
  customerName?: string;
  totalMissingValue: number;
  status: string;
  recordedAt?: any;
}

/** Estado de cuenta de un trabajador dentro del periodo abierto. */
export interface StaffAccount {
  staff: StaffMember;
  advances: Advance[];
  purchases: StaffPurchase[];
  shortages: Shortage[];
  advancesTotal: number;
  purchasesTotal: number;
  shortagesTotal: number;
  /** adelantos + compras + faltantes */
  deductionsTotal: number;
  /** salario - deducciones (puede ser negativo: el trabajador queda debiendo) */
  netPay: number;
}

/** Cierre de periodo: la foto de lo pagado (`payrollSettlements`). */
export interface Settlement {
  id: string;
  uid: string;
  userName: string;
  role: StaffRole;
  salary: number;
  advancesTotal: number;
  purchasesTotal: number;
  shortagesTotal: number;
  deductionsTotal: number;
  netPay: number;
  advanceIds: string[];
  purchaseIds: string[];
  shortageIds: string[];
  paidAt?: any;
  paidBy?: string;
}

/** Estado que reciben los faltantes descontados de la nómina. */
export const SHORTAGE_PAYROLL_DEDUCTED = 'payroll_deducted';
