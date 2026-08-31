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

// Paths Lervy & K666
const LERVY_PIPE = '/tmp/mcc_pipe_lervy_cmd';
const LERVY_STATUS_FILE = path.join(__dirname, 'lervy_status.txt');
const LERVY_READY_FILE = path.join(__dirname, 'lervy_ready.txt');
const K666_READY_FILE = path.join(__dirname, 'k666', 'k666_ready.txt');

// Path Log File (วันต่อวัน)
const DAILY_LOG_FILE = path.join(__dirname, 'auto_open_daily.log');

app.use(express.json());

// 📝 ฟังก์ชันบันทึก Log วันต่อวัน (ข้ามวันใหม่จะเขียนทับของเดิมทันที)
let lastLoggedDate = '';
function logDaily(message) {
    const now = new Date();
    const today = now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' });
    const time = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
    const logLine = `[${today} ${time}] ${message}\n`;

    console.log(logLine.trim());

    try {
        if (lastLoggedDate !== today) {
            // วันใหม่ -> ลบของเก่าทิ้งแล้วเริ่มเขียนใหม่
            fs.writeFileSync(DAILY_LOG_FILE, `=== บันทึกกิจกรรมประจำวันที่ ${today} ===\n` + logLine, 'utf-8');
            lastLoggedDate = today;
        } else {
            // วันเดิม -> ต่อท้ายบรรทัดเดิม
            fs.appendFileSync(DAILY_LOG_FILE, logLine, 'utf-8');
        }
    } catch (e) {
        console.error('Error writing daily log:', e);
    }
}

function readFile(file, fallback = 'unknown') {
    try {
        if (fs.existsSync(file)) {
            const data = fs.readFileSync(file, 'utf-8').trim();
            return data || fallback;
        }
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

// 🛡️ ป้องกัน Pipe Block ค้าง Event Loop ด้วย non-blocking command
function sendCommand(pipePath, cmd) {
    if (!fs.existsSync(pipePath)) return false;
    try {
        exec(`echo "${cmd}" > ${pipePath}`, (err) => {
            if (err) console.error(`[PIPE ERROR]: ไม่สามารถส่ง '${cmd}' ไปยัง ${pipePath}`);
        });
        return true;
    } catch (e) {
        return false;
    }
}

// 💓 เช็กสถานะออนไลน์ผ่าน Process + Heartbeat Timestamp
function checkBotInWorld(botName, readyFilePath) {
    return new Promise((resolve) => {
        exec(`pgrep -fa 'MinecraftClient.*${botName}'`, (err, stdout) => {
            if (err || !stdout.trim()) {
                resolve(false);
            } else {
                const status = readFile(readyFilePath, 'offline');
                if (status === 'offline' || !status) {
                    resolve(false);
                    return;
                }
                
                const lastTimestamp = parseInt(status, 10);
                if (!isNaN(lastTimestamp)) {
                    const currentSec = Math.floor(Date.now() / 1000);
                    // หาก Timestamp ขาดการอัปเดตเกิน 25 วินาที = บอทหลุด/ค้าง
                    if (currentSec - lastTimestamp <= 25) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                } else {
                    resolve(status === 'online');
                }
            }
        });
    });
}

// ==========================================
// ⏰ AUTO-OPEN CRON LOOP (เวลา 07:30 น. เวลาไทย)
// ==========================================
let triggered0730 = false;

setInterval(async () => {
    const bkkTimeStr = new Date().toLocaleTimeString('en-US', {
        timeZone: 'Asia/Bangkok',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
    });
    const [hourStr, minStr] = bkkTimeStr.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);

    // ทำงานเฉพาะเวลา 07:30 น.
    if (hour === 7 && minute === 30) {
        if (!triggered0730) {
            triggered0730 = true;
            logDaily(`⏰ [START 07:30] เริ่มตรวจสอบเงื่อนไข Auto-Open ประจำวัน...`);

            // 1. ตรวจสอบฝั่ง Pumpkin (Kaitom_4 + Kaitom_67)
            const [k4Online, k67Online] = await Promise.all([
                checkBotInWorld('Kaitom_4', K4_READY_FILE),
                checkBotInWorld('Kaitom_67', K67_READY_FILE)
            ]);
            const k4Status = readFile(K4_STATUS_FILE, 'close');

            if (k4Online && k67Online) {
                if (k4Status === 'close') {
                    sendCommand(K4_PIPE, '/useblock -2682 61 14542');
                    writeFile(K4_STATUS_FILE, 'open');
                    logDaily(`🟢 [PUMPKIN] เข้าเงื่อนไข (K4: Online, K67: Online, Status: close) -> สั่ง /useblock สับคันโยก OPEN สำเร็จ!`);
                } else {
                    logDaily(`ℹ️ [PUMPKIN] บอทออนไลน์ครบ แต่สถานะเป็น '${k4Status}' อยู่แล้ว จึงไม่ต้องสับคันโยก`);
                }
            } else {
                logDaily(`⚠️ [PUMPKIN] ข้ามการทำงานเนื่องจากออนไลน์ไม่ครบ (K4: ${k4Online ? 'Online' : 'Offline'}, K67: ${k67Online ? 'Online' : 'Offline'})`);
            }

            // 2. ตรวจสอบฝั่ง Kelp (Lervy_Lever + K666)
            const [lervyOnline, k666Online] = await Promise.all([
                checkBotInWorld('Lervy_Lever', LERVY_READY_FILE),
                checkBotInWorld('K666', K666_READY_FILE)
            ]);
            const lervyStatus = readFile(LERVY_STATUS_FILE, 'close');

            if (lervyOnline && k666Online) {
                if (lervyStatus === 'close') {
                    writeFile(LERVY_STATUS_FILE, 'open');
                    logDaily(`🟢 [KELP] เข้าเงื่อนไข (Lervy: Online, K666: Online, Status: close) -> ปรับไฟล์สถานะเป็น OPEN เริ่มลูป Auto สำเร็จ!`);
                } else {
                    logDaily(`ℹ️ [KELP] บอทออนไลน์ครบ แต่สถานะเป็น '${lervyStatus}' อยู่แล้ว`);
                }
            } else {
                logDaily(`⚠️ [KELP] ข้ามการทำงานเนื่องจากออนไลน์ไม่ครบ (Lervy: ${lervyOnline ? 'Online' : 'Offline'}, K666: ${k666Online ? 'Online' : 'Offline'})`);
            }
        }
    } else {
        // รีเซ็ต Flag เมื่อพ้นช่วงเวลา 07:30 น.
        if (triggered0730) {
            triggered0730 = false;
        }
    }
}, 1000 * 10);

// 📌 API ดึงสถานะรวม + Log ประจำวัน
app.get('/api/status', async (req, res) => {
    const [k4Online, k67Online, lervyOnline, k666Online] = await Promise.all([
        checkBotInWorld('Kaitom_4', K4_READY_FILE),
        checkBotInWorld('Kaitom_67', K67_READY_FILE),
        checkBotInWorld('Lervy_Lever', LERVY_READY_FILE),
        checkBotInWorld('K666', K666_READY_FILE)
    ]);

    const dailyLog = readFile(DAILY_LOG_FILE, 'ยังไม่มีบันทึกการทำงานของวันนี้');

    res.json({
        k4: { status: readFile(K4_STATUS_FILE, 'open'), online: k4Online },
        k67: { online: k67Online },
        lervy: { status: readFile(LERVY_STATUS_FILE, 'open'), online: lervyOnline },
        k666: { online: k666Online },
        dailyLog: dailyLog
    });
});

// 🔄 API สั่ง PM2 Restart
app.post('/api/pm2-restart', (req, res) => {
    const { name } = req.body;
    const allowedProcesses = ['Kaitom_4lever', 'Kaitom_67', 'mcc-lever', 'bot-k666'];
    
    if (!allowedProcesses.includes(name)) {
        return res.status(400).json({ success: false, message: 'ชื่อโปรเซสไม่ถูกต้อง' });
    }

    exec(`pm2 restart ${name} --update-env`, (err, stdout, stderr) => {
        if (err) {
            console.error(`[PM2 Error]: ${stderr}`);
            return res.status(500).json({ success: false, message: `Restart ${name} ล้มเหลว` });
        }
        console.log(`[PM2 Restart]: ${name}`);
        res.json({ success: true, message: `สั่ง Restart ${name} เรียบร้อยแล้ว` });
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
app.post('/api/lervy/toggle-loop', (req, res) => {
    const current = readFile(LERVY_STATUS_FILE, 'open');
    const newStatus = current === 'open' ? 'close' : 'open';
    writeFile(LERVY_STATUS_FILE, newStatus);
    res.json({
        success: true,
        newStatus: newStatus,
        message: newStatus === 'open' ? 'เปิดระบบ Auto Loop แล้ว' : 'ปิดระบบ Auto Loop แล้ว'
    });
});

app.post('/api/lervy/set-status', (req, res) => {
    writeFile(LERVY_STATUS_FILE, req.body.status);
    res.json({ success: true, status: req.body.status });
});

app.post('/api/lervy/home', (req, res) => {
    res.json({ success: sendCommand(LERVY_PIPE, '/home home') });
});

// 🌐 หน้า Web Dashboard
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
            body { background: #0b0f19; color: #f8fafc; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 20px; }
            .wrapper { display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; max-width: 960px; width: 100%; margin-bottom: 20px; }
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
            
            .btn { width: 100%; padding: 12px; font-size: 14px; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; transition: 0.15s; margin-bottom: 8px; }
            .btn-blue { background: #0284c7; color: white; }
            .btn-blue:hover { background: #0369a1; }
            
            .btn-lervy-open { background: #059669; color: white; }
            .btn-lervy-open:hover { background: #047857; }
            .btn-lervy-close { background: #dc2626; color: white; }
            .btn-lervy-close:hover { background: #b91c1c; }
            
            .btn-dark { background: #1f2937; color: #cbd5e1; border: 1px solid #374151; font-size: 12px; }
            .btn-dark:hover { background: #374151; }

            .section-box { margin-top: 12px; padding-top: 10px; border-top: 1px solid #1f2937; text-align: left; }
            .section-title { font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 6px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
            
            .btn-state { padding: 8px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #374151; cursor: pointer; background: #1f2937; color: #e2e8f0; }
            .btn-state-open:hover { background: #065f46; border-color: #059669; }
            .btn-state-close:hover { background: #7f1d1d; border-color: #dc2626; }

            .btn-restart { padding: 8px; font-size: 11px; font-weight: 600; border-radius: 6px; border: 1px solid #475569; cursor: pointer; background: #1e293b; color: #f59e0b; }
            .btn-restart:hover { background: #334155; border-color: #f59e0b; }
            .btn-restart:active { transform: scale(0.98); }

            /* กล่องแสดง Log ประจำวัน */
            .log-panel { max-width: 960px; width: 100%; background: #111827; border: 1px solid #1f2937; border-radius: 18px; padding: 18px 24px; box-shadow: 0 12px 30px rgba(0,0,0,0.6); }
            .log-title { font-size: 14px; font-weight: bold; color: #38bdf8; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
            .log-box { font-family: 'JetBrains Mono', monospace, Consolas; font-size: 11px; background: #030712; border: 1px solid #1f2937; border-radius: 10px; height: 110px; overflow-y: auto; padding: 12px; color: #94a3b8; line-height: 1.6; white-space: pre-wrap; }
        </style>
    </head>
    <body>
        <div class="wrapper">
            <!-- 🕹️ ฝั่งซ้าย: PUMPKIN CONTROLLER -->
            <div class="card">
                <h1>🕹️ PUMPKIN CONTROLLER</h1>
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
                
                <div class="section-box">
                    <div class="section-title">🔄 สั่ง PM2 Restart บอท:</div>
                    <div class="grid-2">
                        <button class="btn-restart" onclick="pm2Restart('Kaitom_4lever')">🔄 Restart K4</button>
                        <button class="btn-restart" onclick="pm2Restart('Kaitom_67')">🔄 Restart K67</button>
                    </div>
                </div>

                <div class="section-box">
                    <div class="section-title">🛠️ บังคับแก้สถานะในไฟล์:</div>
                    <div class="grid-2">
                        <button class="btn-state btn-state-open" onclick="setStatus('/api/k4/set-status', 'open')">🟢 OPEN</button>
                        <button class="btn-state btn-state-close" onclick="setStatus('/api/k4/set-status', 'close')">🔴 CLOSE</button>
                    </div>
                </div>
            </div>

            <!-- ⚙️ ฝั่งขวา: KELP CONTROLLER -->
            <div class="card">
                <h1>⚙️ KELP CONTROLLER</h1>
                <div class="sub">พิกัดคันโยก: 10383 64.00 -5064.51</div>
                
                <div class="status-main">
                    <div class="status-label">สถานะระบบ Auto Loop (MIN % 6 == 3)</div>
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

                <button id="lervyToggleBtn" class="btn btn-lervy-close" onclick="action('/api/lervy/toggle-loop')">⏸️ ปิดระบบ Auto Loop (CLOSE)</button>
                <button class="btn btn-dark" onclick="action('/api/lervy/home')">📍 วาร์ปไปจุดประจำการ (/home home)</button>
                
                <div class="section-box">
                    <div class="section-title">🔄 สั่ง PM2 Restart บอท:</div>
                    <div class="grid-2">
                        <button class="btn-restart" onclick="pm2Restart('mcc-lever')">🔄 Restart Lervy</button>
                        <button class="btn-restart" onclick="pm2Restart('bot-k666')">🔄 Restart K666</button>
                    </div>
                </div>

                <div class="section-box">
                    <div class="section-title">🛠️ สวิตช์ตั้งค่าสถานะตรง:</div>
                    <div class="grid-2">
                        <button class="btn-state btn-state-open" onclick="setStatus('/api/lervy/set-status', 'open')">🟢 บังคับ OPEN</button>
                        <button class="btn-state btn-state-close" onclick="setStatus('/api/lervy/set-status', 'close')">🔴 บังคับ CLOSE</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- 📜 กล่อง Log ประจำวัน -->
        <div class="log-panel">
            <div class="log-title">📜 บันทึกการตรวจสอบ 07:30 น. (รายวัน)</div>
            <div id="logBox" class="log-box">กำลังโหลดข้อมูล...</div>
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
                const isLervyOpen = data.lervy.status === 'open';
                lervyStat.innerText = isLervyOpen ? '🟢 RUNNING (OPEN)' : '🔴 PAUSED (CLOSE)';
                lervyStat.className = 'status-val ' + (isLervyOpen ? 'color-open' : 'color-close');

                const lervyBtn = document.getElementById('lervyToggleBtn');
                if (isLervyOpen) {
                    lervyBtn.innerText = '⏸️ กดเพื่อปิดระบบ (CLOSE)';
                    lervyBtn.className = 'btn btn-lervy-close';
                } else {
                    lervyBtn.innerText = '▶️ กดเพื่อเปิดระบบลูป (OPEN)';
                    lervyBtn.className = 'btn btn-lervy-open';
                }

                const lervyOn = document.getElementById('lervyOnline');
                lervyOn.innerText = data.lervy.online ? '🟢 ONLINE' : '🔴 OFFLINE';
                lervyOn.className = 'status-val-sm ' + (data.lervy.online ? 'color-online' : 'color-offline');

                const k666On = document.getElementById('k666Online');
                k666On.innerText = data.k666.online ? '🟢 ONLINE' : '🔴 OFFLINE';
                k666On.className = 'status-val-sm ' + (data.k666.online ? 'color-online' : 'color-offline');

                // Daily Log Box
                const logBox = document.getElementById('logBox');
                logBox.innerText = data.dailyLog || 'ยังไม่มีบันทึกกิจกรรมของวันนี้';
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

            async function pm2Restart(name) {
                try {
                    await fetch('/api/pm2-restart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
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