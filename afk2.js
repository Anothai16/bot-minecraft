const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3000;

const sharedData = minecraftData(MC_VERSION);

const BOT_NAMES = [
    'obs1', 'Morgan05', 'Domertown', 'Nattanon09', 'Nanepez', 'Sudlorkayeejai', 'Wood_Skel', 'sindirt', 'Pompamz',  'quast', 'Geyman',
    'Jolibee', 'Posma2', 'Rxzy3', 'mecular', 'Iron34', 'd456', 'Ixcw2534', 'ShadowEmpress', 'gulnwza007', 'Monosox', 'twenty29', '0zow29'
];

// เก็บ Instance ของบอทที่กำลังทำงาน
const activeBots = {};

// ตั้งค่าเริ่มต้นให้บอททุกตัวอยู่ในสถานะ "ปิดใช้งาน" (enabled = false)
const botStatusMap = {};
BOT_NAMES.forEach(name => {
    botStatusMap[name] = { 
        status: 'Stopped', 
        step: 'รอสั่งเปิดจากหน้าเว็บ...', 
        lastUpdate: new Date().toLocaleTimeString('th-TH'),
        lastError: '-',
        enabled: false // 🔥 ปิดไว้ก่อนตอนรันโค้ดครั้งแรก
    };
});

function updateStatus(name, status, step, errorReason = null) {
    if (!botStatusMap[name]) return;
    botStatusMap[name].status = status;
    if (step) botStatusMap[name].step = step;
    if (errorReason) botStatusMap[name].lastError = errorReason;
    botStatusMap[name].lastUpdate = new Date().toLocaleTimeString('th-TH');
}

function stopBotInstance(username) {
    if (activeBots[username]) {
        try {
            activeBots[username].quit();
        } catch (e) {}
        delete activeBots[username];
    }
}

function createBotInstance(username, delayMs = 0) {
    // ถ้าบอทไม่ได้เปิดใช้งาน (enabled === false) ให้ยกเลิกการทำงานทันที
    if (!botStatusMap[username]?.enabled) {
        updateStatus(username, 'Stopped', 'ระงับการทำงาน (User Disabled)');
        return;
    }

    setTimeout(() => {
        if (!botStatusMap[username]?.enabled) return;

        stopBotInstance(username);

        console.log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);
        updateStatus(username, 'Connecting', 'กำลังเชื่อมต่อ...');

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
        bot.flowState = 0;

        bot.on('message', (jsonMsg) => {
            const strMsg = jsonMsg.toString().trim();
            if (strMsg && !strMsg.includes('AFK') && !strMsg.includes('เข้าร่วม')) {
                console.log(`[💬 Log] [${username}]: ${strMsg}`);
            }
        });

        bot.on('kicked', (reason) => {
            let kickReasonStr = reason;
            try {
                kickReasonStr = JSON.parse(reason).text || reason;
            } catch (e) {}
            
            console.error(`[🚨 KICKED] [${username}] โดนเตะ! เหตุผล: ${kickReasonStr}`);
            updateStatus(username, 'Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
        });

        bot.on('windowOpen', async (window) => {
            if (window.type === 'minecraft:generic_9x3' && bot.flowState === 0) {
                bot.flowState = 1;
                console.log(`[1/3] [${username}] พบ GUI ล็อกอิน -> กำลังกดปุ่มเข้าสู่ระบบ (Slot 2)...`);
                updateStatus(username, 'Logging in', 'กดเข้าสู่ระบบ (Slot 2)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        updateStatus(username, 'In Lobby', 'วาร์ปเข้าห้องโถง');

                        setTimeout(async () => {
                            updateStatus(username, 'In Lobby', 'สแกนถือเข็มทิศ');
                            const compass = bot.inventory.items().find(i => i.name.includes('compass'));
                            if (compass) {
                                try {
                                    await bot.equip(compass, 'hand');
                                    await bot.sleep(500);
                                    bot.activateItem();
                                } catch (e) {
                                    bot.activateItem();
                                }
                            } else {
                                try { bot.activateItem(); } catch (e) {}
                            }
                        }, 6000);

                    } catch (err) {
                        console.error(`[-] [${username}] กดเข้าสู่ระบบพลาด: ${err.message}`);
                    }
                }, 1500);
            }
            else if (window.type === 'minecraft:generic_9x3' && bot.flowState === 1) {
                bot.flowState = 2;
                console.log(`[3/3] [${username}] GUI เข็มทิศเปิดขึ้นมาแล้ว! -> กำลังกดเลือก Survival (Slot 10)...`);
                updateStatus(username, 'Selecting Mode', 'เลือก Survival (Slot 10)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        updateStatus(username, 'Entering Survival', 'กำลังเข้าโลก Survival');

                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์ /afk สำเร็จ! (ออนไลน์สมบูรณ์)`);
                            updateStatus(username, 'Online (AFK)', 'ออนไลน์ปกติ (/afk)');
                        }, 8000);

                    } catch (err) {
                        console.error(`[-] [${username}] กดเลือก Survival พลาด: ${err.message}`);
                    }
                }, 1800);
            }
        });

        bot.on('spawn', () => {
            console.log(`[✓] [${username}] โหลดฉากสำเร็จ`);
        });

        bot.on('error', (err) => {
            console.error(`[❌ Error] [${username}]: ${err.message}`);
            updateStatus(username, 'Error', err.message, err.message);
        });

        bot.on('end', (reason) => {
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason})`);
            
            if (botStatusMap[username]?.enabled) {
                updateStatus(username, 'Offline', `หลุด (${reason})`, botStatusMap[username]?.lastError || reason);
                console.log(`[i] [${username}] จะต่อใหม่ใน 25 วินาที...`);
                createBotInstance(username, 25000);
            } else {
                updateStatus(username, 'Stopped', 'ระงับการทำงาน');
            }
        });

    }, delayMs);
}

// ==========================================
// Web Server + REST API
// ==========================================
const server = http.createServer((req, res) => {
    const urlParts = req.url.split('?');
    const path = urlParts[0];

    if (path === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(botStatusMap));
        return;
    }

    if (path === '/api/control') {
        const params = new URLSearchParams(urlParts[1]);
        const name = params.get('name');
        const action = params.get('action');

        if (action === 'start-all') {
            BOT_NAMES.forEach((bName, idx) => {
                botStatusMap[bName].enabled = true;
                // สั่งทยอยรันห่างกันตัวละ 15 วินาที
                createBotInstance(bName, idx * 15000);
            });
        } else if (action === 'stop-all') {
            BOT_NAMES.forEach(bName => {
                botStatusMap[bName].enabled = false;
                stopBotInstance(bName);
                updateStatus(bName, 'Stopped', 'ระงับการทำงาน');
            });
        } else if (name && botStatusMap[name]) {
            if (action === 'start') {
                botStatusMap[name].enabled = true;
                botStatusMap[name].lastError = '-';
                createBotInstance(name, 0);
            } else if (action === 'stop') {
                botStatusMap[name].enabled = false;
                stopBotInstance(name);
                updateStatus(name, 'Stopped', 'ระงับการทำงาน (User Disabled)');
            }
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
    <title>Minecraft Multi-Bot Control Panel</title>
    <style>
        body { font-family: monospace, sans-serif; background: #121212; color: #e0e0e0; margin: 15px; }
        h2 { color: #4caf50; margin-bottom: 10px; display: inline-block; }
        .btn-group { margin-bottom: 15px; float: right; }
        button { background: #333; color: #fff; border: 1px solid #555; padding: 6px 12px; cursor: pointer; border-radius: 4px; font-weight: bold; }
        button:hover { background: #444; }
        .btn-start { background: #2e7d32; border-color: #4caf50; }
        .btn-stop { background: #c62828; border-color: #ef5350; }
        .stats { margin-bottom: 15px; font-size: 14px; clear: both; }
        table { width: 100%; border-collapse: collapse; background: #1e1e1e; font-size: 13px; }
        th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
        th { background: #2a2a2a; color: #aaa; }
        .Online { color: #4caf50; font-weight: bold; }
        .Connecting, .Logging, .Selecting, .In { color: #ffeb3b; }
        .Offline, .Kicked, .Error { color: #f44336; }
        .Stopped { color: #757575; }
        .err-log { color: #ff9800; font-size: 11px; max-width: 250px; word-break: break-all; }
    </style>
</head>
<body>
    <div>
        <h2>🤖 Minecraft Multi-Bot Dashboard</h2>
        <div class="btn-group">
            <button class="btn-start" onclick="controlBot('', 'start-all')">▶ Start All</button>
            <button class="btn-stop" onclick="controlBot('', 'stop-all')">⏹ Stop All</button>
        </div>
    </div>
    <div class="stats" id="summary">กำลังโหลดข้อมูล...</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>ชื่อบอท</th>
                <th>สถานะ</th>
                <th>ขั้นตอนล่าสุด</th>
                <th>ข้อผิดพลาดจากเซิร์ฟ (Error Log)</th>
                <th>อัปเดตเมื่อ</th>
                <th>จัดการ</th>
            </tr>
        </thead>
        <tbody id="bot-table"></tbody>
    </table>

    <script>
        async function controlBot(name, action) {
            await fetch(\`/api/control?name=\${name}&action=\${action}\`);
            fetchStatus();
        }

        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const tbody = document.getElementById('bot-table');
                
                let onlineCount = 0;
                let total = 0;
                let html = '';

                Object.keys(data).forEach((name, index) => {
                    total++;
                    const bot = data[name];
                    const isOnline = bot.status.includes('Online');
                    if (isOnline) onlineCount++;

                    let statusClass = 'Offline';
                    if (isOnline) statusClass = 'Online';
                    else if (bot.status === 'Stopped') statusClass = 'Stopped';
                    else if (bot.status !== 'Offline') statusClass = 'Connecting';

                    const toggleBtn = bot.enabled ? 
                        \`<button class="btn-stop" onclick="controlBot('\${name}', 'stop')">Stop</button>\` : 
                        \`<button class="btn-start" onclick="controlBot('\${name}', 'start')">Start</button>\`;

                    html += \`<tr>
                        <td>\${index + 1}</td>
                        <td><b>\${name}</b></td>
                        <td class="\${statusClass}">\${bot.status}</td>
                        <td>\${bot.step}</td>
                        <td class="err-log">\${bot.lastError}</td>
                        <td>\${bot.lastUpdate}</td>
                        <td>\${toggleBtn}</td>
                    </tr>\`;
                });

                tbody.innerHTML = html;
                document.getElementById('summary').innerHTML = 
                    \`ออนไลน์ทั้งหมด: <b>\${onlineCount}/\${total}</b> ตัว | อัปเดตอัตโนมัติทุก 3 วินาที\`;
            } catch (e) {}
        }

        fetchStatus();
        setInterval(fetchStatus, 3000);
    </script>
</body>
</html>
    `);
});

server.listen(WEB_PORT, () => {
    http.get('http://api.ipify.org', (res) => {
        let publicIp = '';
        res.on('data', chunk => publicIp += chunk);
        res.on('end', () => printStartupLogs(publicIp.trim()));
    }).on('error', () => {
        printStartupLogs(getLocalIP());
    });
});

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
}

function printStartupLogs(ipAddress) {
    console.log('==================================================');
    console.log(`🚀 STARTING MINEFLAYER MULTI-BOT SERVER (STANDBY)`);
    console.log('==================================================');
    console.log(` [+] Target Server   : ${SERVER_HOST}:${SERVER_PORT}`);
    console.log(` [+] Total Bots      : ${BOT_NAMES.length} ตัว (สถานะ: พร้อมรัน)`);
    console.log(` [🌐] Web Dashboard  : http://${ipAddress}:${WEB_PORT}`);
    console.log('==================================================');
    console.log(`[System] ระบบเปิดทำงานแล้ว สามารถเข้าหน้าเว็บเพื่อกดเปิดบอทได้เลยครับ`);
}