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

const { setupAmoryLogin } = require('./login');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let botLever = null;
let isReconnectingLever = false;

let botK666 = null;
let isReconnectingK666 = false;

let botK555 = null;
let isReconnectingK555 = false;

let isLeverCycleRunning = false;

// ====================================================================
// 🌐 WEB DASHBOARD & LOGS (Port 3001 - Smooth AJAX / No Page Refresh)
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
        lever: isBotActive(botLever),
        k666: isBotActive(botK666),
        k555: isBotActive(botK555),
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
                    document.getElementById('txt-lever').textContent = data.lever ? 'ออนไลน์' : 'ออฟไลน์';

                    document.getElementById('dot-k666').className = 'dot ' + (data.k666 ? 'online' : 'offline');
                    document.getElementById('txt-k666').textContent = data.k666 ? 'ออนไลน์' : 'ออฟไลน์';

                    document.getElementById('dot-k555').className = 'dot ' + (data.k555 ? 'online' : 'offline');
                    document.getElementById('txt-k555').textContent = data.k555 ? 'ออนไลน์' : 'ออฟไลน์';

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

// ⚡ ดร็อปเฉพาะเอฟเฟกต์/เสียง/แอนิเมชันที่ไม่จำเป็น
const DROP_PACKETS = [
    'world_particles', 'packet_world_particles',
    'named_sound_effect', 'sound_effect',
    'animation'
];

function destroyBot(botInstance) {
    if (!botInstance) return;
    try {
        botInstance.removeAllListeners();
        if (botInstance._client) {
            botInstance._client.removeAllListeners();
            botInstance._client.end();
        }
        botInstance.quit();
    } catch (e) {}
}

function isBotActive(bot) {
    return bot && bot._client && !bot._client.ended;
}

// ====================================================================
// 🕹️ LEVER ACTION (สับคันโยก 1.21 Native Method)
// ====================================================================
async function clickLeverSafe() {
    if (!isBotActive(botLever)) return false;

    const leverPos = new Vec3(10428, 74, -5054);

    try {
        let targetBlock = botLever.blockAt ? botLever.blockAt(leverPos) : null;

        if (!targetBlock) {
            targetBlock = {
                position: leverPos,
                name: 'lever',
                shapes: [[[0, 0, 0, 1, 1, 1]]]
            };
        }

        if (botLever.activateBlock) {
            await botLever.activateBlock(targetBlock);
        } else {
            botLever._client.write('use_item_on', {
                hand: 0,
                location: leverPos,
                direction: 1,
                cursorX: 0.5,
                cursorY: 0.5,
                cursorZ: 0.5,
                insideBlock: false,
                sequence: 0
            });
            botLever._client.write('arm_animation', { hand: 0 });
        }

        return true;
    } catch (err) {
        if (err.message && (err.message.includes('block') || err.message.includes('distance'))) return true;
        console.log(`❌ [LEVER ERROR]: เกิดข้อผิดพลาดตอนสับคันโยก: ${err.message}`);
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
        const hasLever = isBotActive(botLever);
        const hasK666 = isBotActive(botK666);
        const hasK555 = isBotActive(botK555);

        // 🛑 ป้องกันไม่ให้สับคันโยกเด็ดขาดถ้า K555 หรือ K666 ไม่อยู่
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
// 🕹️ 1. LEVER BOT
// ====================================================================
function startLeverBot() {
    if (isReconnectingLever) return;
    isReconnectingLever = true;

    destroyBot(botLever);
    botLever = null;

    console.log('🔌 [Lervy_Lever] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    const bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Lervy_Lever',
        version: '1.21.11',
        viewDistance: 2,
        checkTimeoutInterval: 120000,
        noResetWorld: false
    });

    botLever = bot;

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    setupAmoryLogin(bot);

    bot.on('spawn', () => {
        console.log('Glory! 🛰️ บอท [Lervy_Lever] สปอว์นเข้าฉากเรียบร้อย!');
        isReconnectingLever = false;
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨 [Lervy_Lever]: โดนเตะออก!! เหตุผล: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
    });

    bot.on('error', (err) => console.log(`\n❌ [Lervy_Lever Error]: ${err.message}`));

    bot.on('end', () => { 
        handleLeverReconnect();
    });
}

function handleLeverReconnect() {
    if (!isReconnectingLever) isReconnectingLever = true;
    console.log(`🔄 [Lervy_Lever] รอ 15 วินาทีเพื่อเชื่อมต่อใหม่...`);
    setTimeout(() => {
        isReconnectingLever = false;
        startLeverBot();
    }, 15000);
}

// ====================================================================
// 🤖 2. K666 BOT
// ====================================================================
function startK666Bot() {
    if (isReconnectingK666) return;
    isReconnectingK666 = true;

    destroyBot(botK666);
    botK666 = null;

    console.log('🔌 [K666] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    const bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K666',
        version: '1.21.11',
        viewDistance: 1,
        checkTimeoutInterval: 120000,
        noResetWorld: false
    });

    botK666 = bot;

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    setupAmoryLogin(bot);

    bot.on('spawn', () => {
        console.log('Glory! 🛰️ บอท [K666] สปอว์นเข้าฉากเรียบร้อย!');
        isReconnectingK666 = false;
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨 [K666]: โดนเตะออก!! เหตุผล: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
    });

    bot.on('error', (err) => console.log(`\n❌ [K666 Error]: ${err.message}`));

    bot.on('end', () => { 
        handleK666Reconnect();
    });
}

function handleK666Reconnect() {
    if (!isReconnectingK666) isReconnectingK666 = true;
    console.log(`🔄 [K666] รอ 15 วินาทีเพื่อเชื่อมต่อใหม่...`);
    setTimeout(() => {
        isReconnectingK666 = false;
        startK666Bot();
    }, 15000);
}

// ====================================================================
// 🤖 3. K555 BOT
// ====================================================================
function startK555Bot() {
    if (isReconnectingK555) return;
    isReconnectingK555 = true;

    destroyBot(botK555);
    botK555 = null;

    console.log('🔌 [K555] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    const bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K555',
        version: '1.21.11',
        viewDistance: 1,
        checkTimeoutInterval: 120000,
        noResetWorld: false
    });

    botK555 = bot;

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    setupAmoryLogin(bot);

    bot.on('spawn', () => {
        console.log('Glory! 🛰️ บอท [K555] สปอว์นเข้าฉากเรียบร้อย!');
        isReconnectingK555 = false;
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨 [K555]: โดนเตะออก!! เหตุผล: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
    });

    bot.on('error', (err) => console.log(`\n❌ [K555 Error]: ${err.message}`));

    bot.on('end', () => { 
        handleK555Reconnect();
    });
}

function handleK555Reconnect() {
    if (!isReconnectingK555) isReconnectingK555 = true;
    console.log(`🔄 [K555] รอ 15 วินาทีเพื่อเชื่อมต่อใหม่...`);
    setTimeout(() => {
        isReconnectingK555 = false;
        startK555Bot();
    }, 15000);
}

// ====================================================================
// 🚀 ปล่อยบอทเข้าทีละตัว (เว้นระยะ 20 วินาที)
// ====================================================================
async function launchAllBotsSequentially() {
    initScheduler();

    console.log("🚀 [SYSTEM START]: กำลังเริ่มกระบวนการปล่อยบอทเข้าทีละตัว...");

    startLeverBot();
    await sleep(20000);

    startK666Bot();
    await sleep(20000);

    startK555Bot();
    
    console.log("🌟 [SYSTEM READY]: ปล่อยบอทครบทั้ง 3 ตัวเรียบร้อย!");
}

launchAllBotsSequentially();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'push') {
        await triggerLeverCycle();
        return;
    }

    if (input === 'tpa') {
        if (isBotActive(botLever)) botLever.chat('/tpa DukDikauai');
        if (isBotActive(botK666)) botK666.chat('/tpa DukDikauai');
        if (isBotActive(botK555)) botK555.chat('/tpa DukDikauai');
        return;
    }
});