# Puente de revisión de exámenes

Esto permite que **Claude** (corriendo en tu Mac) baje, lea y analice los exámenes que subes a la app, y escriba el resultado de vuelta.

## Montaje (una sola vez)

1. **Service account:** Firebase Console → ⚙ Project settings → **Service accounts** → *Generate new private key*. Guarda el archivo como `tools/serviceAccount.json` (NO se sube a git, ya está en `.gitignore`).
2. **Storage:** en Firebase Console → **Storage** → crea el bucket. Pega las reglas de [`../storage.rules`](../storage.rules).
3. Instala dependencias:
   ```bash
   cd tools
   npm install
   ```

## Cómo lo uso (Claude)

Cuando me digas *"revisa mis exámenes"* o *"revisa el perfil lipídico"*, yo corro:

```bash
# 0. (Opcional) Subir un PDF que está en el Mac, sin pasar por la app
node revisar.mjs upload <archivo.pdf> <uid> "Título" 2025-07-21 "Tipo"   # imprime el docPath

# 1. Ver qué hay pendiente
node revisar.mjs list

# 2. Bajar el archivo de un examen
node revisar.mjs pull users/<uid>/examenes/<archivo>    # imprime la ruta local

# 3. (Claude lee el PDF/foto, extrae valores, compara, resume)

# 4. Escribir el análisis de vuelta y marcarlo como revisado
node revisar.mjs save users/<uid>/examenes/<id> analisis.json
```

El análisis aparece automáticamente en la app (resumen, comparación, valores fuera de rango) y los valores numéricos alimentan las gráficas de evolución.

## Formato del análisis (`analisis.json`)

Claude parte el PDF en sus métricas individuales. Cada una lleva **categoría** y todo el examen lleva su **fecha real** (la del laboratorio, no la de subida).

```json
{
  "fecha": "2025-07-31",
  "fuente": "SynLab — Colmédica",
  "tipo": "Función renal y metabólico",
  "titulo": "Panel renal + curva de glucosa",
  "resumen": "Texto claro de qué dice el examen.",
  "comparacion": "Qué subió/bajó vs el examen anterior del mismo tipo.",
  "metricas": [
    { "nombre": "Creatinina", "categoria": "Función renal", "valor": 1.20, "unidad": "mg/dL", "ref": "0.73 - 1.18", "refMin": 0.73, "refMax": 1.18, "fuera": "alto",
      "analisis": "Qué es la métrica, qué significa este valor y la tendencia. Se muestra en el detalle del indicador." },
    { "nombre": "Glicemia en ayunas", "categoria": "Metabólico / Glucosa", "valor": 84, "unidad": "mg/dL", "ref": "70 - 100", "refMin": 70, "refMax": 100, "fuera": null, "analisis": "..." }
  ]
}
```

- `fuera` debe ser `"alto"`, `"bajo"` o `null`.
- `categoria`: usa nombres consistentes (Función renal, Metabólico / Glucosa, Lípidos, Tiroides, Hematología, Hígado, Vitaminas y minerales, Hormonal, Otros).
- Al guardar, cada métrica se escribe en la colección `metricas` con su `fecha` y `examenId`, y alimenta la vista **Indicadores** y las gráficas de evolución. Re-ejecutar `save` sobre el mismo examen reemplaza sus métricas (no duplica).
- `nombre` debe ser **idéntico** entre exámenes para que un indicador se siga en el tiempo (ej. siempre "Creatinina", no "creatinina enzimática").

> Nota: el análisis es informativo y de organización. No es diagnóstico ni reemplaza a tu médico.
