const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createBotLogger, LOG_DIR } = require('./logger');

const logger = createBotLogger('Lervy_Lever');
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let bot = null;
let isReady = false;
let isReconnecting = false;
let hasNavigated = false;

// ================= Web Dashboard (Port 3001) =================
const app = express();
app.get('/api/status', (req, res) => {
    const result = { bots: {}, combinedLogs: [] };
    const files = ['Lervy_Lever.json', 'K666.json', 'K555.json'];
    
    files.forEach(file => {
        const p = path.join(LOG_DIR, file);
        if (fs.existsSync(p)) {
            try {
                const data = JSON.parse(fs.readFileSync(p, 'utf8'));
                result.bots[data.name] = data.online;
                result.combinedLogs.push(...data.logs);
            } catch (e) {}
        }
    });

    result.combinedLogs.sort().reverse();
    res.json(result);
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8"><title>Minecraft Multi-Bot Status</title>
        <style>
            body { font-family: sans-serif; background: #0f172a; color: #e2e8f0; padding: 20px; margin: 0; }
            .header { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
            .card { background: #1e293b; padding: 12px 20px; border-radius: 8px; border: 1px solid #334155; }
            .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
            .online { background: #22c55e; box-shadow: 0 0 8px #22c55e; }
            .offline { background: #ef4444; }
            .log-box { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 13px; height: 70vh; overflow-y: auto; white-space: pre-wrap; }
        </style>
    </head>
    <body>
        <h2>🤖 Multi-Process Bots Status & Logs</h2>
        <div class="header">
            <div class="card"><span id="dot-Lervy_Lever" class="dot offline"></span> Lervy_Lever: <b id="txt-Lervy_Lever">ออฟไลน์</b></div>
            <div class="card"><span id="dot-K666" class="dot offline"></span> K666: <b id="txt-K666">ออฟไลน์</b></div>
            <div class="card"><span id="dot-K555" class="dot offline"></span> K555: <b id="txt-K555">ออฟไลน์</b></div>
        </div>
        <div class="log-box" id="logs">กำลังดึง Logs...</div>
        <script>
            async function update() {
                try {
                    const res = await fetch('/api/status');
                    const data = await res.json();
                    ['Lervy_Lever', 'K666', 'K555'].forEach(name => {
                        const on = data.bots[name] || false;
                        document.getElementById('dot-' + name).className = 'dot ' + (on ? 'online' : 'offline');
                        document.getElementById('txt-' + name).textContent = on ? 'ออนไลน์ (ในบ้าน)' : 'ออฟไลน์';
                    });
                    document.getElementById('logs').textContent = data.combinedLogs.join('\\n');
                } catch(e) {}
            }
            setInterval(update, 2000);
            update();
        </script>
    </body>
    </html>`);
});
app.listen(3001, () => logger.log('🌍 Web Dashboard รันอยู่ที่พอร์ต http://localhost:3001'));

function reconnect(delayMs = 15000) {
    if (isReconnecting) return;
    isReconnecting = true;
    isReady = false;
    hasNavigated = false;
    logger.setStatus(false);

    if (bot) {
        try {
            bot.removeAllListeners();
            if (bot._client) {
                bot._client.removeAllListeners();
                bot._client.end();
            }
            bot.quit();
        } catch (e) {}
        bot = null;
    }

    logger.log(`หลุดการเชื่อมต่อ รอ ${Math.round(delayMs / 1000)} วินาทีเพื่อเชื่อมต่อใหม่...`);
    setTimeout(() => {
        isReconnecting = false;
        startBot();
    }, delayMs);
}

function startBot() {
    isReady = false;
    hasNavigated = false;
    logger.setStatus(false);
    logger.log('กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');

    bot = mineflayer.createBot({
        host: 'play.amorycraft.com',
        username: 'Lervy_Lever',
        version: '1.21.11',
        viewDistance: 2,
        checkTimeoutInterval: 120000
    });

    bot.once('spawn', async () => {
        await sleep(3500);
        if (!bot || bot._client.ended) return;

        bot.chat('/login 112233');
        logger.log('ยิงรหัสผ่านด่านตรวจสมุดรอบที่ 1');
        
        await sleep(3500);
        if (!bot || bot._client.ended) return;

        bot.chat('/login 112233');
        logger.log('ยิงรหัสผ่านรอบที่ 2');

        await sleep(4000);
        if (!bot || bot._client.ended) return;

        const comp = bot.inventory?.items().find(i => i.name.includes('compass'));
        if (comp) {
            try {
                await bot.equip(comp, 'hand');
                await sleep(1500);
                await bot.activateItem();
                logger.log('กดใช้งานเข็มทิศเปิดเมนูเรียบร้อย');
            } catch (e) {}
        }
    });

    bot.on('windowOpen', async (window) => {
        if (hasNavigated) return;
        hasNavigated = true;

        await sleep(2500);
        if (!bot || bot._client.ended) return;

        try {
            // หา slot ของ grass_block หรือกดที่ช่อง 10
            const grassItem = window.items().find(i => i.name.includes('grass'));
            const targetSlot = grassItem ? grassItem.slot : 10;

            await bot.simpleClick.leftMouse(targetSlot);
            logger.log(`จิ้มเมนูเลือกเซิร์ฟ Survival (Slot ${targetSlot}) เรียบร้อย`);

            // รอ 9 วินาทีให้โหลดข้ามมิติไปยัง Survival
            await sleep(9000);
            if (bot && !bot._client.ended) {
                bot.chat('/home home');
                await sleep(2000);
                isReady = true;
                logger.setStatus(true);
                logger.log('ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย!');
            }
        } catch (err) {
            logger.log(`❌ จิ้มเมนูไม่สำเร็จ: ${err.message}`);
        }
    });

    bot.on('kicked', (reason) => logger.log(`🚨 โดนเตะออก: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`));
    bot.on('error', (err) => logger.log(`❌ Error: ${err.message}`));
    bot.on('end', () => reconnect(15000));
}

function areAfkBotsOnline() {
    try {
        const k666 = JSON.parse(fs.readFileSync(path.join(LOG_DIR, 'K666.json'), 'utf8'));
        const k555 = JSON.parse(fs.readFileSync(path.join(LOG_DIR, 'K555.json'), 'utf8'));
        return k666.online && k555.online;
    } catch (e) {
        return false;
    }
}

cron.schedule('0 3,9,15,21,27,33,39,45,51,57 * * * *', async () => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    if ((hour === 5 && minute >= 35) || hour === 6) return;

    if (!isReady || !bot) {
        logger.log('⏳ ยกเลิกสับคันโยก: Lever ยังไม่พร้อม');
        return;
    }

    if (!areAfkBotsOnline()) {
        logger.log('⏳ ยกเลิกสับคันโยก: บอท K666 หรือ K555 ยังไม่ออนไลน์');
        return;
    }

    const leverPos = new Vec3(10428, 74, -5054);
    logger.log('🔴 สั่งสับปิดคันโยก (OFF)...');
    try {
        await bot.lookAt(leverPos.offset(0.5, 0.5, 0.5), true);
        await sleep(100);
        let block = bot.blockAt ? bot.blockAt(leverPos) : null;
        if (!block) block = { position: leverPos, name: 'lever', shapes: [[[0, 0, 0, 1, 1, 1]]] };
        await bot.activateBlock(block);
    } catch (e) {}
    
    await sleep(30000);
    
    logger.log('🟢 สั่งสับเปิดคันโยก (ON)...');
    try {
        await bot.lookAt(leverPos.offset(0.5, 0.5, 0.5), true);
        await sleep(100);
        let block = bot.blockAt ? bot.blockAt(leverPos) : null;
        if (!block) block = { position: leverPos, name: 'lever', shapes: [[[0, 0, 0, 1, 1, 1]]] };
        await bot.activateBlock(block);
    } catch (e) {}
    logger.log('✅ ทำงานครบไซเคิลเรียบร้อย!');
});

startBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
    if (line.trim() === 'tpa' && isReady && bot) {
        bot.chat('/tpa DukDikauai');
    }
});