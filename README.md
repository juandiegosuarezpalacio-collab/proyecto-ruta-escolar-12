# Ruta escolar Montenegro

## Qué incluye
- interfaz móvil para conductor
- orden de recogida por ruta
- bandeja de mensajes
- envío en 3 modos: demo, abrir WhatsApp y WhatsApp Business
- IA local para redactar mensajes
- GPS del celular y mapa
- estudiantes de prueba cargados

## Cómo probar rápido
1. abre `index.html` desde un servidor local o súbelo a GitHub Pages
2. usa **modo Demo** para ver el flujo completo sin backend
3. usa **Abrir WhatsApp** para abrir el chat con el mensaje listo
4. usa **WhatsApp Business** solo si ya desplegaste el worker

## Configuración de WhatsApp Business
1. despliega `backend/cloudflare-worker.js` en Cloudflare Workers
2. crea estos secretos:
   - `API_KEY`
   - `PHONE_NUMBER_ID`
   - `WHATSAPP_TOKEN`
3. pega la URL del worker y la API key en la pestaña **Config**
4. elige **WhatsApp Business** y usa **Probar conexión**

## Nota
Si abres la página como archivo local, algunos navegadores bloquean `fetch` para leer JSON. En ese caso la app usa datos de respaldo automáticamente.
