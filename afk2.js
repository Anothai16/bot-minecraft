const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';

console.log(`[System] กำลังเตรียมระบบ Shared Resources (${MC_VERSION})...`);
const sharedData = minecraftData(MC_VERSION);

const BOT_NAMES = [
    'Geyman',
    'Jolibee',
    'Posma2',
    'Rxzy3',
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

        // 0: Start, 1: Anvil, 2: Confirm, 3: Lobby (รอคลิกเข็มทิศ), 4: Joined Survival
        bot.state = 0;

        bot.on('windowOpen', async (window) => {
            // --- STEP 0: เข้าเซิร์ฟครั้งแรก เจอ GUI หลัก ---
            if (window.type === 'minecraft:generic_9x3' && bot.state === 0) {
                bot.state = 1;
                setTimeout(() => {
                    bot.clickWindow(1, 0, 0).catch(() => {});
                }, 1200);

                // สำหรับบอทเก่าที่ล็อกอินไว้แล้ว ให้เว้น 4 วินาทีถ้าไม่มี Anvil ค่อยกดเข็มทิศ
                setTimeout(() => {
                    if (bot.state === 1) {
                        bot.state = 3;
                        triggerCompass(bot, username);
                    }
                }, 4000);
            }
            
            // --- STEP 1: เจอ Anvil พิมพ์รหัสผ่าน ---
            else if (window.type === 'minecraft:anvil' && bot.state === 1) {
                bot.state = 2; // ย้ายไป State 2 ทันที กันบอทเก่ามากดซ้ำ
                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: BOT_PASSWORD });
                        setTimeout(() => {
                            bot.clickWindow(2, 0, 0).catch(() => {});
                        }, 800);
                    } catch (e) {}
                }, 1200);
            }

            // --- STEP 2: กลับมาจาก Anvil กดยืนยันปุ่มล็อกอิน ---
            else if (window.type === 'minecraft:generic_9x3' && bot.state === 2) {
                bot.state = 3; // ล็อก State เป็น 3 ทันที
                setTimeout(() => {
                    bot.clickWindow(2, 0, 0).catch(() => {});
                    console.log(`[✓] [${username}] กรอกรหัสผ่านสำเร็จ! (กำลังรอวาร์ปเข้าห้องโถง...)`);
                    
                    // สั่งใช้เข็มทิศหลังจากกดยืนยันรหัสแล้วเท่านั้น
                    triggerCompass(bot, username);
                }, 1200);
            }

            // --- STEP 3: GUI เข็มทิศเปิดขึ้นมาจริงๆ (ต้องอยู่ใน State 3 เท่านั้น!) ---
            else if (window.type === 'minecraft:generic_9x3' && bot.state === 3) {
                bot.state = 4; // เปลี่ยนเป็น State 4 ทันที ป้องกันกดซ้ำ
                setTimeout(() => {
                    bot.clickWindow(10, 0, 0).catch(() => {});
                    console.log(`[>] [${username}] เลือกโหมด Survival (Slot 10) เรียบร้อย`);

                    // พิมพ์ /afk หลังวาร์ปเข้าโลกหลัก
                    setTimeout(() => {
                        bot.chat('/afk');
                        console.log(`[✓] [${username}] พิมพ์ /afk สำเร็จ! (ออนไลน์สมบูรณ์)`);
                    }, 10000);
                }, 1500);
            }
        });

        // ฟังก์ชันคลิกขวาเข็มทิศ
        function triggerCompass(botInstance, botName) {
            setTimeout(() => {
                // เช็คว่าถ้ายังอยู่ใน State 3 จริงๆ ถึงจะกดใช้เข็มทิศ
                if (botInstance.state === 3) {
                    try {
                        console.log(`[>] [${botName}] กำลังคลิกขวาใช้เข็มทิศ...`);
                        botInstance.activateItem();
                    } catch (e) {}
                }
            }, 6000); // เว้น 6 วินาทีให้วาร์ปห้องโถงนิ่งๆ ก่อน
        }

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
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (State Machine Control)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 25000);
});