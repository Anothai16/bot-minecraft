const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const DEFAULT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3000;

const sharedData = minecraftData(MC_VERSION);

const BOT_CONFIGS = [
    { name: 'obs1', pass: '112233' },
    { name: 'Morgan05', pass: '112233' },
    { name: 'Domertown', pass: '112233' },
    { name: 'Nattanon09', pass: '112233' },
    { name: 'Nanepez', pass: '112233' },
    { name: 'Sudlorkayeejai', pass: '112233' },
    { name: 'Wood_Skel', pass: '112233' },
    { name: 'sindirt', pass: '112233' },
    { name: 'Pompamz', pass: '112233' },
    { name: 'Netherboy', pass: '112233' },
    { name: 'quast', pass: '112233' },
    { name: 'Geyman', pass: '112233' },
    { name: 'Jolibee', pass: '112233' },
    { name: 'Posma2', pass: '112233' },
    { name: 'Rxzy3', pass: '112233' },
    { name: 'mecular', pass: '112233' },
    { name: 'Iron34', pass: '112233' },
    { name: 'd456', pass: '112233' },
    { name: 'llMasterll', pass: '112233' },
    { name: 'Ixcw2534', pass: '112233' },
    { name: 'ShadowEmpress', pass: '112233' },
    { name: 'gulnwza007', pass: '112233' },
    { name: 'Monosox', pass: '112233' },
    { name: 'twenty29', pass: '112233' },
    { name: '0zow29', pass: '112233' }
];

const BOT_NAMES = BOT_CONFIGS.map(b => b.name);
const activeBots = {};

const botStatusMap = {};
BOT_NAMES.forEach(name => {
    botStatusMap[name] = { 
        status: 'Stopped', 
        step: 'รอสั่งเปิดจากหน้าเว็บ...', 
        lastUpdate: new Date().toLocaleTimeString('th-TH'),
        lastError: '-',
        enabled: false 
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
        try { activeBots[username].quit(); } catch (e) {}
        delete activeBots[username];
    }
}

function createBotInstance(username, delayMs = 0) {
    if (!botStatusMap[username]?.enabled) {
        updateStatus(username, 'Stopped', 'ระงับการทำงาน (User Disabled)');
        return;
    }

    setTimeout(() => {
        if (!botStatusMap[username]?.enabled) return;

        stopBotInstance(username);

        console.log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);
        updateStatus(username, 'Connecting', 'กำลังเชื่อมต่อ...');

        const botConfig = BOT_CONFIGS.find(b => b.name === username);
        const botPassword = botConfig ? botConfig.pass : DEFAULT_PASSWORD;

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

        // 0: หน้าหลัก, 1: รอ Anvil, 2: รอกดยืนยัน (Slot 2), 3: รอใช้เข็มทิศ, 4: สำเร็จ
        bot.authStage = 0;

        bot.on('message', (jsonMsg) => {
            const strMsg = jsonMsg.toString().trim();
            if (strMsg && !strMsg.includes('AFK') && !strMsg.includes('เข้าร่วม')) {
                console.log(`[💬 Log] [${username}]: ${strMsg}`);
            }
        });

        bot.on('kicked', (reason) => {
            let kickReasonStr = reason;
            try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
            
            console.error(`[🚨 KICKED] [${username}] โดนเตะ! เหตุผล: ${kickReasonStr}`);
            updateStatus(username, 'Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
        });

        bot.on('windowOpen', async (window) => {
            
            // STAGE 0: เจอ GUI หน้าแรก -> กด Slot 1 (สมุดรหัสผ่าน) เพื่อเรียก Anvil
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                console.log(`[1/5] [${username}] พบ GUI ล็อกอินหลัก -> กด Slot 1 (สมุดรหัสผ่าน)...`);
                updateStatus(username, 'Logging in', 'กด Slot 1 เปิด Anvil');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);
                    } catch (e) {}
                }, 1500);
            }

            // STAGE 1: เจอ Anvil -> พิมพ์รหัสผ่าน
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                console.log(`[2/5] [${username}] Anvil เปิดแล้ว -> กำลังพิมพ์รหัสผ่าน ${botPassword}...`);
                updateStatus(username, 'Logging in', `พิมพ์รหัสผ่าน ${botPassword}`);

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: botPassword });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0); // หยิบผลลัพธ์ Anvil
                        }, 800);
                    } catch (e) {}
                }, 1200);
            }

            // STAGE 2: กลับมาหน้า GUI หลักหลังพิมพ์ Anvil -> กด Slot 2 (ปุ่มเข้าสู่ระบบ)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                console.log(`[3/5] [${username}] พิมพ์รหัสแล้ว -> กด Slot 2 (เข้าสู่ระบบ)...`);
                updateStatus(username, 'Logging in', 'กด Slot 2 ยืนยันเข้าสู่ระบบ');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        updateStatus(username, 'In Lobby', 'วาร์ปเข้าห้องโถง');

                        // รอ 6 วินาทีให้วาร์ปเข้าห้องโถง แล้วสแกนใช้เข็มทิศ
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

                    } catch (e) {}
                }, 1500);
            }

            // STAGE 3: เมนูเข็มทิศเปิดขึ้นมา -> กด Slot 10 (Survival)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4;
                console.log(`[4/5] [${username}] GUI เข็มทิศเปิดขึ้นมาแล้ว -> กดเลือก Survival (Slot 10)...`);
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
        for (const iface = interfaces[name]; ; ) {
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
    console.log(` [+] Total Bots      : ${BOT_NAMES.length} ตัว`);
    console.log(` [🌐] Web Dashboard  : http://${ipAddress}:${WEB_PORT}`);
    console.log('==================================================');
}t