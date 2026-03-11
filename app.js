const APP = {
  students: [],
  barrios: [],
  queue: [],
  logs: [],
  route: 'Bachillerato - Parte 1',
  currentIndex: 0,
  watchId: null,
  location: null,
  map: null,
  marker: null,
  flags: {},
  config: {
    modoEnvio: 'open_whatsapp',
    backendUrl: '',
    apiKey: ''
  }
};

const ROUTES = ['Bachillerato - Parte 1', 'Bachillerato - Parte 2', 'Primaria', 'Transición'];
const MESSAGE_TYPES = [
  { value: 'alistamiento', label: 'Ruta alistándose' },
  { value: 'barrio', label: 'Ingreso al barrio' },
  { value: 'cerca', label: 'Ruta cerca' },
  { value: 'retraso', label: 'Retraso' },
  { value: 'subio', label: 'Estudiante subió' },
  { value: 'llegada_colegio', label: 'Llegada al colegio' },
  { value: 'entrega', label: 'Entregado' },
  { value: 'personalizado', label: 'Personalizado' }
];

const FALLBACK_STUDENTS = [
  { id: 'b1-1', nombre: 'Juan Pablo', acudiente: 'Mamá', telefono: '573225940033', barrio: 'El Turbai', ruta: 'Bachillerato - Parte 1', orden: 1, lat: 4.566, lng: -75.751, estado: 'pendiente' },
  { id: 'b1-2', nombre: 'Nicolás Bedoya', acudiente: 'Mamá', telefono: '573128840559', barrio: 'El Turbai', ruta: 'Bachillerato - Parte 1', orden: 2, lat: 4.5664, lng: -75.7514, estado: 'pendiente' },
  { id: 'b1-3', nombre: 'Dilan Gañán', acudiente: 'Abuela Teresa', telefono: '573206342481', barrio: 'El Turbai', ruta: 'Bachillerato - Parte 1', orden: 3, lat: 4.5668, lng: -75.7518, estado: 'pendiente' }
];

const FALLBACK_BARRIOS = [
  'Centro', 'El Turbai', 'Villa Carolina', 'La Isabela', 'Santa Helena', 'El Cacique', 'Ciudad Alegría', 'La Julia'
];

const $ = (id) => document.getElementById(id);

async function init() {
  loadConfig();
  await loadData();
  bindEvents();
  fillSelectors();
  initMap();
  renderAll();
  log('Aplicación iniciada correctamente.');
}

async function loadData() {
  const savedStudents = safeJSON(localStorage.getItem('ruta_escolar_students'));
  if (Array.isArray(savedStudents) && savedStudents.length) APP.students = savedStudents;
  const savedQueue = safeJSON(localStorage.getItem('ruta_escolar_queue'));
  if (Array.isArray(savedQueue)) APP.queue = savedQueue;

  try {
    const [studentsRes, barriosRes] = await Promise.all([
      fetch('data/estudiantes.json'),
      fetch('data/barrios.json')
    ]);
    if (!APP.students.length) APP.students = studentsRes.ok ? await studentsRes.json() : [...FALLBACK_STUDENTS];
    APP.barrios = barriosRes.ok ? await barriosRes.json() : [...FALLBACK_BARRIOS];
  } catch (error) {
    if (!APP.students.length) APP.students = [...FALLBACK_STUDENTS];
    APP.barrios = [...FALLBACK_BARRIOS];
    log('Se cargaron datos de respaldo por bloqueo del navegador o falta de archivos JSON.');
  }
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  $('btnConfigTop').addEventListener('click', () => switchTab('config'));
  $('rutaSelect').addEventListener('change', (e) => {
    APP.route = e.target.value;
    APP.currentIndex = 0;
    renderAll();
  });
  $('btnIniciarRuta').addEventListener('click', startRoute);
  $('btnSubio').addEventListener('click', markStudentPickedUp);
  $('btnAvisarActual').addEventListener('click', () => queueCurrent('cerca'));
  $('btnAvisarBarrio').addEventListener('click', queueBarrioActual);
  $('btnRefrescarOrden').addEventListener('click', renderOrder);
  $('btnGPS').addEventListener('click', toggleGPS);
  $('btnGenerarMensaje').addEventListener('click', generatePreview);
  $('btnEnviarMensaje').addEventListener('click', sendPreviewMessage);
  $('btnMasivoRuta').addEventListener('click', queueRoutePreparation);
  $('btnLlegadaColegio').addEventListener('click', queueArrivalAtSchool);
  $('btnProcesarCola').addEventListener('click', processQueue);
  $('btnPreguntarIA').addEventListener('click', askIA);
  $('btnUsarRespuestaIA').addEventListener('click', useIAResponse);
  $('studentForm').addEventListener('submit', saveStudent);
  $('btnLimpiarForm').addEventListener('click', clearForm);
  $('btnGuardarConfig').addEventListener('click', saveConfig);
  $('btnProbarBackend').addEventListener('click', testBackend);
  $('modoEnvio').addEventListener('change', () => {
    APP.config.modoEnvio = $('modoEnvio').value;
    persistConfig();
    renderStats();
    renderStatus();
  });
}

function fillSelectors() {
  const routeOptions = ROUTES.map((r) => `<option value="${r}">${r}</option>`).join('');
  $('rutaSelect').innerHTML = routeOptions;
  $('studentRuta').innerHTML = routeOptions;
  $('rutaSelect').value = APP.route;
  $('studentBarrio').innerHTML = APP.barrios.map((b) => `<option value="${b}">${b}</option>`).join('');
  $('tipoMensaje').innerHTML = MESSAGE_TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join('');
  $('destinoMensaje').innerHTML = `
    <option value="actual">Estudiante actual</option>
    <option value="toda_ruta">Toda la ruta</option>
    <option value="barrio_actual">Barrio actual</option>
  `;
  $('modoEnvio').value = APP.config.modoEnvio;
  $('backendUrl').value = APP.config.backendUrl;
  $('apiKey').value = APP.config.apiKey;
}

function renderAll() {
  $('rutaActivaTexto').textContent = APP.route;
  renderOrder();
  renderStudents();
  renderQueue();
  renderStats();
  renderLogs();
  renderStatus();
}

function currentRouteStudents() {
  return [...APP.students]
    .filter((s) => s.ruta === APP.route)
    .sort((a, b) => Number(a.orden) - Number(b.orden));
}

function currentStudent() {
  const list = currentRouteStudents();
  return list[APP.currentIndex] || null;
}

function renderStats() {
  const current = currentStudent();
  $('actualNombre').textContent = current ? current.nombre : 'Ruta terminada';
  $('actualBarrio').textContent = current ? current.barrio : '---';
  $('pendientesCount').textContent = currentRouteStudents().slice(APP.currentIndex).length;
  $('canalActivo').textContent = APP.config.modoEnvio === 'business' ? 'Business' : APP.config.modoEnvio === 'demo' ? 'Demo' : 'WhatsApp';
}

function renderStatus() {
  const modeText = APP.config.modoEnvio === 'business' ? 'Listo para backend' : APP.config.modoEnvio === 'demo' ? 'Solo simulación' : 'Abrir app';
  $('backendEstado').textContent = modeText;
}

function renderOrder() {
  const current = currentStudent();
  const html = currentRouteStudents().map((student, index) => {
    const statusClass = index < APP.currentIndex ? 'done' : 'pending';
    const statusText = index < APP.currentIndex ? 'Recogido' : 'Pendiente';
    const currentClass = current && current.id === student.id ? 'current' : '';
    return `
      <article class="list-item ${currentClass}">
        <div class="list-top">
          <div>
            <strong>${student.orden}. ${student.nombre}</strong>
            <div class="meta">Acudiente: ${student.acudiente}<br>Barrio: ${student.barrio}<br>Tel: ${student.telefono}</div>
          </div>
          <span class="badge ${statusClass}">${statusText}</span>
        </div>
        <div class="action-row">
          <button class="small-btn" onclick="editStudent('${student.id}')">Editar</button>
          <button class="small-btn" onclick="quickSend('${student.id}', 'cerca')">Avisar</button>
          <button class="small-btn danger" onclick="deleteStudent('${student.id}')">Borrar</button>
        </div>
      </article>
    `;
  }).join('');
  $('ordenLista').innerHTML = html || '<div class="list-item">No hay estudiantes para esta ruta.</div>';
}

function renderStudents() {
  $('estudiantesLista').innerHTML = [...APP.students]
    .sort((a, b) => a.ruta.localeCompare(b.ruta) || Number(a.orden) - Number(b.orden))
    .map((student) => `
      <article class="list-item">
        <div class="list-top">
          <div>
            <strong>${student.nombre}</strong>
            <div class="meta">${student.ruta} · orden ${student.orden}<br>${student.barrio} · ${student.telefono}</div>
          </div>
          <span class="badge queue">${student.acudiente}</span>
        </div>
      </article>
    `).join('') || '<div class="list-item">No hay estudiantes cargados.</div>';
}

function renderQueue() {
  const pending = APP.queue.filter((item) => item.status !== 'enviado').length;
  $('queueStats').textContent = `${pending} pendientes`;
  $('colaMensajes').innerHTML = APP.queue.map((item, index) => `
    <article class="list-item">
      <div class="list-top">
        <div>
          <strong>${escapeHtml(item.title)}</strong>
          <div class="meta">${item.phone || 'sin número'}<br>${escapeHtml(item.body.slice(0, 160))}${item.body.length > 160 ? '...' : ''}</div>
        </div>
        <span class="badge queue">${item.status}</span>
      </div>
      <div class="action-row">
        <button class="small-btn" onclick="sendQueueItem(${index})">Enviar</button>
        <button class="small-btn danger" onclick="removeQueueItem(${index})">Quitar</button>
      </div>
    </article>
  `).join('') || '<div class="list-item">No hay mensajes en la bandeja.</div>';
}

function renderLogs() {
  $('bitacora').textContent = APP.logs.slice(-20).reverse().join('\n') || 'Sin eventos todavía.';
}

function log(text) {
  APP.logs.push(`[${new Date().toLocaleTimeString('es-CO')}] ${text}`);
  renderLogs();
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.id === `tab-${tab}`));
}

function startRoute() {
  APP.currentIndex = 0;
  APP.flags = {};
  renderAll();
  log(`Ruta iniciada: ${APP.route}.`);
}

function markStudentPickedUp() {
  const student = currentStudent();
  if (!student) {
    log('No hay más estudiantes por recoger.');
    return;
  }
  queueStudentMessage(student, 'subio');
  APP.currentIndex += 1;
  renderAll();
  log(`Se marcó como recogido: ${student.nombre}.`);
}

function buildContext(student, custom = '') {
  return {
    estudiante: student?.nombre || 'el estudiante',
    acudiente: student?.acudiente || 'acudiente',
    barrio: student?.barrio || 'su barrio',
    ruta: student?.ruta || APP.route,
    minutos: 10,
    extraLista: '',
    custom
  };
}

function generatePreview() {
  const type = $('tipoMensaje').value;
  const tone = $('tonoMensaje').value;
  const target = $('destinoMensaje').value;
  const current = currentStudent();

  if (target === 'toda_ruta') {
    $('mensajePreview').value = RUTA_IA.massiveRouteMessage(APP.route, currentRouteStudents());
    return;
  }
  if (target === 'barrio_actual') {
    const barrio = current?.barrio || 'el barrio actual';
    $('mensajePreview').value = `Hola familias. La ruta ya ingresó al barrio ${barrio}. Por favor alistar a los estudiantes de este sector.`;
    return;
  }
  $('mensajePreview').value = RUTA_IA.generate(type, tone, buildContext(current));
}

function queueStudentMessage(student, type, bodyOverride = '') {
  const tone = $('tonoMensaje').value || 'cercano';
  const body = bodyOverride || RUTA_IA.generate(type, tone, buildContext(student));
  APP.queue.push({ title: `${type} - ${student.nombre}`, phone: student.telefono, body, status: 'pendiente' });
  persistQueue();
  renderQueue();
  log(`Mensaje agregado a la bandeja para ${student.nombre}.`);
}

function queueCurrent(type) {
  const student = currentStudent();
  if (!student) return log('No hay estudiante actual para avisar.');
  queueStudentMessage(student, type);
  switchTab('mensajes');
}

function queueBarrioActual() {
  const student = currentStudent();
  if (!student) return log('No hay estudiante actual para identificar el barrio.');
  const sameBarrio = currentRouteStudents().filter((s) => s.barrio === student.barrio);
  const body = `Hola familias. La ruta ya ingresó al barrio ${student.barrio}. Por favor alistar a los estudiantes de este sector.`;
  sameBarrio.forEach((s) => APP.queue.push({ title: `Barrio ${student.barrio} - ${s.nombre}`, phone: s.telefono, body, status: 'pendiente' }));
  persistQueue();
  renderQueue();
  switchTab('mensajes');
  log(`Se agregaron ${sameBarrio.length} avisos para el barrio ${student.barrio}.`);
}

function queueRoutePreparation() {
  const list = currentRouteStudents();
  const body = RUTA_IA.massiveRouteMessage(APP.route, list);
  list.forEach((student) => APP.queue.push({ title: `Alistamiento - ${student.nombre}`, phone: student.telefono, body, status: 'pendiente' }));
  persistQueue();
  renderQueue();
  switchTab('mensajes');
  log(`Se cargó el mensaje masivo de alistamiento para ${APP.route}.`);
}

function queueArrivalAtSchool() {
  currentRouteStudents().forEach((student) => {
    const body = RUTA_IA.generate('llegada_colegio', $('tonoMensaje').value || 'cercano', buildContext(student));
    APP.queue.push({ title: `Llegada - ${student.nombre}`, phone: student.telefono, body, status: 'pendiente' });
  });
  persistQueue();
  renderQueue();
  switchTab('mensajes');
  log(`Se agregaron mensajes de llegada al colegio para ${APP.route}.`);
}

async function sendPreviewMessage() {
  const body = $('mensajePreview').value.trim();
  if (!body) return log('Primero genera o escribe un mensaje.');
  const target = $('destinoMensaje').value;
  if (target === 'toda_ruta') {
    currentRouteStudents().forEach((student) => APP.queue.push({ title: `Manual ruta - ${student.nombre}`, phone: student.telefono, body, status: 'pendiente' }));
  } else if (target === 'barrio_actual') {
    const current = currentStudent();
    if (!current) return log('No hay barrio actual activo.');
    currentRouteStudents().filter((student) => student.barrio === current.barrio).forEach((student) => {
      APP.queue.push({ title: `Manual barrio - ${student.nombre}`, phone: student.telefono, body, status: 'pendiente' });
    });
  } else {
    const current = currentStudent();
    if (!current) return log('No hay estudiante actual.');
    APP.queue.push({ title: `Manual - ${current.nombre}`, phone: current.telefono, body, status: 'pendiente' });
  }
  persistQueue();
  renderQueue();
  switchTab('mensajes');
}

async function processQueue() {
  for (let i = 0; i < APP.queue.length; i += 1) {
    if (APP.queue[i].status === 'enviado') continue;
    await sendQueueItem(i);
  }
}

async function sendQueueItem(index) {
  const item = APP.queue[index];
  if (!item) return;
  item.status = 'enviando';
  renderQueue();
  try {
    await deliverMessage(item.phone, item.body);
    item.status = 'enviado';
    log(`Mensaje enviado a ${item.phone}.`);
  } catch (error) {
    item.status = 'error';
    log(`Error enviando a ${item.phone}: ${error.message}`);
  }
  persistQueue();
  renderQueue();
}

function removeQueueItem(index) {
  APP.queue.splice(index, 1);
  persistQueue();
  renderQueue();
}

async function deliverMessage(phone, body) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) throw new Error('Número inválido.');

  if (APP.config.modoEnvio === 'demo') {
    await sleep(200);
    return { ok: true };
  }

  if (APP.config.modoEnvio === 'open_whatsapp') {
    const encoded = encodeURIComponent(body);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const primary = isMobile
      ? `https://wa.me/${digits}?text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${digits}&text=${encoded}`;
    window.open(primary, '_blank', 'noopener');
    return { ok: true };
  }

  if (APP.config.modoEnvio === 'business') {
    const base = (APP.config.backendUrl || '').trim().replace(/\/$/, '');
    if (!base) throw new Error('Falta URL del backend.');
    const response = await fetch(`${base}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': APP.config.apiKey || ''
      },
      body: JSON.stringify({ telefono: digits, mensaje: body })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || 'El backend no respondió bien.');
    return data;
  }

  throw new Error('Modo de envío no soportado.');
}

function askIA() {
  const answer = RUTA_IA.ask($('preguntaIA').value, {
    pending: currentRouteStudents().slice(APP.currentIndex).length,
    current: currentStudent()?.nombre
  });
  $('respuestaIA').textContent = answer;
}

function useIAResponse() {
  $('mensajePreview').value = $('respuestaIA').textContent.trim();
  switchTab('mensajes');
}

function saveStudent(event) {
  event.preventDefault();
  const student = {
    id: $('studentId').value || `id-${Date.now()}`,
    nombre: $('studentNombre').value.trim(),
    acudiente: $('studentAcudiente').value.trim(),
    telefono: $('studentTelefono').value.trim(),
    ruta: $('studentRuta').value,
    barrio: $('studentBarrio').value,
    orden: Number($('studentOrden').value),
    lat: $('studentLat').value.trim() || null,
    lng: $('studentLng').value.trim() || null,
    estado: 'pendiente'
  };
  const idx = APP.students.findIndex((item) => item.id === student.id);
  if (idx >= 0) APP.students[idx] = student; else APP.students.push(student);
  persistStudents();
  clearForm();
  renderAll();
  log(`Se guardó el estudiante ${student.nombre}.`);
}

function editStudent(id) {
  const student = APP.students.find((item) => item.id === id);
  if (!student) return;
  $('studentId').value = student.id;
  $('studentNombre').value = student.nombre;
  $('studentAcudiente').value = student.acudiente;
  $('studentTelefono').value = student.telefono;
  $('studentRuta').value = student.ruta;
  $('studentBarrio').value = student.barrio;
  $('studentOrden').value = student.orden;
  $('studentLat').value = student.lat || '';
  $('studentLng').value = student.lng || '';
  switchTab('estudiantes');
}
window.editStudent = editStudent;

function deleteStudent(id) {
  APP.students = APP.students.filter((item) => item.id !== id);
  persistStudents();
  renderAll();
  log('Se eliminó un estudiante.');
}
window.deleteStudent = deleteStudent;

function quickSend(id, type) {
  const student = APP.students.find((item) => item.id === id);
  if (!student) return;
  queueStudentMessage(student, type);
  switchTab('mensajes');
}
window.quickSend = quickSend;

function clearForm() {
  $('studentForm').reset();
  $('studentId').value = '';
}

function loadConfig() {
  const saved = safeJSON(localStorage.getItem('ruta_escolar_config'));
  if (saved) APP.config = { ...APP.config, ...saved };
}

function saveConfig() {
  APP.config = {
    modoEnvio: $('modoEnvio').value,
    backendUrl: $('backendUrl').value.trim(),
    apiKey: $('apiKey').value.trim()
  };
  persistConfig();
  renderStats();
  renderStatus();
  log('Se guardó la configuración del canal de mensajes.');
}

async function testBackend() {
  if ($('modoEnvio').value !== 'business') return log('La prueba de backend solo aplica en modo WhatsApp Business.');
  const base = $('backendUrl').value.trim().replace(/\/$/, '');
  if (!base) return log('Primero escribe la URL del backend.');
  try {
    const response = await fetch(`${base}/health`, { headers: { 'x-api-key': $('apiKey').value.trim() || '' } });
    const data = await response.json();
    $('backendEstado').textContent = data.ok ? 'Conectado' : 'Sin conexión';
    log(data.ok ? 'Backend conectado correctamente.' : 'El backend respondió pero aún falta configurar secretos.');
  } catch (error) {
    $('backendEstado').textContent = 'Sin conexión';
    log(`No fue posible conectar con el backend: ${error.message}`);
  }
}

function persistStudents() {
  localStorage.setItem('ruta_escolar_students', JSON.stringify(APP.students));
}

function persistQueue() {
  localStorage.setItem('ruta_escolar_queue', JSON.stringify(APP.queue));
}

function persistConfig() {
  localStorage.setItem('ruta_escolar_config', JSON.stringify(APP.config));
}

function initMap() {
  APP.map = L.map('map').setView([4.566, -75.751], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(APP.map);
  APP.marker = L.marker([4.566, -75.751]).addTo(APP.map).bindPopup('Ruta escolar');
}

function toggleGPS() {
  if (APP.watchId) {
    navigator.geolocation.clearWatch(APP.watchId);
    APP.watchId = null;
    $('gpsEstado').textContent = 'GPS apagado';
    $('gpsDetalle').textContent = 'Sin seguimiento';
    log('GPS desactivado.');
    return;
  }
  if (!navigator.geolocation) return log('Este celular no permite geolocalización.');
  APP.watchId = navigator.geolocation.watchPosition(onPosition, onGpsError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 15000
  });
  $('gpsEstado').textContent = 'GPS encendido';
  log('GPS activado.');
}

function onGpsError(error) {
  log(`Error GPS: ${error.message}`);
}

function onPosition(pos) {
  APP.location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  $('gpsDetalle').textContent = `${APP.location.lat.toFixed(5)}, ${APP.location.lng.toFixed(5)}`;
  APP.map.setView([APP.location.lat, APP.location.lng], 16);
  APP.marker.setLatLng([APP.location.lat, APP.location.lng]).bindPopup('Ubicación actual de la ruta').openPopup();
  checkAutoNotifications();
}

function checkAutoNotifications() {
  const student = currentStudent();
  if (!student || !student.lat || !student.lng || !APP.location) return;
  const distance = haversine(APP.location.lat, APP.location.lng, Number(student.lat), Number(student.lng));
  if (distance <= 250 && !APP.flags[`near-${student.id}`]) {
    APP.flags[`near-${student.id}`] = true;
    queueStudentMessage(student, 'cerca');
    log(`Autoaviso: la ruta está cerca de ${student.nombre}.`);
  }
  if (distance <= 500 && !APP.flags[`barrio-${student.barrio}`]) {
    APP.flags[`barrio-${student.barrio}`] = true;
    queueBarrioActual();
  }
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function safeJSON(value) {
  try { return JSON.parse(value); } catch (_) { return null; }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

document.addEventListener('DOMContentLoaded', init);
window.sendQueueItem = sendQueueItem;
window.removeQueueItem = removeQueueItem;
