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

        // 0: หน้าแรก, 1: รอ Anvil, 2: รอยืนยันรหัส, 3: รอใช้เข็มทิศ, 4: อยู่ใน Survival
        bot.authStage = 0;

        bot.on('windowOpen', async (window) => {
            
            // STAGE 0: หน้าต่างแรกสุด (generic_9x3) -> คลิก Slot 1 (สมุด)
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1; // ล็อคเข้า Stage 1 ทันที
                console.log(`[1/5] [${username}] พบ GUI ล็อกอินหลัก -> กำลังรอกด Slot 1 (สมุด)...`);

                // หน่วงเวลา 1.5 วินาทีเพื่อให้ GUI โหลดไอเทมครบชัวร์ๆ ก่อนกด
                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);
                        console.log(`[>] [${username}] กด Slot 1 เรียบร้อย`);
                    } catch (err) {
                        console.error(`[-] [${username}] กด Slot 1 พลาด: ${err.message}`);
                    }
                }, 1500);
            }

            // STAGE 1: หน้าต่าง Anvil เด้งขึ้นมา -> พิมพ์รหัสผ่าน
            else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2; // ล็อคเข้า Stage 2 ทันที
                console.log(`[2/5] [${username}] พบ Anvil -> กำลังพิมพ์รหัสผ่าน ${BOT_PASSWORD}...`);

                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: BOT_PASSWORD });
                        setTimeout(async () => {
                            await bot.clickWindow(2, 0, 0); // หยิบผลลัพธ์ใน Anvil
                            console.log(`[>] [${username}] ส่งรหัสผ่านเข้า Anvil เรียบร้อย`);
                        }, 1000);
                    } catch (e) {}
                }, 1500);
            }

            // STAGE 2: กลับมาจาก Anvil เจอ GUI ยืนยันรหัส -> กด Slot 2
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3; // ล็อคเข้า Stage 3 ทันที
                console.log(`[3/5] [${username}] พบ GUI ยืนยัน -> กำลังกดปุ่มยืนยัน (Slot 2)...`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        console.log(`[✓] [${username}] กรอกรหัสผ่านผ่านแล้ว! (รอ 6 วินาทีเพื่อเปิดเข็มทิศ...)`);

                        // รอ 6 วินาทีให้ตัวละครวาร์ปเข้าห้องโถงนิ่งๆ แล้วคลิกขวาเข็มทิศ
                        setTimeout(() => {
                            console.log(`[4/5] [${username}] กำลังคลิกขวาใช้เข็มทิศ...`);
                            try { bot.activateItem(); } catch (e) {}
                        }, 6000);

                    } catch (e) {}
                }, 1500);
            }

            // STAGE 3: เมนูเข็มทิศเปิดขึ้นมา (ต้องผ่าน Stage 3 เท่านั้น) -> กด Survival (Slot 10)
            else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4; // ล็อคเข้า Stage 4 (เสร็จสิ้น)
                console.log(`[5/5] [${username}] พบเมนูเข็มทิศ -> กำลังกดเลือก Survival (Slot 10)...`);

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[>] [${username}] เลือกโหมด Survival เรียบร้อย!`);

                        // รอวาร์ปเข้าเซิร์ฟหลัก 8 วินาที แล้วพิมพ์ /afk
                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์ /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);
                        }, 8000);

                    } catch (e) {}
                }, 1500);
            }
        });

        bot.on('spawn', () => {
            console.log(`[✓] [${username}] โหลดฉากสำเร็จ`);
        });

        bot.on('error', () => {});

        bot.on('end', (reason) => {
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason}) -> จะต่อใหม่ใน 20 วินาที...`);
            createBotInstance(username, 20000);
        });

    }, delayMs);
}

console.log('==================================================');
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (Strict Event Sequence)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 20000); // เว้นระยะต่อตัวละ 20 วินาที
});