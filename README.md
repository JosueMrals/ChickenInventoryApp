<br/># 🐔 ChickenInventoryApp

<p align="center">
  <img src="./resources/ic_launcher.png" alt="ChickenInventoryApp Logo" width="120"/>
</p>

<p align="center">
  <strong>Sistema de gestión de inventario, ventas y rutas para distribuidoras de pollo</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.9.0-blue" />
  <img src="https://img.shields.io/badge/React%20Native-0.83.1-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/Firebase-23.8.2-FFCA28?logo=firebase" />
  <img src="https://img.shields.io/badge/platform-Android-3DDC84?logo=android" />
</p>

---

## 📱 Presentación

**ChickenInventoryApp** es una aplicación móvil nativa para Android desarrollada con **React Native**, diseñada específicamente para negocios de distribución y venta de pollo. Permite a equipos de vendedores, bodegueros y administradores gestionar en tiempo real el inventario, las ventas, las rutas de entrega y los reportes del negocio desde cualquier dispositivo Android.

---

## 📋 Descripción

La aplicación conecta en tiempo real con **Firebase Firestore** y ofrece una experiencia completa de gestión empresarial adaptada al sector avícola. Cuenta con autenticación segura, control de roles por usuario, generación de reportes en PDF, lectura de códigos de barras, impresión por Bluetooth y sincronización automática de datos en la nube.

### Módulos principales:

| Módulo | Descripción |
|--------|-------------|
| 🔐 **Autenticación** | Login seguro con Firebase Auth y verificación de correo |
| 📦 **Inventario** | Gestión de productos, stock en bodega y movimientos |
| 🛒 **Ventas rápidas** | Registro de ventas al instante con control de cantidades |
| 📋 **Preventas** | Creación de pedidos anticipados para rutas de entrega |
| 👥 **Clientes** | Catálogo de clientes, historial de compras y créditos |
| 🗺️ **Rutas** | Asignación y selección de rutas de distribución |
| 📊 **Reportes** | Generación de informes en PDF y exportación de datos |
| ⚙️ **Usuarios** | Administración de cuentas y roles del sistema |
| 🏪 **Bodega** | Control de entradas/salidas de productos en bodega |

---

## 🎯 Propósitos

- **Digitalizar** el proceso de ventas y distribución de productos avícolas eliminando el uso de papel.
- **Centralizar** la información de inventario, clientes y ventas en tiempo real en la nube.
- **Optimizar** las rutas de distribución y el trabajo en campo de los vendedores.
- **Controlar** el acceso por roles: administrador, vendedor, entregador y bodeguero.
- **Monitorear** errores en producción con Firebase Crashlytics para garantizar estabilidad.
- **Facilitar** la impresión de recibos y reportes directamente desde el móvil vía Bluetooth.

---

## 🏗️ Estructura del Proyecto

```
ChickenInventoryApp/
├── android/
│   └── app/
│       └── src/
│           ├── screens/           # Pantallas de la aplicación
│           │   ├── dashboard/     # Panel principal por rol
│           │   ├── sales/         # Módulo de ventas
│           │   ├── quicksalesNew/ # Ventas rápidas
│           │   ├── presales/      # Preventas / pedidos
│           │   ├── customer/      # Gestión de clientes y créditos
│           │   ├── reports/       # Reportes y estadísticas
│           │   ├── Warehouse/     # Bodega
│           │   ├── users/         # Administración de usuarios
│           │   ├── routes/        # Rutas de distribución
│           │   ├── settings/      # Configuración
│           │   └── productsNew1/  # Catálogo de productos
│           ├── services/          # Lógica de negocio y Firebase
│           │   ├── firebase.js
│           │   ├── auth.js
│           │   ├── customersService.js
│           │   ├── preSaleService.js
│           │   ├── errorMonitoring.js
│           │   └── operations/
│           ├── navigation/        # Navegación entre pantallas
│           ├── context/           # Contextos globales (React Context)
│           ├── hooks/             # Custom hooks
│           ├── helpers/           # Funciones auxiliares
│           ├── styles/            # Estilos globales
│           └── utils/             # Utilidades generales
├── functions/                     # Firebase Cloud Functions
├── firebase/                      # Reglas y configuración Firestore
├── App.tsx                        # Entrada principal + navigationRef
├── index.js                       # Entry point de React Native
└── package.json
```

---

## 🛠️ Tecnologías Implementadas

### Core
| Tecnología | Versión | Uso |
|------------|---------|-----|
| React Native | 0.83.1 | Framework principal |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Tipado estático |
| Node.js | ≥ 20 | Entorno de ejecución |

### Firebase
| Librería | Uso |
|----------|-----|
| `@react-native-firebase/app` | Inicialización Firebase |
| `@react-native-firebase/auth` | Autenticación de usuarios |
| `@react-native-firebase/firestore` | Base de datos en tiempo real |
| `@react-native-firebase/storage` | Almacenamiento de archivos |
| `@react-native-firebase/crashlytics` | Monitoreo de errores en producción |
| `@react-native-firebase/app-distribution` | Distribución de builds de prueba |
| `@react-native-firebase/functions` | Cloud Functions |

### Navegación y UI
| Librería | Uso |
|----------|-----|
| `@react-navigation/native` | Sistema de navegación |
| `@react-navigation/native-stack` | Navegación en stack |
| `@react-navigation/drawer` | Menú lateral |
| `react-native-vector-icons` | Íconos |
| `react-native-reanimated` | Animaciones fluidas |
| `react-native-gesture-handler` | Gestos táctiles |
| `react-native-safe-area-context` | Áreas seguras de pantalla |

### Hardware y Periféricos
| Librería | Uso |
|----------|-----|
| `react-native-bluetooth-classic` | Impresión por Bluetooth |
| `react-native-ble-plx` | BLE (Bluetooth Low Energy) |
| `react-native-vision-camera` | Cámara para escaneo |
| `@react-native-ml-kit/barcode-scanning` | Lectura de códigos de barras |

### Reportes y Archivos
| Librería | Uso |
|----------|-----|
| `react-native-html-to-pdf` | Generación de PDFs |
| `react-native-print` | Impresión de documentos |
| `react-native-fs` | Acceso al sistema de archivos |
| `react-native-share` | Compartir archivos |

### Estado y Almacenamiento
| Librería | Uso |
|----------|-----|
| `zustand` | Manejo de estado global |
| `@react-native-async-storage/async-storage` | Almacenamiento local |
| `react-native-encrypted-storage` | Almacenamiento seguro/encriptado |

---

## ⚙️ Configuración del Entorno y Ejecución

### Requisitos Previos (Ambos sistemas)
- **Node.js** ≥ 20
- **JDK 17**
- **Android SDK** con `platform-tools`, `platforms;android-34`, `build-tools;34.0.0`
- **Android Studio** (recomendado para emulador)
- Dispositivo Android o emulador con API ≥ 24

---

### 📁 Archivos que debes agregar manualmente (NO están en Git)

Estos archivos contienen secretos y **nunca se versionan**. Debes crearlos/copiarlos tú mismo:

| Archivo | Ruta exacta | Descripción |
|---------|-------------|-------------|
| `google-services.json` | `android/app/google-services.json` | Configuración Firebase |
| `my-release-key.keystore` | `android/app/my-release-key.keystore` | Firma de APK release |

---

### 🪟 Windows

#### 1. Variables de entorno (Sistema → Variables de entorno)

```
JAVA_HOME   = C:\Program Files\Java\jdk-17
ANDROID_HOME = C:\Users\<TuUsuario>\AppData\Local\Android\Sdk
```

Agrega al **PATH**:
```
%JAVA_HOME%\bin
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\cmdline-tools\latest\bin
%ANDROID_HOME%\emulator
```

#### 2. Instalación de dependencias

```cmd
npm install
```

#### 3. Ejecutar en modo Debug

```cmd
npm start
```
En otra terminal:
```cmd
npm run android
```

#### 4. Generar APK Release

Asegúrate de tener en `android/gradle.properties`:
```properties
MYAPP_UPLOAD_STORE_FILE=my-release-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=chickeninventory
MYAPP_UPLOAD_STORE_PASSWORD=tu_password
MYAPP_UPLOAD_KEY_PASSWORD=tu_password
```

Luego ejecuta:
```cmd
cd android
gradlew assembleRelease
```

El APK se genera en:
```
android\app\build\outputs\apk\release\app-release.apk
```

#### 5. Limpiar build (Windows)
```cmd
cd android
gradlew clean
```

---

### 🐧 Linux / Ubuntu

#### 1. Instalar Java 17

```bash
sudo apt update && sudo apt install openjdk-17-jdk -y
```

#### 2. Configurar variables de entorno

Agrega al final de `~/.bashrc`:

```bash
# Java
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export PATH=$PATH:$JAVA_HOME/bin

# Android SDK
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
```

Aplica los cambios:
```bash
source ~/.bashrc
```

#### 3. Instalar Android SDK

```bash
sdkmanager --install "platform-tools"
sdkmanager --install "platforms;android-34"
sdkmanager --install "build-tools;34.0.0"
sdkmanager --licenses   # Acepta todo con 'y'
```

#### 4. Dar permisos de ejecución a Gradle

> ⚠️ **Obligatorio en Linux.** El bit de ejecución se pierde al copiar desde Windows.

```bash
chmod +x android/gradlew
```

#### 5. Agregar archivos secretos

```bash
# Copia tu google-services.json (obtenlo de Firebase Console)
cp /ruta/de/tu/google-services.json android/app/google-services.json

# Opción A: Copia tu keystore existente de Windows
cp /ruta/de/tu/my-release-key.keystore android/app/my-release-key.keystore

# Opción B: Genera un nuevo keystore (solo si es la primera vez)
keytool -genkeypair -v \
  -keystore android/app/my-release-key.keystore \
  -alias chickeninventory \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass tu_password -keypass tu_password \
  -dname "CN=ChickenInventoryApp, OU=Dev, O=MyOrg, L=City, ST=State, C=US"
```

#### 6. Instalar dependencias

```bash
npm install
```

#### 7. Ejecutar en modo Debug

```bash
npm start
```
En otra terminal:
```bash
npm run android
```

#### 8. Limpiar build

```bash
cd android
./gradlew clean
```

#### 9. Generar APK Release

```bash
cd android
./gradlew assembleRelease
```

El APK se genera en:
```
android/app/build/outputs/apk/release/app-release.apk
```

---

## 🔒 Seguridad

Los siguientes archivos **nunca deben subirse a Git** y están en `.gitignore`:

```
android/app/google-services.json
android/app/*.keystore
android/app/*.jks
android/gradle.properties   # Si contiene contraseñas
```

> ⚠️ Si ya tienes la app en Google Play Store, **conserva siempre el mismo keystore**. Si lo pierdes, no podrás publicar actualizaciones de la app.

---

## 🐛 Monitoreo de Errores

El proyecto integra **Firebase Crashlytics** para reportar crashes en producción automáticamente. La recolección de datos está:
- ✅ **Activada** en builds `release`
- ❌ **Desactivada** en builds `debug`

---

## 📄 Licencia

Proyecto privado — Todos los derechos reservados © 2024 ChickenInventoryApp.
