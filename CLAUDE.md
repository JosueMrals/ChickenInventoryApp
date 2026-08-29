# CLAUDE.md — Índice del código base

Este archivo es la memoria del proyecto para agentes (Claude Code). Se carga en cada sesión
para que el agente no tenga que re-explorar el repo. **Léelo antes de tocar cualquier archivo**
y respétalo como fuente de verdad; solo revisa el código cuando el índice no baste.

Complementa (no duplica): `android/.claude/CLAUDE.md`, `android/.github/copilot-instructions.md`,
`README.md`, `PRODUCT.md`, `DESIGN.md`.

---

## Reglas de salida (obligatorias — heredadas de copilot-instructions.md)

- **CERO relleno**: sin saludos, despedidas, "aquí tienes", "espero que te sirva".
- **CERO explicaciones previas o finales** salvo que el usuario diga "EXPLICA".
- **Cambios quirúrgicos**: `patch`/`write_file` para editar; **no** pegar código en el chat.
- **Reportar el cambio, no describirlo**: 1-3 líneas de qué se hizo y qué archivo. Si no se pide, sin racional.
- **Español**: UI, comentarios, commits y respuestas van en español (idioma del proyecto y del usuario).
- **Preguntar ≤1 línea** si falta contexto crítico; nunca inventar variables/APIs/archivos.

## Proyecto en 5 líneas

- **App**: `ChickenInventoryApp` — React Native 0.85, Android-only, para distribuidora de pollo en Nicaragua.
- **Backend**: Firebase (Auth, Firestore, Storage, Crashlytics, Functions, App Check). Firestore = fuente de verdad.
- **Roles**: `admin`, `vendedor`, `bodeguero`, `entregador` — mapeados a navegación y a `firestore.rules`.
- **Estado**: zustand por módulo + React Context puntual (`RouteContext`, `preSaleContext`).
- **Versión**: 2.1.0 (package.json aún dice 1.9.0 — inconsistencia conocida). Node ≥ 20, JDK 17, Android API ≥ 24.

## Comandos (correr desde la raíz del repo)

```bash
npm install                 # instala deps
npm start                   # metro (reset cache)
npm run android             # build+run debug en emulador/dispositivo
npm run lint                # eslint .   (32 errores preexistentes en archivos ajenos, ignóralos)
npm test                    # jest — 30 suites, 229 tests, DEBE seguir en verde
npx jest <path>             # test individual
```

Desde `android/`:
```bash
./gradlew :app:assembleDebug
./gradlew :app:assembleRelease   # requiere my-release-key.keystore + gradle.properties
./gradlew clean
```

Deploy Firebase (raíz): `firebase deploy --only firestore:rules,firestore:indexes,storage`

## Layout crítico

```
/  (raíz del repo — aquí arrancan Claude/tests/lint)
├── App.tsx                       # NavigationContainer + Drawer + Stack. Registrar aquí toda pantalla nueva.
├── index.js                      # entry RN
├── package.json / jest.config.js / jest.setup.js
├── firebase/
│   ├── firestore.rules           # reglas por rol (isAdmin/isVendedor/isBodeguero/isEntregador)
│   ├── firestore.indexes.json    # índices compuestos
│   └── storage.rules             # goodsReceipts/, customers/, resto denegado
├── functions/                    # Cloud Functions (proyecto Node separado, su propio package.json)
│   └── index.js                  # createUser, deleteUser, updateUserPassword, syncUserRoleClaim,
│                                 # syncAllRoleClaims, resolveLoginEmail, getDashboardStats,
│                                 # completePreSalePayment, dispatchPreSale, updateOwnProfile
├── __tests__/                    # 29 suites raíz (más 1 en android/app/src/screens/reception/__tests__)
└── android/app/src/              # ¡TODO el JS/TS de la app vive aquí, no en android/app/src/main/java!
    ├── screens/<módulo>/         # feature-module: components/, hooks/, services/, styles/, [store/|context/]
    ├── services/                 # servicios globales (auth, firebase, receptionService, returnService, preSaleService, etc.)
    ├── navigation/               # ProductsStack, PreSaleStack, QuickSaleStack, ReceptionStack, UsersStack
    ├── context/                  # RouteContext (contextos por módulo viven junto a su módulo)
    ├── hooks/                    # useSessionTimeout, useAdaptiveBottom, useSubmitLock
    ├── helpers/ · utils/ · styles/
    └── main/java                 # NATIVO Android (raro tocar)
```

Secretos gitignored: `android/app/google-services.json`, `android/app/my-release-key.keystore`, `android/gradle.properties`.

## Módulos (screens/) — mapa rápido

| Módulo | Rutas Drawer/Stack | Roles | Nota |
|---|---|---|---|
| `dashboard/` | (raíz, tras login) | todos | Contenedor + variants (Classic/Modern) + `dashboardConfig.js` (fuente de módulos y stats por rol) |
| `productsNew1/` | `ProductsStack` → ProductsList, ProductDetail, EditProduct, AddProduct, AddStock, BarcodeScanner, ManageCategories, CategoryForm, ProductsAggregates | admin edita, todos leen | El nombre del módulo es histórico. Detalle acepta `{product, role}` — carga con `getProductById` si sólo tienes id |
| `presales/` | `PreSaleStack` | admin, vendedor | Con `PreSaleProvider` |
| `quicksalesNew/` | `QuickSaleStack` | admin, vendedor | zustand: `store/useQuickCartStore.js` |
| `sales/` | `SalesScreen` (drawer) | admin | Reportes de ventas |
| `Warehouse/` | `PreparePreSales`, `WarehouseOrderDetail`, `ProductHandover`, `HandoverHistory`, `MyDeliveries`, `DeliveryPayment`, `DeliveryDone` | admin, bodeguero, entregador | Drift conocido: usa `#2DCE89` en vez de Field Blue — no arreglar hasta tocarlo |
| `customer/` | `Customer`, `CustomerForm`, `CustomerDetail` | admin, vendedor, entregador(consulta) | Fotos: `customerPhotosService` (Storage + ImageResizer) |
| `credits/` | `Credits`, `CreditsHistory`, `CreditDetail` | admin, vendedor, entregador | Ver `firestore.rules` — sobregiro por % o fijo |
| `routes/` | `Routes`, `AddRouteScreen`, `RouteSelection` | admin edita, resto selecciona | `RouteContext` global |
| `returns/` | `Returns` | admin, bodeguero, entregador | Ver `services/returnService.js` — `applyReturnToPresale` es pura y está testeada |
| `reports/` | `Reports` | admin | Agregaciones server-side (Cloud Function `getDashboardStats`) |
| `users/` | `UsersStack` | admin | Callable functions para create/delete/updatePassword |
| `payroll/` | `Payroll`, `StaffAccount`, `PayrollHistory`, `StaffPurchase` | admin (StaffPurchase también bodeguero) | Adelantos, deducciones, cierres |
| `reception/` | `Reception` (stack: ReceptionList, ReceptionCreate, ReceptionDetail) | admin, bodeguero | **Nuevo**. Ver sección dedicada abajo |
| `settings/` | `Settings`, `PrintersScreen`, `TicketCustomizationScreen` | admin, entregador | Impresión BT, tema de tickets |

## Cómo agregar una pantalla nueva

1. **Screen** en `android/app/src/screens/<módulo>/screens/`. Recibe `route`, saca params de `route.params`.
2. **Estilos** en `<módulo>/styles/`. Usa la paleta de `DESIGN.md` (ver más abajo).
3. Si es un flujo de varias pantallas → **Stack** propio en `android/app/src/navigation/<Módulo>Stack.jsx` (patrón: lee `role/user` de `route.params` y los reinyecta con `initialParams`).
4. **Registrar en `App.tsx`**: importa, crea alias `const XScreenAny = X as React.ComponentType<any>;`, y añade `<Drawer.Screen name="X">{(props) => <XScreenAny {...props} user={user} role={role} />}</Drawer.Screen>`.
5. **Dashboard**: añade el módulo en `android/app/src/screens/dashboard/dashboardConfig.js` (en `ALL_MODULES` y en `MODULE_GROUPS_BY_ROLE`).
6. **Reglas Firestore/Storage**: si escribe una colección nueva, añadir regla en `firebase/firestore.rules` con el rol adecuado.
7. **Test**: si añades lógica pura (validación, cálculos, mutaciones), añade `__tests__/<x>.test.js` — no rompas la suite verde.

## Convenciones de edición (leer antes de cambiar código)

- **No reescribir archivos completos.** Usa `patch` (mode replace/patch) con snippets únicos.
- **Diff quirúrgico.** No refactorizar/renombrar/reformatear código no pedido.
- **No inventar** archivos/APIs/símbolos. Si no lo viste en el repo, léelo.
- **Imports/deps** deben existir en `package.json`. Bibliotecas ya disponibles y no obvias:
  - `react-native-image-picker`, `@bam.tech/react-native-image-resizer` (patrón fotos: ver `customerPhotosService.js`, `invoicePhotosService.js`).
  - `react-native-vector-icons/Ionicons` (nombres kebab con `-outline`).
  - `date-fns` con locale `es`.
  - `zustand` para stores locales por módulo.
  - `react-native-bluetooth-classic` (térmica), `react-native-html-to-pdf`, `react-native-print`, `react-native-share`.
  - `@react-native-ml-kit/barcode-scanning` + `react-native-vision-camera`.
- **Firestore modular API**: importar `firestore, { serverTimestamp, increment }` de `@react-native-firebase/firestore` como en `productsService.js`.
- **Transacciones**: siempre releer con `tx.get()` dentro (patrón `returnService.approveReturnRequest` / `receptionService.createGoodsReceipt`). Todas las lecturas antes de cualquier escritura.
- **Concurrencia**: submitting refs (`submittingRef.current`) para evitar dobles envíos que dupliquen movimientos.
- **Errores**: usar `captureError(error, context)` de `services/errorMonitoring.js`, no `console.error` a secas.
- **Ticket impreso**: preservar ancho, alineación y `C$`. Nada de reformateo incidental.
- **Fechas**: usar utilidades existentes (`helpers/date*`), no inventar formateadores.
- **Descuentos/créditos**: campos habitualmente `null`; validar antes de operar.
- **Idioma**: comentarios, alerts, commits en español.

## Design system (extracto — la fuente es `DESIGN.md` y `.impeccable/design.json`)

- **Accent único**: Field Blue `#007AFF` (headers, primary, FAB, activo).
- **Semánticos**: `#34C759` verde éxito/pagado; `#FF3B30` rojo peligro/eliminar. Nunca decorativos.
- **Sombra única**: `shadowColor #0A2540, offset {0,2}, opacity 0.05, radius 6, elevation 2`. Sin sombras secundarias.
- **Tipografía**: system (Roboto). Pesos 800/700 para títulos y números, 500/600 para body/labels. Sin fuente custom.
- **Radios**: pill `30px` (primary buttons/FAB), `16px` cards, `8-12px` inputs y contenedores anidados.
- **Canvas**: `#F5F6FA` / `#F0F4F8` con cards blancas. Sin gradientes, glass o blur.
- **Drift conocido no arreglar hasta tocar**: `Warehouse` usa `#2DCE89`; `App.tsx` tiene mezcla de tabs indentados con tabs y espacios.

## Reglas Firestore — patrones que ya existen (no duplicar)

- Helper `hasRole(rol)` mira **custom claim** (`request.auth.token.role`), con fallback legacy a `users/{uid}.role` (retirable cuando termine el backfill).
- **products**: bodeguero/vendedor pueden update pero solo `['stock','lastSaleUpdate','updatedAt']`.
- **counters**: admin/vendedor/bodeguero (para `goodsReceiptCounter`, `preSaleCounter`).
- **inventoryMovements**: create admin/vendedor/bodeguero; no update/delete.
- **goodsReceipts**: create admin/bodeguero (nace `completed`, `createdByUid == auth.uid`); update solo admin y solo `completed→voided`; no delete (auditoría).
- Storage `goodsReceipts/{fileName}`: read operativos, write admin/bodeguero (≤ 8MB, `image/.*`).
- Storage `customers/{customerId}/{fileName}`: read operativos, write admin/vendedor.

## Módulo Reception (nuevo — resumen operativo)

- **Colecciones**: `goodsReceipts` (cabecera + líneas embebidas + `invoicePhoto {url, path, uploadedAt}`), `inventoryMovements` (feed cronológico `type: 'reception' | 'reception_void'`), `counters/goodsReceiptCounter` (consecutivo).
- **Servicio**: `android/app/src/services/receptionService.js` — puro: `round2`, `normalizeReceiptItem`, `computeReceiptTotals`, `validateReceptionDraft({items,supplier,reference})`, `computeReceiptStockChanges`, `computeVoidStockChanges`. Transaccionales: `createGoodsReceipt`, `voidGoodsReceipt` (solo admin, exige motivo, bloquea si stock ya consumido). Suscripciones: `subscribeGoodsReceipts`, `subscribeReceptionMovements`.
- **Fotos factura**: `screens/reception/services/invoicePhotosService.js` — sube a `goodsReceipts/{ts}.jpg` (comprime a 1600px, JPEG 75).
- **Hook**: `useGoodsReceipts({limit})` con filtros `search`, `statusFilter` (`all|completed|voided`) y `timeFilter` (`all|today|7d|30d`) — todo en cliente sobre la página cargada.
- **Modales flotantes**: `InvoicePhotoModal`, `LineItemModal`, `ProductPickerModal`.
- **UI compacta** actual: `receiptRow` con barra lateral de color (verde/rojo), banda `summaryBandSm` (3 celdas con divisor), buscador de 38px con ícono embebido, chips en una sola fila horizontal deslizable (tiempo + separador + estado).
- **Requisitos de validación**: proveedor y N.º de factura obligatorios; ≥1 línea; cantidad > 0; costo ≥ 0; sin productos duplicados.
- **Navegación cruzada**: `ReceptionDetail` abre el producto en inventario vía `navigation.navigate('ProductsStack', {screen: 'ProductDetail', params: {product, role}})` cargando el producto completo con `getProductById`.

## Tests — patrones de mock para Firestore/Auth

Preset: `@react-native/jest-preset`, setup en `jest.setup.js` (ya mockea `image-picker`, `image-resizer`, `firebase/app`, `firebase/auth`, `storage.putFile`).

Patrones de referencia:
- **Lógica pura**: `__tests__/receptionServiceLogic.test.js`, `__tests__/returnService.test.js`.
- **Transacción mockeando store completo**: `__tests__/receptionServiceTransaction.test.js` (contadores, snapshots, writes acumulados) y `__tests__/preSaleStatusGuard.test.js` (contención por `failIds`).
- **Hook con `renderHook`/`act`**: `android/app/src/screens/reception/__tests__/useGoodsReceipts.test.js`, `android/app/src/screens/credits/__tests__/useCredits.test.js`.

## Utilidades y servicios reutilizables (usa esto, no dupliques)

- `services/firebase.js` (`db`, `auth`), `services/firebaseConfig.js` (`firestore` modular).
- `services/operations/productOperations.js` — `createProductOperation` para log en `product_movements`.
- `services/errorMonitoring.js` — `captureError`, `setMonitoringUser`.
- `services/accountManager.js` — resolver login, callables `createUser/deleteUser/updateUserPassword`.
- `services/preSaleService.js` — `updatePreSaleStatusGuarded`, `TERMINAL_PRESALE_STATUSES`, `deletePreSaleInFirestore`.
- `services/returnService.js` — `applyReturnToPresale` (pura), `approveReturnRequest`, `fulfillShortage`.
- `services/receptionService.js` — ver arriba.
- `hooks/useSubmitLock.js` — candado de submit.
- `hooks/useAdaptiveBottom.js` — padding inferior según safe area.
- `context/RouteContext.js` — ruta activa global.
- `utils/SessionManager.js` + `hooks/useSessionTimeout.js` — logout por inactividad (15 min por defecto).

## Anti-patrones observados en el repo (evítalos)

- Crear un servicio de fotos nuevo → **reutilizar patrón** `customerPhotosService` / `invoicePhotosService`.
- Añadir formateador de fecha → usar utilidades existentes o `date-fns` con locale `es`.
- Escribir `stock` con set directo → transacción con relectura + `serverTimestamp()` para `updatedAt` (respeta reglas).
- Añadir `console.error` sueltos → `captureError`.
- Registrar pantalla sin actualizar `dashboardConfig.js` → aparecerá en drawer pero no en el dashboard por rol.
- Escribir sin `createdByUid == auth.uid` en `goodsReceipts` / documentos con guardas → falla la regla.

## Convenciones de commits (según historial)

- Prefijos observados: `--update:`, `--fix:`. Descripción en español, explícita, sin cuerpo.
- No hacer commits/push desde el agente sin pedirlo explícitamente.
