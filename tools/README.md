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

```json
{
  "resumen": "Perfil lipídico dentro de rangos salvo LDL levemente alto.",
  "comparacion": "LDL subió de 118 a 131 desde el examen de marzo; HDL estable.",
  "valores": [
    { "nombre": "Colesterol total", "valor": 205, "unidad": "mg/dL", "ref": "< 200", "refMax": 200, "fuera": "alto" },
    { "nombre": "Colesterol HDL",  "valor": 48,  "unidad": "mg/dL", "ref": "> 40",  "refMin": 40,  "fuera": null },
    { "nombre": "Colesterol LDL",  "valor": 131, "unidad": "mg/dL", "ref": "< 100", "refMax": 100, "fuera": "alto" },
    { "nombre": "Triglicéridos",   "valor": 150, "unidad": "mg/dL", "ref": "< 150", "refMax": 150, "fuera": null }
  ]
}
```

`fuera` debe ser `"alto"`, `"bajo"` o `null`.

> Nota: el análisis es informativo y de organización. No es diagnóstico ni reemplaza a tu médico.
