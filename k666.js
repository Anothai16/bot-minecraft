const mineflayer = require('mineflayer');
const readline = require('readline');
const { createBotLogger } = require('./logger');

const logger = createBotLogger('K666');
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
        username: 'K666',
        version: '1.21.11',
        viewDistance: 2,
        checkTimeoutInterval: 120000
    });

    let spawnCount = 0;

    bot.on('spawn', async () => {
        spawnCount++;
        if (spawnCount === 1) {
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
        } else if (spawnCount >= 2) {
            isChangingServer = false;
            await sleep(4000);
            bot.chat('/home home');
            isReady = true;
            logger.setStatus(true);
            logger.log('ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย!');
        }
    });

    bot.on('windowOpen', async () => {
        await sleep(2000);
        try {
            isChangingServer = true;
            await bot.clickWindow(10, 0, 0);
            logger.log('จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย (กำลังย้ายมิติ...)');
        } catch(e) {}
    });

    bot.on('end', () => {
        isReady = false;
        logger.setStatus(false);
        if (isChangingServer) return;
        logger.log('หลุดการเชื่อมต่อ รอ 35 วินาทีเพื่อเข้าใหม่...');
        setTimeout(startBot, 35000);
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