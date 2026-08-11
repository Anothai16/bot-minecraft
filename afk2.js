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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ฟังก์ชันรอรับ Window ถัดไปโดยไม่สนประเภท (แค่อย่างน้อยมี Window เปิดขึ้นมา)
function waitForAnyWindow(bot, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            bot.removeListener('windowOpen', handler);
            reject(new Error('ไม่มีหน้าต่างใดๆ เปิดขึ้นมาเลย (Timeout)'));
        }, timeoutMs);

        const handler = (window) => {
            clearTimeout(timer);
            bot.removeListener('windowOpen', handler);
            resolve(window);
        };

        bot.on('windowOpen', handler);
    });
}

function createBotInstance(username, delayMs) {
    setTimeout(async () => {
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

        async function runAuthenticationProcess() {
            try {
                // 1. รอเปิด GUI หน้าแรกสุด -> สั่งคลิกสมุด (Slot 1)
                const win1 = await waitForAnyWindow(bot);
                console.log(`[1/5] [${username}] เปิด GUI หน้าแรกสำเร็จ (${win1.type}) -> สั่งคลิกสมุด (Slot 1)`);
                await sleep(1500);
                
                // ลองคลิกซ้าย Slot 1
                await bot.clickWindow(1, 0, 0);

                // 2. รอรับ Window ถัดไปที่เซิร์ฟเวอร์ส่งกลับมา
                const win2 = await waitForAnyWindow(bot);
                console.log(`[2/5] [${username}] เซิร์ฟเวอร์ส่งหน้าต่างประเภท: ${win2.type} กลับมา`);

                // ถ้าเป็น Anvil ให้ยิง Packet พิมพ์รหัส
                if (win2.type === 'minecraft:anvil') {
                    console.log(`[>] [${username}] กำลังยิงรหัสผ่านลงใน Anvil...`);
                    await sleep(1200);
                    bot._client.write('name_item', { name: BOT_PASSWORD });
                    await sleep(800);
                    await bot.clickWindow(2, 0, 0); // หยิบผลลัพธ์จาก Anvil

                    // รอ GUI ยืนยันรหัสเด้งกลับมา
                    const win3 = await waitForAnyWindow(bot);
                    console.log(`[3/5] [${username}] กลับมาหน้าต่างยืนยัน (${win3.type}) -> กด Slot 2 ยืนยัน`);
                    await sleep(1200);
                    await bot.clickWindow(2, 0, 0);
                } else {
                    // ถ้าไม่ใช่ Anvil (อาจเป็นปุ่มยืนยัน หรือเข็มทิศเลย) ให้ลองกด Slot 2 ยืนยันดู
                    console.log(`[i] [${username}] ไม่ใช่ Anvil -> ลองกด Slot 2 ยืนยันเลย`);
                    await sleep(1200);
                    await bot.clickWindow(2, 0, 0).catch(() => {});
                }

                // 3. รอ 6 วินาที เข้าห้องโถง แล้วกดใช้เข็มทิศ
                console.log(`[4/5] [${username}] รอ 6 วินาทีวาร์ปเข้าห้องโถง แล้วใช้เข็มทิศ...`);
                await sleep(6000);
                
                const compassPromise = waitForAnyWindow(bot);
                bot.activateItem();
                const compassWin = await compassPromise;
                console.log(`[5/5] [${username}] GUI เข็มทิศเปิดขึ้นมาแล้ว (${compassWin.type}) -> เลือก Survival (Slot 10)`);

                await sleep(1500);
                await bot.clickWindow(10, 0, 0);

                // จบกระบวนการ: รอวาร์ปเข้าโลก Survival 8 วินาที แล้วพิมพ์ /afk
                await sleep(8000);
                bot.chat('/afk');
                console.log(`[✓] [✓] [${username}] พิมพ์ /afk เรียบร้อย! (ออนไลน์สมบูรณ์)`);

            } catch (err) {
                console.error(`[-] [${username}] ขั้นตอนขัดข้อง: ${err.message}`);
            }
        }

        bot.once('spawn', () => {
            console.log(`[✓] [${username}] โหลดฉากสำเร็จ เริ่มต้นกระบวนการล็อกอิน...`);
            runAuthenticationProcess();
        });

        bot.on('error', () => {});

        bot.on('end', (reason) => {
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason}) -> จะต่อใหม่ใน 15 วินาที...`);
            createBotInstance(username, 15000);
        });

    }, delayMs);
}

console.log('==================================================');
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (Any Window Waiter)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 10000);
});