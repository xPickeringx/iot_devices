const API_URL = 'https://698a177bc04d974bc6a15369.mockapi.io/api/v1/devices'; // <--- TU URL AQUÍ
let monitoringInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadDevices();
    
    // Control de pestañas
    document.getElementById('pills-monitor-tab').addEventListener('shown.bs.tab', startMonitoring);
    document.getElementById('pills-admin-tab').addEventListener('shown.bs.tab', stopMonitoring);
});

// ==========================================
//  LÓGICA "REALISTA" DE DISPOSITIVOS
// ==========================================
function getDeviceConfig(type, isOn) {
    // Definimos comportamiento según el tipo
    switch(type) {
        case 'lock':
            return {
                icon: isOn ? 'bi-lock-fill' : 'bi-unlock-fill',
                statusText: isOn ? 'CERRADA (SEGURA)' : 'ABIERTA',
                colorClass: isOn ? 'text-success' : 'text-danger', // Verde es seguro, Rojo inseguro
                btnText: isOn ? 'Abrir' : 'Cerrar'
            };
        case 'camera':
            return {
                icon: isOn ? 'bi-camera-video-fill' : 'bi-camera-video-off',
                statusText: isOn ? 'GRABANDO' : 'EN ESPERA',
                colorClass: isOn ? 'text-danger' : 'text-secondary', // Rojo es grabando (REC)
                btnText: isOn ? 'Apagar' : 'Grabar'
            };
        case 'plug':
            return {
                icon: isOn ? 'bi-plug-fill' : 'bi-plug',
                statusText: isOn ? 'ENCENDIDO' : 'APAGADO',
                colorClass: isOn ? 'text-warning' : 'text-secondary', // Amarillo energía
                btnText: isOn ? 'Apagar' : 'Encender'
            };
        default:
            return { icon: 'bi-box', statusText: 'UNK', colorClass: '', btnText: 'Toggle' };
    }
}

// ==========================================
//  CRUD: CREATE & READ
// ==========================================
async function loadDevices() {
    try {
        const res = await fetch(API_URL);
        const devices = await res.json();
        renderAdmin(devices);
    } catch (e) { console.error(e); }
}

async function createDevice() {
    const name = document.getElementById('deviceName').value;
    const type = document.getElementById('deviceType').value;

    if (!name) return alert("Nombre requerido");

    await fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, type, isOn: false })
    });

    bootstrap.Modal.getInstance(document.getElementById('addDeviceModal')).hide();
    document.getElementById('add-device-form').reset();
    loadDevices();
}

// ==========================================
//  CRUD: UPDATE (ESTADO & INFORMACIÓN)
// ==========================================

// 1. Alternar Interruptor (Toggle Switch)
async function toggleStatus(id, currentStatus) {
    await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ isOn: !currentStatus })
    });
    loadDevices();
}

// 2. Cargar datos en Modal de Edición
async function openEditModal(id) {
    // Primero obtenemos el dispositivo actual
    const res = await fetch(`${API_URL}/${id}`);
    const device = await res.json();

    document.getElementById('editDeviceId').value = device.id;
    document.getElementById('editDeviceName').value = device.name;
    document.getElementById('editDeviceType').value = device.type;

    const modal = new bootstrap.Modal(document.getElementById('editDeviceModal'));
    modal.show();
}

// 3. Guardar cambios de información
async function updateDeviceData() {
    const id = document.getElementById('editDeviceId').value;
    const name = document.getElementById('editDeviceName').value;
    const type = document.getElementById('editDeviceType').value;

    await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, type })
    });

    bootstrap.Modal.getInstance(document.getElementById('editDeviceModal')).hide();
    loadDevices();
}

// ==========================================
//  CRUD: DELETE
// ==========================================
async function deleteDevice(id) {
    if(confirm('¿Eliminar dispositivo?')) {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        loadDevices();
    }
}

// ==========================================
//  RENDERIZADO (UI)
// ==========================================
function renderAdmin(devices) {
    const container = document.getElementById('devices-container');
    container.innerHTML = '';

    devices.forEach(dev => {
        const config = getDeviceConfig(dev.type, dev.isOn);
        
        container.innerHTML += `
            <div class="col-md-4 mb-4">
                <div class="card shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center mb-3">
                            <i class="${config.icon} device-icon ${config.colorClass}"></i>
                            <div>
                                <h5 class="card-title mb-0 text-truncate">${dev.name}</h5>
                                <small class="text-muted">${getReadableType(dev.type)}</small>
                            </div>
                        </div>
                        
                        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded mb-3">
                            <span class="fw-bold ${config.colorClass}">${config.statusText}</span>
                            
                            <div class="form-check form-switch">
                                <input class="form-check-input" type="checkbox" style="cursor:pointer; transform: scale(1.3);"
                                    ${dev.isOn ? 'checked' : ''} 
                                    onchange="toggleStatus('${dev.id}', ${dev.isOn})">
                            </div>
                        </div>

                        <div class="btn-group w-100">
                            <button class="btn btn-outline-secondary btn-sm" onclick="openEditModal('${dev.id}')">
                                <i class="bi bi-pencil"></i> Editar
                            </button>
                            <button class="btn btn-outline-danger btn-sm" onclick="deleteDevice('${dev.id}')">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
}

function getReadableType(type) {
    const types = { 'lock': 'Cerradura', 'plug': 'Enchufe', 'camera': 'Cámara' };
    return types[type] || type;
}

// ==========================================
//  MONITOREO: GRÁFICOS + TABLAS INDIVIDUALES
// ==========================================

const chartsInstances = {}; // Instancias de Chart.js
const deviceLogs = {};      // Historial local: { "id_1": [ {hora, estado}, ... ], "id_2": [] }
const MAX_LOGS = 10;        // Límite de filas por tabla

function startMonitoring() {
    updateMonitor(); 
    monitoringInterval = setInterval(updateMonitor, 2000);
}

function stopMonitoring() {
    clearInterval(monitoringInterval);
}

async function updateMonitor() {
    try {
        const res = await fetch(API_URL);
        const devices = await res.json();
        const now = new Date().toLocaleTimeString();

        // Limpiar interfaz si se borraron dispositivos
        cleanOrphanElements(devices);

        // Iterar sobre cada dispositivo
        devices.forEach(dev => {
            // 1. Verificar si existe la tarjeta visual, si no, crearla
            if (!document.getElementById(`card-${dev.id}`)) {
                createMonitorCard(dev);
            }

            // 2. Actualizar Gráfico (Chart.js)
            updateDeviceChart(dev, now);

            // 3. Actualizar Tabla Individual
            updateDeviceTable(dev, now);
        });

    } catch (error) {
        console.error("Error monitoreando:", error);
    }
}

// --- GESTIÓN VISUAL (CREACIÓN DE TARJETAS) ---
function createMonitorCard(device) {
    const container = document.getElementById('monitor-container');
    const col = document.createElement('div');
    col.className = 'col-lg-6 col-12 mb-4'; // 2 columnas en pantallas grandes
    col.id = `card-${device.id}`; // ID único para borrarlo si el dispositivo se elimina

    col.innerHTML = `
        <div class="card shadow border-0 h-100">
            <div class="card-header bg-white d-flex justify-content-between align-items-center">
                <h5 class="mb-0 text-primary"><i class="bi bi-hdd-network"></i> ${device.name}</h5>
                <span class="badge bg-light text-dark border">${getReadableType(device.type)}</span>
            </div>
            <div class="card-body">
                <div style="height: 180px;" class="mb-3">
                    <canvas id="canvas-${device.id}"></canvas>
                </div>
                
                <hr>

                <h6 class="text-muted small mb-2"><i class="bi bi-clock-history"></i> Historial Reciente (Últimos 10)</h6>
                <div class="table-responsive" style="max-height: 200px; overflow-y: auto;">
                    <table class="table table-sm table-hover text-center align-middle small mb-0">
                        <thead class="table-light sticky-top">
                            <tr>
                                <th>Hora</th>
                                <th>Estado</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody id="tbody-${device.id}">
                            </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    container.appendChild(col);

    // Inicializar el gráfico vacío inmediatamente
    initChart(device);
}

function cleanOrphanElements(activeDevices) {
    const activeIds = activeDevices.map(d => d.id);
    
    // Buscar todas las columnas de tarjetas en el DOM
    const currentCards = document.querySelectorAll('[id^="card-"]');
    
    currentCards.forEach(card => {
        const id = card.id.replace('card-', '');
        if (!activeIds.includes(id)) {
            // Si el ID ya no viene de la API, borrar todo
            card.remove(); 
            if (chartsInstances[id]) {
                chartsInstances[id].destroy();
                delete chartsInstances[id];
            }
            delete deviceLogs[id];
        }
    });
}

// --- LÓGICA DE GRÁFICOS (CHART.JS) ---
function initChart(device) {
    const ctx = document.getElementById(`canvas-${device.id}`).getContext('2d');
    const colors = getGraphColors(device.type, false); // Color inicial apagado

    chartsInstances[device.id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Estado',
                data: [],
                borderColor: colors.border,
                backgroundColor: colors.bg,
                borderWidth: 2,
                fill: true,
                tension: 0.1,
                stepped: true // Onda cuadrada
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false, // Desactivar animación para mejor rendimiento cada 2s
            scales: {
                
                y: { min: 0, max: 1.2, ticks: { callback: v => v===1?'ON':'OFF', stepSize: 1 },
                grid: { display: false } },
                x: { display: false, grid: { display: false }} // Ocultar etiquetas de tiempo en X para limpieza
            },
            plugins: { legend: { display: false } }, layout: {
        padding: 10 // Un poco de aire alrededor
            
        }}
    });
}

function updateDeviceChart(device, time) {
    const chart = chartsInstances[device.id];
    const val = device.isOn ? 1 : 0;
    const colors = getGraphColors(device.type, device.isOn);

    // Actualizar datos
    chart.data.labels.push(time);
    chart.data.datasets[0].data.push(val);
    
    // Actualizar colores
    chart.data.datasets[0].borderColor = colors.border;
    chart.data.datasets[0].backgroundColor = colors.bg;

    // Mantener ventana de tiempo (ej: últimos 20 puntos gráficos)
    if (chart.data.labels.length > 20) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.update();
}

// --- LÓGICA DE TABLAS INDIVIDUALES ---
function updateDeviceTable(device, time) {
    // 1. Inicializar array de historial si no existe
    if (!deviceLogs[device.id]) {
        deviceLogs[device.id] = [];
    }

    // 2. Obtener config visual (Iconos, textos)
    const config = getDeviceConfig(device.type, device.isOn);

    // 3. Agregar nuevo registro AL PRINCIPIO (unshift)
    deviceLogs[device.id].unshift({
        time: time,
        isOn: device.isOn,
        statusText: config.statusText,
        colorClass: config.colorClass,
        icon: config.icon
    });

    // 4. Recortar a 10 registros
    if (deviceLogs[device.id].length > MAX_LOGS) {
        deviceLogs[device.id].pop();
    }

    // 5. Renderizar HTML en el tbody específico
    const tbody = document.getElementById(`tbody-${device.id}`);
    tbody.innerHTML = ''; // Limpiar tabla

    deviceLogs[device.id].forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-muted">${log.time}</td>
            <td>
                <span class="badge ${log.isOn ? 'bg-success' : 'bg-secondary'}">
                    ${log.isOn ? 'ON' : 'OFF'}
                </span>
            </td>
            <td class="${log.colorClass} fw-bold small">
                <i class="${log.icon}"></i> ${log.statusText}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// --- UTILIDADES DE ESTILO (Reutilizamos las anteriores) ---
function getGraphColors(type, isOn) {
    if (!isOn) return { border: '#6c757d', bg: 'rgba(108, 117, 125, 0.1)' };
    switch(type) {
        case 'camera': return { border: '#dc3545', bg: 'rgba(220, 53, 69, 0.2)' };
        case 'lock': return { border: '#198754', bg: 'rgba(25, 135, 84, 0.2)' };
        case 'plug': return { border: '#ffc107', bg: 'rgba(255, 193, 7, 0.2)' };
        default: return { border: '#0d6efd', bg: 'rgba(13, 110, 253, 0.2)' };
    }
}