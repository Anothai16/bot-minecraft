const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { SocksClient } = require('socks');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const DEFAULT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3000;

const sharedData = minecraftData(MC_VERSION);

function log(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.log(`[${time}] ${msg}`);
}

function logError(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.error(`[${time}] ${msg}`);
}

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
    { name: 'JoinServer', pass: '112233' },
    { name: 'Nigga58', pass: '112233' },
    { name: 'Effe2', pass: '112233' },
    { name: 'Yihai', pass: '112233' },
    { name: 'Huyteelai', pass: '112233' },
    { name: 'Amasterpeach', pass: '112233' },
    { name: 'Water762', pass: '112233' },
    { name: 'JumPBaa', pass: '112233' },
    { name: 'd123', pass: '112233' },
    { name: 'Yukina', pass: '112233' },
    { name: 'shabu555', pass: '112233' }
];

const BOT_NAMES = BOT_CONFIGS.map(b => b.name);
const activeBots = {};

// แบ่ง 4 กลุ่ม (กลุ่มละ 10 ตัว) ใช้พอร์ต 1080 - 1083
function getProxyPortForBot(botName) {
    const index = BOT_NAMES.indexOf(botName);
    if (index >= 0 && index < 10) return 1080;
    if (index >= 10 && index < 20) return 1081;
    if (index >= 20 && index < 30) return 1082;
    if (index >= 30 && index < 40) return 1083;
    return 1080;
}

const botStatusMap = {};
BOT_NAMES.forEach(name => {
    botStatusMap[name] = { 
        status: 'Stopped', 
        step: 'รอสั่งเปิดจากหน้าเว็บ...', 
        lastUpdate: new Date().toLocaleTimeString('th-TH', { hour12: false }),
        lastError: '-',
        enabled: false 
    };
});

function updateStatus(name, status, step, errorReason = null) {
    if (!botStatusMap[name]) return;
    if (status) botStatusMap[name].status = status;
    if (step) botStatusMap[name].step = step;
    if (errorReason) botStatusMap[name].lastError = errorReason;
    botStatusMap[name].lastUpdate = new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function stopBotInstance(username) {
    if (activeBots[username]) {
        const b = activeBots[username];
        if (b.compassTimer) clearTimeout(b.compassTimer);
        if (b.anvilCheckTimer) clearTimeout(b.anvilCheckTimer);
        if (b.afkInterval) clearInterval(b.afkInterval);
        if (b.watchdogTimer) clearTimeout(b.watchdogTimer);
        if (b.connectionTimeout) clearTimeout(b.connectionTimeout);
        try { 
            b.removeAllListeners();
            b.quit(); 
        } catch (e) {}
        delete activeBots[username];
    }
}

// ตัวจัดการ Reconnect กลาง: แก้ปัญหา Proxy Error แล้วค้างไม่ยอมต่อใหม่
function triggerSafeReconnect(username, delayMs = 30000, reason = '') {
    if (!botStatusMap[username]?.enabled) return;

    stopBotInstance(username);
    updateStatus(username, 'Offline', `รอต่อใหม่ (${reason || 'หลุด'})`, reason);
    log(`[i] [${username}] เตรียมเชื่อมต่อใหม่ใน ${Math.round(delayMs / 1000)} วินาที... (${reason})`);

    setTimeout(() => {
        if (botStatusMap[username]?.enabled) {
            createBotInstance(username, 0);
        }
    }, delayMs);
}

function triggerLobbyCompass(bot, username) {
    if (bot.compassTimer) clearTimeout(bot.compassTimer);
    bot.authStage = 'IN_LOBBY';
    log(`[🏠] [${username}] อยู่ใน Lobby แล้ว -> รอ 8s ให้ฉากโหลดสมบูรณ์ก่อนหาเข็มทิศ...`);
    updateStatus(username, 'In Lobby', 'วาร์ปเข้า Lobby (รอ 8s)');

    bot.compassTimer = setTimeout(() => {
        useCompass(bot, username);
    }, 8000);
}

async function useCompass(bot, username) {
    if (!bot || !bot.inventory) return;
    updateStatus(username, 'In Lobby', 'สแกนถือเข็มทิศ');
    log(`[🧭] [${username}] กำลังค้นหาและเตรียมถือเข็มทิศ...`);

    // Watchdog: ป้องกันค้างที่สถานะ In Lobby สแกนถือเข็มทิศ
    if (bot.watchdogTimer) clearTimeout(bot.watchdogTimer);
    bot.watchdogTimer = setTimeout(() => {
        if (bot.authStage === 'IN_LOBBY' || bot.authStage === 'WAIT_COMPASS_MENU') {
            log(`[⚠️ Watchdog] [${username}] เมนูไม่เปิดตามเวลา -> บังคับกดเข็มทิศซ้ำ`);
            try { bot.activateItem(); } catch (e) {}
        }
    }, 12000);

    const compass = bot.inventory.items().find(i => i.name.includes('compass'));
    if (compass) {
        try {
            await bot.equip(compass, 'hand');
            log(`[🧭] [${username}] ถือเข็มทิศแล้ว -> รอ 2s ก่อนคลิกขวา...`);
            await bot.sleep(2000);
            
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
            log(`[🧭] [${username}] คลิกขวาใช้งานเข็มทิศเรียบร้อย! (รอ GUI เมนูเปิด)`);
        } catch (e) {
            bot.authStage = 'WAIT_COMPASS_MENU';
            try { bot.activateItem(); } catch (err) {}
        }
    } else {
        // Fallback: หากหาในกระเป๋าไม่เจอ ให้สลับ Hotbar ช่องแรกแล้วกดใช้ทันที
        try {
            bot.setQuickBarSlot(0);
            await bot.sleep(1500);
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
        } catch (e) {}
    }
}

function createBotInstance(username, delayMs = 0) {
    const currentStatus = botStatusMap[username]?.status || 'Stopped';
    const isAlreadyRunning = activeBots[username] && (currentStatus.includes('Online') || currentStatus === 'Connecting' || currentStatus === 'Logging in' || currentStatus === 'In Lobby');

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

        const proxyPort = getProxyPortForBot(username);
        log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์... (SOCKS5 :${proxyPort})`);
        updateStatus(username, 'Connecting', `กำลังเชื่อมต่อ (SOCKS5 :${proxyPort})...`);

        const botConfig = BOT_CONFIGS.find(b => b.name === username);
        const botPassword = botConfig ? botConfig.pass : DEFAULT_PASSWORD;

        const botOptions = {
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: false,
            checkTimeoutInterval: 90000
        };

        botOptions.connect = (client) => {
            SocksClient.createConnection({
                proxy: {
                    host: '127.0.0.1',
                    port: proxyPort,
                    type: 5
                },
                command: 'connect',
                destination: {
                    host: SERVER_HOST,
                    port: SERVER_PORT
                },
                timeout: 45000
            }, (err, info) => {
                if (err) {
                    logError(`[Proxy Error] [${username}] พอร์ต ${proxyPort} ต่อไม่ติด: ${err.message}`);
                    triggerSafeReconnect(username, 25000, `Proxy Timeout :${proxyPort}`);
                    return client.emit('error', err);
                }
                client.setSocket(info.socket);
                client.emit('connect');
            });
        };

        const bot = mineflayer.createBot(botOptions);
        activeBots[username] = bot;
        bot.authStage = 'START';

        // ป้องกันค้างหน้า Connecting เกิน 60 วินาที
        bot.connectionTimeout = setTimeout(() => {
            if (bot.authStage === 'START' && botStatusMap[username]?.status === 'Connecting') {
                log(`[⚠️ Timeout] [${username}] ค้างหน้า Connecting เกิน 60s -> บังคับต่อใหม่`);
                triggerSafeReconnect(username, 15000, 'Connecting Timeout');
            }
        }, 60000);

        bot.on('spawn', () => {
            if (bot.connectionTimeout) clearTimeout(bot.connectionTimeout);
            log(`[✓] [${username}] โหลดฉากสำเร็จ`);
        });

        bot.on('kicked', (reason) => {
            if (bot.connectionTimeout) clearTimeout(bot.connectionTimeout);
            let kickReasonStr = reason;
            try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
            logError(`[🚨 KICKED] [${username}] โดนเตะ! เหตุผล: ${kickReasonStr}`);
            triggerSafeReconnect(username, 35000, `โดนเตะ: ${kickReasonStr}`);
        });

        bot.on('windowOpen', async (window) => {
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'START') {
                bot.authStage = 'OPENING_ANVIL';
                log(`[1/4] [${username}] พบ GUI ล็อกอินหลัก -> รอ 3.5s แล้วกด Slot 1 (สมุด)...`);
                updateStatus(username, 'Logging in', 'รอเปิด Anvil (Slot 1)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);

                        bot.anvilCheckTimer = setTimeout(() => {
                            if (bot.authStage === 'OPENING_ANVIL') {
                                log(`[⚡] [${username}] ข้ามไปเข้า Lobby ทันที`);
                                triggerLobbyCompass(bot, username);
                            }
                        }, 4000);
                    } catch (e) {}
                }, 3500);
            }
            else if (window.type === 'minecraft:anvil' && (bot.authStage === 'OPENING_ANVIL' || bot.authStage === 'START')) {
                if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
                bot.authStage = 'PASS_TYPED';
                log(`[2/4] [${username}] Anvil เปิดสำเร็จ! -> รอพิมพ์รหัสผ่าน...`);
                updateStatus(username, 'Logging in', 'กำลังพิมพ์รหัสผ่าน');

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: botPassword });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0);
                        }, 1500);
                    } catch (e) {}
                }, 2500);
            }
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'PASS_TYPED') {
                log(`[3/4] [${username}] กำลังรอ 2.5s เพื่อกด Slot 2 (เข้าสู่ระบบ)...`);
                updateStatus(username, 'Logging in', 'กด Slot 2 ยืนยัน');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        triggerLobbyCompass(bot, username);
                    } catch (e) {}
                }, 2500);
            }
            else if (window.type === 'minecraft:generic_9x3' && (bot.authStage === 'WAIT_COMPASS_MENU' || bot.authStage === 'IN_LOBBY')) {
                if (bot.watchdogTimer) clearTimeout(bot.watchdogTimer);
                bot.authStage = 'SURVIVAL_DONE';
                log(`[4/4] [${username}] GUI เมนูเปิดเรียบร้อย! -> รอ 3s แล้วเลือก Survival (Slot 10)...`);
                updateStatus(username, 'Selecting Mode', 'เลือก Survival (Slot 10)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        log(`[🚀] [${username}] คลิกเลือก Survival สำเร็จ! (รอวาร์ปเข้าโลก 14 วินาที...)`);
                        updateStatus(username, 'Entering Survival', 'กำลังวาร์ปเข้า Survival (รอ 14s)');

                        setTimeout(() => {
                            bot.chat('/afk');
                            log(`[✓] [✓] [${username}] พิมพ์คำสั่ง /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                            updateStatus(username, 'Online (AFK)', 'ออนไลน์ปกติ (/afk)');

                            if (bot.afkInterval) clearInterval(bot.afkInterval);
                            bot.afkInterval = setInterval(() => {
                                try {
                                    bot.look(bot.entity.yaw + 0.1, bot.entity.pitch, true);
                                } catch (e) {}
                            }, 60000);

                        }, 14000);
                    } catch (err) {
                        logError(`[-] [${username}] กดเลือก Survival พลาด: ${err.message}`);
                    }
                }, 3000);
            }
        });

        bot.on('error', (err) => {
            if (bot.connectionTimeout) clearTimeout(bot.connectionTimeout);
            if (err.message && (err.message.includes('Proxy') || err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT'))) {
                logError(`[❌ Connection Error] [${username}]: ${err.message}`);
                triggerSafeReconnect(username, 25000, err.message);
                return;
            }
            logError(`[❌ Error] [${username}]: ${err.message}`);
        });

        bot.on('end', (reason) => {
            if (bot.connectionTimeout) clearTimeout(bot.connectionTimeout);
            log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason})`);
            triggerSafeReconnect(username, 30000, reason);
        });

    }, delayMs);
}

// Web Server + REST API
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
            const startVal = parseInt(parsedUrl.searchParams.get('start'), 10);
            const endVal = parseInt(parsedUrl.searchParams.get('end'), 10);
            
            const start = isNaN(startVal) ? 0 : startVal;
            const end = isNaN(endVal) ? BOT_NAMES.length : endVal;

            log(`[Batch Command] สั่งรันช่วงดรรชนี ${start} ถึง ${end}`);

            const targetBots = BOT_NAMES.slice(start, end);
            let launchIndex = 0;

            targetBots.forEach((bName) => {
                const currStatus = botStatusMap[bName]?.status || 'Stopped';
                const isRunning = activeBots[bName] && (currStatus.includes('Online') || currStatus === 'Connecting' || currStatus === 'Logging in' || currStatus === 'In Lobby');

                if (!isRunning) {
                    botStatusMap[bName].enabled = true;
                    createBotInstance(bName, launchIndex * 15000);
                    launchIndex++;
                } else {
                    log(`[i] [${bName}] ทำงานอยู่แล้วในกลุ่ม (${currStatus}) -> ไม่รันซ้ำ`);
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
                    createBotInstance(bName, launchIndex * 15000);
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
    <title>Minecraft Multi-Bot Dashboard (40 Bots - Tor)</title>
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
        .badge-proxy { font-size: 10px; padding: 2px 5px; border-radius: 3px; background: #004d40; color: #80cbc4; margin-left: 5px; border: 1px solid #00796b; }
        .err-log { color: #ff9800; font-size: 11px; max-width: 250px; word-break: break-all; }
    </style>
</head>
<body>
    <div>
        <h2>🤖 Minecraft Multi-Bot Dashboard (40 Bots - Auto-Recovery)</h2>
        <div class="btn-group">
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=0&end=10')">▶ 01-10 (:1080)</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=10&end=20')">▶ 11-20 (:1081)</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=20&end=30')">▶ 21-30 (:1082)</button>
            <button class="btn-batch" onclick="controlBot('', 'start-range&start=30&end=40')">▶ 31-40 (:1083)</button>
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
                <th>เน็ตเวิร์ก</th>
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

        function getPortByIndex(index) {
            return 1080 + Math.floor(index / 10);
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

                    const pPort = getPortByIndex(index);

                    html += \`<tr>
                        <td>\${index + 1}</td>
                        <td><b>\${name}</b></td>
                        <td><span class="badge-proxy">SOCKS:\${pPort}</span></td>
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
    log('==================================================');
    log(`🚀 STARTING MINEFLAYER MULTI-BOT SERVER (40 BOTS)`);
    log('==================================================');
    log(` [+] Target Server   : ${SERVER_HOST}:${SERVER_PORT}`);
    log(` [+] Total Bots      : ${BOT_NAMES.length} ตัว (4 Tor Ports)`);
    log(` [🌐] Web Dashboard  : http://${ipAddress}:${WEB_PORT}`);
    log('==================================================');
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