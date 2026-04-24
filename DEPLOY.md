# AI Survey Platform · Grupo Scanda
## Guía de Despliegue en Netlify

---

## 1. Estructura del proyecto

```
ai-survey/
├── index.html                   ← Redirect root
├── admin/index.html             ← Panel admin (protegido con password)
├── survey/index.html            ← Formulario público
├── report/index.html            ← Vista del reporte
├── netlify/functions/
│   ├── generate-report.js       ← Llama Claude API
│   ├── send-email.js            ← Envía email con Resend
│   ├── save-event.js            ← Guarda eventos en Blobs
│   ├── get-event.js             ← Lee evento por ID/slug
│   ├── list-events.js           ← Lista todos los eventos (admin)
│   └── get-responses.js         ← Lista respuestas de un evento (admin)
├── netlify.toml                 ← Configuración Netlify
└── package.json                 ← Dependencias de Functions
```

---

## 2. Crear cuenta Resend (email transaccional)

1. Ir a https://resend.com → Sign Up (gratis)
2. Verificar tu dominio o usar el sandbox para pruebas
3. Ir a API Keys → Create API Key → copiar el key

---

## 3. Deploy en Netlify

### Opción A: Drag & Drop (más rápido para empezar)
1. Ir a https://app.netlify.com
2. Sites → "Add new site" → "Deploy manually"
3. Arrastrar la carpeta `ai-survey/` completa
4. Esperar el deploy (~30 segundos)

### Opción B: GitHub (recomendado para producción)
1. Subir el proyecto a un repo de GitHub
2. En Netlify → "Add new site" → "Import from Git"
3. Seleccionar el repo → Deploy

---

## 4. Variables de entorno (CRÍTICO)

En Netlify → Site Settings → Environment Variables → Add variable:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Tu API key de Anthropic |
| `RESEND_API_KEY` | `re_...` | Tu API key de Resend |
| `RESEND_FROM_EMAIL` | `ai@tudominio.com` | Email remitente (debe estar verificado en Resend) |
| `ADMIN_PASSWORD` | `tu-password-seguro` | Contraseña para el panel admin |
| `ADMIN_CC_EMAIL` | `hector@scanda.com` | Tu email para recibir CC de cada respuesta |

---

## 5. Habilitar Netlify Blobs

Los Blobs se habilitan automáticamente en proyectos Netlify (plan gratis incluye 1GB).
No requiere configuración adicional.

---

## 6. Flujo de uso

### Como admin:
1. Ir a `https://tu-sitio.netlify.app/admin/`
2. Ingresar la contraseña del admin
3. Crear un nuevo evento → configurar preguntas, prompt y template
4. Guardar → copiar el link generado
5. Compartir el link con los asistentes

### Link del formulario público:
```
https://tu-sitio.netlify.app/survey/?evento=SLUG-DEL-EVENTO
```

### El respondente:
1. Abre el link
2. Llena datos de contacto + cuestionario
3. Hace clic en "Generar mi reporte"
4. Ve el reporte en pantalla (~20 seg)
5. Recibe el reporte por email automáticamente

---

## 7. Personalización del dominio

En Netlify → Domain Settings → Add custom domain
Ejemplo: `survey.grupoScanda.com`

---

## 8. Troubleshooting

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| "Error generando reporte" | ANTHROPIC_API_KEY no configurado | Verificar variable de entorno en Netlify |
| Email no llega | RESEND_API_KEY o FROM_EMAIL incorrectos | Verificar variables + dominio en Resend |
| Admin dice "Unauthorized" | ADMIN_PASSWORD no coincide | Verificar variable en Netlify |
| Functions da 404 | `netlify/functions` no existe en el deploy | Asegurarse de incluir la carpeta completa |
| Blobs no persiste | Deploy sin sitio en Netlify | Solo funciona en Netlify, no local |

---

## 9. Costos estimados

| Servicio | Plan | Costo |
|----------|------|-------|
| Netlify Hosting | Free | $0/mes |
| Netlify Functions | Free (125k invocaciones/mes) | $0/mes |
| Netlify Blobs | Free (1GB) | $0/mes |
| Resend | Free (3,000 emails/mes) | $0/mes |
| Anthropic Claude | Pay per use | ~$0.01-0.05 por reporte |

**Para un evento de 70 personas: ~$1-3 USD total en API calls.**
