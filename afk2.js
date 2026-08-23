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
    { name: '0zow29', pass: '112233' },
    { name: '0zow30', pass: '112233' },
    { name: '0zow31', pass: '112233' },
    { name: 'guguy555', pass: '112233' },
    { name: 'ginggong', pass: '112233' },
    { name: 'JoinServer', pass: '112233' }
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
        if (activeBots[username].compassTimer) clearTimeout(activeBots[username].compassTimer);
        if (activeBots[username].afkInterval) clearInterval(activeBots[username].afkInterval);
        try { activeBots[username].quit(); } catch (e) {}
        delete activeBots[username];
    }
}

// ฟังก์ชันสแกนถือและเปิดใช้เข็มทิศ (หน่วงเวลาถือ 3 วินาทีก่อนคลิกขวา)
async function useCompass(bot, username) {
    if (!bot || !bot.inventory) return;
    updateStatus(username, 'In Lobby', 'สแกนถือเข็มทิศ');
    console.log(`[🧭] [${username}] กำลังค้นหาและเตรียมถือเข็มทิศ...`);
    
    const compass = bot.inventory.items().find(i => i.name.includes('compass'));
    if (compass) {
        try {
            await bot.equip(compass, 'hand');
            console.log(`[🧭] [${username}] ถือเข็มทิศแล้ว -> รอ 3s ให้เซิร์ฟเวอร์ Sync ก่อนคลิกขวา...`);
            await bot.sleep(3000); // รอ 3 วินาที
            bot.activateItem();
            console.log(`[🧭] [${username}] คลิกขวาใช้งานเข็มทิศเรียบร้อย!`);
        } catch (e) {
            bot.activateItem();
        }
    } else {
        try {
            await bot.sleep(3000);
            bot.activateItem();
        } catch (e) {}
    }
}

function createBotInstance(username, delayMs = 0) {
    const currentStatus = botStatusMap[username]?.status || 'Stopped';
    const isAlreadyRunning = activeBots[username] && (currentStatus.includes('Online') || currentStatus === 'Connecting' || currentStatus === 'Logging in' || currentStatus === 'In Lobby');

    if (isAlreadyRunning) {
        console.log(`[i] [${username}] กำลังทำงานอยู่แล้ว -> ข้ามการรันซ้ำ`);
        return;
    }

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
        bot.authStage = 0;

        bot.on('kicked', (reason) => {
            let kickReasonStr = reason;
            try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
            console.error(`[🚨 KICKED] [${username}] โดนเตะ! เหตุผล: ${kickReasonStr}`);
            updateStatus(username, 'Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
        });

        bot.on('windowOpen', async (window) => {
            
            // STAGE 0: กด Slot 1 เปิด Anvil
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                console.log(`[1/4] [${username}] พบ GUI ล็อกอินหลัก -> กำลังรอ 3.5s แล้วกด Slot 1 (สมุด)...`);
                updateStatus(username, 'Logging in', 'รอเปิด Anvil (Slot 1)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);
                    } catch (e) {}
                }, 3500);
            }

            // STAGE 1: พิมพ์รหัสใส่ Anvil
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                console.log(`[2/4] [${username}] Anvil เปิดสำเร็จ! -> รอพิมพ์รหัสผ่าน ${botPassword}...`);
                updateStatus(username, 'Logging in', `กำลังพิมพ์รหัสผ่าน`);

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: botPassword });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0);
                        }, 1500);
                    } catch (e) {}
                }, 2500);
            }

            // STAGE 2: กด Slot 2 ยืนยันเข้าสู่ระบบ -> รอ 13 วินาที เพื่อเริ่มหาเข็มทิศ
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                console.log(`[3/4] [${username}] พิมพ์รหัสแล้ว -> กำลังรอ 2.5s เพื่อกด Slot 2 (เข้าสู่ระบบ)...`);
                updateStatus(username, 'Logging in', 'กด Slot 2 ยืนยัน');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        console.log(`[🏠] [${username}] ยืนยันรหัสผ่านแล้ว -> รอ 13s ให้ตัวละครโหลดเข้า Lobby ก่อนหาเข็มทิศ...`);
                        updateStatus(username, 'In Lobby', 'วาร์ปเข้า Lobby (รอ 13s)');

                        bot.compassTimer = setTimeout(() => {
                            useCompass(bot, username);
                        }, 13000); // หน่วงเวลา 13 วินาที

                    } catch (e) {}
                }, 2500);
            }

            // STAGE 3: GUI เมนูเข็มทิศเปิดจริง -> กด Slot 10 (Survival)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4;
                console.log(`[4/4] [${username}] GUI เข็มทิศเปิดเรียบร้อย! -> รอ 3s แล้วเลือก Survival (Slot 10)...`);
                updateStatus(username, 'Selecting Mode', 'เลือก Survival (Slot 10)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[🚀] [${username}] คลิกเลือก Survival สำเร็จ! (กำลังรอวาร์ปเข้าโลก 12 วินาที...)`);
                        updateStatus(username, 'Entering Survival', 'กำลังวาร์ปเข้า Survival (รอ 12s)');

                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์คำสั่ง /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                            updateStatus(username, 'Online (AFK)', 'ออนไลน์ปกติ (/afk)');

                            if (bot.afkInterval) clearInterval(bot.afkInterval);
                            bot.afkInterval = setInterval(() => {
                                try {
                                    bot.look(bot.entity.yaw + 0.1, bot.entity.pitch, true);
                                } catch (e) {}
                            }, 60000);

                        }, 12000);

                    } catch (err) {
                        console.error(`[-] [${username}] กดเลือก Survival พลาด: ${err.message}`);
                    }
                }, 3000);
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
            if (bot.compassTimer) clearTimeout(bot.compassTimer);
            if (bot.afkInterval) clearInterval(bot.afkInterval);
            delete activeBots[username];
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason})`);
            
            if (botStatusMap[username]?.enabled) {
                updateStatus(username, 'Offline', `หลุด (${reason})`, botStatusMap[username]?.lastError || reason);
                console.log(`[i] [${username}] จะต่อใหม่ใน 30 วินาที...`);
                createBotInstance(username, 30000);
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
    const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
    const path = parsedUrl.pathname;

    if (path === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(botStatusMap));
        return;
    }

    if (path === '/api/control') {
        const action = parsedUrl.searchParams.get('action');
        const name = parsedUrl.searchParams.get('name');

        if (action === 'start-range') {
            const startVal = parseInt(parsedUrl.searchParams.get('start'));
            const endVal = parseInt(parsedUrl.searchParams.get('end'));
            
            const start = isNaN(startVal) ? 0 : startVal;
            const end = isNaN(endVal) ? BOT_NAMES.length : endVal;

            console.log(`[Batch Command] สั่งรันช่วงดรรชนี ${start} ถึง ${end}`);

            const targetBots = BOT_NAMES.slice(start, end);
            let launchIndex = 0;

            targetBots.forEach((bName) => {
                const currStatus = botStatusMap[bName]?.status || 'Stopped';
                const isRunning = activeBots[bName] && (currStatus.includes('Online') || currStatus === 'Connecting' || currStatus === 'Logging in' || currStatus === 'In Lobby');

                if (!isRunning) {
                    botStatusMap[bName].enabled = true;
                    createBotInstance(bName, launchIndex * 12000);
                    launchIndex++;
                } else {
                    console.log(`[i] [${bName}] ทำงานอยู่แล้วในกลุ่ม (${currStatus}) -> ไม่รันซ้ำ`);
                }
            });
        } 
        else if (action === 'start-all') {
            let launchIndex = 0;
            BOT_NAMES.forEach((bName) => {
                const currStatus = botStatusMap[bName]?.status || 'Stopped';
                const isRunning = activeBots[bName] && (currStatus.includes('Online') || currStatus === 'Connecting' || currStatus === 'Logging in' || currStatus === 'In Lobby');

                if (!isRunning) {
                    botStatusMap[bName].enabled = true;
                    createBotInstance(bName, launchIndex * 12000);
                    launchIndex++;
                }
            });
        } 
        else if (action === 'stop-all') {
            BOT_NAMES.forEach(bName => {
                botStatusMap[bName].enabled = false;
                stopBotInstance(bName);
                updateStatus(bName, 'Stopped', 'ระงับการทำงาน');
            });
        } 
        else if (name && botStatusMap[name]) {
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
        .btn-group { margin-bottom: 15px; float: right; display: flex; gap: 5px; flex-wrap: wrap; }
        button { background: #333; color: #fff; border: 1px solid #555; padding: 6px 10px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 12px; }
        button:hover { background: #444; }
        .btn-start { background: #2e7d32; border-color: #4caf50; }
        .btn-batch { background: #1565c0; border-color: #42a5f5; }
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
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=0&end=10')">▶ 1-10</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=10&end=20')">▶ 11-20</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=20&end=25')">▶ 21-25</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=25&end=30')">▶ 26-30</button>
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

function printStartupLogs(ipAddress) {
    console.log('==================================================');
    console.log(`🚀 STARTING MINEFLAYER MULTI-BOT SERVER (STANDBY)`);
    console.log('==================================================');
    console.log(` [+] Target Server   : ${SERVER_HOST}:${SERVER_PORT}`);
    console.log(` [+] Total Bots      : ${BOT_NAMES.length} ตัว`);
    console.log(` [🌐] Web Dashboard  : http://${ipAddress}:${WEB_PORT}`);
    console.log('==================================================');
}

server.listen(WEB_PORT, () => {
    http.get('http://api.ipify.org', (res) => {
        let publicIp = '';
        res.on('data', chunk => publicIp += chunk);
        res.on('end', () => printStartupLogs(publicIp.trim()));
    }).on('error', () => {
        printStartupLogs(getLocalIP());
    });
});