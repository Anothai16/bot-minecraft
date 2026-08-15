const mineflayer = require('mineflayer');
const readline = require('readline');
const { createBotLogger } = require('./logger');

const logger = createBotLogger('K555');
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let bot = null;
let isReady = false;
let isReconnecting = false;
let transferWatchdog = null;

function reconnect(delayMs = 55000) {
    if (isReconnecting) return;
    isReconnecting = true;
    isReady = false;
    logger.setStatus(false);
    if (transferWatchdog) clearTimeout(transferWatchdog);

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
    logger.setStatus(false);
    logger.log('กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');

    bot = mineflayer.createBot({
        host: 'play.amorycraft.com',
        username: 'K555',
        version: '1.21.11',
        viewDistance: 2,
        checkTimeoutInterval: 120000,
        physicsEnabled: false // 👈 ปิด Physics
    });

    bot.on('entitySpawn', (entity) => {
        if (entity.name === 'item' || entity.type === 'object') {
            delete bot.entities[entity.id];
        }
    });

    bot.once('spawn', async () => {
        await sleep(3000);
        if (!bot || bot._client.ended) return;

        bot.chat('/login 112233');
        logger.log('ยิงรหัสผ่านด่านตรวจสมุดรอบที่ 1');
        
        await sleep(3500);
        if (!bot || bot._client.ended) return;

        bot.chat('/login 112233');
        logger.log('ยิงรหัสผ่านรอบที่ 2');

        await sleep(4000);
        if (!bot || bot._client.ended) return;

        const comp = bot.inventory?.items().find(i => i.name === 'recovery_compass');
        if (comp) {
            try {
                await bot.equip(comp, 'hand');
                await sleep(1000);
                await bot.activateItem();
                logger.log('กดใช้งานเข็มทิศฟ้าเรียบร้อย');
            } catch (e) {}
        } else {
            bot.chat('/server survival');
        }
    });

    bot.on('windowOpen', async () => {
        await sleep(2500);
        if (!bot || bot._client.ended) return;

        try {
            await bot.clickWindow(10, 0, 0);
            logger.log('จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย');

            if (transferWatchdog) clearTimeout(transferWatchdog);
            transferWatchdog = setTimeout(() => {
                if (!isReady && bot && !bot._client.ended) {
                    logger.log('⚠️ ค้างจังหวะย้ายห้องเกิน 15 วินาที สั่งเชื่อมต่อใหม่...');
                    reconnect(10000);
                }
            }, 15000);

            await sleep(8000);
            if (bot && !bot._client.ended) {
                bot.chat('/home home');
                await sleep(2000);
                isReady = true;
                if (transferWatchdog) clearTimeout(transferWatchdog);
                logger.setStatus(true);
                logger.log('ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย!');
            }
        } catch (e) {}
    });

    bot.on('kicked', (reason) => logger.log(`🚨 โดนเตะออก: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`));
    bot.on('error', (err) => logger.log(`❌ Error: ${err.message}`));
    bot.on('end', () => reconnect(55000));
}

startBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
    if (line.trim() === 'tpa' && isReady && bot) {
        bot.chat('/tpa DukDikauai');
    }
});