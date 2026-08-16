const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const { Vec3 } = require('vec3');
const cron = require('node-cron');
const readline = require('readline');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const DEFAULT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3001;

const sharedData = minecraftData(MC_VERSION);

// รายชื่อและบทบาทของบอท
const BOT_CONFIGS = [
    { name: 'Lervy_Lever', pass: '112233', role: 'lever' },
    { name: 'K666', pass: '112233', role: 'afk' },
    { name: 'K555', pass: '112233', role: 'afk' }
];

const BOT_NAMES = BOT_CONFIGS.map(b => b.name);
const activeBots = {};
const botStatusMap = {};

BOT_NAMES.forEach(name => {
    botStatusMap[name] = { 
        status: 'Stopped', 
        step: 'รอเริ่มทำงาน...', 
        lastUpdate: new Date().toLocaleTimeString('th-TH'),
        lastError: '-',
        enabled: true 
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

// ====================================================================
// 🧭 ฟังก์ชันค้นหาและคลิกเข็มทิศ
// ====================================================================
async function useCompass(bot, username) {
    updateStatus(username, 'In Lobby', 'สแกนถือเข็มทิศ');
    console.log(`[3.5/4] [${username}] กำลังค้นหาและคลิกขวาเข็มทิศ...`);
    const compass = bot.inventory ? bot.inventory.items().find(i => i.name.includes('compass')) : null;
    if (compass) {
        try {
            await bot.equip(compass, 'hand');
            await sleep(500);
            bot.activateItem();
        } catch (e) {
            bot.activateItem();
        }
    } else {
        try { bot.activateItem(); } catch (e) {}
    }
}

// ====================================================================
// 🤖 ฟังก์ชันสร้างตัวตนบอท (Life Cycle Engine)
// ====================================================================
function createBotInstance(username, delayMs = 0) {
    const currentStatus = botStatusMap[username]?.status || 'Stopped';
    const isAlreadyRunning = activeBots[username] && (currentStatus.includes('Online') || currentStatus === 'Connecting' || currentStatus === 'Logging in' || currentStatus === 'In Lobby');

    if (isAlreadyRunning) {
        console.log(`[i] [${username}] กำลังทำงานอยู่แล้ว -> ข้ามการรันซ้ำ`);
        return;
    }

    if (!botStatusMap[username]?.enabled) {
        updateStatus(username, 'Stopped', 'ระงับการทำงาน');
        return;
    }

    setTimeout(() => {
        if (!botStatusMap[username]?.enabled) return;

        stopBotInstance(username);

        console.log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);
        updateStatus(username, 'Connecting', 'กำลังเชื่อมต่อ...');

        const botConfig = BOT_CONFIGS.find(b => b.name === username);
        const botPassword = botConfig ? botConfig.pass : DEFAULT_PASSWORD;
        const isLever = botConfig?.role === 'lever';

        const bot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: isLever ? true : false,
            checkTimeoutInterval: 120000,
            disabledPlugins: isLever ? ['sound', 'rain', 'particle'] : ['sound', 'rain', 'particle', 'raycast', 'physics', 'chest', 'tablist']
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
                console.log(`[1/4] [${username}] พบ GUI ล็อกอินหลัก -> กำลังกด Slot 1 (สมุดรหัสผ่าน)...`);
                updateStatus(username, 'Logging in', 'กด Slot 1 เปิด Anvil');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);

                        setTimeout(async () => {
                            if (bot.authStage === 1) {
                                console.log(`[i] [${username}] Anvil ไม่เด้งเปิด -> สั่งข้ามไปกด Slot 2 ยืนยัน...`);
                                bot.authStage = 3;
                                await bot.clickWindow(2, 0, 0).catch(() => {});
                                updateStatus(username, 'In Lobby', 'วาร์ปเข้าห้องโถง (รอ 10s)');
                                setTimeout(() => useCompass(bot, username), 10000);
                            }
                        }, 3500);
                    } catch (e) {}
                }, 2000);
            }

            // STAGE 1: พิมพ์รหัสใส่ Anvil
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                console.log(`[2/4] [${username}] Anvil เปิดสำเร็จ! -> พิมพ์รหัสผ่าน ${botPassword}...`);
                updateStatus(username, 'Logging in', `พิมพ์รหัสผ่าน ${botPassword}`);

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: botPassword });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0);
                        }, 800);
                    } catch (e) {}
                }, 1200);
            }

            // STAGE 2: กด Slot 2 ยืนยันเข้าสู่ระบบ
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                console.log(`[3/4] [${username}] พิมพ์รหัสแล้ว -> กด Slot 2 (เข้าสู่ระบบ)...`);
                updateStatus(username, 'Logging in', 'กด Slot 2 ยืนยันเข้าสู่ระบบ');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        updateStatus(username, 'In Lobby', 'วาร์ปเข้าห้องโถง (รอ 10s)');
                        setTimeout(() => useCompass(bot, username), 10000);
                    } catch (e) {}
                }, 1500);
            }

            // STAGE 3: กดบล็อกหญ้า Survival (Slot 10)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4;
                console.log(`[4/4] [${username}] GUI เข็มทิศเปิดแล้ว -> กดเลือก Survival (Slot 10)...`);
                updateStatus(username, 'Selecting Mode', 'เลือก Survival (Slot 10)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[>] [${username}] คลิกเลือก Survival แล้ว (กำลังรอวาร์ปสลับโลก 10 วินาที...)`);
                        updateStatus(username, 'Entering Survival', 'กำลังวาร์ปเข้า Survival (รอ 10s)');

                        setTimeout(() => {
                            if (isLever) {
                                bot.chat('/home home2');
                                console.log(`[✓] [${username}] วาร์ปไปจุดพักผ่อน /home home2 เรียบร้อย!`);
                                updateStatus(username, 'Online (Lever Ready)', 'สแตนด์บายที่ home2');
                            } else {
                                console.log(`[✓] [${username}] เข้าสู่เซิร์ฟเวอร์ Survival เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                                updateStatus(username, 'Online (AFK)', 'ออนไลน์ปกติ');

                                if (bot.afkInterval) clearInterval(bot.afkInterval);
                                bot.afkInterval = setInterval(() => {
                                    try {
                                        bot.look(bot.entity.yaw + 0.1, bot.entity.pitch, true);
                                    } catch (e) {}
                                }, 60000);
                            }
                        }, 10000);

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
            if (bot.afkInterval) clearInterval(bot.afkInterval);
            delete activeBots[username];
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

// ====================================================================
// 🕹️ LEVER INTERACTION ENGINE (Lervy_Lever)
// ====================================================================
let isLeverCycleRunning = false;

function isBotOnline(username) {
    const b = activeBots[username];
    return b && b._client && !b._client.ended && botStatusMap[username]?.status.includes('Online');
}

async function clickLeverSafe(actionName) {
    const leverBot = activeBots['Lervy_Lever'];
    if (!isBotOnline('Lervy_Lever')) {
        console.log(`❌ [LEVER LOG] ยกเลิก: Lervy_Lever ไม่ออนไลน์`);
        return false;
    }

    const leverPos = new Vec3(10428, 74, -5054);
    let currentPos = leverBot.entity?.position ? leverBot.entity.position.floored() : null;
    let distance = currentPos ? leverBot.entity.position.distanceTo(leverPos) : 9999;

    if (distance > 3) {
        console.log(`🚀 [LEVER LOG] วาร์ปกลับเข้าบ้าน (/home home) เพื่อสับคันโยก...`);
        leverBot.chat('/home home');
        await sleep(3500);
    }

    try {
        await leverBot.lookAt(leverPos.offset(0.5, 0.5, 0.5), true);
        await sleep(200);

        let block = leverBot.blockAt ? leverBot.blockAt(leverPos) : null;
        if (!block) {
            block = {
                position: leverPos,
                name: 'lever',
                shapes: [[[0, 0, 0, 1, 1, 1]]]
            };
        }

        leverBot.activateBlock(block).catch(() => {});
        if (leverBot.swingArm) leverBot.swingArm('right');
        console.log(`✨ [LEVER LOG] สับคันโยก ${actionName} สำเร็จ!`);

        return true;
    } catch (err) {
        console.log(`❌ [LEVER ERROR]: ${err.message}`);
        return false;
    }
}

async function triggerLeverCycle() {
    if (isLeverCycleRunning) return;
    isLeverCycleRunning = true;

    try {
        const hasLever = isBotOnline('Lervy_Lever');
        const hasK666 = isBotOnline('K666');
        const hasK555 = isBotOnline('K555');

        if (!hasLever || !hasK666 || !hasK555) {
            console.log(`⏳ [SKIP CYCLE]: บอทไม่ครบ ข้ามรอบนี้`);
            return;
        }

        console.log(`\n=================== 🔴 เริ่มต้นไซเคิลสับคันโยก ===================`);
        const okClose = await clickLeverSafe('ปิดคันโยก (OFF)');

        if (okClose) {
            console.log(`⏱️ [LEVER CYCLE]: สับปิดเรียบร้อย รอ 10 วินาที...`);
            await sleep(10000);

            console.log(`\n=================== 🟢 จบเวลาทำงาน: สับเปิดระบบ ===================`);
            await clickLeverSafe('เปิดคันโยก (ON)');

            activeBots['Lervy_Lever'].chat('/home home2');
            console.log(`🚀 [LEVER CYCLE]: วาร์ปหนีฟาร์ม (/home home2) สำเร็จ!`);
            console.log(`✅ [LEVER CYCLE]: ทำงานครบไซเคิลเรียบร้อย!\n`);
        }
    } finally {
        isLeverCycleRunning = false;
    }
}

// ====================================================================
// ⏰ SCHEDULE ENGINE
// ====================================================================
cron.schedule('0 3,9,15,21,27,33,39,45,51,57 * * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if ((hour === 5 && minute >= 35) || hour === 6) {
        console.log(`⏸️ [SCHEDULER]: อยู่ในช่วงพักระบบ (05:35 - 07:00 น.)`);
        return;
    }

    console.log(`\n⏰ [CRON TRIGGER]: ถึงรอบทำงาน [${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น.]`);
    await triggerLeverCycle();
});

cron.schedule('0 2,8,14,20,26,32,38,44,50,56 * * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if ((hour === 5 && minute >= 34) || hour === 6) return;

    if (isBotOnline('Lervy_Lever')) {
        console.log(`\n🚶 [PRE-WARP 1 MIN]: วาร์ปกลับบ้าน (/home home) มารอหน้าคันโยก [${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น.]`);
        activeBots['Lervy_Lever'].chat('/home home');
    }
});

// ====================================================================
// 🌐 WEB SERVER & CONTROL PANEL (Port 3001)
// ====================================================================
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

        if (action === 'start-all') {
            let launchIndex = 0;
            BOT_NAMES.forEach((bName) => {
                const currStatus = botStatusMap[bName]?.status || 'Stopped';
                const isRunning = activeBots[bName] && (currStatus.includes('Online') || currStatus === 'Connecting' || currStatus === 'Logging in' || currStatus === 'In Lobby');

                if (!isRunning) {
                    botStatusMap[bName].enabled = true;
                    createBotInstance(bName, launchIndex * 10000);
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
    <title>Minecraft Multi-Bot & Lever Dashboard</title>
    <style>
        body { font-family: monospace, sans-serif; background: #121212; color: #e0e0e0; margin: 15px; }
        h2 { color: #4caf50; margin-bottom: 10px; display: inline-block; }
        .btn-group { margin-bottom: 15px; float: right; display: flex; gap: 5px; flex-wrap: wrap; }
        button { background: #333; color: #fff; border: 1px solid #555; padding: 6px 10px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 12px; }
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
        <h2>🤖 Multi-Bot &amp; Lever Controller</h2>
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
    console.log(`🚀 STARTING MULTI-BOT & LEVER CONTROLLER`);
    console.log('==================================================');
    console.log(` [+] Target Server   : ${SERVER_HOST}:${SERVER_PORT}`);
    console.log(` [+] Total Bots      : ${BOT_NAMES.length} ตัว (Lever + AFK)`);
    console.log(` [🌐] Web Dashboard  : http://${ipAddress}:${WEB_PORT}`);
    console.log('==================================================');
}

server.listen(WEB_PORT, () => {
    printStartupLogs(getLocalIP());
});

// ====================================================================
// 🚀 เริ่มต้นทำงานทันที (Auto-Start)
// ====================================================================
let startIdx = 0;
BOT_NAMES.forEach((bName) => {
    createBotInstance(bName, startIdx * 10000);
    startIdx++;
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'push') {
        await triggerLeverCycle();
    }
    if (input === 'tpa') {
        BOT_NAMES.forEach(name => {
            if (isBotOnline(name)) activeBots[name].chat('/tpa DukDikauai');
        });
    }
});