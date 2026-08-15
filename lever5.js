// 🔇 1. กรอง Warning ข้อความที่ไม่จำเป็น
const originalWarn = console.warn;
console.warn = (...args) => {
    if (args[0] && typeof args[0] === 'string' && args[0].includes('Ignoring block entities')) return;
    originalWarn(...args);
};

const mineflayer = require('mineflayer');
const { Vec3 } = require('vec3');
const cron = require('node-cron');
const express = require('express');
const readline = require('readline');

const { setupAmoryLogin } = require('./login');

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let botLever = null;
let isReconnectingLever = false;

let botK666 = null;
let isReconnectingK666 = false;

let botK555 = null;
let isReconnectingK555 = false;

let isLeverCycleRunning = false;

// 🌍 Express Server (Health check 24/7)
const app = express();
const port = process.env.PORT || 8083;
app.get('/', (req, res) => res.send('Bots (Lever, K666, K555) are running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

const DROP_PACKETS = [
    'world_particles', 'packet_world_particles',
    'named_sound_effect', 'sound_effect', 'entity_destroy',
    'rel_entity_move', 'entity_move_look', 'entity_teleport',
    'entity_head_rotation', 'animation', 'entity_metadata',
    'block_change', 'multi_block_change', 'block_action', 
    'block_entity_data', 'tile_entity_data', 'update_time', 'set_passengers', 'lighting',
    'map_chunk', 'world_event', 'spawn_entity', 'spawn_entity_experience_orb',
    'entity_velocity', 'entity_equipment', 'game_state_change'
];

function optimizeBot(bot) {
    bot.physicsEnabled = false;
    if (bot.physics) bot.physics.stopped = true;
    
    if (bot.world) {
        bot.world.columns = {};
    }
    bot.entities = {};
}

function destroyBot(botInstance) {
    if (!botInstance) return;
    try {
        if (botInstance.watchdogInterval) clearInterval(botInstance.watchdogInterval);
        botInstance.removeAllListeners();
        if (botInstance._client) {
            botInstance._client.removeAllListeners();
            botInstance._client.end();
        }
        botInstance.quit();
    } catch (e) {}
}

// 🛡️ ป้องกันปัญหา Keep-Alive Timeout
function setupKeepAliveFix(bot) {
    if (!bot._client) return;
    bot._client.on('packet', (data, metadata) => {
        if (!metadata || !metadata.name) return;
        if (metadata.name === 'keep_alive') {
            try {
                bot._client.write('keep_alive', {
                    keepAliveId: data.keepAliveId
                });
            } catch (e) {}
        }
    });
}

// ====================================================================
// 🔍 CHECK PLAYERS ONLINE
// ====================================================================
function checkPlayersFromLever() {
    if (!botLever || !botLever.players) {
        return { isReady: false, hasK555: false, hasK666: false };
    }
    const onlinePlayerNames = Object.keys(botLever.players);
    return {
        isReady: onlinePlayerNames.includes('K555') && onlinePlayerNames.includes('K666'),
        hasK555: onlinePlayerNames.includes('K555'),
        hasK666: onlinePlayerNames.includes('K666')
    };
}

function isLeverBotOnline() {
    if (botK666 && botK666.players && Object.keys(botK666.players).includes('Lervy_Lever')) return true;
    if (botK555 && botK555.players && Object.keys(botK555.players).includes('Lervy_Lever')) return true;
    return false;
}

// ====================================================================
// 🕹️ LEVER ACTION (1.21.x Safe Protocol)
// ====================================================================
async function clickLeverSafe() {
    if (!botLever || !botLever._client || botLever._client.ended) return false;

    const leverPos = new Vec3(10428, 74, -5054);

    try {
        botLever._client.write('use_item_on', {
            hand: 0,
            location: leverPos,
            direction: 1,
            cursorX: 0.5,
            cursorY: 0.5,
            cursorZ: 0.5,
            insideBlock: false,
            sequence: 0
        });

        botLever._client.write('arm_animation', { hand: 0 });
        return true;
    } catch (err) {
        console.log(`❌ [LEVER ERROR]: ไม่สามารถสับคันโยกได้: ${err.message}`);
        return false;
    }
}

async function triggerLeverCycle() {
    if (isLeverCycleRunning) {
        console.log(`⚠️ [LEVER CYCLE]: มีรอบทำงานเดิมกำลังดำเนินการอยู่ ข้ามรอบซ้ำซ้อน`);
        return;
    }

    isLeverCycleRunning = true;

    try {
        console.log(`🔍 [CHECK ONLINE]: กำลังตรวจสอบผู้เล่น K555 และ K666 ในเซิร์ฟเวอร์...`);
        
        while (true) {
            const check = checkPlayersFromLever();

            if (check.isReady) {
                console.log(`✅ [CHECK ONLINE]: พบผู้เล่น K555 และ K666 ครบถ้วน!`);
                break;
            } else {
                console.log(`⏳ [WAIT PLAYERS]: ผู้เล่นไม่ครบ (K555: ${check.hasK555 ? 'ออนไลน์' : '❌ ไม่อยู่'}, K666: ${check.hasK666 ? 'ออนไลน์' : '❌ ไม่อยู่'})`);
                
                if (!check.hasK666 && !isReconnectingK666) {
                    console.log(`🔄 [AUTO RECONNECT K666]: สั่งเชื่อมต่อ K666 ใหม่...`);
                    startK666Bot();
                }

                if (!check.hasK555 && !isReconnectingK555) {
                    console.log(`🔄 [AUTO RECONNECT K555]: สั่งเชื่อมต่อ K555 ใหม่...`);
                    startK555Bot();
                }

                console.log(`⏱️ รอ 1 นาทีแล้วจะเช็กใหม่อีกครั้ง...`);
                await sleep(60000);
            }
        }

        console.log(`\n🔴 [LEVER CYCLE]: สั่งสับปิดคันโยก (OFF)...`);
        const successOff = await clickLeverSafe();
        
        if (successOff) {
            console.log(`⏱️ [LEVER CYCLE]: สับปิดเรียบร้อย รอ 30 วินาที...`);
            await sleep(30000);
            
            console.log(`🟢 [LEVER CYCLE]: สั่งสับเปิดคันโยกกลับคืน (ON)...`);
            await clickLeverSafe();
            console.log(`✅ [LEVER CYCLE]: ทำงานครบไซเคิลเรียบร้อย!`);
        }
    } finally {
        isLeverCycleRunning = false;
    }
}

function initScheduler() {
    const CRON_PATTERN = '0 3,9,15,21,27,33,39,45,51,57 * * * *';

    cron.schedule(CRON_PATTERN, async () => {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        if ((hour === 5 && minute >= 35) || hour === 6) {
            console.log(`⏸️ [SCHEDULER SKIP]: เวลา ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น. อยู่ในช่วงพัก ข้ามรอบนี้`);
            return;
        }

        console.log(`\n⏰ [CRON TRIGGER]: ถึงรอบทำงาน [${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น.]`);
        await triggerLeverCycle();
    });

    console.log(`⏱️ [SCHEDULER READY]: ตั้งระบบอัตโนมัติทุกนาทีที่ 3,9,15,21,27,33,39,45,51,57 (เว้นช่วงพัก 05:35 - 07:00 น.)`);
}

// ====================================================================
// 🕹️ 1. LEVER BOT (Lervy_Lever)
// ====================================================================
function startLeverBot() {
    if (isReconnectingLever) return;
    isReconnectingLever = true;

    destroyBot(botLever);
    botLever = null;

    console.log('🔌 [Lervy_Lever] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    const bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Lervy_Lever',
        version: '1.21.11',
        viewDistance: 1,
        checkTimeoutInterval: 120000, // ขยายเป็น 2 นาที ป้องกันตัดสายตัวเอง
        noResetWorld: true,
        physicsEnabled: false
    });

    botLever = bot;

    if (bot._client) {
        setupKeepAliveFix(bot);
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    let isSuccessfullyInSurvival = false;

    const loginTimeout = setTimeout(() => {
        if (!isSuccessfullyInSurvival) {
            console.log(`⚠️ [Lervy_Lever]: ติดค้างเกิน 30 วินาที สั่ง Reconnect ใหม่...`);
            destroyBot(bot);
            handleLeverReconnect();
        }
    }, 30000);

    setupAmoryLogin(bot, () => {
        isSuccessfullyInSurvival = true;
        clearTimeout(loginTimeout);
        isReconnectingLever = false;
    });

    bot.on('spawn', () => {
        setTimeout(() => {
            isSuccessfullyInSurvival = true;
            clearTimeout(loginTimeout);
            isReconnectingLever = false;
        }, 12000);
    });

    bot.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [Lervy_Lever] ออนไลน์สำเร็จ! (โหมด Low-CPU)');
        optimizeBot(bot);
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨 [Lervy_Lever]: โดนเตะออก!! เหตุผล: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
    });

    bot.on('error', (err) => console.log(`\n❌ [Lervy_Lever Error]: ${err.message}`));

    bot.on('end', () => { 
        clearTimeout(loginTimeout);
        handleLeverReconnect();
    });
}

function handleLeverReconnect() {
    if (!isReconnectingLever) isReconnectingLever = true;
    console.log(`🔄 [Lervy_Lever] กำลังรอ 12 วินาทีเพื่อเชื่อมต่อใหม่...`);
    setTimeout(() => {
        isReconnectingLever = false;
        startLeverBot();
    }, 12000);
}

// ====================================================================
// 🤖 2. AFK BOT (K666)
// ====================================================================
function startK666Bot() {
    if (isReconnectingK666) return;
    isReconnectingK666 = true;

    destroyBot(botK666);
    botK666 = null;

    console.log('🔌 [K666] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    const bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K666',
        version: '1.21.11',
        viewDistance: 1,
        checkTimeoutInterval: 120000,
        noResetWorld: true,
        physicsEnabled: false
    });

    botK666 = bot;

    if (bot._client) {
        setupKeepAliveFix(bot);
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    let isK666InSurvival = false;

    const k666LoginTimeout = setTimeout(() => {
        if (!isK666InSurvival) {
            console.log(`⚠️ [K666]: ติดค้างเกิน 30 วินาที สั่ง Reconnect ใหม่...`);
            destroyBot(bot);
            handleK666Reconnect();
        }
    }, 30000);

    setupAmoryLogin(bot, () => {
        isK666InSurvival = true;
        clearTimeout(k666LoginTimeout);
        isReconnectingK666 = false;
    });

    bot.on('spawn', () => {
        setTimeout(() => {
            isK666InSurvival = true;
            clearTimeout(k666LoginTimeout);
            isReconnectingK666 = false;
        }, 12000);
    });

    bot.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [K666] ออนไลน์และยืน AFK สำเร็จ! (โหมด Low-CPU)');
        optimizeBot(bot);

        if (bot.watchdogInterval) clearInterval(bot.watchdogInterval);
        bot.watchdogInterval = setInterval(() => {
            if (isK666InSurvival && !isLeverBotOnline() && !isReconnectingLever) {
                console.log(`⚠️ [WATCHDOG]: ไม่พบ Lervy_Lever ในเซิร์ฟเวอร์! สั่ง Reconnect ให้...`);
                startLeverBot();
            }
        }, 120000);
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨 [K666]: โดนเตะออก!! เหตุผล: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
    });

    bot.on('error', (err) => console.log(`\n❌ [K666 Error]: ${err.message}`));

    bot.on('end', () => { 
        clearTimeout(k666LoginTimeout);
        handleK666Reconnect();
    });
}

function handleK666Reconnect() {
    if (!isReconnectingK666) isReconnectingK666 = true;
    console.log(`🔄 [K666] กำลังรอ 12 วินาทีเพื่อเชื่อมต่อใหม่...`);
    setTimeout(() => {
        isReconnectingK666 = false;
        startK666Bot();
    }, 12000);
}

// ====================================================================
// 🤖 3. AFK BOT (K555)
// ====================================================================
function startK555Bot() {
    if (isReconnectingK555) return;
    isReconnectingK555 = true;

    destroyBot(botK555);
    botK555 = null;

    console.log('🔌 [K555] กำลังเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    
    const bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'K555',
        version: '1.21.11',
        viewDistance: 1,
        checkTimeoutInterval: 120000,
        noResetWorld: true,
        physicsEnabled: false
    });

    botK555 = bot;

    if (bot._client) {
        setupKeepAliveFix(bot);
        bot._client.on('packet', (data, metadata) => {
            if (!metadata || !metadata.name) return;
            if (DROP_PACKETS.includes(metadata.name)) metadata.size = 0;
        });
    }

    let isK555InSurvival = false;

    const k555LoginTimeout = setTimeout(() => {
        if (!isK555InSurvival) {
            console.log(`⚠️ [K555]: ติดค้างเกิน 30 วินาที สั่ง Reconnect ใหม่...`);
            destroyBot(bot);
            handleK555Reconnect();
        }
    }, 30000);

    setupAmoryLogin(bot, () => {
        isK555InSurvival = true;
        clearTimeout(k555LoginTimeout);
        isReconnectingK555 = false;
    });

    bot.on('spawn', () => {
        setTimeout(() => {
            isK555InSurvival = true;
            clearTimeout(k555LoginTimeout);
            isReconnectingK555 = false;
        }, 12000);
    });

    bot.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [K555] ออนไลน์และยืน AFK สำเร็จ! (โหมด Low-CPU)');
        optimizeBot(bot);
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨 [K555]: โดนเตะออก!! เหตุผล: ${typeof reason === 'object' ? JSON.stringify(reason) : reason}`);
    });

    bot.on('error', (err) => console.log(`\n❌ [K555 Error]: ${err.message}`));

    bot.on('end', () => { 
        clearTimeout(k555LoginTimeout);
        handleK555Reconnect();
    });
}

function handleK555Reconnect() {
    if (!isReconnectingK555) isReconnectingK555 = true;
    console.log(`🔄 [K555] กำลังรอ 12 วินาทีเพื่อเชื่อมต่อใหม่...`);
    setTimeout(() => {
        isReconnectingK555 = false;
        startK555Bot();
    }, 12000);
}

// ====================================================================
// 🚀 STARTUP & CLI
// ====================================================================
initScheduler();

startLeverBot();

setTimeout(() => {
    startK666Bot();
}, 6000);

setTimeout(() => {
    startK555Bot();
}, 12000);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'push') {
        await triggerLeverCycle();
        return;
    }

    if (input === 'tpa') {
        if (botLever && botLever._client && !botLever._client.ended) {
            console.log('✍️ [Terminal Action] Lervy_Lever ยิงคำสั่ง -> /tpa DukDikauai');
            botLever.chat('/tpa DukDikauai');
        }
        if (botK666 && botK666._client && !botK666._client.ended) {
            console.log('✍️ [Terminal Action] K666 ยิงคำสั่ง -> /tpa DukDikauai');
            botK666.chat('/tpa DukDikauai');
        }
        if (botK555 && botK555._client && !botK555._client.ended) {
            console.log('✍️ [Terminal Action] K555 ยิงคำสั่ง -> /tpa DukDikauai');
            botK555.chat('/tpa DukDikauai');
        }
        return;
    }
});
