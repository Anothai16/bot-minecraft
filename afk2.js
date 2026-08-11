const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';

console.log(`[System] กำลังเตรียมระบบ Shared Resources (${MC_VERSION})...`);
const sharedData = minecraftData(MC_VERSION);

const BOT_NAMES = [
    'obs1',
    'Morgan05',
    'Domertown',
    'Nattanon09',
    'Nanepez',
    'Sudlorkayeejai',
    'Wood_Skel',
    'sindirt',
    'Pompamz',
    // 'quast',
    // 'Geyman',
    // 'Jolibee',
    // 'Posma2',
    // 'Rxzy3',
    'mecular',
    'Iron34',
    'd456'
];

function createBotInstance(username, delayMs) {
    setTimeout(() => {
        console.log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);

        const bot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: false,
            checkTimeoutInterval: 60000
        });

        // สถานะนับลำดับขั้นตอนการทำงาน (Strict Sequence Control)
        // 0: รอหน้าแรก, 1: รอ Anvil, 2: รอยืนยันรหัส, 3: รอวาร์ปเข้าห้องโถง, 4: รอเมนูเข็มทิศเปิด, 5: เสร็จสิ้น
        bot.authStage = 0;

        bot.on('windowOpen', async (window) => {
            
            // STAGE 0: หน้าต่างแรกสุด เด้งขึ้นมา -> สั่งคลิกสมุด (Slot 1)
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                setTimeout(() => {
                    bot.clickWindow(1, 0, 0).catch(() => {});
                }, 1000);
            }

            // STAGE 1: หน้าต่าง Anvil เด้งขึ้นมา -> ส่งรหัสผ่าน
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: BOT_PASSWORD });
                        setTimeout(() => {
                            bot.clickWindow(2, 0, 0).catch(() => {});
                        }, 800);
                    } catch (e) {}
                }, 1200);
            }

            // STAGE 2: หน้าต่างยืนยันรหัสเด้งกลับมา -> กด Slot 2 ยืนยัน
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                setTimeout(() => {
                    bot.clickWindow(2, 0, 0).catch(() => {});
                    console.log(`[✓] [${username}] กรอกรหัสผ่านเรียบร้อย -> กำลังรอวาร์ปเข้าห้องโถง...`);

                    // เมื่อยืนยันรหัสผ่านแล้ว ให้รอนิ่งๆ 7 วินาทีให้วาร์ปห้องโถง แล้วค่อยใช้เข็มทิศ
                    setTimeout(() => {
                        bot.authStage = 4; // เปลี่ยน Stage เป็น 4 พร้อมรับหน้าต่างเข็มทิศ
                        console.log(`[>] [${username}] กำลังคลิกขวาเปิดเข็มทิศ...`);
                        try { bot.activateItem(); } catch (e) {}
                    }, 7000);

                }, 1200);
            }

            // STAGE 4: หน้าต่างเมนูเข็มทิศเด้งขึ้นมา (ต้องผ่านการเปิดเข็มทิศแล้วเท่านั้น!)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 4) {
                bot.authStage = 5; // ล็อกทันที ไม่ให้กดซ้ำ
                setTimeout(() => {
                    bot.clickWindow(10, 0, 0).catch(() => {});
                    console.log(`[>] [${username}] เลือกโหมด Survival (Slot 10) เรียบร้อย`);

                    // พิมพ์ /afk หลังวาร์ปเข้าโลกหลัก
                    setTimeout(() => {
                        bot.chat('/afk');
                        console.log(`[✓] [${username}] พิมพ์ /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                    }, 10000);
                }, 1200);
            }
        });

        bot.on('spawn', () => {
            console.log(`[✓] [${username}] โหลดฉากสำเร็จ`);
        });

        bot.on('error', () => {});

        bot.on('end', (reason) => {
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason}) -> จะต่อใหม่ใน 25 วินาที...`);
            createBotInstance(username, 25000);
        });

    }, delayMs);
}

console.log('==================================================');
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (Strict Sequence Control)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 25000);
});