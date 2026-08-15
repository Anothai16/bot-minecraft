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

// 🌍 Express Server (Health check 24/7)
const app = express();
const port = process.env.PORT || 8083;
app.get('/', (req, res) => res.send('Bots (Lever, K666, K555) are running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

// ⚡ ดร็อปเฉพาะเอฟเฟกต์/เสียง/แอนิเมชันที่ไม่จำเป็น (เว้นแพ็กเก็ตระบบไว้)
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
// 🕹️ LEVER ACTION (สับคันโยก)
// ====================================================================
async function clickLeverSafe() {
    if (!isBotActive(botLever)) return false;

    const leverPos = new Vec3(10428, 74, -5054);

    try {
        botLever._client.write('use_item_on', {
            hand: 0,
            location: leverPos,
            direction: 1,
            cursorX: 0.5,
            cursorY: 0.5,
            cursorZ: 0.5,
            insideBlock: false,
            sequence: 1
        });
        botLever._client.write('arm_animation', { hand: 0 });
        return true;
    } catch (err) {
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

        if (!hasLever || !hasK666 || !hasK555) {
            console.log(`⏳ [SKIP CYCLE]: บอทไม่ครบ (Lever: ${hasLever ? '🟢' : '❌'}, K666: ${hasK666 ? '🟢' : '❌'}, K555: ${hasK555 ? '🟢' : '❌'}) ข้ามรอบนี้เพื่อให้ระบบ Reconnect`);
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
        viewDistance: 1,
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
