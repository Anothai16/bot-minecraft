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

// ฟังก์ชันรอรับ Window ถัดไปที่เด้งขึ้นมา
function waitForNextWindow(bot, timeoutMs = 12000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            bot.removeListener('windowOpen', handler);
            reject(new Error('รอหน้าต่างใหม่จากเซิร์ฟเวอร์ นานเกินไป (Timeout)'));
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
                await waitForNextWindow(bot);
                console.log(`[1/5] [${username}] เปิดหน้าต่างล็อกอินหลักสำเร็จ -> กดสมุด (Slot 1)`);
                await sleep(1800); // หน่วงเวลาให้เซิร์ฟเวอร์ส่งไอเทมสมุดครบ
                await bot.clickWindow(1, 0, 0);

                // 2. รอฟังว่าเซิร์ฟเวอร์จะเปิดหน้าต่างอะไรมาถัดไป
                const nextWindow = await waitForNextWindow(bot);

                // กรณีที่ 1: เซิร์ฟเวอร์เปิดหน้าต่าง Anvil (ต้องกรอกรหัส)
                if (nextWindow.type === 'minecraft:anvil') {
                    console.log(`[2/5] [${username}] ตรวจพบ Anvil -> กำลังพิมพ์รหัสผ่าน...`);
                    await sleep(1500);
                    bot._client.write('name_item', { name: BOT_PASSWORD });
                    await sleep(1000);
                    await bot.clickWindow(2, 0, 0); // กดปุ่มรับไอเทมใน Anvil

                    // 3. รอเปิด GUI ยืนยันรหัสผ่าน
                    await waitForNextWindow(bot);
                    console.log(`[3/5] [${username}] กลับมาหน้าต่างยืนยัน -> กดปุ่มยืนยัน (Slot 2)`);
                    await sleep(1500);
                    await bot.clickWindow(2, 0, 0);
                    console.log(`[✓] [${username}] กรอกรหัสผ่านเรียบร้อย! (รอ 6 วินาทีเข้าห้องโถง)`);

                    await sleep(6000);
                    console.log(`[4/5] [${username}] คลิกขวาใช้เข็มทิศ...`);
                    const compassWinPromise = waitForNextWindow(bot);
                    bot.activateItem();
                    await compassWinPromise;
                } else {
                    // กรณีที่ 2: เซิร์ฟเวอร์จำ IP ได้ ข้าม Anvil มาเปิดหน้าต่างห้องโถง/เข็มทิศเลย
                    console.log(`[i] [${username}] ข้าม Anvil (เซิร์ฟเวอร์จำ IP ได้แล้ว) -> กำลังดำเนินการต่อ...`);
                }

                // 5. คลิกเลือก Survival (Slot 10)
                console.log(`[5/5] [${username}] เปิดเมนูเข็มทิศสำเร็จ -> คลิกเลือก Survival (Slot 10)`);
                await sleep(1800);
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
console.log(`เริ่มต้นระบบ Mineflayer Multi-Bot (Auto-Detect Anvil)`);
console.log('==================================================');

BOT_NAMES.forEach((name, index) => {
    createBotInstance(name, index * 10000);
});