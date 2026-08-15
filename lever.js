const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const cron = require('node-cron');
const express = require('express');
const readline = require('readline');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// ====================================================================
// 🌐 WEB DASHBOARD & LIVE LOGS (Port 3001)
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
        <title>Minecraft Bot Resource Controller</title>
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
        <div class="title">⚡ Packet Shield & CPU Profiler Stream (0-2% CPU)</div>
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
                    document.getElementById('txt-lever').textContent = data.lever ? 'ออนไลน์ (ในบ้าน)' : 'ออฟไลน์';
                    document.getElementById('dot-k666').className = 'dot ' + (data.k666 ? 'online' : 'offline');
                    document.getElementById('txt-k666').textContent = data.k666 ? 'ออนไลน์ (Shield ON)' : 'ออฟไลน์';
                    document.getElementById('dot-k555').className = 'dot ' + (data.k555 ? 'online' : 'offline');
                    document.getElementById('txt-k555').textContent = data.k555 ? 'ออนไลน์ (Shield ON)' : 'ออฟไลน์';
                    document.getElementById('logs').textContent = data.logs || 'ไม่มีข้อมูล Log';
                } catch(e) {}
            }
            setInterval(update, 2000);
            update();
        </script>
    </body>
    </html>`);
});
app.listen(port, () => console.log(`🌍 Dashboard พร้อมทำงานที่ http://localhost:${port}`));

// ====================================================================
// 📊 REAL-TIME CPU & PROFILER ENGINE (ทุก 5 วินาที)
// ====================================================================
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();
let totalBlockedPackets = 0;

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

    console.log(`📊 [PROFILER 5s] CPU จริง: ${cpuPercent}% | RAM: ${rssMB}MB (Heap: ${heapMB}MB) | บล็อกแพ็กเก็ตขยะไปแล้ว: ${totalBlockedPackets.toLocaleString()} ชิ้น`);
}, 5000);

// ====================================================================
// 🛡️ PACKET SHIELD ENGINE (ตัดการ Decode ในระดับ Binary)
// ====================================================================
function enablePacketShield(bot, username) {
    const deserializer = bot._client?.deserializer;
    if (!deserializer || deserializer._shieldActive) return;
    deserializer._shieldActive = true;

    const ignoredNames = new Set([
        'rel_entity_move',
        'entity_velocity',
        'entity_metadata',
        'entity_teleport',
        'entity_look',
        'entity_move_look',
        'entity_head_rotation',
        'world_particles',
        'sound_effect',
        'named_sound_effect',
        'sound_effect_entity',
        'block_action',
        'multi_block_change',
        'damage_event',
        'animation',
        'entity_equipment'
    ]);

    const ignoredIds = new Set();
    const origParse = deserializer.parsePacketBuffer.bind(deserializer);

    deserializer.parsePacketBuffer = function (buffer) {
        let offset = 0;
        let packetId = 0;
        let shift = 0;
        while (offset < buffer.length) {
            const b = buffer[offset++];
            packetId |= (b & 0x7F) << shift;
            if ((b & 0x80) === 0) break;
            shift += 7;
        }

        // 🛑 ถ้าเป็น Packet ขยะ ให้ Bypass การถอดรหัสทิ้งทันที (CPU 0%)
        if (ignoredIds.has(packetId)) {
            totalBlockedPackets++;
            return {
                data: { name: 'ignored', params: {} },
                metadata: {
                    name: 'ignored',
                    state: deserializer.state || 'play',
                    size: buffer.length
                },
                buffer
            };
        }

        // ถอดรหัสปกติสำหรับแพ็กเก็ตสำคัญ
        const res = origParse(buffer);
        if (res && res.metadata && res.metadata.name) {
            if (ignoredNames.has(res.metadata.name)) {
                ignoredIds.add(packetId);
            }
        }
        return res;
    };

    console.log(`🛡️ [${username}] เปิดใช้งาน Packet Shield สำเร็จ! (บล็อก Deserializer ขยะ 100%)`);
}

// ====================================================================
// 🤖 BOT MANAGEMENT & QUEUE ENGINE
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
    return b && b.instance && b.instance._client && !b.instance._client.ended && b.ready;
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
        console.log(`❌ [${username}] Exception: ${err.message}`);
    } finally {
        isLoginBusy = false;
        if (loginQueue.length > 0) {
            setTimeout(processQueue, 6000);
        }
    }
}

function destroyBot(username) {
    const b = bots[username];
    if (!b || !b.instance) return;
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

        const isAfk = username !== 'Lervy_Lever';

        const bot = mineflayer.createBot({
            host: 'play.amorycraft.com',
            username: username,
            version: '1.21.11',
            viewDistance: 1,
            checkTimeoutInterval: 120000,
            disabledPlugins: isAfk ? ['sound', 'rain', 'particle', 'raycast', 'physics'] : ['sound', 'rain', 'particle']
        });

        bot.physicsEnabled = false;
        bots[username].instance = bot;
        bots[username].ready = false;

        let isCompleted = false;
        let isWindowHandled = false;

        const finalizeLogin = () => {
            if (isCompleted) return;
            isCompleted = true;
            bots[username].ready = true;
            console.log(`🏠 [${username}] ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย!`);

            // ⚡ เปิดเกราะ Packet Shield สกัด CPU 100%
            enablePacketShield(bot, username);

            bot.removeAllListeners('blockUpdate');
            bot.removeAllListeners('chunkColumnLoad');
            bot.removeAllListeners('entityMoved');
            bot.removeAllListeners('entitySpawn');

            bot.entities = {};
            if (isAfk && bot.world) {
                bot.world.columns = {};
                bot.world.getBlock = () => null;
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

        // 2. จิ้มเลือก Survival
        bot.on('windowOpen', async (window) => {
            if (isWindowHandled) return;
            isWindowHandled = true;

            let clicked = false;

            const tryClickMenu = async () => {
                if (clicked || !bot || bot._client.ended) return;

                const currentWin = bot.currentWindow || window;
                if (!currentWin || !currentWin.slots) return;

                const menuItems = currentWin.slots.slice(0, 27).filter(it => it !== null && it !== undefined);

                if (menuItems.length > 0) {
                    clicked = true;

                    const target = menuItems.find(it => it.name.includes('grass')) || 
                                   menuItems.find(it => it.slot === 10) || 
                                   menuItems[0];

                    console.log(`📦 [${username}] พบไอเทมในเมนู: ${target.name} (Slot ${target.slot})`);

                    await sleep(1000);
                    try {
                        await bot.clickWindow(target.slot, 0, 0);
                        console.log(`👆 [${username}] จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);

                        await sleep(9000);
                        if (bot && !bot._client.ended) {
                            bot.chat('/home home');
                            await sleep(3000);
                            finalizeLogin();
                        }
                    } catch (e) {
                        console.log(`❌ [${username}] ข้อผิดพลาดตอนคลิก: ${e.message}`);
                    }
                }
            };

            window.on('updateSlot', () => {
                tryClickMenu();
            });

            for (let i = 0; i < 20; i++) {
                if (clicked) break;
                await sleep(500);
                await tryClickMenu();
            }
        });

        bot.on('kicked', (reason) => {
            console.log(`🚨 [${username}] โดนเตะออก: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
        });

        bot.on('error', (err) => {
            console.log(`❌ [${username}] Error: ${err.message}`);
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
// 🕹️ LEVER LOGIC
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
console.log("🚀 [SYSTEM START]: เริ่มระบบ Packet Shield...");
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