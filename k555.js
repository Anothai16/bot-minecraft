const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_USERNAME = 'K555';
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';

const sharedData = minecraftData(MC_VERSION);
let bot = null;

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

        bot.on('kicked', (reason) => console.error(`[🚨 KICKED] [${BOT_USERNAME}] โดนเตะ: ${reason}`));

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
                            console.log(`[✓] [${BOT_USERNAME}] ออนไลน์ประจำการ Survival เรียบร้อย!`);
                            bot.removeAllListeners('soundEffect');
                            bot.removeAllListeners('particle');
                            bot.removeAllListeners('entityMoved');
                        }, 10000);
                    } catch (e) {}
                }, 1800);
            }
        });

        bot.on('end', (reason) => {
            console.log(`[!] [${BOT_USERNAME}] หลุด (${reason}) ต่อใหม่ใน 25s...`);
            bot = null;
            startBot(25000);
        });

        bot.on('error', (err) => console.error(`[❌ Error]: ${err.message}`));
    }, delayMs);
}

startBot(0);