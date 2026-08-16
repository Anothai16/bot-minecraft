const express = require('express');
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

// ====================================================================
// 🌐 WEB DASHBOARD & LIVE LOGS
// ====================================================================
const logsBuffer = [];
const MAX_LOGS = 100;

const originalLog = console.log;
console.log = (...args) => {
    const timestamp = new Date().toLocaleTimeString('th-TH');
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    logsBuffer.push(`[${timestamp}] ${message}`);
    if (logsBuffer.length > MAX_LOGS) logsBuffer.shift();
    originalLog(...args);
};

const app = express();

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

function isBotOnline(username) {
    const b = activeBots[username];
    return b && b._client && !b._client.ended && botStatusMap[username]?.status.includes('Online');
}

app.get('/api/status', (req, res) => {
    res.json({
        lever: isBotOnline('Lervy_Lever'),
        k666: isBotOnline('K666'),
        k555: isBotOnline('K555'),
        logs: logsBuffer.slice().reverse().join('\n')
    });
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Minecraft Full Diagnostic Controller</title>
        <style>
            body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
            .header { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
            .card { background: #1e293b; padding: 12px 20px; border-radius: 8px; border: 1px solid #334155; display: flex; align-items: center; gap: 8px; font-size: 14px; }
            .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
            .online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
            .offline { background: #ef4444; }
            .log-box { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 12px; line-height: 1.6; height: 72vh; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
            .title { margin: 0 0 16px 0; font-size: 20px; color: #38bdf8; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="title">⚡ Full-Diagnostic Inspector &amp; Auto-Rejoin</div>
        <div class="header">
            <div class="card"><span id="dot-lever" class="dot offline"></span> Lervy_Lever: <b id="txt-lever">กำลังโหลด...</b></div>
            <div class="card"><span id="dot-k666" class="dot offline"></span> K666: <b id="txt-k666">กำลังโหลด...</b></div>
            <div class="card"><span id="dot-k555" class="dot offline"></span> K555: <b id="txt-k555">กำลังโหลด...</b></div>
        </div>
        <div class="log-box" id="logs">กำลังดึง Logs...</div>
        <script>
            async function update() {
                try {
                    const res = await fetch('/api/status');
                    const data = await res.json();
                    document.getElementById('dot-lever').className = 'dot ' + (data.lever ? 'online' : 'offline');
                    document.getElementById('txt-lever').textContent = data.lever ? 'ออนไลน์' : 'ออฟไลน์';
                    document.getElementById('dot-k666').className = 'dot ' + (data.k666 ? 'online' : 'offline');
                    document.getElementById('txt-k666').textContent = data.k666 ? 'ออนไลน์' : 'ออฟไลน์';
                    document.getElementById('dot-k555').className = 'dot ' + (data.k555 ? 'online' : 'offline');
                    document.getElementById('txt-k555').textContent = data.k555 ? 'ออนไลน์' : 'ออฟไลน์';
                    document.getElementById('logs').textContent = data.logs || 'ไม่มีข้อมูล Log';
                } catch(e) {}
            }
            setInterval(update, 2000);
            update();
        </script>
    </body>
    </html>`);
});

app.listen(WEB_PORT, () => console.log(`🌍 Dashboard พร้อมทำงานที่ http://localhost:${WEB_PORT}`));

// ====================================================================
// 📊 REAL-TIME CPU PROFILER
// ====================================================================
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

setInterval(() => {
    const elapsedMs = Date.now() - lastCpuTime;
    const cpuDiff = process.cpuUsage(lastCpuUsage);
    
    const totalUserSystemMicros = cpuDiff.user + cpuDiff.system;
    const cpuPercent = ((totalUserSystemMicros / (elapsedMs * 1000)) * 100).toFixed(1);

    lastCpuUsage = process.cpuUsage();
    lastCpuTime = Date.now();

    const mem = process.memoryUsage();
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);

    console.log(`📊 [PROFILER 5s] CPU รวม: ${cpuPercent}% | RAM: ${rssMB}MB (Heap: ${heapMB}MB)`);
}, 5000);

// ====================================================================
// 🤖 BOT ENGINE & AUTH LOGIC (WITH FULL DIAGNOSTICS)
// ====================================================================
function updateStatus(name, status, step, errorReason = null) {
    if (!botStatusMap[name]) return;
    botStatusMap[name].status = status;
    if (step) botStatusMap[name].step = step;
    if (errorReason) botStatusMap[name].lastError = errorReason;
    botStatusMap[name].lastUpdate = new Date().toLocaleTimeString('th-TH');
}

function stopBotInstance(username) {
    if (activeBots[username]) {
        if (activeBots[username].compassTimer) clearInterval(activeBots[username].compassTimer);
        try { activeBots[username].quit(); } catch (e) {}
        delete activeBots[username];
    }
}

async function triggerCompass(bot, username) {
    if (bot.inSurvival) return;
    console.log(`🧭 [COMPASS] [${username}] กำลังตรวจสอบช่องเข็มทิศในตัว...`);

    const compass = bot.inventory ? bot.inventory.items().find(i => i.name.includes('compass')) : null;
    if (compass) {
        console.log(`🧭 [COMPASS] [${username}] พบเข็มทิศที่ Slot ${compass.slot} (${compass.name}) -> กำลัง Equip และใช้งาน`);
        try {
            await bot.equip(compass, 'hand');
            await sleep(300);
            bot.activateItem();
        } catch (e) {
            bot.activateItem();
        }
    } else {
        console.log(`⚠️ [COMPASS] [${username}] ไม่พบไอเทมเข็มทิศใน Inventory -> ใช้ Fallback Hotbar 0 + Packet Use`);
        if (bot._client) {
            try {
                bot._client.write('held_item_slot', { slotId: 0 });
                await sleep(200);
                bot._client.write('use_item', { hand: 0, sequence: 0 });
            } catch (e) {}
        }
        if (bot.activateItem) bot.activateItem();
    }
}

function createBotInstance(username, delayMs = 0) {
    const currentStatus = botStatusMap[username]?.status || 'Stopped';
    const isAlreadyRunning = activeBots[username] && (currentStatus.includes('Online') || currentStatus === 'Connecting' || currentStatus === 'Logging in' || currentStatus === 'In Lobby');

    if (isAlreadyRunning) return;

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
            physicsEnabled: false,
            checkTimeoutInterval: 0,
            disabledPlugins: ['sound', 'rain', 'particle', 'raycast', 'experience', 'villager', 'tablist', 'blocks', 'physics', 'entities']
        });

        bot.inSurvival = false;
        bot.authStage = 0;

        bot.once('inject_allowed', () => {
            if (bot._client && bot._client.socket) {
                try {
                    bot._client.socket.setNoDelay(true);
                    bot._client.socket.setKeepAlive(true, 10000);
                } catch (e) {}
            }
        });

        // ดัก Keep-Alive & Ping
        if (bot._client) {
            bot._client.on('keep_alive', (packet) => {
                try { bot._client.write('keep_alive', { keepAliveId: packet.keepAliveId }); } catch (e) {}
            });
            bot._client.on('ping', (packet) => {
                try { bot._client.write('ping', { id: packet.id }); } catch (e) {}
            });
        }

        activeBots[username] = bot;

        // ดักจับข้อความในแชททั้งหมด
        bot.on('message', (jsonMsg) => {
            const rawText = jsonMsg.toString().trim();
            if (rawText.length > 0) {
                console.log(`💬 [CHAT] [${username}]: ${rawText}`);
            }
        });

        bot.on('kicked', (reason) => {
            let kickReasonStr = reason;
            try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
            console.error(`[🚨 KICKED] [${username}] โดนเตะ! เหตุผล: ${kickReasonStr}`);
            updateStatus(username, 'Kicked', `โดนเตะ: ${kickReasonStr}`, kickReasonStr);
        });

        bot.on('windowOpen', async (window) => {
            const titleStr = typeof window.title === 'string' ? window.title : JSON.stringify(window.title);
            const slotDetails = window.slots
                .filter(s => s !== null)
                .map(s => `[#${s.slot}: ${s.name} x${s.count}]`)
                .join(' | ');

            console.log(`\n🪟 [WINDOW OPEN] [${username}] ID: ${window.id} | Type: ${window.type} | Title: ${titleStr}`);
            console.log(`📦 [WINDOW SLOTS] [${username}] -> ${slotDetails || 'ไม่มีไอเทม'}`);

            // 1. หน้าแรก (สมุดรหัสผ่าน Slot 1)
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                console.log(`👉 [AUTH 1/4] [${username}] คลิก Slot 1 เพื่อเปิด Anvil...`);
                updateStatus(username, 'Logging in', 'กด Slot 1 เปิด Anvil');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);
                        setTimeout(async () => {
                            if (bot.authStage === 1) {
                                console.log(`⚠️ [AUTH] [${username}] Anvil ไม่เด้ง -> ข้ามไปกดยืนยัน Slot 2`);
                                bot.authStage = 3;
                                await bot.clickWindow(2, 0, 0).catch(() => {});
                                startCompassRetry(bot, username);
                            }
                        }, 3500);
                    } catch (e) {}
                }, 1500);
            }

            // 2. หน้า Anvil (พิมพ์รหัสผ่าน)
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                console.log(`✍️ [AUTH 2/4] [${username}] พิมพ์รหัสผ่านใน Anvil...`);
                updateStatus(username, 'Logging in', 'พิมพ์รหัสผ่าน');

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: botPassword });
                        setTimeout(async () => {
                            console.log(`👉 [AUTH 2.5/4] [${username}] กด Slot 2 ยืนยันการพิมพ์รหัสใน Anvil`);
                            await bot.clickWindow(2, 0, 0);
                        }, 800);
                    } catch (e) {}
                }, 1200);
            }

            // 3. หน้ากดยืนยันหลังพิมพ์รหัส
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                console.log(`👉 [AUTH 3/4] [${username}] กด Slot 2 เพื่อล็อกอินเข้า Lobby...`);
                updateStatus(username, 'Logging in', 'กด Slot 2 ยืนยัน');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        updateStatus(username, 'In Lobby', 'เข้าห้องโถง');
                        startCompassRetry(bot, username);
                    } catch (e) {}
                }, 1500);
            }

            // 4. หน้าเลือกโหมด (Server Selector / Survival)
            else if (window.type === 'minecraft:generic_9x3' && (bot.authStage >= 3 || titleStr.toLowerCase().includes('server') || titleStr.toLowerCase().includes('select'))) {
                bot.authStage = 4;
                if (bot.compassTimer) clearInterval(bot.compassTimer);

                console.log(`🎯 [AUTH 4/4] [${username}] พบหน้าต่างเลือกเซิร์ฟเวอร์! กำลังส่งคำสั่งคลิก Slot 10 (Survival)...`);
                updateStatus(username, 'Selecting Mode', 'คลิกเลือก Survival (Slot 10)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0).catch(() => {});
                        
                        // เสริม Packet ตรงระดับ Native
                        if (bot._client) {
                            bot._client.write('window_click', {
                                windowId: window.id,
                                stateId: window.stateId || 0,
                                slot: 10,
                                mouseButton: 0,
                                mode: 0,
                                changedSlots: [],
                                cursorItem: { present: false }
                            });
                        }

                        console.log(`🚀 [AUTH DONE] [${username}] คลิก Slot 10 เรียบร้อย! รอเซิร์ฟเวอร์ย้ายโลก (10 วินาที)...`);
                        updateStatus(username, 'Entering Survival', 'กำลังย้ายเข้า Survival');

                        setTimeout(() => {
                            const pos = bot.entity?.position;
                            console.log(`📍 [LOCATION CHECK] [${username}] พิกัดปัจจุบัน: [${pos ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}` : 'Unknown'}]`);

                            if (isLever) {
                                bot.chat('/home home2');
                                console.log(`🚀 [Lervy_Lever] วาร์ปไปพักผ่อนที่ (/home home2) เรียบร้อย!`);
                                updateStatus(username, 'Online (Standby home2)', 'สแตนด์บายที่ home2');
                            } else {
                                console.log(`[✓] [${username}] ประจำการที่ Survival สมบูรณ์!`);
                                updateStatus(username, 'Online (AFK)', 'ออนไลน์ปกติ');
                            }

                            bot.inSurvival = true;
                            bot.removeAllListeners('soundEffect');
                            bot.removeAllListeners('particle');
                            bot.removeAllListeners('entityMoved');
                        }, 10000);

                    } catch (err) {
                        console.error(`[-] [${username}] คลิกเลือก Survival ล้มเหลว: ${err.message}`);
                    }
                }, 1800);
            }
        });

        function startCompassRetry(bot, username) {
            if (bot.compassTimer) clearInterval(bot.compassTimer);
            let retries = 0;
            console.log(`⏳ [LOOP] [${username}] เริ่มต้นลูปตรวจจับเข็มทิศ (สแกนซ้ำทุก 3 วินาที)...`);

            bot.compassTimer = setInterval(async () => {
                if (bot.authStage >= 4 || bot.inSurvival) {
                    clearInterval(bot.compassTimer);
                    return;
                }
                retries++;
                console.log(`🔄 [RETRY ${retries}] [${username}] พยายามคลิกขวาเข็มทิศ...`);
                await triggerCompass(bot, username);

                if (retries >= 12) {
                    console.log(`⚠️ [TIMEOUT] [${username}] ไม่สามารถเปิด GUI เข็มทิศได้ภายใน 12 รอบ`);
                    clearInterval(bot.compassTimer);
                }
            }, 3000);
        }

        bot.on('spawn', () => {
            const pos = bot.entity?.position;
            console.log(`[✓] [${username}] Spawn เรียบร้อย! (พิกัด: ${pos ? `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}` : 'Unknown'})`);
            setTimeout(() => {
                if (bot.authStage === 3 && !bot.inSurvival) {
                    startCompassRetry(bot, username);
                }
            }, 3000);
        });

        bot.on('error', (err) => {
            console.error(`[❌ Error] [${username}]: ${err.message}`);
            updateStatus(username, 'Error', err.message, err.message);
        });

        bot.on('end', (reason) => {
            if (bot.compassTimer) clearInterval(bot.compassTimer);
            delete activeBots[username];
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason})`);
            
            if (botStatusMap[username]?.enabled) {
                updateStatus(username, 'Offline', `หลุด (${reason})`, botStatusMap[username]?.lastError || reason);
                console.log(`[i] [${username}] จะต่อใหม่ใน 15 วินาที...`);
                createBotInstance(username, 15000);
            } else {
                updateStatus(username, 'Stopped', 'ระงับการทำงาน');
            }
        });

    }, delayMs);
}

// ====================================================================
// 🕹️ DIRECT SOCKET LEVER ENGINE
// ====================================================================
let isLeverCycleRunning = false;

const LEVER_COORD = { x: 10456, y: 64, z: -5054 };
const PLAYER_STAND_POS = { x: 10457.5, y: 64.0, z: -5053.5 };

async function clickLeverSafe(actionName) {
    const leverBot = activeBots['Lervy_Lever'];
    if (!isBotOnline('Lervy_Lever')) {
        console.log(`❌ [LEVER LOG] ยกเลิก: Lervy_Lever ไม่ออนไลน์`);
        return false;
    }

    try {
        if (leverBot._client) {
            leverBot._client.write('position_look', {
                x: PLAYER_STAND_POS.x,
                y: PLAYER_STAND_POS.y,
                z: PLAYER_STAND_POS.z,
                yaw: 90,
                pitch: 0,
                onGround: true
            });
        }
        await sleep(100);

        if (leverBot._client) {
            leverBot._client.write('block_place', {
                hand: 0,
                location: { x: LEVER_COORD.x, y: LEVER_COORD.y, z: LEVER_COORD.z },
                direction: 1,
                cursorX: 0.5,
                cursorY: 0.5,
                cursorZ: 0.5,
                insideBlock: false,
                sequence: 0
            });
        }

        if (leverBot.swingArm) leverBot.swingArm('right');
        console.log(`✨ [LEVER LOG] สับคันโยก ${actionName} สำเร็จสมบูรณ์!`);
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
            console.log(`⏱️ [LEVER CYCLE]: สับปิดเรียบร้อย รอ 5 วินาที...`);
            await sleep(5000);

            console.log(`\n=================== 🟢 จบเวลาทำงาน: สับเปิดระบบ ===================`);
            await clickLeverSafe('เปิดคันโยก (ON)');

            activeBots['Lervy_Lever'].chat('/home home2');
            console.log(`🚀 [LEVER CYCLE]: สับเปิดสำเร็จ วาร์ปหลบไปที่ (/home home2) ทันที!`);
            console.log(`✅ [LEVER CYCLE]: จบการทำงานรอบนี้เรียบร้อย!\n`);
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

cron.schedule('45 2,8,14,20,26,32,38,44,50,56 * * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if ((hour === 5 && minute >= 34) || hour === 6) return;

    if (isBotOnline('Lervy_Lever')) {
        console.log(`\n🚶 [PRE-WARP 15s]: วาร์ปกลับมารอหน้าคันโยก (/home home) เพื่อเตรียมสับ`);
        activeBots['Lervy_Lever'].chat('/home home');
    }
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