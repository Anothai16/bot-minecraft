const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const WEB_PORT = 3001;

app.use(express.json());

const logsBuffer = [];
const MAX_LOGS = 200;

function addLog(msg) {
    const timestamp = new Date().toLocaleTimeString('th-TH');
    logsBuffer.push(`[${timestamp}] ${msg}`);
    if (logsBuffer.length > MAX_LOGS) logsBuffer.shift();
    console.log(`[${timestamp}] ${msg}`);
}

let mccProcess = null;
let isConnected = false;

function startMCC() {
    addLog('[SYSTEM] กำลังเริ่มโปรเซส Minecraft Console Client...');
    
    // ⚡ รันโดยใช้การตั้งค่าจาก MinecraftClient.ini ในโฟลเดอร์โดยตรง
    mccProcess = spawn(path.join(__dirname, 'MinecraftClient'), [], {
        cwd: __dirname,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    mccProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(l => {
            const line = l.trim();
            if (!line) return;
            addLog(line);

            // ดักจับว่าหน้าต่าง Dialog โผล่ขึ้นมาแล้ว
            if (line.includes('Dialog #1') || line.includes('ยินดีต้อนรับเข้าสู่เซิร์ฟเวอร์')) {
                handleDialogLogin();
            }
        });
    });

    mccProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(l => {
            const line = l.trim();
            if (line) addLog(`[STDERR] ${line}`);
        });
    });

    mccProcess.on('close', (code) => {
        addLog(`[SYSTEM] MCC Process ปิดตัวลง (Code: ${code}) กำลังเปิดใหม่ใน 10 วินาที...`);
        isConnected = false;
        setTimeout(startMCC, 10000);
    });
}

function sendCommand(cmd) {
    if (mccProcess && mccProcess.stdin && !mccProcess.stdin.destroyed) {
        addLog(`⌨️ [INPUT] ${cmd}`);
        mccProcess.stdin.write(`${cmd}\n`);
    } else {
        addLog(`❌ [ERROR] ไม่สามารถส่งคำสั่งได้ Process ยังไม่พร้อม`);
    }
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function handleDialogLogin() {
    addLog('[LOGIN] ตรวจพบ Dialog! กำลังส่งรหัสผ่าน...');
    await sleep(2000);
    sendCommand('/dialog input pass 112233');

    await sleep(1500);
    sendCommand('/dialog click 1');
    addLog('[LOGIN] กดยืนยัน Dialog สำเร็จ');

    await sleep(8000);
    addLog('[LOBBY] กดใช้งานเข็มทิศ...');
    sendCommand('/useitem mainhand');

    await sleep(1500);
    addLog('[LOBBY] เลือกห้อง Survival (Slot 10)...');
    sendCommand('/inventory container click 10 Left');

    await sleep(10000);
    addLog('[WARP] วาร์ปไปที่จุดคันโยก (/home home)...');
    sendCommand('/home home');
    addLog('✅ [READY] Lervy_Lever พร้อมทำงาน! ทดสอบกดปุ่มบนเว็บได้เลย');
    isConnected = true;
}

startMCC();

// ====================================================================
// 🌐 API ROUTES & WEB DASHBOARD
// ====================================================================
app.post('/api/send', (req, res) => {
    const { cmd } = req.body;
    if (!cmd) return res.status(400).json({ error: 'No command specified' });
    sendCommand(cmd);
    res.json({ status: 'ok', sent: cmd });
});

app.get('/api/logs', (req, res) => {
    res.json({ logs: logsBuffer.slice().reverse().join('\n') });
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MCC Lever Command Tester</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
            .container { max-width: 1000px; margin: auto; }
            h1 { font-size: 22px; color: #38bdf8; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px; }
            .btn { background: #1e293b; color: #38bdf8; border: 1px solid #334155; padding: 14px; font-size: 14px; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s; }
            .btn:hover { background: #334155; border-color: #38bdf8; }
            .btn:active { transform: scale(0.98); }
            .btn span { display: block; font-size: 11px; color: #94a3b8; margin-top: 4px; font-family: monospace; }
            .custom-box { display: flex; gap: 8px; margin-bottom: 20px; }
            .custom-box input { flex: 1; background: #020617; border: 1px solid #334155; padding: 12px 16px; border-radius: 6px; color: #fff; font-family: monospace; font-size: 14px; outline: none; }
            .custom-box button { background: #2563eb; color: #fff; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-weight: bold; }
            .log-box { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; height: 50vh; overflow-y: auto; white-space: pre-wrap; line-height: 1.5; color: #cbd5e1; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🕹️ MCC Lever Command Tester (Port 3001)</h1>
            
            <div class="grid">
                <button class="btn" onclick="exec('/useblock 10383 64 -5065')">
                    📌 1. /useblock
                    <span>/useblock 10383 64 -5065</span>
                </button>
                <button class="btn" onclick="exec('/interact 10383 64 -5065')">
                    📌 2. /interact
                    <span>/interact 10383 64 -5065</span>
                </button>
                <button class="btn" onclick="exec('/look 10383 64 -5065\\n/useitem')">
                    📌 3. Look + UseItem
                    <span>/look + /useitem</span>
                </button>
                <button class="btn" onclick="exec('/loc')">
                    📍 เช็คพิกัดปัจจุบัน
                    <span>/loc</span>
                </button>
                <button class="btn" onclick="exec('/home home')">
                    🏠 วาร์ปกลับจุดคันโยก
                    <span>/home home</span>
                </button>
                <button class="btn" onclick="exec('/reconnect')">
                    🔄 ต่อเซิร์ฟเวอร์ใหม่
                    <span>/reconnect</span>
                </button>
            </div>

            <div class="custom-box">
                <input type="text" id="customCmd" placeholder="พิมพ์คำสั่งสดเองที่นี่..." onkeydown="if(event.key==='Enter') sendCustom()">
                <button onclick="sendCustom()">ส่งคำสั่ง</button>
            </div>

            <div class="log-box" id="logs">กำลังดึง Logs...</div>
        </div>

        <script>
            async function exec(cmd) {
                await fetch('/api/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cmd })
                });
                updateLogs();
            }

            function sendCustom() {
                const input = document.getElementById('customCmd');
                if (input.value.trim()) {
                    exec(input.value.trim());
                    input.value = '';
                }
            }

            async function updateLogs() {
                try {
                    const res = await fetch('/api/logs');
                    const data = await res.json();
                    document.getElementById('logs').textContent = data.logs || 'ไม่มีข้อมูล Logs';
                } catch(e) {}
            }

            setInterval(updateLogs, 1500);
            updateLogs();
        </script>
    </body>
    </html>
    `);
});

app.listen(WEB_PORT, () => {
    addLog(`🌍 Web Tester พร้อมทำงานที่ http://localhost:${WEB_PORT}`);
});