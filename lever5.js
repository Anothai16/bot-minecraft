// 🔇 1. กรอง Warning ข้อความที่ไม่จำเป็น
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Ignoring block entities')) return;
    originalWarn(...args);
};

const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const cron = require('node-cron');
const express = require('express');
const readline = require('readline');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// ====================================================================
// 🌐 WEB DASHBOARD & LOGS (Port 3001)
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
const port = 3001;

app.get('/api/status', (req, res) => {
    res.json({
        lever: isBotReady(bots.Lervy_Lever),
        k666: isBotReady(bots.K666),
        k555: isBotReady(bots.K555),
        logs: logsBuffer.slice().reverse().join('\n')
    });
});

app.get('/', (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Minecraft Bots Status & Logs</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
            .header { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
            .card { background: #1e293b; padding: 14px 20px; border-radius: 8px; border: 1px solid #334155; font-size: 15px; display: flex; align-items: center; gap: 8px; }
            .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
            .online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
            .offline { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
            .log-box { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.6; height: 70vh; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
            .title { margin: 0 0 16px 0; font-size: 20px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between; }
            .badge { font-size: 12px; background: #0369a1; color: #fff; padding: 4px 8px; border-radius: 4px; font-weight: normal; }
        </style>
    </head>
    <body>
        <div class="title">
            <span>🤖 Bot Controller Dashboard</span>
            <span class="badge">Live Logs</span>
        </div>
        <div class="header">
            <div class="card"><span id="dot-lever" class="dot offline"></span> <b>Lervy_Lever:</b> <span id="txt-lever">กำลังโหลด...</span></div>
            <div class="card"><span id="dot-k666" class="dot offline"></span> <b>K666:</b> <span id="txt-k666">กำลังโหลด...</span></div>
            <div class="card"><span id="dot-k555" class="dot offline"></span> <b>K555:</b> <span id="txt-k555">กำลังโหลด...</span></div>
        </div>
        <div class="log-box" id="logs">กำลังดึง Logs...</div>

        <script>
            async function updateDashboard() {
                try {
                    const res = await fetch('/api/status');
                    const data = await res.json();

                    document.getElementById('dot-lever').className = 'dot ' + (data.lever ? 'online' : 'offline');
                    document.getElementById('txt-lever').textContent = data.lever ? 'ออนไลน์ (ในบ้าน)' : 'ออฟไลน์';

                    document.getElementById('dot-k666').className = 'dot ' + (data.k666 ? 'online' : 'offline');
                    document.getElementById('txt-k666').textContent = data.k666 ? 'ออนไลน์ (ในบ้าน)' : 'ออฟไลน์';

                    document.getElementById('dot-k555').className = 'dot ' + (data.k555 ? 'online' : 'offline');
                    document.getElementById('txt-k555').textContent = data.k555 ? 'ออนไลน์ (ในบ้าน)' : 'ออฟไลน์';

                    document.getElementById('logs').textContent = data.logs || 'ไม่มีข้อมูล Log';
                } catch (err) {}
            }

            updateDashboard();
            setInterval(updateDashboard, 2500);
        </script>
    </body>
    </html>
    `;
    res.send(html);
});

app.listen(port, () => console.log(`🌍 Web Logs Dashboard รันอยู่ที่พอร์ต http://localhost:${port}`));

// ====================================================================
// 🤖 BOT MANAGEMENT & QUEUE ENGINE
// ====================================================================
const DROP_PACKETS = [
    'world_particles', 'packet_world_particles',
    'named_sound_effect', 'sound_effect',
    'animation'
];

const bots = {
    Lervy_Lever: null,
    K666: null,
    K555: null
};

let isGlobalLoginBusy = false;
let loginQueue = [];
let isLeverCycleRunning = false;

function isBotReady(bot) {
    return bot && bot._client && !bot._client.ended && bot.isHomeReady;
}

function destroyBot(username) {
    const bot = bots[username];
    if (!bot) return;
    if (bot.afkHeartbeat) clearInterval(bot.afkHeartbeat);
    try {
        bot.removeAllListeners();
        if (bot._client) {
            bot._client.removeAllListeners();
            bot._client.end();
        }
        bot.quit();
    } catch (e) {}
    bots[username] = null;
}

function queueBotLogin(username, delayMs = 0) {
    if (!loginQueue.includes(username)) {
        loginQueue.push(username);
    }
    setTimeout(processLoginQueue, delayMs);
}

async function processLoginQueue() {
    if (isGlobalLoginBusy || loginQueue.length === 0) return;

    isGlobalLoginBusy = true;
    const username = loginQueue.shift();

    try {
        await createAndRunBot(username);
    } catch (err) {
        console.log(`❌ [QUEUE ERROR]: ล็อกอิน ${username} เกิดข้อผิดพลาด: ${err.message}`);
    } finally {
        isGlobalLoginBusy = false;
        if (loginQueue.length > 0) {
            setTimeout(processLoginQueue, 6000);
        }
    }
}

function createAndRunBot(username) {
    return new Promise((resolve) => {
        destroyBot(username);

        console.log(`🔌 [${username}] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...`);

        const bot = mineflayer.createBot({
            host: 'play.amorycraft.com',
            username: username,
            version: '1.21.11',
            viewDistance: 2,
            checkTimeoutInterval: 120000,
            noResetWorld: false
        });

        bot.isHomeReady = false;
        bots[username] = bot;

        if (bot._client) {
            bot._client.setMaxListeners(0);
            bot._client.on('packet', (data, metadata) => {
                if (!metadata || !metadata.name) return;
                if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
            });
        }

        let isBookHandled = false;
        let isCompassHandled = false;
        let isWindowClicked = false;
        let isDone = false;

        const completeLogin = () => {
            if (isDone) return;
            isDone = true;
            bot.isHomeReady = true;
            console.log(`🏠 [${username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!`);

            if (bot.afkHeartbeat) clearInterval(bot.afkHeartbeat);
            bot.afkHeartbeat = setInterval(() => {
                if (isBotReady(bot)) {
                    try {
                        bot._client.write('player_rotation', {
                            yaw: (bot.entity?.yaw || 0) + 0.001,
                            pitch: bot.entity?.pitch || 0,
                            onGround: true
                        });
                    } catch (e) {}
                }
            }, 10000);

            resolve(true);
        };

        // 🎯 1. ตรวจจับด่านสมุด
        bot._client.on('packet', async (data, metadata) => {
            if (!metadata || !metadata.name) return;

            if (metadata.name === 'open_book' || metadata.name.includes('book')) {
                if (isBookHandled) return;
                isBookHandled = true;

                console.log(`🚨 [${username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...`);
                await sleep(800);

                if (bot && !bot._client.ended) {
                    bot.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 1 [/login 112233]`);
                }

                await sleep(1500);
                try {
                    bot.closeWindow(0);
                    console.log(`✅ [${username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!`);
                } catch (e) {}

                await sleep(3000);
                if (bot && !bot._client.ended) {
                    bot.chat('/login 112233');
                    console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 2 ซ้ำเพื่อความชัวร์`);
                }
            }
        });

        // 🧭 2. กดเข็มทิศฟ้า
        bot.once('spawn', () => {
            setTimeout(async () => {
                if (isCompassHandled || !bot || bot._client.ended) return;
                isCompassHandled = true;

                const blueCompass = bot.inventory ? bot.inventory.items().find(i => i.name === 'recovery_compass') : null;
                if (blueCompass) {
                    try {
                        await bot.equip(blueCompass, 'hand');
                        await sleep(1200);
                        await bot.activateItem();
                        console.log(`🧭 [${username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย`);
                    } catch (e) {}
                } else {
                    bot.chat('/server survival');
                }
            }, 8000);
        });

        // 🚨 3. คลิกบล็อกหญ้า + ย้ายเข้าบ้านอย่างนุ่มนวล
        bot.on('windowOpen', async () => {
            if (isWindowClicked) return;
            isWindowClicked = true;

            await sleep(2000);
            if (!bot || bot._client.ended) return;

            try {
                await bot.clickWindow(10, 0, 0);
                console.log(`จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);

                // เว้น 10 วินาทีให้ Netty โอนย้าย Socket ข้ามไปยัง Survival ให้เสร็จสมบูรณ์
                await sleep(10000);
                if (bot && !bot._client.ended) {
                    bot.chat('/home home');
                    await sleep(3000);
                    completeLogin();
                }
            } catch (err) {}
        });

        bot.on('kicked', (reason) => {
            console.log(`\n🚨 [${username}]: โดนเตะออก!! เหตุผล: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
        });

        bot.on('error', (err) => {
            console.log(`\n❌ [${username} Error]: ${err.message}`);
        });

        bot.on('end', () => {
            if (bot.afkHeartbeat) clearInterval(bot.afkHeartbeat);
            bot.isHomeReady = false;
            if (!isDone) {
                isDone = true;
                resolve(false);
            }
            console.log(`🔄 [${username}] เข้าคิวรอเชื่อมต่อใหม่ในอีก 25 วินาที...`);
            queueBotLogin(username, 25000);
        });
    });
}

// ====================================================================
// 🕹️ LEVER ACTION (Native Method)
// ====================================================================
async function clickLeverSafe() {
    const botLever = bots.Lervy_Lever;
    if (!isBotReady(botLever)) return false;

    const leverPos = new Vec3(10428, 74, -5054);

    try {
        await botLever.lookAt(leverPos.offset(0.5, 0.5, 0.5), true);
        await sleep(100);

        let block = botLever.blockAt ? botLever.blockAt(leverPos) : null;
        if (!block) {
            block = {
                position: leverPos,
                name: 'lever',
                shapes: [[[0, 0, 0, 1, 1, 1]]]
            };
        }

        await botLever.activateBlock(block);
        return true;
    } catch (err) {
        if (err.message && (err.message.includes('block') || err.message.includes('interact'))) {
            return true;
        }
        console.log(`❌ [LEVER ERROR]: ${err.message}`);
        return false;
    }
}

async function triggerLeverCycle() {
    if (isLeverCycleRunning) {
        console.log(`⚠️ [LEVER CYCLE]: มีรอบเดิมกำลังทำงานอยู่ ข้ามรอบซ้ำซ้อน`);
        return;
    }

    isLeverCycleRunning = true;

    try {
        const hasLever = isBotReady(bots.Lervy_Lever);
        const hasK666 = isBotReady(bots.K666);
        const hasK555 = isBotReady(bots.K555);

        if (!hasLever || !hasK666 || !hasK555) {
            console.log(`⏳ [SKIP CYCLE]: บอทไม่ครบ (Lever: ${hasLever ? '🟢' : '❌'}, K666: ${hasK666 ? '🟢' : '❌'}, K555: ${hasK555 ? '🟢' : '❌'}) ยกเลิกการสับคันโยกรอบนี้!`);
            return;
        }

        console.log(`\n🔴 [LEVER CYCLE]: สั่งสับปิดคันโยก (OFF)...`);
        const successOff = await clickLeverSafe();

        if (successOff) {
            console.log(`⏱️ [LEVER CYCLE]: สับปิดเรียบร้อย รอ 30 วินาที...`);
            await sleep(30000);

            console.log(`🟢 [LEVER CYCLE]: สั่งสับเปิดคันโยกกลับคืน (ON)...`);
            await clickLeverSafe();
            console.log(`✅ [LEVER CYCLE]: ทำงานครบไซเคิลเรียบร้อย!`);
        }
    } finally {
        isLeverCycleRunning = false;
    }
}

function initScheduler() {
    const CRON_PATTERN = '0 3,9,15,21,27,33,39,45,51,57 * * * *';

    cron.schedule(CRON_PATTERN, async () => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        if ((hour === 5 && minute >= 35) || hour === 6) {
            console.log(`⏸️ [SCHEDULER SKIP]: เวลา ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น. อยู่ในช่วงพัก ข้ามรอบนี้`);
            return;
        }

        console.log(`\n⏰ [CRON TRIGGER]: ถึงรอบทำงาน [${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น.]`);
        await triggerLeverCycle();
    });

    console.log(`⏱️ [SCHEDULER READY]: ตั้งระบบอัตโนมัติทุกนาทีที่ 3,9,15,21,27,33,39,45,51,57 (เว้นช่วงพัก 05:35 - 07:00 น.)`);
}

// ====================================================================
// 🚀 เริ่มต้นระบบ ป้อนคิวปล่อยบอททีละตัว
// ====================================================================
initScheduler();
console.log("🚀 [SYSTEM START]: กำลังเริ่มกระบวนการปล่อยบอทตามลำดับคิว...");

queueBotLogin('Lervy_Lever', 0);
queueBotLogin('K666', 0);
queueBotLogin('K555', 0);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();

    if (input === 'push') {
        await triggerLeverCycle();
        return;
    }

    if (input === 'tpa') {
        if (isBotReady(bots.Lervy_Lever)) bots.Lervy_Lever.chat('/tpa DukDikauai');
        if (isBotReady(bots.K666)) bots.K666.chat('/tpa DukDikauai');
        if (isBotReady(bots.K555)) bots.K555.chat('/tpa DukDikauai');
        return;
    }
});