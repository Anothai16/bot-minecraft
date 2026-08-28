const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const PORT = 3003;

// Paths Kaitom
const K4_PIPE = '/tmp/mcc_pipe_kaitom_cmd';
const K4_STATUS_FILE = path.join(__dirname, 'lever_status.txt');
const K4_READY_FILE = path.join(__dirname, 'kaitom4_ready.txt');
const K67_READY_FILE = path.join(__dirname, 'k666', 'kaitom67_ready.txt');

// Paths Lervy
const LERVY_PIPE = '/tmp/mcc_pipe_lervy_cmd';
const LERVY_STATUS_FILE = path.join(__dirname, 'lervy_status.txt');
const LERVY_READY_FILE = path.join(__dirname, 'lervy_ready.txt');
const K666_READY_FILE = path.join(__dirname, 'k666_ready.txt');

app.use(express.json());

function readFile(file, fallback = 'unknown') {
    try {
        if (fs.existsSync(file)) return fs.readFileSync(file, 'utf-8').trim();
    } catch (e) {}
    return fallback;
}

function writeFile(file, data) {
    try {
        fs.writeFileSync(file, data.trim(), 'utf-8');
        return true;
    } catch (e) {
        return false;
    }
}

function sendCommand(pipePath, cmd) {
    if (fs.existsSync(pipePath)) {
        fs.appendFileSync(pipePath, cmd + '\n');
        return true;
    }
    return false;
}

function checkBotInWorld(botName, readyFilePath) {
    return new Promise((resolve) => {
        exec(`pgrep -fa 'MinecraftClient.*${botName}'`, (err, stdout) => {
            if (err || !stdout.trim()) {
                resolve(false);
            } else {
                resolve(readFile(readyFilePath) === 'online');
            }
        });
    });
}

// 📌 API: ดึงสถานะรวมของบอททุกตัว
app.get('/api/status', async (req, res) => {
    const [k4Online, k67Online, lervyOnline, k666Online] = await Promise.all([
        checkBotInWorld('Kaitom_4', K4_READY_FILE),
        checkBotInWorld('Kaitom_67', K67_READY_FILE),
        checkBotInWorld('Lervy_Lever', LERVY_READY_FILE),
        checkBotInWorld('K666', K666_READY_FILE)
    ]);

    res.json({
        k4: { status: readFile(K4_STATUS_FILE, 'open'), online: k4Online },
        k67: { online: k67Online },
        lervy: { status: readFile(LERVY_STATUS_FILE, 'open'), online: lervyOnline },
        k666: { online: k666Online }
    });
});

// 📌 Kaitom Actions
app.post('/api/k4/toggle', (req, res) => {
    if (!fs.existsSync(K4_PIPE)) return res.status(500).json({ success: false, message: 'บอท Kaitom_4 ไม่พร้อม' });
    sendCommand(K4_PIPE, '/useblock -2682 61 14542');
    const newStatus = readFile(K4_STATUS_FILE) === 'open' ? 'close' : 'open';
    writeFile(K4_STATUS_FILE, newStatus);
    res.json({ success: true, newStatus });
});

app.post('/api/k4/set-status', (req, res) => {
    writeFile(K4_STATUS_FILE, req.body.status);
    res.json({ success: true, status: req.body.status });
});

app.post('/api/k4/home', (req, res) => {
    res.json({ success: sendCommand(K4_PIPE, '/home home') });
});

// 📌 Lervy Actions
app.post('/api/lervy/toggle-once', (req, res) => {
    if (!fs.existsSync(LERVY_PIPE)) return res.status(500).json({ success: false, message: 'บอท Lervy_Lever ไม่พร้อม' });
    sendCommand(LERVY_PIPE, '/useblock 10383 64.00 -5064.51');
    setTimeout(() => {
        sendCommand(LERVY_PIPE, '/useblock 10383 64.00 -5064.51');
    }, 5000);
    res.json({ success: true, message: 'สับคันโยก (สับลง-รอ 5 วิ-สับขึ้น) เรียบร้อย' });
});

app.post('/api/lervy/set-status', (req, res) => {
    writeFile(LERVY_STATUS_FILE, req.body.status);
    res.json({ success: true, status: req.body.status });
});

app.post('/api/lervy/home', (req, res) => {
    res.json({ success: sendCommand(LERVY_PIPE, '/home home') });
});

// 🌐 หน้า Web Dashboard สองฝั่ง
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dual Bot Controller Dashboard</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, sans-serif; }
            body { background: #0b0f19; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
            .wrapper { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; max-width: 960px; width: 100%; }
            .card { background: #111827; padding: 24px; border-radius: 18px; border: 1px solid #1f2937; flex: 1; min-width: 320px; max-width: 450px; box-shadow: 0 12px 30px rgba(0,0,0,0.6); text-align: center; }
            h1 { font-size: 18px; color: #38bdf8; margin-bottom: 2px; }
            .sub { font-size: 11px; color: #64748b; margin-bottom: 16px; }
            
            .status-main { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 12px; margin-bottom: 10px; }
            .grid-status { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
            .status-container { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 10px; }
            .status-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .status-val { font-size: 18px; font-weight: bold; }
            .status-val-sm { font-size: 14px; font-weight: bold; }
            
            .color-open, .color-online { color: #34d399; }
            .color-close, .color-offline { color: #f87171; }
            
            .btn { width: 100%; padding: 11px; font-size: 14px; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; transition: 0.15s; margin-bottom: 8px; }
            .btn-blue { background: #0284c7; color: white; }
            .btn-blue:hover { background: #0369a1; }
            .btn-green { background: #059669; color: white; }
            .btn-green:hover { background: #047857; }
            .btn-dark { background: #1f2937; color: #cbd5e1; border: 1px solid #374151; font-size: 12px; }
            .btn-dark:hover { background: #374151; }
            
            .edit-box { margin-top: 14px; padding-top: 12px; border-top: 1px solid #1f2937; text-align: left; }
            .edit-title { font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 6px; }
            .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
            .btn-state { padding: 8px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #374151; cursor: pointer; background: #1f2937; color: #e2e8f0; }
            .btn-state-open:hover { background: #065f46; border-color: #059669; }
            .btn-state-close:hover { background: #7f1d1d; border-color: #dc2626; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <!-- 🕹️ ฝั่งซ้าย: KAITOM CONTROLLER -->
            <div class="card">
                <h1>🕹️ KAITOM CONTROLLER</h1>
                <div class="sub">พิกัดคันโยก: -2682 61 14542</div>
                
                <div class="status-main">
                    <div class="status-label">สถานะระบบคันโยก</div>
                    <div id="k4Status" class="status-val color-open">...</div>
                </div>

                <div class="grid-status">
                    <div class="status-container">
                        <div class="status-label">Kaitom_4 (คันโยก)</div>
                        <div id="k4Online" class="status-val-sm color-offline">OFFLINE</div>
                    </div>
                    <div class="status-container">
                        <div class="status-label">Kaitom_67 (AFK)</div>
                        <div id="k67Online" class="status-val-sm color-offline">OFFLINE</div>
                    </div>
                </div>

                <button class="btn btn-blue" onclick="action('/api/k4/toggle')">⚡ สับคันโยก (สลับสถานะ)</button>
                <button class="btn btn-dark" onclick="action('/api/k4/home')">📍 วาร์ปไปจุดประจำการ (/home home)</button>
                
                <div class="edit-box">
                    <div class="edit-title">🛠️ บังคับแก้สถานะในไฟล์:</div>
                    <div class="edit-grid">
                        <button class="btn-state btn-state-open" onclick="setStatus('/api/k4/set-status', 'open')">🟢 OPEN</button>
                        <button class="btn-state btn-state-close" onclick="setStatus('/api/k4/set-status', 'close')">🔴 CLOSE</button>
                    </div>
                </div>
            </div>

            <!-- ⚙️ ฝั่งขวา: LERVY CONTROLLER -->
            <div class="card">
                <h1>⚙️ LERVY CONTROLLER</h1>
                <div class="sub">พิกัดคันโยก: 10383 64.00 -5064.51</div>
                
                <div class="status-main">
                    <div class="status-label">สถานะ Auto Loop (MIN % 6 == 3)</div>
                    <div id="lervyStatus" class="status-val color-open">...</div>
                </div>

                <div class="grid-status">
                    <div class="status-container">
                        <div class="status-label">Lervy_Lever (คันโยก)</div>
                        <div id="lervyOnline" class="status-val-sm color-offline">OFFLINE</div>
                    </div>
                    <div class="status-container">
                        <div class="status-label">K666 (AFK)</div>
                        <div id="k666Online" class="status-val-sm color-offline">OFFLINE</div>
                    </div>
                </div>

                <button class="btn btn-green" onclick="action('/api/lervy/toggle-once')">⚡ สับ 1 ไซเคิล (สับลง-รอ 5 วิ-สับขึ้น)</button>
                <button class="btn btn-dark" onclick="action('/api/lervy/home')">📍 วาร์ปไปจุดประจำการ (/home home)</button>
                
                <div class="edit-box">
                    <div class="edit-title">🕹️ สวิตช์ควบคุมระบบ Auto Loop:</div>
                    <div class="edit-grid">
                        <button class="btn-state btn-state-open" onclick="setStatus('/api/lervy/set-status', 'open')">🟢 เปิด Loop Auto</button>
                        <button class="btn-state btn-state-close" onclick="setStatus('/api/lervy/set-status', 'close')">🔴 ปิด Loop Auto</button>
                    </div>
                </div>
            </div>
        </div>

        <script>
            function updateUI(data) {
                // Kaitom
                const k4Stat = document.getElementById('k4Status');
                k4Stat.innerText = data.k4.status.toUpperCase();
                k4Stat.className = 'status-val ' + (data.k4.status === 'open' ? 'color-open' : 'color-close');

                const k4On = document.getElementById('k4Online');
                k4On.innerText = data.k4.online ? '🟢 ONLINE' : '🔴 OFFLINE';
                k4On.className = 'status-val-sm ' + (data.k4.online ? 'color-online' : 'color-offline');

                const k67On = document.getElementById('k67Online');
                k67On.innerText = data.k67.online ? '🟢 ONLINE' : '🔴 OFFLINE';
                k67On.className = 'status-val-sm ' + (data.k67.online ? 'color-online' : 'color-offline');

                // Lervy
                const lervyStat = document.getElementById('lervyStatus');
                lervyStat.innerText = data.lervy.status === 'open' ? 'RUNNING (OPEN)' : 'PAUSED (CLOSE)';
                lervyStat.className = 'status-val ' + (data.lervy.status === 'open' ? 'color-open' : 'color-close');

                const lervyOn = document.getElementById('lervyOnline');
                lervyOn.innerText = data.lervy.online ? '🟢 ONLINE' : '🔴 OFFLINE';
                lervyOn.className = 'status-val-sm ' + (data.lervy.online ? 'color-online' : 'color-offline');

                const k666On = document.getElementById('k666Online');
                k666On.innerText = data.k666.online ? '🟢 ONLINE' : '🔴 OFFLINE';
                k666On.className = 'status-val-sm ' + (data.k666.online ? 'color-online' : 'color-offline');
            }

            async function fetchStatus() {
                try {
                    const res = await fetch('/api/status');
                    const data = await res.json();
                    updateUI(data);
                } catch(e) {}
            }

            async function action(url) {
                try {
                    await fetch(url, { method: 'POST' });
                    fetchStatus();
                } catch(e) {}
            }

            async function setStatus(url, status) {
                try {
                    await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status })
                    });
                    fetchStatus();
                } catch(e) {}
            }

            fetchStatus();
            setInterval(fetchStatus, 3000);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Controller รันบน http://localhost:${PORT}`);
});