const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// ====================================================================
// ⏱️ ตัวแปรตั้งเวลาสับเปิด (CRON SYNTAX: 'วินาที นาที ชั่วโมง * * *')
// ====================================================================
// เวลาสับเปิดคันโยก (05:35:00 น.)
const CRON_ON_TIME = '0 35 5 * * *';
// ====================================================================

// 🕒 ฟังก์ชันดึงเวลาปัจจุบันของเครื่องสำหรับหน้า Log
function getTimestamp() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour12: false });
    const dateStr = now.toISOString().split('T')[0];
    return `[${dateStr} ${timeStr}]`;
}

// 📝 Override console.log / console.error เพื่อให้ติด Timestamp นำหน้าอัตโนมัติ
const originalLog = console.log;
const originalError = console.error;

console.log = function (...args) {
    originalLog.apply(console, [`${getTimestamp()}`, ...args]);
};

console.error = function (...args) {
    originalError.apply(console, [`${getTimestamp()}`, ...args]);
};

// 🎯 เรียกใช้งานโมดูลล็อกอิน Amory ออโต้จากไฟล์ร่วม login.js
const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let buildActive = false;
let forceSneakLocked = false;
let offTimeoutTimer = null; // ตัวแปรเก็บ Timer นับถอยหลัง 10 นาที

const express = require('express');
const app = express();
const port = process.env.PORT || 8083;
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

function getMaxDurability(itemName) {
    if (itemName.startsWith('netherite_')) return 2031;
    if (itemName.startsWith('diamond_')) return 1561;
    if (itemName.startsWith('iron_')) return 250;
    if (itemName.startsWith('golden_')) return 32;
    if (itemName.startsWith('stone_')) return 131;
    return 59; 
}

function getHoeDurabilityPercent() {
    if (!bot || !bot.inventory) return 0;
    const hoe = bot.inventory.items().find(i => i.name.endsWith('_hoe'));
    if (!hoe) return 0;
    const maxDur = getMaxDurability(hoe.name);
    const usedDur = hoe.durabilityUsed || 0;
    return Math.max(0, Math.floor(((maxDur - usedDur) / maxDur) * 100));
}

function getTotalSeedCount() {
    if (!bot || !bot.inventory) return 0;
    return bot.inventory.items()
        .filter(item => item.name === 'pumpkin_seeds')
        .reduce((sum, item) => sum + item.count, 0);
}

function checkSeedCount() {
    const totalSeeds = getTotalSeedCount();
    console.log(`👉 SEED_COUNT: ${totalSeeds}`);
    const hoePercent = getHoeDurabilityPercent();
    console.log(`👉 HOE_DURABILITY: ${hoePercent}`);
}

// 👥 ฟังก์ชันเช็ครายชื่อผู้เล่น 3 คนในเซิร์ฟเวอร์
function checkTargetPlayers() {
    if (!bot || !bot.players) return false;

    const targets = ['Samatachai', 'Kaitom_4', 'Kaitom_67'];
    const onlinePlayers = Object.keys(bot.players);

    const foundPlayers = targets.filter(name => onlinePlayers.includes(name));
    const missingPlayers = targets.filter(name => !onlinePlayers.includes(name));

    console.log(`\n👥 ================= [ PLAYER CHECK ] =================`);
    console.log(`📊 จำนวนผู้เล่นออนไลน์ทั้งหมด : ${onlinePlayers.length} คน`);
    console.log(`✅ พบผู้เล่นเป้าหมาย (${foundPlayers.length}/${targets.length}) : ${foundPlayers.join(', ') || 'ไม่พบใครเลย'}`);
    
    if (missingPlayers.length > 0) {
        console.log(`❌ ยังไม่ออนไลน์ : ${missingPlayers.join(', ')}`);
    }

    const isAllPresent = foundPlayers.length === targets.length;
    if (isAllPresent) {
        console.log(`🎉 [ALERT COMPLETE]: พบผู้เล่นครบทั้ง 3 คนแล้ว!`);
    }
    console.log(`=====================================================\n`);

    return isAllPresent;
}

// 🕹️ ฟังก์ชันโยกคันโยกและสั่งให้ตรงกับสถานะเป้าหมาย (targetState: 'ON' หรือ 'OFF')
async function setLeverState(targetState = null) {
    if (!bot) return;

    const leverPos = new Vec3(-2725, 64, 14506);
    const leverBlock = bot.blockAt(leverPos);

    if (!leverBlock || leverBlock.name !== 'lever') {
        console.log(`❌ [LEVER ERROR]: ไม่พบคันโยกที่พิกัด X:-2725 Y:64 Z:14506`);
        return;
    }

    try {
        let props = leverBlock.getProperties ? leverBlock.getProperties() : (leverBlock._properties || {});
        let isPowered = props.powered === 'true' || props.powered === true;

        if (targetState === 'ON' && isPowered) {
            console.log(`ℹ️ [LEVER SCHEDULE]: คันโยกเปิด (ON) อยู่แล้ว ข้ามการโยกซ้ำ`);
            return;
        }
        if (targetState === 'OFF' && !isPowered) {
            console.log(`ℹ️ [LEVER SCHEDULE]: คันโยกปิด (OFF) อยู่แล้ว ข้ามการโยกซ้ำ`);
            return;
        }

        await bot.lookAt(leverPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
        await bot.activateBlock(leverBlock);

        await new Promise(resolve => setTimeout(resolve, 300));

        const updatedBlock = bot.blockAt(leverPos);
        props = updatedBlock.getProperties ? updatedBlock.getProperties() : (updatedBlock._properties || {});
        isPowered = props.powered === 'true' || props.powered === true;
        const facing = props.facing ? props.facing.toString().toUpperCase() : 'UNKNOWN';

        console.log(`\n🕹️ ================= [ LEVER AUTOMATION ] =================`);
        console.log(`🎯 คำสั่ง               : ${targetState ? targetState : 'TOGGLE'}`);
        console.log(`🟢 สถานะใหม่ (Powered)  : ${isPowered ? 'เปิด (ON)' : 'ปิด (OFF)'}`);
        console.log(`🧭 ทิศทางคันโยก (Facing) : ${facing}`);
        console.log(`========================================================\n`);

    } catch (err) {
        console.log(`❌ [LEVER ERROR]: เกิดข้อผิดพลาดในการโยกคันโยก: ${err.message}`);
    }
}

// 🔄 ฟังก์ชันประมวลผลตามเงื่อนไข: สับเปิด -> เช็คผู้เล่น 3 คน -> รอนับถอยหลัง 10 นาที -> สับปิด
async function handleScheduledLeverRoutine() {
    console.log(`\n⏰ [CRON TRIGGER]: ถึงเวลาสับเปิดคันโยกตามกำหนดการ!`);
    await setLeverState('ON');

    const isComplete = checkTargetPlayers();

    if (isComplete) {
        console.log(`⏳ [TIMER STARTED]: พบผู้เล่นครบ 3 คน! กำลังตั้งเวลารอ 10 นาทีเพื่อสั่งปิดคันโยก...`);
        
        if (offTimeoutTimer) clearTimeout(offTimeoutTimer);

        offTimeoutTimer = setTimeout(async () => {
            console.log(`\n⌛ [TIMER EXPIRED]: ครบกำหนดเวลา 10 นาทีเรียบร้อยแล้ว! กำลังสั่งสับปิดคันโยก...`);
            await setLeverState('OFF');
        }, 10 * 60 * 1000);
    } else {
        console.log(`⚠️ [TIMER CANCELLED]: ผู้เล่นเป้าหมายยังมาไม่ครบ 3 คน ระงับการนับถอยหลังปิดคันโยก 10 นาที`);
    }
}

// ⏰ ฟังก์ชันตั้งคิวงานอัตโนมัติ Cron Jobs
function initScheduler() {
    cron.schedule(CRON_ON_TIME, async () => {
        await handleScheduledLeverRoutine();
    });

    console.log(`⏱️ [SCHEDULER READY]: ตั้งระบบสับเปิดไว้ที่ [${CRON_ON_TIME}] เรียบร้อยแล้ว`);
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Lever_Ohman',
        version: '1.21.11'
    });

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            if (metadata.name === 'world_particles' || metadata.name === 'packet_world_particles') {
                metadata.size = 0;
                return false; 
            }
        });
    }

    setupAmoryLogin(bot);
    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log('Glory! 🛰️ บอท [Lever_Ohman] ออนไลน์สำเร็จ!');
        
        setTimeout(async () => {
            // maain3checkSeedCount();

            // 🔍 ตรวจสอบเวลาเครื่องตอนบอท Reconnect เข้ามาใหม่
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            // ตรวจสอบว่าเป็นช่วงเวลาหลังสับเปิดปกติ (เช่น หลัง 05:35 น. ถึงก่อน 08:00 น.)
            const isAfterCronTime = (hours === 5 && minutes >= 35) || (hours >= 6 && hours < 8);

            if (isAfterCronTime) {
                console.log(`🕒 [RECONNECT DETECTED]: บอทล็อกอินกลับเข้ามาช่วงเวลา ${hours}:${minutes.toString().padStart(2, '0')} น. ทำการตรวจสอบสถานะคันโยกและรายชื่อผู้เล่น...`);
                
                const leverPos = new Vec3(-2725, 64, 14506);
                const leverBlock = bot.blockAt(leverPos);
                
                if (leverBlock && leverBlock.name === 'lever') {
                    const props = leverBlock.getProperties ? leverBlock.getProperties() : (leverBlock._properties || {});
                    const isPowered = props.powered === 'true' || props.powered === true;

                    // ถ้าพบว่าคันโยกเปิด (ON) ค้างไว้อยู่ ให้เช็คคนและตั้งเวลานับถอยหลัง 10 นาทีปิดทันที
                    if (isPowered) {
                        console.log(`🟢 [RECONNECT CHECK]: พบว่าคันโยกเปิด (ON) ค้างไว้อยู่! สั่งประมวลผลเช็คผู้เล่นและตั้งเวลาปิด...`);
                        
                        const isComplete = checkTargetPlayers();
                        if (isComplete) {
                            console.log(`⏳ [TIMER STARTED]: ผู้เล่นครบ 3 คน! กำลังตั้งเวลารอ 10 นาทีเพื่อสั่งปิดคันโยก...`);
                            if (offTimeoutTimer) clearTimeout(offTimeoutTimer);
                            offTimeoutTimer = setTimeout(async () => {
                                console.log(`\n⌛ [TIMER EXPIRED]: ครบกำหนดเวลา 10 นาที! กำลังสั่งสับปิดคันโยก...`);
                                await setLeverState('OFF');
                            }, 10 * 60 * 1000);
                        } else {
                            console.log(`⚠️ [TIMER CANCELLED]: คันโยกเปิดอยู่แต่ผู้เล่นยังมาไม่ครบ 3 คน ระงับการนับถอยหลัง 10 นาที`);
                        }
                    } else {
                        console.log(`ℹ️ [RECONNECT CHECK]: คันโยกปิด (OFF) อยู่แล้ว ไม่ต้องดำเนินการเพิ่มเติม`);
                    }
                }
            } else {
                checkTargetPlayers();
            }

            if (bot.inventory) {
                bot.inventory.on('updateSlot', () => { checkSeedCount(); });
            }
        }, 8000);
    });

    bot.on('playerJoined', (player) => {
        const targets = ['Samatachai', 'Kaitom_4', 'Kaitom_67'];
        if (targets.includes(player.username)) {
            console.log(`🟢 [PLAYER JOINED]: ${player.username} เข้าสู่เซิร์ฟเวอร์`);
            checkTargetPlayers();
        }
    });

    bot.on('playerLeft', (player) => {
        const targets = ['Samatachai', 'Kaitom_4', 'Kaitom_67'];
        if (targets.includes(player.username)) {
            console.log(`🔴 [PLAYER LEFT]: ${player.username} ออกจากเซิร์ฟเวอร์`);
        }
    });

    bot.on('death', () => {
        buildActive = false;
        forceSneakLocked = false;
        if (bot) bot.setControlState('sneak', false);
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('physicsTick', () => {
        if (buildActive && forceSneakLocked) {
            bot.setControlState('sneak', true);
            if (bot.controlState.forward) {
                bot.setControlState('sprint', false); 
            }
        } else if (buildActive && !forceSneakLocked) {
            bot.setControlState('sneak', false);
        }
    });

    bot.on('kicked', (reason) => {
        console.log(`\n🚨🚨🚨 [⚠️ DETECTED KICK]: บอทโดนเซิร์ฟเวอร์เตะออก!!`);
        buildActive = false;
        forceSneakLocked = false;
    });

    bot.on('error', (err) => {
        console.log(`\n❌❌❌ [💥 SYSTEM ERROR]: โปรแกรมขัดข้องหลุดการเชื่อมต่อ!`);
        buildActive = false;
        forceSneakLocked = false;
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;

        if (message.trim() === 'push') {
            await setLeverState();
            return;
        }

        if (message.trim() === 'check') {
            checkTargetPlayers();
            return;
        }

        if (message.startsWith('farm')) {
            const args = message.split(' ');
            let startX = parseInt(args[1]);
            const startY = parseInt(args[2]);
            const startZ = parseInt(args[3]);
            const selectSet = args[4] ? parseInt(args[4]) : null;

            if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
            if (startX === -2718) startX = -2719;
            
            await startCustomPlatformBuilder(startX, startY, startZ, selectSet);
        }
    });

    bot.on('end', () => { 
        buildActive = false; 
        forceSneakLocked = false;
        if (offTimeoutTimer) clearTimeout(offTimeoutTimer);
        if (bot) bot.setControlState('sneak', false);
        setTimeout(startBot, 10000); 
    });
}

function setupMovements(botInstance) {
    const registry = botInstance.registry;
    const movements = new Movements(botInstance, registry);
    movements.allowSprinting = false;
    movements.allowParkour = false;
    movements.canDig = false;
    movements.allow1by1towers = false;
    movements.maxDropDown = 1;
    movements.allowFreeMotion = false;
    botInstance.pathfinder.setMovements(movements);
}

async function startCustomPlatformBuilder(startX, targetY, startZ, selectSet) {
    buildActive = true;
    setupMovements(bot);

    const targetEndX = -2638;
    let startRound = selectSet ? selectSet : 1;
    let endRound = selectSet ? selectSet : 3;

    console.log(`\n============================ [ ระบบฟาร์มล็อกเลนเดินความเร็วสูง ] ============================`);

    for (let round = startRound; round <= endRound; round++) {
        if (!buildActive) break;

        const checkHoe = bot.inventory.items().find(i => i.name.endsWith('_hoe'));
        if (!checkHoe || getHoeDurabilityPercent() <= 1) {
            console.log('❌ [⚡ STOP FARMING]: ตรวจไม่พบจอบใช้การได้ หรือจอบพังวิกฤต ระงับคิวงานระบบฟาร์มทันที');
            break;
        }

        let currentBaseZ = startZ + ((round - 1) * 4);
        const zCandidate1 = currentBaseZ;      
        const zCandidate2 = currentBaseZ + 1;  

        let walkZ;         
        let parallelZ;     

        if (round === 1) {
            walkZ = zCandidate1;
            parallelZ = zCandidate2;
            console.log(`\n🎰 [ชุดที่ 1 / 3] -> เท้าล็อกเดินบนแกน Z: ${walkZ} | สะบัดหน้าทำงานแกน Z: ${parallelZ}`);
        } else {
            walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
            console.log(`\n🎰 [ชุดที่ ${round} / 3 - โหมดเท้าล็อกแกน Z คี่ร่วม] -> ขาไปขากลับเดินบนแกน Z คี่: ${walkZ} | หันไปทำงานแกน Z คู่: ${parallelZ}`);
        }

        console.log(`🚜 เริ่มสเต็ป 1: วิ่งสับพรวนดินเลนคู่ขนาน [เท้าล็อกเหยียบ Z: ${walkZ}]`);
        await runTurboTillEngine(startX, targetEndX, targetY, walkZ, walkZ);
        if (!buildActive) break;

        await runTurboTillEngine(targetEndX, startX, targetY, walkZ, parallelZ);
        if (!buildActive) break;

        if (getTotalSeedCount() > 0) {
            console.log(`\n🌾 เริ่มสเต็ป 2: วิ่งสับเกียร์ไล่ปลูกเมล็ดฟักทองเลนคู่ [เท้าล็อกเหยียบ Z: ${walkZ}]`);
            await runTurboPlantEngine(startX, targetEndX, targetY, walkZ, walkZ);
            if (!buildActive) break;

            await runTurboPlantEngine(targetEndX, startX, targetY, walkZ, parallelZ);
        } else {
            console.log('⚠️ [Warning] เมล็ดฟักทองในตักหมดเกลี้ยง! สั่งข้ามสเต็ปปักเมล็ดไปขึ้นชุดถัดไปด่วน');
        }

        if (!buildActive) break;

        console.log(`🚀 [CHAINING REPORT] จบกระบวนการชุดที่ ${round} สำเร็จ!`);
        if (round < endRound) {
            await new Promise(resolve => setTimeout(resolve, 600));
        }
    }

    console.log(`\n🏆 [All Job Completed] ภารกิจฟาร์มล็อกแกนเท้าเดินเดี่ยวแกนคี่เสร็จสมบูรณ์เรียบร้อยครับพี่!`);
    buildActive = false;
}

async function autoRefillSeedsFromInventory() {
    if (!bot || !bot.inventory) return;

    let hasSeedInHotbar = false;
    for (let slot = 0; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (item && item.name === 'pumpkin_seeds' && item.count > 0) {
            hasSeedInHotbar = true;
            break;
        }
    }

    if (!hasSeedInHotbar) {
        const backupItem = bot.inventory.items().find(item => item.name === 'pumpkin_seeds' && item.slot >= 9 && item.slot <= 35);
        if (backupItem) {
            bot.clearControlStates();
            await new Promise(res => setTimeout(res, 150));
            try {
                await bot.moveSlotItem(backupItem.slot, 36); 
                await new Promise(res => setTimeout(res, 350)); 
            } catch (err) {}
        }
    }
}

async function runTurboTillEngine(fromX, toX, targetY, walkZ, workZ) {
    const stepX = fromX <= toX ? 1 : -1;
    let currentX = fromX;

    if (bot) bot.clearControlStates();

    while (buildActive) {
        if (getHoeDurabilityPercent() <= 1) break;

        let hotbarHoeSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const itemInSlot = bot.inventory.slots[36 + slot];
            if (itemInSlot && itemInSlot.name.endsWith('_hoe')) {
                hotbarHoeSlot = slot;
                break;
            }
        }
        if (hotbarHoeSlot !== -1 && bot.quickBarSlot !== hotbarHoeSlot) {
            bot.setQuickBarSlot(hotbarHoeSlot);
        }

        const blockPos = new Vec3(currentX, targetY, workZ);
        const standPos = new Vec3(currentX, targetY + 1, walkZ);
        let currentBlockState = bot.blockAt(blockPos, true);

        if (bot && bot.entity) {
            const distance = bot.entity.position.distanceTo(standPos);
            if (distance > 0.8) {
                await bot.lookAt(standPos.offset(0.5, 0, 0.5), true);
                bot.setControlState('forward', true);
                while (bot.entity.position.distanceTo(standPos) > 1.2 && buildActive) {
                    await new Promise(res => setTimeout(res, 20));
                }
            }
        }

        if (currentBlockState && (currentBlockState.name === 'dirt' || currentBlockState.name === 'grass_block')) {
            try {
                await bot.lookAt(blockPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
                await bot.activateBlock(currentBlockState);
                await new Promise(res => setTimeout(res, 40));
            } catch (e) {}
        }

        if (currentX === toX) break;
        currentX += stepX;
    }
    if (bot) bot.clearControlStates();
}

async function runTurboPlantEngine(fromX, toX, targetY, walkZ, workZ) {
    const stepX = fromX <= toX ? 1 : -1;
    let currentX = fromX;

    if (bot) bot.clearControlStates();

    while (buildActive) {
        if (getTotalSeedCount() <= 0) break;

        await autoRefillSeedsFromInventory();

        let hotbarSeedSlot = -1;
        let hotbarHoeSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const item = bot.inventory.slots[36 + slot];
            if (item) {
                if (item.name === 'pumpkin_seeds' && item.count > 0) hotbarSeedSlot = slot;
                if (item.name.endsWith('_hoe')) hotbarHoeSlot = slot;
            }
        }

        if (hotbarSeedSlot !== -1 && bot.quickBarSlot !== hotbarSeedSlot) {
            bot.setQuickBarSlot(hotbarSeedSlot);
            await new Promise(res => setTimeout(res, 30)); 
        }

        const blockPos = new Vec3(currentX, targetY, workZ);
        const standPos = new Vec3(currentX, targetY + 1, walkZ);
        let currentBlockState = bot.blockAt(blockPos, true);

        if (bot && bot.entity) {
            const distance = bot.entity.position.distanceTo(standPos);
            if (distance > 0.8) {
                await bot.lookAt(standPos.offset(0.5, 0, 0.5), true);
                bot.setControlState('forward', true);
                while (bot.entity.position.distanceTo(standPos) > 1.2 && buildActive) {
                    await new Promise(res => setTimeout(res, 20));
                }
            }
        }

        if (currentBlockState && (currentBlockState.name === 'dirt' || currentBlockState.name === 'grass_block')) {
            if (hotbarHoeSlot !== -1) {
                bot.setQuickBarSlot(hotbarHoeSlot);
                await bot.lookAt(blockPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
                await bot.activateBlock(currentBlockState);
                await new Promise(res => setTimeout(res, 50));
                currentBlockState = bot.blockAt(blockPos, true);
                if (hotbarSeedSlot !== -1) bot.setQuickBarSlot(hotbarSeedSlot);
            }
        }

        if (currentBlockState && currentBlockState.name === 'farmland') {
            try {
                if (hotbarSeedSlot !== -1 && bot.quickBarSlot !== hotbarSeedSlot) {
                    bot.setQuickBarSlot(hotbarSeedSlot);
                }
                
                forceSneakLocked = true;
                if (bot) bot.setControlState('sneak', true);
                
                await bot.lookAt(blockPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
                await bot.placeBlock(currentBlockState, new Vec3(0, 1, 0));
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {}
        }

        forceSneakLocked = false;
        if (bot) bot.setControlState('sneak', false);

        if (currentX === toX) break;
        currentX += stepX;
    }
    if (bot) bot.clearControlStates();
}

// เรียกให้ระบบตั้งเวลาเริ่มทำงาน
initScheduler();

// เริ่มการทำงานของบอท
startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'push') {
        await setLeverState();
        return;
    }

    if (input === 'check' || input === 'players') {
        checkTargetPlayers();
        return;
    }

    if (input === 'tpa') {
        if (bot && bot.entity) {
            console.log('✍️ [Terminal Action] ยิงคำสั่งด่วน -> /tpa DukDikauai');
            bot.chat('/tpa DukDikauai');
        }
        return;
    }

    if (input === 'drop') {
        if (!bot || !bot.inventory) return;
        const currentHoe = bot.inventory.items().find(i => i.name.endsWith('_hoe'));
        if (currentHoe) {
            try {
                await bot.equip(currentHoe, 'hand');
                await new Promise(r => setTimeout(r, 200));
                await bot.tossStack(currentHoe);
            } catch (err) {}
        }
        return;
    }

    if (input.startsWith('farm')) {
        const args = input.split(' ');
        let startX = parseInt(args[1]);
        const startY = parseInt(args[2]);
        const startZ = parseInt(args[3]);
        const selectSet = args[4] ? parseInt(args[4]) : null;

        if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
        if (startX === -2718) startX = -2719;

        if (bot) {
            await startCustomPlatformBuilder(startX, startY, startZ, selectSet);
        }
    }
});