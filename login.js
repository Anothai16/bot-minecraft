const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const MC_VERSION = '1.20.1';
const WEB_PORT = 3011;

const sharedData = minecraftData(MC_VERSION);

function log(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.log(`[${time}] ${msg}`);
}

function logError(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.error(`[${time}] ${msg}`);
}

// เหลือแค่บอท K666 ตัวเดียว
const BOT_CONFIGS = [
    { name: 'K666', pass: '112233' }
];

const BOT_NAMES = BOT_CONFIGS.map(b => b.name);
const activeBots = {};

const botStatusMap = {};
BOT_NAMES.forEach(name => {
    botStatusMap[name] = { 
        status: 'Stopped', 
        step: 'พร้อมสั่งล็อกอิน...', 
        lastUpdate: new Date().toLocaleTimeString('th-TH', { hour12: false }),
        lastError: '-',
        enabled: false 
    };
});

function updateStatus(name, status, step, errorReason = null) {
    if (!botStatusMap[name]) return;
    botStatusMap[name].status = status;
    if (step) botStatusMap[name].step = step;
    if (errorReason) botStatusMap[name].lastError = errorReason;
    botStatusMap[name].lastUpdate = new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function stopBotInstance(username) {
    if (activeBots[username]) {
        if (activeBots[username].anvilCheckTimer) clearTimeout(activeBots[username].anvilCheckTimer);
        try { activeBots[username].quit(); } catch (e) {}
        delete activeBots[username];
    }
}

function finishLoginAndDisconnect(bot, username) {
    log(`[🎉] [${username}] ล็อกอินเสร็จสมบูรณ์ 100%! เตรียมตัดการเชื่อมต่อใน 3 วินาทีเพื่อให้ MCC เข้าใช้งานต่อ...`);
    updateStatus(username, 'Completed', 'ล็อกอินผ่านแล้ว (ตัดการเชื่อมต่อให้ MCC)');

    setTimeout(() => {
        botStatusMap[username].enabled = false;
        stopBotInstance(username);
        log(`[🚪] [${username}] ตัดการเชื่อมต่อเรียบร้อยแล้ว -> พร้อมให้ MCC ล็อกอินเข้าไปเดินต่อ!`);
        updateStatus(username, 'Ready for MCC', 'ปลดล็อกแล้ว (พร้อมส่งต่อให้ MCC)');
    }, 3000);
}

function createBotInstance(username, delayMs = 0) {
    const currentStatus = botStatusMap[username]?.status || 'Stopped';
    const isAlreadyRunning = activeBots[username] && (currentStatus.includes('Online') || currentStatus === 'Connecting' || currentStatus === 'Logging in');

    if (isAlreadyRunning) {
        log(`[i] [${username}] กำลังทำงานอยู่แล้ว -> ข้ามการรันซ้ำ`);
        return;
    }

    if (!botStatusMap[username]?.enabled) {
        updateStatus(username, 'Stopped', 'ระงับการทำงาน (User Disabled)');
        return;
    }

    setTimeout(() => {
        if (!botStatusMap[username]?.enabled) return;

        stopBotInstance(username);

        log(`[+] [${username}] กำลังเชื่อมต่อเพื่อดำเนินการปลดล็อกระบบ Anvil Login...`);
        updateStatus(username, 'Connecting', 'กำลังเชื่อมต่อ...');

        const botConfig = BOT_CONFIGS.find(b => b.name === username);
        const botPassword = botConfig ? botConfig.pass : '112233';

        const bot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: false,
            checkTimeoutInterval: 60000
        });

        activeBots[username] = bot;
        bot.authStage = 'START';

        bot.on('kicked', (reason) => {
            let kickReasonStr = reason;
            try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
            logError(`[🚨 KICKED] [${username}] โดนเตะ! เหตุผล: ${kickReasonStr}`);
            updateStatus(username, 'Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
        });

        bot.on('windowOpen', async (window) => {
            // STAGE 1: หน้าต่างล็อกอินหลัก (GUI สมุด) -> กด Slot 1
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'START') {
                bot.authStage = 'OPENING_ANVIL';
                log(`[1/3] [${username}] พบ GUI ล็อกอินหลัก -> กำลังรอ 3.5s แล้วกด Slot 1 (สมุด)...`);
                updateStatus(username, 'Logging in', 'รอเปิด Anvil (Slot 1)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);

                        // Fallback Check: ถ้าไม่เด้ง Anvil แสดงว่าเคยล็อกอินผ่านแล้ว
                        bot.anvilCheckTimer = setTimeout(() => {
                            if (bot.authStage === 'OPENING_ANVIL') {
                                log(`[⚡] [${username}] ไม่พบหน้าต่าง Anvil (บัญชีนี้ปลดล็อกอยู่แล้ว)`);
                                finishLoginAndDisconnect(bot, username);
                            }
                        }, 4000);

                    } catch (e) {}
                }, 3500);
            }

            // STAGE 2: หน้าต่าง Anvil (Edit text) -> ป้อนรหัสผ่าน 112233
            else if (window.type === 'minecraft:anvil' && (bot.authStage === 'OPENING_ANVIL' || bot.authStage === 'START')) {
                if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
                bot.authStage = 'PASS_TYPED';
                log(`[2/3] [${username}] Anvil เปิดสำเร็จ! -> กำลังป้อนรหัสผ่าน ${botPassword}...`);
                updateStatus(username, 'Logging in', 'กำลังพิมพ์รหัสผ่านลง Anvil');

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: botPassword });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0);
                        }, 1500);
                    } catch (e) {}
                }, 2500);
            }

            // STAGE 3: ยืนยันรหัสผ่าน (Slot 2) หลังพิมพ์รหัสเสร็จ
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'PASS_TYPED') {
                bot.authStage = 'DONE';
                log(`[3/3] [${username}] พิมพ์รหัสเรียบร้อย -> ยืนยันเข้าสู่ระบบ (Slot 2)...`);
                updateStatus(username, 'Logging in', 'กดยืนยัน Slot 2');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        finishLoginAndDisconnect(bot, username);
                    } catch (e) {}
                }, 2500);
            }
        });

        bot.on('spawn', () => {
            log(`[✓] [${username}] สปอว์นเข้าฉากเรียบร้อย`);
        });

        bot.on('error', (err) => {
            logError(`[❌ Error] [${username}]: ${err.message}`);
            updateStatus(username, 'Error', err.message, err.message);
        });

        bot.on('end', (reason) => {
            if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
            delete activeBots[username];
            log(`[!] [${username}] จบการเชื่อมต่อ (${reason})`);
            
            if (botStatusMap[username]?.status !== 'Ready for MCC') {
                updateStatus(username, 'Stopped', 'ไม่ได้ทำงาน');
            }
        });

    }, delayMs);
}

// ==========================================
// Web Dashboard & API (Port 3011)
// ==========================================
const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const path = parsedUrl.pathname;

    if (path === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(botStatusMap));
        return;
    }

    if (path === '/api/control') {
        const action = parsedUrl.searchParams.get('action');
        const name = parsedUrl.searchParams.get('name') || 'K666';

        if (action === 'start') {
            botStatusMap[name].enabled = true;
            botStatusMap[name].lastError = '-';
            createBotInstance(name, 0);
        } else if (action === 'stop') {
            botStatusMap[name].enabled = false;
            stopBotInstance(name);
            updateStatus(name, 'Stopped', 'สั่งหยุดทำงาน');
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ success: true }));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>K666 Login Helper</title>
    <style>
        body { font-family: monospace, sans-serif; background: #121212; color: #e0e0e0; margin: 25px; }
        .card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 20px; max-width: 500px; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        h2 { color: #4caf50; margin-top: 0; }
        .status-row { margin: 12px 0; font-size: 15px; }
        .btn { background: #2e7d32; color: #fff; border: 1px solid #4caf50; padding: 10px 18px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 14px; width: 100%; margin-top: 10px; }
        .btn-stop { background: #c62828; border-color: #ef5350; margin-top: 5px; }
        .btn:hover { opacity: 0.9; }
        .val { color: #fff; font-weight: bold; }
        .Ready { color: #00e676 !important; font-weight: bold; }
        .Logging { color: #ffeb3b !important; }
        .Stopped { color: #9e9e9e !important; }
    </style>
</head>
<body>
    <div class="card">
        <h2>🔑 K666 Login Helper (Port 3011)</h2>
        <div class="status-row">ไอดีเป้าหมาย: <span class="val">K666</span></div>
        <div class="status-row">สถานะ: <span id="status" class="val">-</span></div>
        <div class="status-row">ขั้นตอนล่าสุด: <span id="step" class="val">-</span></div>
        <div class="status-row">อัปเดตเมื่อ: <span id="time" class="val">-</span></div>

        <button class="btn" onclick="control('start')">▶ เริ่มการปลดล็อก Login (Anvil)</button>
        <button class="btn btn-stop" onclick="control('stop')">⏹ ยกเลิก / สั่งหยุด</button>
    </div>

    <script>
        async function control(action) {
            await fetch('/api/control?name=K666&action=' + action);
            fetchStatus();
        }

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const k666 = data['K666'];
                if (k666) {
                    const statusEl = document.getElementById('status');
                    statusEl.textContent = k666.status;
                    statusEl.className = 'val ' + (k666.status.includes('Ready') ? 'Ready' : (k666.status.includes('Logging') ? 'Logging' : 'Stopped'));
                    document.getElementById('step').textContent = k666.step;
                    document.getElementById('time').textContent = k666.lastUpdate;
                }
            } catch (e) {}
        }
        setInterval(fetchStatus, 2000);
        fetchStatus();
    </script>
</body>
</html>
    `);
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

server.listen(WEB_PORT, () => {
    log('==================================================');
    log(`🔑 K666 AUTO-LOGIN HELPER INITIALIZED`);
    log(` [+] Target Server   : ${SERVER_HOST}:${SERVER_PORT}`);
    log(` [+] Port Web        : ${WEB_PORT}`);
    log(` [🌐] Web Dashboard  : http://${getLocalIP()}:${WEB_PORT}`);
    log('==================================================');
});