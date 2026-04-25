# AI Survey Platform — v5 Deploy Guide

## Cambios v5 vs v4

### Bugs corregidos
- ✅ Modelo Claude corregido: `claude-sonnet-4-20250514` (era claude-opus-4-5 inválido)
- ✅ `get-event.js` ahora tiene AmCham config hardcodeada como fallback (no depende de Blobs)
- ✅ `list-events.js` siempre retorna 200 (antes podía fallar y bloquear el login)
- ✅ `survey/index.html` — init ahora hace GET a get-event para cargar config completa desde servidor
- ✅ Tipo de pregunta `open` soportado en el survey (textarea)
- ✅ Admin — botones ⬇ Backup / ⬆ Importar para sync cross-device sin depender de Blobs

### AmCham Monterrey — ya configurado
- Slug: `amcham-mty`
- URL pública: `https://encuesta-ia.netlify.app/survey/?evento=amcham-mty`
- 8 preguntas definitivas del Comité Manufactura
- Prompt con benchmarks Gartner 2025-2026
- Framework Gartner Industrial AI (Tradicional → Conectado → Analítico → Inteligente)

## Deploy en Netlify

### Opción A: Drag & Drop (recomendado)
1. Comprimir la carpeta `ai-survey-v5/` como ZIP
2. Ir a Netlify → encuesta-ia → Deploys
3. Arrastrar el ZIP al área de drag & drop

### Variables de entorno requeridas
```
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@encuestas.hpm.one
ADMIN_PASSWORD=ScandaAI2026!
ADMIN_CC_EMAIL=hpadilla@scanda.com.mx
```

## URLs del sistema
- Admin: https://encuesta-ia.netlify.app/admin/
- Survey AmCham: https://encuesta-ia.netlify.app/survey/?evento=amcham-mty
- Report: https://encuesta-ia.netlify.app/report/

## Cross-device sync (sin Blobs)
Cuando Blobs no está disponible (deploy manual via ZIP):
1. En el admin principal, crea/edita tus eventos
2. Usa "⬇ Backup" para exportar JSON
3. En otro dispositivo, usa "⬆ Importar" para cargar el JSON
4. El evento AmCham siempre está disponible vía get-event.js hardcodeado

## Notas sobre Resend
- Dominio `encuestas.hpm.one` debe estar verificado en Resend
- Si no está verificado, el email falla silenciosamente (el reporte sí se muestra en pantalla)
- Para testear: abrir la función send-email manualmente o verificar logs en Netlify
