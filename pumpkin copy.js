const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');
const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let buildActive = false;
let forceSneakLocked = false;
const progressFilePath = path.join(__dirname, 'progress.txt');

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

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'dpumpkind',
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
        console.log('🛰️ บอท [dpumpkind] ออนไลน์สำเร็จ! รอรับคำสั่งพิมพ์ farm จากพี่ครับ...');
        setTimeout(() => {
            checkSeedCount();
            if (bot.inventory) {
                bot.inventory.on('updateSlot', () => { checkSeedCount(); });
            }
        }, 8000);
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
            if (bot.controlState.forward) bot.setControlState('sprint', false); 
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

    bot.on('end', () => { 
        buildActive = false; 
        forceSneakLocked = false;
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

// 🧭 ฟังก์ชันวิเคราะห์อาร์กิวเมนต์ ปรับโครงสร้างรองรับ Multi-Round
async function parseAndExecuteFarm(inputStr) {
    const args = inputStr.split(' ');
    let startX = parseInt(args[1]);
    const startY = parseInt(args[2]);
    const startZ = parseInt(args[3]);

    if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
    if (startX === -2718) startX = -2719;

    let selectSet = null;
    let totalRounds = 1;

    // ตรวจสอบค่าพารามิเตอร์เสริมท้าย
    if (args[4] && !isNaN(parseInt(args[4]))) {
        // เคส farm X Y Z [รอบ]
        totalRounds = parseInt(args[4]);
    }
    if (args[5] && !isNaN(parseInt(args[5]))) {
        // เคสเผื่อพี่ระบุชุดเดี่ยวนำหน้า farm X Y Z [ชุดเดี่ยว] [รอบ]
        selectSet = parseInt(args[4]);
        totalRounds = parseInt(args[5]);
    }

    if (bot) {
        await runMultiRoundFarmManager(startX, startY, startZ, selectSet, totalRounds);
    }
}

// 🎰 ลูปใหญ่ควบคุมการวนรอบขยับแกน Z ทีละ 13 บล็อก
async function runMultiRoundFarmManager(startX, targetY, startZ, selectSet, totalRounds) {
    buildActive = true;
    
    for (let currentRound = 1; currentRound <= totalRounds; currentRound++) {
        if (!buildActive) break;

        // คำนวณแกน Z เริ่มต้นประจำรอบนั้น ๆ (รอบแรก = สั่งตรง, รอบสองขยับ + 13)
        let activeRoundStartZ = startZ + ((currentRound - 1) * 13);

        console.log(`\n🎰 ==================== [ 🎮 FARM ROUND ${currentRound} / ${totalRounds} ] ==================== 🎰`);
        console.log(`📐 พิกัดเริ่มต้นแกน Z ประจำรอบนี้: ${activeRoundStartZ}`);

        // ดักลอจิกคำนวณตรรกะคู่อัตโนมัติในแต่ละรอบป้องกันพิกัดแกนเคลื่อน
        let config = {
            selectSet: selectSet,
            round2Mode: (activeRoundStartZ % 2 !== 0) ? 'koo' : 'kee',
            round3Mode: (activeRoundStartZ % 2 !== 0) ? 'kee' : 'koo'
        };

        await startCustomPlatformBuilder(startX, targetY, activeRoundStartZ, config);
        
        if (buildActive && currentRound < totalRounds) {
            console.log(`🛰️ จบลูปแผงรอบที่ ${currentRound} กำลังปรับแท่นขยับขึ้นเลนรอบถัดไป...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    if (buildActive) {
        console.log(`\n🏆 [Mission Complete] ภารกิจรัน Multi-Round ฟาร์มครบทุกแถวเรียบร้อยครับพี่!`);
    }
    buildActive = false;
}

// 🧱 ฟังก์ชันหลักคุมขบวนสลับชุด รันแปลงล็อกแกน Z
async function startCustomPlatformBuilder(startX, targetY, activeRoundStartZ, config) {
    setupMovements(bot);
    const targetEndX = -2639;
    
    let startRound = config.selectSet ? config.selectSet : 1;
    let endRound = config.selectSet ? config.selectSet : 3;

    console.log(`🤖 แผนการวิ่งอัตโนมัติรอบนี้ -> ชุดที่ 2: [${config.round2Mode.toUpperCase()}] | ชุดที่ 3: [${config.round3Mode.toUpperCase()}]`);

    for (let round = startRound; round <= endRound; round++) {
        if (!buildActive) break;

        const checkHoe = bot.inventory.items().find(i => i.name.endsWith('_hoe'));
        if (!checkHoe || getHoeDurabilityPercent() <= 1) {
            console.log('❌ [⚡ STOP FARMING]: จอบหมด/พังวิกฤต ระงับคิวงานระบบฟาร์มทันที');
            buildActive = false;
            break;
        }

        let currentBaseZ = activeRoundStartZ + ((round - 1) * 4);
        const zCandidate1 = currentBaseZ;      
        const zCandidate2 = currentBaseZ + 1;  

        let walkZ;         
        let parallelZ;     

        if (round === 1) {
            walkZ = zCandidate1;
            parallelZ = zCandidate2;
            console.log(`\n🎬 [ชุดที่ 1 / 3] -> เท้าเดิน Z: ${walkZ} | พรวน/ปัก Z: ${parallelZ}`);
        } 
        else if (round === 2) {
            if (config.round2Mode === 'koo') {
                walkZ = (zCandidate1 % 2 === 0) ? zCandidate1 : zCandidate2;
            } else {
                walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            }
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
            console.log(`\n🎬 [ชุดที่ 2 / 3 - Z ${config.round2Mode.toUpperCase()}] -> เดิน Z: ${walkZ} | พรวน/ปัก Z: ${parallelZ}`);
        } 
        else if (round === 3) {
            if (config.round3Mode === 'koo') {
                walkZ = (zCandidate1 % 2 === 0) ? zCandidate1 : zCandidate2;
            } else {
                walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            }
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
            console.log(`\n🎬 [ชุดที่ 3 / 3 - Z ${config.round3Mode.toUpperCase()}] -> เดิน Z: ${walkZ} | พรวน/ปัก Z: ${parallelZ}`);
        }

        // 🚜 สเต็ป 1: วิ่งสับพรวนดินเลนคู่ขนาน
        console.log(`🚜 พรวนเลนเหยียบ [Z: ${walkZ}]`);
        await runTurboTillEngine(startX, targetEndX, targetY, walkZ, walkZ);
        if (!buildActive) break;

        console.log(`🚜 พรวนเลนข้างขนาน [Z: ${parallelZ}]`);
        await runTurboTillEngine(targetEndX, startX, targetY, walkZ, parallelZ);
        if (!buildActive) break;

        // 🌾 สเต็ป 2: วิ่งปักเมล็ดฟักทองเลนคู่
        if (getTotalSeedCount() > 0) {
            console.log(`🌾 ปลูกเมล็ดเลนเหยียบ [Z: ${walkZ}]`);
            await runTurboPlantEngine(startX, targetEndX, targetY, walkZ, walkZ);
            if (!buildActive) break;

            console.log(`🌾 ปลูกเมล็ดเลนข้างขนาน [Z: ${parallelZ}]`);
            await runTurboPlantEngine(targetEndX, startX, targetY, walkZ, parallelZ);
        } else {
            console.log('⚠️ [Warning] เมล็ดฟักทองหมดคลัง! ข้ามไปขึ้นชุดถัดไปด่วน');
        }

        if (!buildActive) break;
        console.log(`🚀 [REPORT] จบกระบวนการชุดที่ ${round} สำเร็จ!`);
    }
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
            console.log(`📦 เมล็ดฟักทองใน Hotbar หมด ดึงช่องที่ ${backupItem.slot} เติมลง Hotbar...`);
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
        if (hotbarHoeSlot !== -1 && bot.quickBarSlot !== hotbarHoeSlot) bot.setQuickBarSlot(hotbarHoeSlot);

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
                if (hotbarSeedSlot !== -1 && bot.quickBarSlot !== hotbarSeedSlot) bot.setQuickBarSlot(hotbarSeedSlot);
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

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'c') {
        buildActive = false;
        forceSneakLocked = false;
        if (bot) bot.clearControlStates();
        console.log('🛑 สั่งหยุดกระบวนการฟาร์มชั่วคราว!');
        return;
    }
    if (input === 'tpa') {
        if (bot && bot.entity) bot.chat('/tpa DukDikauai');
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
        await parseAndExecuteFarm(input);
    }
});