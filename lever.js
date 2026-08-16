const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const cron = require('node-cron');
const readline = require('readline');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_USERNAME = 'Lervy_Lever';
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';

const sharedData = minecraftData(MC_VERSION);
let bot = null;
let isLeverCycleRunning = false;

const LEVER_COORD = { x: 10456, y: 64, z: -5054 };
const PLAYER_STAND_POS = { x: 10457.5, y: 64.0, z: -5053.5 };

function isOnline() {
    return bot && bot._client && !bot._client.ended;
}

async function useCompass() {
    console.log(`[3.5/4] [${BOT_USERNAME}] กำลังค้นหาและคลิกขวาเข็มทิศ...`);
    const compass = bot.inventory ? bot.inventory.items().find(i => i.name.includes('compass')) : null;
    if (compass) {
        try {
            await bot.equip(compass, 'hand');
            await sleep(500);
            bot.activateItem();
        } catch (e) {
            bot.activateItem();
        }
    } else {
        try { bot.activateItem(); } catch (e) {}
    }
}

function startBot(delayMs = 0) {
    setTimeout(() => {
        if (bot) {
            try { bot.quit(); } catch (e) {}
            bot = null;
        }

        console.log(`[+] [${BOT_USERNAME}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);
        bot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: BOT_USERNAME,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: false,
            checkTimeoutInterval: 120000,
            disabledPlugins: ['sound', 'rain', 'particle', 'raycast', 'experience', 'villager', 'tablist', 'blocks', 'physics', 'entities', 'chest']
        });

        bot.authStage = 0;

        bot.on('kicked', (reason) => {
            console.error(`[🚨 KICKED] [${BOT_USERNAME}] โดนเตะ! เหตุผล: ${reason}`);
        });

        bot.on('windowOpen', async (window) => {
            if (window.type === 'minecraft:generic_9x3' && bot.authStage === 0) {
                bot.authStage = 1;
                setTimeout(async () => {
                    try {
                        await bot.clickWindow(1, 0, 0);
                        setTimeout(async () => {
                            if (bot.authStage === 1) {
                                bot.authStage = 3;
                                await bot.clickWindow(2, 0, 0).catch(() => {});
                                setTimeout(useCompass, 10000);
                            }
                        }, 3500);
                    } catch (e) {}
                }, 2000);
            } else if (window.type === 'minecraft:anvil' && bot.authStage === 1) {
                bot.authStage = 2;
                setTimeout(() => {
                    try {
                        bot._client.write('name_item', { name: BOT_PASSWORD });
                        setTimeout(async () => { await bot.clickWindow(2, 0, 0); }, 800);
                    } catch (e) {}
                }, 1200);
            } else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 2) {
                bot.authStage = 3;
                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        setTimeout(useCompass, 10000);
                    } catch (e) {}
                }, 1500);
            } else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 3) {
                bot.authStage = 4;
                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        setTimeout(() => {
                            bot.chat('/home home2');
                            console.log(`🚀 [${BOT_USERNAME}] ประจำการที่ (/home home2) พร้อมสลับตัวสับ!`);
                            bot.removeAllListeners('soundEffect');
                            bot.removeAllListeners('particle');
                            bot.removeAllListeners('entityMoved');
                        }, 10000);
                    } catch (e) {}
                }, 1800);
            }
        });

        bot.on('end', (reason) => {
            console.log(`[!] [${BOT_USERNAME}] หลุดการเชื่อมต่อ (${reason}) ต่อใหม่ใน 25s...`);
            bot = null;
            startBot(25000);
        });

        bot.on('error', (err) => console.error(`[❌ Error]: ${err.message}`));
    }, delayMs);
}

async function clickLever(actionName) {
    if (!isOnline()) return false;
    try {
        bot._client.write('position_look', {
            x: PLAYER_STAND_POS.x,
            y: PLAYER_STAND_POS.y,
            z: PLAYER_STAND_POS.z,
            yaw: 90,
            pitch: 0,
            onGround: true
        });
        await sleep(100);
        bot._client.write('block_place', {
            hand: 0,
            location: { x: LEVER_COORD.x, y: LEVER_COORD.y, z: LEVER_COORD.z },
            direction: 1,
            cursorX: 0.5, cursorY: 0.5, cursorZ: 0.5,
            insideBlock: false,
            sequence: 0
        });
        if (bot.swingArm) bot.swingArm('right');
        console.log(`✨ [LEVER] สับคันโยก ${actionName} สำเร็จ!`);
        return true;
    } catch (e) {
        console.error(`❌ [LEVER ERROR]: ${e.message}`);
        return false;
    }
}

async function runLeverCycle() {
    if (isLeverCycleRunning || !isOnline()) return;
    isLeverCycleRunning = true;
    try {
        console.log(`\n=================== 🔴 เริ่มต้นไซเคิลสับคันโยก ===================`);
        const okClose = await clickLever('ปิด (OFF)');
        if (okClose) {
            console.log(`⏱️ [CYCLE]: รอ 5 วินาที...`);
            await sleep(5000);
            console.log(`=================== 🟢 จบเวลาทำงาน: สับเปิดระบบ ===================`);
            await clickLever('เปิด (ON)');
            bot.chat('/home home2');
            console.log(`🚀 [CYCLE]: วาร์ปหลบไป (/home home2) เรียบร้อย!\n`);
        }
    } finally {
        isLeverCycleRunning = false;
    }
}

// ทุกนาทีที่ 3, 9, 15, 21, 27, 33, 39, 45, 51, 57
cron.schedule('0 3,9,15,21,27,33,39,45,51,57 * * * *', async () => {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    if ((h === 5 && m >= 35) || h === 6) return;
    await runLeverCycle();
});

// ก่อนถึงรอบ 15 วิ: วาร์ปมารอหน้าคันโยก
cron.schedule('45 2,8,14,20,26,32,38,44,50,56 * * * *', async () => {
    const now = new Date();
    const h = now.getHours(), m = now.getMinutes();
    if ((h === 5 && m >= 34) || h === 6) return;
    if (isOnline()) {
        console.log(`\n🚶 [PRE-WARP]: วาร์ปกลับมารอหน้าคันโยก (/home home)`);
        bot.chat('/home home');
    }
});

startBot(0);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
    if (line.trim() === 'push') runLeverCycle();
});