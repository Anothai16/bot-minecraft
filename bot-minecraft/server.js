const express = require('express');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const app = express();
const PORT = 3003;

const PIPE_PATH = '/tmp/mcc_pipe_kaitom_cmd';
const STATUS_FILE = path.join(__dirname, 'lever_status.txt');
const K4_READY_FILE = path.join(__dirname, 'kaitom4_ready.txt');
const K67_READY_FILE = path.join(__dirname, 'k666', 'kaitom67_ready.txt');

app.use(express.json());

function getLeverStatus() {
    try {
        if (fs.existsSync(STATUS_FILE)) {
            return fs.readFileSync(STATUS_FILE, 'utf-8').trim();
        }
    } catch (e) {}
    return 'unknown';
}

function setLeverStatus(status) {
    try {
        fs.writeFileSync(STATUS_FILE, status.trim(), 'utf-8');
        return true;
    } catch (e) {
        return false;
    }
}

function sendCommand(cmd) {
    if (fs.existsSync(PIPE_PATH)) {
        fs.appendFileSync(PIPE_PATH, cmd + '\n');
        return true;
    }
    return false;
}

// ฟังก์ชันเช็กว่ารันอยู่จริง และผ่านขั้นตอนวาร์ปเข้าโลกแล้ว
function checkBotInWorld(botName, readyFilePath) {
    return new Promise((resolve) => {
        exec(`pgrep -fa 'MinecraftClient.*${botName}'`, (err, stdout) => {
            if (err || !stdout.trim()) {
                // ถ้าโปรเซสไม่รัน = OFFLINE
                resolve(false);
            } else {
                // ถ้าโปรเซสรันอยู่ ต้องดูว่าวาร์ปเข้าโลกเสร็จหรือยัง
                try {
                    if (fs.existsSync(readyFilePath)) {
                        const state = fs.readFileSync(readyFilePath, 'utf-8').trim();
                        resolve(state === 'online');
                    } else {
                        resolve(false);
                    }
                } catch (e) {
                    resolve(false);
                }
            }
        });
    });
}

// 📌 API ดึงสถานะ
app.get('/api/status', async (req, res) => {
    const [kaitom4Online, kaitom67Online] = await Promise.all([
        checkBotInWorld('Kaitom_4', K4_READY_FILE),
        checkBotInWorld('Kaitom_67', K67_READY_FILE)
    ]);

    res.json({
        status: getLeverStatus(),
        kaitom4Online: kaitom4Online,
        kaitom67Online: kaitom67Online
    });
});

app.post('/api/set-status', (req, res) => {
    const { status } = req.body;
    if (status !== 'open' && status !== 'close') {
        return res.status(400).json({ success: false, message: 'สถานะต้องเป็น open หรือ close เท่านั้น' });
    }
    if (setLeverStatus(status)) {
        res.json({ success: true, status: status, message: `แก้ไขสถานะเป็น '${status}' เรียบร้อยแล้ว` });
    } else {
        res.status(500).json({ success: false, message: 'ไม่สามารถบันทึกไฟล์สถานะได้' });
    }
});

app.post('/api/toggle-lever', (req, res) => {
    if (!fs.existsSync(PIPE_PATH)) {
        return res.status(500).json({ success: false, message: 'ไม่พบบอทในระบบ (ท่อคำสั่งไม่พร้อม)' });
    }

    sendCommand('/useblock -2682 61 14542');

    const current = getLeverStatus();
    const newStatus = current === 'open' ? 'close' : 'open';
    setLeverStatus(newStatus);

    res.json({
        success: true,
        newStatus: newStatus,
        message: `สับคันโยกเรียบร้อย! สถานะปัจจุบัน: ${newStatus.toUpperCase()}`
    });
});

app.post('/api/go-home', (req, res) => {
    if (sendCommand('/home home')) {
        res.json({ success: true, message: 'ส่งคำสั่ง /home home เรียบร้อย' });
    } else {
        res.status(500).json({ success: false, message: 'ส่งคำสั่งไม่สำเร็จ บอทไม่ได้ออนไลน์' });
    }
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Bot Dashboard</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
            body { background: #0b0f19; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
            .card { background: #111827; padding: 28px; border-radius: 18px; border: 1px solid #1f2937; width: 100%; max-width: 480px; box-shadow: 0 12px 30px rgba(0,0,0,0.6); text-align: center; }
            h1 { font-size: 20px; color: #38bdf8; margin-bottom: 4px; font-weight: 700; }
            .sub { font-size: 12px; color: #64748b; margin-bottom: 20px; }
            
            .status-main { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 14px; margin-bottom: 12px; }
            .grid-status { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
            .status-container { background: #030712; border: 1px solid #1f2937; border-radius: 12px; padding: 12px; }
            
            .status-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
            .status-val { font-size: 20px; font-weight: bold; }
            .status-val-sm { font-size: 15px; font-weight: bold; }
            
            .color-open, .color-online { color: #34d399; }
            .color-close, .color-offline { color: #f87171; }
            
            .btn { width: 100%; padding: 13px; font-size: 15px; font-weight: bold; border: none; border-radius: 10px; cursor: pointer; transition: 0.15s; margin-bottom: 10px; }
            .btn-toggle { background: #0284c7; color: white; }
            .btn-toggle:hover { background: #0369a1; }
            .btn-toggle:disabled { background: #374151; cursor: not-allowed; }
            
            .btn-home { background: #1f2937; color: #cbd5e1; border: 1px solid #374151; font-size: 13px; }
            .btn-home:hover { background: #374151; }
            
            .edit-box { margin-top: 18px; padding-top: 16px; border-top: 1px solid #1f2937; text-align: left; }
            .edit-title { font-size: 12px; color: #94a3b8; font-weight: 600; margin-bottom: 8px; }
            .edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .btn-state { padding: 9px; font-size: 12px; font-weight: 600; border-radius: 8px; border: 1px solid #374151; cursor: pointer; background: #1f2937; color: #e2e8f0; }
            .btn-state-open:hover { background: #065f46; border-color: #059669; }
            .btn-state-close:hover { background: #7f1d1d; border-color: #dc2626; }

            #msg { margin-top: 14px; font-size: 13px; padding: 10px; border-radius: 8px; display: none; }
            .msg-success { background: #064e3b; color: #6ee7b7; }
            .msg-error { background: #7f1d1d; color: #fca5a5; }
        </style>
    </head>
    <body>
        <div class="card">
            <h1>🕹️ BOT CONTROLLER & MONITOR</h1>
            <div class="sub">พิกัดคันโยก: -2682 61 14542 (Port 3003)</div>
            
            <div class="status-main">
                <div class="status-label">สถานะระบบคันโยก</div>
                <div id="leverVal" class="status-val color-open">กำลังโหลด...</div>
            </div>

            <div class="grid-status">
                <div class="status-container">
                    <div class="status-label">Kaitom_4 (คันโยก)</div>
                    <div id="bot4Val" class="status-val-sm color-offline">OFFLINE</div>
                </div>
                <div class="status-container">
                    <div class="status-label">Kaitom_67 (AFK)</div>
                    <div id="bot67Val" class="status-val-sm color-offline">OFFLINE</div>
                </div>
            </div>

            <button id="toggleBtn" class="btn btn-toggle" onclick="toggleLever()">⚡ สับคันโยก (สลับสถานะ)</button>
            <button class="btn btn-home" onclick="sendHome()">📍 วาร์ป Kaitom_4 ไปจุดคันโยก (/home home)</button>
            
            <div class="edit-box">
                <div class="edit-title">🛠️ บังคับแก้ไขประวัติสถานะ (ไม่กดสับในเกม):</div>
                <div class="edit-grid">
                    <button class="btn-state btn-state-open" onclick="overrideStatus('open')">🟢 ตั้งเป็น OPEN</button>
                    <button class="btn-state btn-state-close" onclick="overrideStatus('close')">🔴 ตั้งเป็น CLOSE</button>
                </div>
            </div>

            <div id="msg"></div>
        </div>

        <script>
            function showMsg(text, isError = false) {
                const box = document.getElementById('msg');
                box.style.display = 'block';
                box.className = isError ? 'msg-error' : 'msg-success';
                box.innerText = text;
            }

            function updateUI(data) {
                const leverEl = document.getElementById('leverVal');
                leverEl.innerText = data.status.toUpperCase();
                leverEl.className = 'status-val ' + (data.status === 'open' ? 'color-open' : 'color-close');

                const bot4El = document.getElementById('bot4Val');
                if (data.kaitom4Online) {
                    bot4El.innerText = '🟢 ONLINE';
                    bot4El.className = 'status-val-sm color-online';
                } else {
                    bot4El.innerText = '🔴 OFFLINE';
                    bot4El.className = 'status-val-sm color-offline';
                }

                const bot67El = document.getElementById('bot67Val');
                if (data.kaitom67Online) {
                    bot67El.innerText = '🟢 ONLINE';
                    bot67El.className = 'status-val-sm color-online';
                } else {
                    bot67El.innerText = '🔴 OFFLINE';
                    bot67El.className = 'status-val-sm color-offline';
                }
            }

            async function fetchStatus() {
                try {
                    const res = await fetch('/api/status');
                    const data = await res.json();
                    updateUI(data);
                } catch(e) {}
            }

            async function toggleLever() {
                const btn = document.getElementById('toggleBtn');
                btn.disabled = true;
                btn.innerText = '⏳ กำลังส่งคำสั่ง...';
                
                try {
                    const res = await fetch('/api/toggle-lever', { method: 'POST' });
                    const data = await res.json();
                    showMsg(data.message, !data.success);
                    fetchStatus();
                } catch(e) {
                    showMsg('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', true);
                } finally {
                    btn.disabled = false;
                    btn.innerText = '⚡ สับคันโยก (สลับสถานะ)';
                }
            }

            async function overrideStatus(newStatus) {
                try {
                    const res = await fetch('/api/set-status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus })
                    });
                    const data = await res.json();
                    showMsg(data.message, !data.success);
                    fetchStatus();
                } catch(e) {
                    showMsg('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', true);
                }
            }

            async function sendHome() {
                try {
                    const res = await fetch('/api/go-home', { method: 'POST' });
                    const data = await res.json();
                    showMsg(data.message, !data.success);
                } catch(e) {
                    showMsg('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', true);
                }
            }

            fetchStatus();
            setInterval(fetchStatus, 3000);
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Kaitom Controller รันบน http://localhost:${PORT}`);
});