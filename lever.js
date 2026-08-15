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
const MAX_LOGS = 80;

const originalLog = console.log;
console.log = (...args) => {
    const timestamp = new Date().toLocaleTimeString('th-TH');
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    logsBuffer.push(`[${timestamp}]${message}`);
    if (logsBuffer.length > MAX_LOGS) logsBuffer.shift();
    originalLog(...args);
};

const app = express();
const port = 3001;

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
        <title>Minecraft Bots Controller</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; }
            .header { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
            .card { background: #1e293b; padding: 12px 20px; border-radius: 8px; border: 1px solid #334155; display: flex; align-items: center; gap: 8px; }
            .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
            .online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
            .offline { background: #ef4444; }
            .log-box { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; line-height: 1.6; height: 72vh; overflow-y: auto; white-space: pre-wrap; word-break: break-all; }
            .title { margin: 0 0 16px 0; font-size: 20px; color: #38bdf8; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="title">🤖 Minecraft Bot Automation Dashboard</div>
        <div class="header">
            <div class="card"><span id="dot-lever" class="dot offline"></span> Lervy_Lever: <b id="txt-lever">กำลังโหลด...</b></div>
            <div class="card"><span id="dot-k666" class="dot offline"></span> K666: <b id="txt-k666">กำลังโหลด...</b></div>
            <div class="card"><span id="dot-k555" class="dot offline"></span> K555: <b id="txt-k555">กำลังโหลด...</b></div>
        </div>
        <div class="log-box" id="logs">กำลังเชื่อมต่อฐานข้อมูล...</div>
        <script>
            async function update() {
                try {
                    const res = await fetch('/api/status');
                    const data = await res.json();
                    document.getElementById('dot-lever').className = 'dot ' + (data.lever ? 'online' : 'offline');
                    document.getElementById('txt-lever').textContent = data.lever ? 'ออนไลน์ (ในบ้าน)' : 'ออฟไลน์';
                    document.getElementById('dot-k666').className = 'dot ' + (data.k666 ? 'online' : 'offline');
                    document.getElementById('txt-k666').textContent = data.k666 ? 'ออนไลน์ (AFK)' : 'ออฟไลน์';
                    document.getElementById('dot-k555').className = 'dot ' + (data.k555 ? 'online' : 'offline');
                    document.getElementById('txt-k555').textContent = data.k555 ? 'ออนไลน์ (AFK)' : 'ออฟไลน์';
                    document.getElementById('logs').textContent = data.logs || 'ไม่มีข้อมูล Log';
                } catch(e) {}
            }
            setInterval(update, 2000);
            update();
        </script>
    </body>
    </html>
    `);
});

app.listen(port, () => console.log(`🌍 Dashboard พร้อมทำงานที่ http://localhost:${port}`));

// ====================================================================
// 🤖 BOT QUEUE & LIFECYCLE MANAGEMENT
// ====================================================================
const bots = {
    Lervy_Lever: { instance: null, ready: false },
    K666: { instance: null, ready: false },
    K555: { instance: null, ready: false }
};

let isLoginBusy = false;
const loginQueue = [];
let isLeverCycleRunning = false;

function isBotOnline(username) {
    const b = bots[username];
    return b.instance && b.instance._client && !b.instance._client.ended && b.ready;
}

function queueBot(username, delay = 0) {
    if (!loginQueue.includes(username)) {
        loginQueue.push(username);
    }
    setTimeout(processQueue, delay);
}

async function processQueue() {
    if (isLoginBusy || loginQueue.length === 0) return;

    isLoginBusy = true;
    const username = loginQueue.shift();

    try {
        await launchBotPipeline(username);
    } catch (err) {
        console.log(`❌ [${username}] Pipeline Error:${err.message}`);
    } finally {
        isLoginBusy = false;
        if (loginQueue.length > 0) {
            setTimeout(processQueue, 6000); // เว้นระยะ 6 วินาทีก่อนเริ่มตัวถัดไป
        }
    }
}

function destroyBot(username) {
    const b = bots[username];
    if (!b.instance) return;
    try {
        b.instance.removeAllListeners();
        if (b.instance._client) {
            b.instance._client.removeAllListeners();
            b.instance._client.end();
        }
        b.instance.quit();
    } catch (e) {}
    b.instance = null;
    b.ready = false;
}

function launchBotPipeline(username) {
    return new Promise((resolve) => {
        destroyBot(username);
        console.log(`🔌 [${username}] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...`);

        const bot = mineflayer.createBot({
            host: 'play.amorycraft.com',
            username: username,
            version: '1.21.11',
            viewDistance: 2,
            checkTimeoutInterval: 120000
        });

        bots[username].instance = bot;
        bots[username].ready = false;

        let isCompleted = false;
        let isWindowHandled = false;

        const finalizeLogin = () => {
            if (isCompleted) return;
            isCompleted = true;
            bots[username].ready = true;
            console.log(`🏠 [${username}] ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย!`);

            // ⚡ โหมดประหยัด CPU ขั้นสูงสุด
            bot.physicsEnabled = false;
            bot.removeAllListeners('blockUpdate');
            bot.removeAllListeners('chunkColumnLoad');

            // สำหรับ AFK Bot ตัดการประมวลผล Entity/Item ลอยน้ำทั้งหมด
            if (username !== 'Lervy_Lever') {
                bot.on('entitySpawn', (entity) => {
                    delete bot.entities[entity.id];
                });
            }

            resolve(true);
        };

        // 1. จัดการรหัสผ่านและเข็มทิศ
        bot.once('spawn', async () => {
            await sleep(3500);
            if (!bot || bot._client.ended) return;
            bot.chat('/login 112233');
            console.log(`✍️ [${username}] ยิงรหัสผ่านรอบที่ 1`);

            await sleep(3500);
            if (!bot || bot._client.ended) return;
            bot.chat('/login 112233');
            console.log(`✍️ [${username}] ยิงรหัสผ่านรอบที่ 2`);

            await sleep(4500);
            if (!bot || bot._client.ended) return;
            const comp = bot.inventory?.items().find(i => i.name.includes('compass'));
            if (comp) {
                try {
                    await bot.equip(comp, 'hand');
                    await sleep(1500);
                    await bot.activateItem();
                    console.log(`🧭 [${username}] เปิดเมนูเข็มทิศเรียบร้อย`);
                } catch (e) {}
            }
        });

        // 2. จิ้มเลือก Survival และวาร์ปเข้าบ้าน
        bot.on('windowOpen', async (window) => {
            if (isWindowHandled) return;
            isWindowHandled = true;

            await sleep(3000);
            if (!bot || bot._client.ended) return;

            try {
                const grass = window.items().find(i => i.name.includes('grass'));
                const slot = grass ? grass.slot : 10;
                await bot.clickWindow(slot, 0, 0);
                console.log(`จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);

                // รอโหลดมิติ 9 วินาทีแล้ววาร์ปเข้าบ้าน
                await sleep(9000);
                if (bot && !bot._client.ended) {
                    bot.chat('/home home');
                    await sleep(3000);
                    finalizeLogin();
                }
            } catch (err) {}
        });

        bot.on('kicked', (reason) => {
            console.log(`🚨 [${username}] โดนเตะออก: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
        });

        bot.on('error', (err) => {
            console.log(`❌ [${username}] Error:${err.message}`);
        });

        bot.on('end', () => {
            bots[username].ready = false;
            if (!isCompleted) {
                isCompleted = true;
                resolve(false);
            }
            console.log(`🔄 [${username}] หลุดการเชื่อมต่อ เข้าคิวรอต่อใหม่ใน 25 วินาที...`);
            queueBot(username, 25000);
        });
    });
}

// ====================================================================
// 🕹️ LEVER LOGIC (สับคันโยก Native 1.21)
// ====================================================================
async function clickLeverSafe() {
    const leverBot = bots.Lervy_Lever.instance;
    if (!isBotOnline('Lervy_Lever')) return false;

    const leverPos = new Vec3(10428, 74, -5054);

    try {
        await leverBot.lookAt(leverPos.offset(0.5, 0.5, 0.5), true);
        await sleep(150);

        let block = leverBot.blockAt ? leverBot.blockAt(leverPos) : null;
        if (!block) {
            block = {
                position: leverPos,
                name: 'lever',
                shapes: [[[0, 0, 0, 1, 1, 1]]]
            };
        }

        await leverBot.activateBlock(block);
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
    if (isLeverCycleRunning) return;
    isLeverCycleRunning = true;

    try {
        const hasLever = isBotOnline('Lervy_Lever');
        const hasK666 = isBotOnline('K666');
        const hasK555 = isBotOnline('K555');

        if (!hasLever || !hasK666 || !hasK555) {
            console.log(`⏳ [SKIP CYCLE]: บอทไม่ครบ (Lever: ${hasLever ? '🟢' : '❌'}, K666: ${hasK666 ? '🟢' : '❌'}, K555: ${hasK555 ? '🟢' : '❌'}) ข้ามรอบนี้`);
            return;
        }

        console.log(`🔴 [LEVER CYCLE]: สั่งสับปิดคันโยก (OFF)...`);
        const ok = await clickLeverSafe();

        if (ok) {
            console.log(`⏱️ [LEVER CYCLE]: สับปิดเรียบร้อย รอ 30 วินาที...`);
            await sleep(30000);

            console.log(`🟢 [LEVER CYCLE]: สั่งสับเปิดคันโยก (ON)...`);
            await clickLeverSafe();
            console.log(`✅ [LEVER CYCLE]: ทำงานครบไซเคิลเรียบร้อย!`);
        }
    } finally {
        isLeverCycleRunning = false;
    }
}

// ตั้งเวลารอบสับคันโยกอัตโนมัติ
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

// ====================================================================
// 🚀 เริ่มต้นระบบ
// ====================================================================
console.log("🚀 [SYSTEM START]: กำลังเริ่มระบบบอทคิวเดี่ยว (Ultra Low-CPU)...");
queueBot('Lervy_Lever', 0);
queueBot('K666', 0);
queueBot('K555', 0);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'push') {
        await triggerLeverCycle();
    }
    if (input === 'tpa') {
        if (isBotOnline('Lervy_Lever')) bots.Lervy_Lever.instance.chat('/tpa DukDikauai');
        if (isBotOnline('K666')) bots.K666.instance.chat('/tpa DukDikauai');
        if (isBotOnline('K555')) bots.K555.instance.chat('/tpa DukDikauai');
    }
});