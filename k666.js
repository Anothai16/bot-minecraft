const mineflayer = require('mineflayer');
const readline = require('readline');
const { createBotLogger } = require('./logger');

const logger = createBotLogger('K666');
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let bot = null;
let isReady = false;

function startBot() {
    isReady = false;
    logger.setStatus(false);
    logger.log('กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');

    bot = mineflayer.createBot({
        host: 'play.amorycraft.com',
        username: 'K666',
        version: '1.21.11',
        viewDistance: 2
    });

    bot._client.on('packet', async (data, meta) => {
        if (meta.name === 'open_book') {
            await sleep(1000);
            bot.chat('/login 112233');
            logger.log('ยิงรหัสผ่านรอบที่ 1');
            await sleep(1500);
            try { bot.closeWindow(0); } catch(e){}
            await sleep(3000);
            bot.chat('/login 112233');
            logger.log('ยิงรหัสผ่านรอบที่ 2');
        }
    });

    bot.once('spawn', () => {
        setTimeout(async () => {
            const comp = bot.inventory?.items().find(i => i.name === 'recovery_compass');
            if (comp) {
                try {
                    await bot.equip(comp, 'hand');
                    await sleep(1000);
                    await bot.activateItem();
                    logger.log('กดใช้งานเข็มทิศฟ้าเรียบร้อย');
                } catch(e){}
            }
        }, 8000);
    });

    bot.on('windowOpen', async () => {
        await sleep(2000);
        try {
            await bot.clickWindow(10, 0, 0);
            logger.log('จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย');
            await sleep(8000);
            bot.chat('/home home');
            isReady = true;
            logger.log('ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อย!');
        } catch(e) {}
    });

    bot.on('end', () => {
        isReady = false;
        logger.setStatus(false);
        logger.log('หลุดการเชื่อมต่อ รอ 35 วินาทีเพื่อเข้าใหม่...');
        setTimeout(startBot, 35000); // 👈 K666 รีคอนเนกต์ที่ 35 วินาที (ไม่ชนตัวอื่น)
    });
}

startBot();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
    if (line.trim() === 'tpa' && isReady && bot) {
        bot.chat('/tpa DukDikauai');
    }
});