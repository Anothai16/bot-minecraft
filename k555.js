const mineflayer = require('mineflayer');
const readline = require('readline');
const { createBotLogger } = require('./logger');

const logger = createBotLogger('K555');
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let bot = null;
let isReady = false;
let isChangingServer = false;

function startBot() {
    isReady = false;
    isChangingServer = false;
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
        await sleep(1500);
        bot.chat('/login 112233');
        logger.log('ยิงรหัสผ่านด่านตรวจสมุดรอบที่ 1');
        
        await sleep(3000);
        try { bot.closeWindow(0); } catch(e){}
        
        await sleep(2000);
        bot.chat('/login 112233');
        logger.log('ยิงรหัสผ่านรอบที่ 2');

        await sleep(5000);
        const comp = bot.inventory?.items().find(i => i.name === 'recovery_compass');
        if (comp) {
            try {
                await bot.equip(comp, 'hand');
                await sleep(1000);
                await bot.activateItem();
                logger.log('กดใช้งานเข็มทิศฟ้าเรียบร้อย');
            } catch(e){}
        } else {
            bot.chat('/server survival');
        }
    });

    bot.on('windowOpen', async () => {
        await sleep(2000);
        try {
            isChangingServer = true;
            await bot.clickWindow(10, 0, 0);
            logger.log('จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย');

            await sleep(7000);
            if (bot && !bot._client.ended) {
                bot.chat('/home home');
                isReady = true;
                isChangingServer = false;
                logger.setStatus(true);
                logger.log('ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย!');
            }
        } catch(e) {}
    });

    bot.on('end', () => {
        isReady = false;
        logger.setStatus(false);
        if (isChangingServer) return;
        logger.log('หลุดการเชื่อมต่อ รอ 55 วินาทีเพื่อเข้าใหม่...');
        setTimeout(startBot, 55000);
    });

    bot.on('error', (err) => logger.log(`Error: ${err.message}`));
}

startBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
    if (line.trim() === 'tpa' && isReady && bot) {
        bot.chat('/tpa DukDikauai');
    }
});