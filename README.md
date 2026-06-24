# Mi Salud

App personal (PWA) para llevar tus temas de salud: **medicamentos, citas médicas, exámenes de laboratorio y diario de síntomas**. Datos en la nube con Firebase, acceso solo con tu cuenta, instalable en el iPhone.

## Qué hace

- **Inicio** — resumen: medicamentos activos, próxima cita, último examen y registro.
- **Medicamentos** — qué tomas, dosis, frecuencia, horarios, activo/suspendido.
- **Citas** — especialistas, fecha/hora, lugar, motivo y notas de la consulta.
- **Exámenes** — **subes el PDF/foto del examen**, se guarda en la nube y queda "Por revisar". Cuando le pides a Claude que lo revise, escribe de vuelta un **resumen**, **comparación con el anterior**, marca los **valores fuera de rango** y alimenta las **gráficas de evolución**.
- **Diario** — ánimo, síntomas, peso, presión, glucosa día a día.
- Funciona **offline** (caché del service worker + persistencia de Firestore).

## Revisión de exámenes por Claude

El flujo "pro": subes el examen desde la app (iPhone o Mac) → vive en Firebase Storage → le dices a Claude *"revisa mi último examen"* → Claude lo baja con el puente local, lo lee y deja el análisis dentro de la app. El montaje del puente está en [`tools/README.md`](tools/README.md).

> El análisis es informativo y de organización. **No es diagnóstico ni reemplaza a tu médico.**

## Estructura

```
mi-salud/
  index.html
  manifest.webmanifest      PWA
  sw.js                     service worker (offline)
  firestore.rules           reglas de seguridad (solo tu cuenta)
  css/styles.css
  icons/icon.svg
  js/
    firebase-config.js      <-- AQUÍ pegas tus credenciales
    firebase.js             init de Firebase (auth + firestore offline)
    auth.js                 login Google restringido a tu correo
    db.js                   CRUD genérico sobre Firestore
    ui.js                   modales, formularios, fechas
    app.js                  router por hash + sesión
    views/                  una vista por sección
```

## Configurar Firebase (una sola vez)

1. Entra a <https://console.firebase.google.com> y crea un proyecto **nuevo** (aparte de Mundial 2026), p. ej. `mi-salud`.
2. **Project settings > General > Your apps**: agrega una *Web app* y copia el objeto `firebaseConfig`. Pégalo en [`js/firebase-config.js`](js/firebase-config.js).
3. **Authentication > Sign-in method**: activa **Google**.
4. **Firestore Database**: crea la base (modo producción). En la pestaña **Rules**, pega el contenido de [`firestore.rules`](firestore.rules) y publica.
5. **Storage**: crea el bucket. En **Rules**, pega [`storage.rules`](storage.rules) y publica. (Necesario para subir exámenes.)
6. **Authentication > Settings > Authorized domains**: agrega `juank4835.github.io` (y `localhost` para pruebas locales).
7. Para que **Claude** pueda revisar exámenes, monta el puente: [`tools/README.md`](tools/README.md).

> El correo autorizado (`juank4835@gmail.com`) está fijado en `firebase-config.js` **y** en `firestore.rules`. Cualquier otra cuenta queda bloqueada en los dos lados.

## Probar en local

Necesita servirse por HTTP (no abrir el archivo directo) para que funcionen los módulos y el service worker:

```bash
cd mi-salud
python3 -m http.server 5173
# abre http://localhost:5173
```

## Publicar en GitHub Pages

1. Crea el repo `mi-salud` y sube esta carpeta.
2. **Settings > Pages > Source: Deploy from a branch**, rama `main`, carpeta `/ (root)`.
3. Abre `https://juank4835.github.io/mi-salud/` en el iPhone (Safari) → **Compartir > Añadir a pantalla de inicio**.

## Íconos

`icons/icon.svg` ya funciona para el manifest. Para mejor resultado en iOS conviene generar PNG:
`icons/icon-192.png` y `icons/icon-512.png` (puedes exportarlos desde el SVG con cualquier editor o un conversor online).

## Privacidad

- Datos en tu proyecto Firebase privado, separado de cualquier otro.
- Reglas que solo permiten leer/escribir a tu UID con tu correo.
- Nada es público. Si pierdes el celular, tus datos siguen seguros tras tu login de Google.
