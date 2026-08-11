const mineflayer = require('mineflayer');
const os = require('os');

const HOST = 'play.amorycraft.com';
const PORT = 25565;
const VERSION = '1.21.11';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

const botNames = ['K666'];
const activeBots = new Map();

// 📊 ระบบ Report Resources
function logResourceUsage() {
    // บังคับทำ Garbage Collection ถ้าเปิดโหมด --expose-gc ไว้
    if (global.gc) {
        global.gc();
    }

    const memory = process.memoryUsage();
    const rss = (memory.rss / 1024 / 1024).toFixed(2);
    const heapUsed = (memory.heapUsed / 1024 / 1024).toFixed(2);
    const external = (memory.external / 1024 / 1024).toFixed(2);
    
    console.log(`\n============== 📊 OPTIMIZED RESOURCE REPORT ==============`);
    console.log(`🧠 [Total RAM Usage (RSS)]: ${rss} MB`);
    console.log(` ├─ 📦 Heap Used (JS Objects): ${heapUsed} MB`);
    console.log(` └─ 🌐 External (Buffers): ${external} MB`);
    console.log(`🤖 [Active Bots]: ${activeBots.size} ตัว (เฉลี่ย ~${(rss / Math.max(activeBots.size, 1)).toFixed(1)} MB/ตัว)`);
    
    activeBots.forEach((bot, name) => {
        if (bot && bot._client) {
            console.log(`   👉 Bot [${name}]: Listeners เหลือเพียง = ${bot._client.eventNames().length} ตัว`);
        }
    });
    console.log(`==========================================================\n`);
}

setInterval(logResourceUsage, 30000);

function startBot(accountName, delay = 0) {
    setTimeout(() => {
        console.log(`[SYS] กำลังเชื่อมต่อบอท: ${accountName}...`);

        const bot = mineflayer.createBot({
            host: HOST,
            port: PORT,
            username: accountName,
            version: VERSION,
            auth: 'offline',

            physicsEnabled: false,
            checkTimeoutInterval: 120000,

            // ⚡ 1. ปิด Plugins ที่ไม่จำเป็นทั้งหมด
            plugins: {
                chest: false,
                furnace: false,
                dispenser: false,
                enchantment_table: false,
                brewing_stand: false,
                villager: false,
                trade: false,
                book: false,
                anvil: false,
                pathfinder: false,
                'relative-nodes': false,
                raycast: false
            }
        });

        activeBots.set(accountName, bot);

        // ⚡ 2. ดักทิ้ง Packet ไร้สาระตั้งแต่นาทีแรก
        const packetFilter = (data, metadata) => {
            if (
                metadata.name === 'map_chunk' || 
                metadata.name === 'unload_chunk' || 
                metadata.name === 'spawn_entity' ||
                metadata.name === 'light_update' ||
                metadata.name === 'block_change' ||
                metadata.name === 'entity_metadata' ||
                metadata.name === 'entity_move' ||
                metadata.name === 'rel_entity_move'
            ) {
                return;
            }
        };
        bot._client.on('packet', packetFilter);

        // ⚡ 3. ตัวแปรเก็บ Handler เพื่อถอดออกภายหลัง (Cleanup)
        let isBookProcessed = false;

        const loginBookHandler = (data, metadata) => {
            if (!metadata || !metadata.name) return;

            if (metadata.name === 'open_book' || metadata.name.includes('book')) {
                if (isBookProcessed) return;
                isBookProcessed = true;

                console.log(`\n🚨 [${accountName}]: ตรวจพบด่านสมุด ล็อกอิน...`);

                setTimeout(() => {
                    if (bot._client && !bot._client.ended) bot.chat('/login 112233');
                }, 600);

                setTimeout(() => {
                    if (bot._client && !bot._client.ended) {
                        try { bot.closeWindow(0); } catch (e) {}
                    }
                }, 1200);

                setTimeout(() => {
                    if (bot._client && !bot._client.ended) bot.chat('/login 112233');
                }, 1800);
            }
        };

        bot._client.on('packet', loginBookHandler);

        // 🛰️ ด่านเข็มทิศ
        const spawnHandler = async () => {
            setTimeout(async () => {
                if (!bot || bot._client.ended) return;

                if (bot.inventory) {
                    const blueCompass = bot.inventory.items().find(i => i.name === 'recovery_compass');
                    if (blueCompass) {
                        try {
                            await bot.equip(blueCompass, 'hand');
                            await sleep(800);
                            await bot.activateItem();
                            console.log(`🧭 [${accountName}]: กดเข็มทิศสำเร็จ`);
                            return;
                        } catch (e) {}
                    }
                }
                bot.chat('/server survival');
            }, 7000);
        };
        bot.once('spawn', spawnHandler);

        // 🚨 ด่านเมนู GUI & ระบบล้าง Memory (Cleanup Phase)
        const windowHandler = async (window) => {
            await sleep(1500);
            if (!bot || bot._client.ended) return;

            try {
                await bot.clickWindow(10, 0, 0);
                console.log(`🟩 [${accountName}]: เลือกเมนู Survival เรียบร้อย`);

                setTimeout(() => {
                    if (bot && !bot._client.ended) {
                        bot.chat('/home home');
                        console.log(`🏠 [${accountName}]: เข้าบ้านเรียบร้อย -> 🧹 กำลังเคลียร์ Memory...`);

                        // ⚡ 4. CLEAR LISTENERS: ถอดฟังก์ชั่นล็อกอินออกให้หมดจาก RAM
                        bot._client.removeListener('packet', loginBookHandler);
                        bot.removeListener('windowOpen', windowHandler);

                        // ล้างข้อมูล Inventory ที่คาอยู่ใน Memory ทิ้ง
                        if (bot.inventory) {
                            bot.inventory.clear();
                        }

                        // บังคับเคลียร์ GC ชั่วคราว
                        if (global.gc) global.gc();
                    }
                }, 3000);
            } catch (clickErr) {}
        };
        bot.on('windowOpen', windowHandler);

        // Keep-Alive ทุก 2 นาที (ส่ง Packet ดิบ ไม่ผ่าน Engine)
        const keepAliveInterval = setInterval(() => {
            if (bot._client && !bot._client.ended) {
                bot._client.write('look', { yaw: 0, pitch: 0, onGround: true });
            } else {
                clearInterval(keepAliveInterval);
            }
        }, 120000);

        bot.on('end', () => {
            console.log(`[!] [${accountName}] หลุด... รอต่อใหม่`);
            activeBots.delete(accountName);
            clearInterval(keepAliveInterval);
            setTimeout(() => startBot(accountName, 0), 20000);
        });

        bot.on('error', (err) => {
            console.log(`[ERR] [${accountName}]:`, err.message);
        });

    }, delay);
}

botNames.forEach((name, index) => {
    startBot(name, index * 5000);
});