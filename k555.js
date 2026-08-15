const mineflayer = require('mineflayer');
const readline = require('readline');
const { createBotLogger } = require('./logger');

const logger = createBotLogger('K555');
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let bot = null;
let isReady = false;
let isReconnecting = false;
let hasNavigated = false;

function reconnect(delayMs = 60000) {
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
        username: 'K555',
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
            const grassItem = window.items().find(i => i.name.includes('grass'));
            const targetSlot = grassItem ? grassItem.slot : 10;

            await bot.simpleClick.leftMouse(targetSlot);
            logger.log(`จิ้มเมนูเลือกเซิร์ฟ Survival (Slot ${targetSlot}) เรียบร้อย`);

            await sleep(9000);
            if (bot && !bot._client.ended) {
                bot.chat('/home home');
                await sleep(2000);
                isReady = true;
                logger.setStatus(true);
                logger.log('ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย! (เข้าสู่โหมด Low-CPU)');

                bot.physicsEnabled = false;
            }
        } catch (err) {
            logger.log(`❌ จิ้มเมนูไม่สำเร็จ: ${err.message}`);
        }
    });

    bot.on('kicked', (reason) => logger.log(`🚨 โดนเตะออก: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`));
    bot.on('error', (err) => logger.log(`❌ Error: ${err.message}`));
    bot.on('end', () => reconnect(60000));
}

startBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
    if (line.trim() === 'tpa' && isReady && bot) {
        bot.chat('/tpa DukDikauai');
    }
});