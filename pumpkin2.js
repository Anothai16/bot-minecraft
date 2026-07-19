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

// ⏳ ฟังก์ชันดีเลย์อิสระ ป้องกัน ReferenceError บึ้มสคริปต์
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

function getTotalPumpkinCount() {
    if (!bot || !bot.inventory) return 0;
    return bot.inventory.items()
        .filter(item => item.name === 'pumpkin')
        .reduce((sum, item) => sum + item.count, 0);
}

function checkSeedCount() {
    const totalSeeds = getTotalSeedCount();
    const totalPumpkins = getTotalPumpkinCount();
    console.log(`👉 SEED_COUNT: ${totalSeeds} | PUMPKIN_COUNT: ${totalPumpkins}`);
    const hoePercent = getHoeDurabilityPercent();
    console.log(`👉 HOE_DURABILITY: ${hoePercent}`);
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Kaitom_2',
        version: '1.21.1'
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
        console.log('🛰️ บอท [dpumpkind] ออนไลน์สำเร็จ! เพิ่มระบบกู้จอบกลับเข้า Hotbar ตลอดเวลาแล้วครับพี่');
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

async function parseAndExecuteFarm(inputStr) {
    const args = inputStr.split(' ');
    let startX = parseInt(args[1]);
    const startY = parseInt(args[2]);
    const startZ = parseInt(args[3]);

    if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
    if (startX === -2718) startX = -2719;

    let selectSet = null;
    let totalRounds = 1;

    if (args[4] && !isNaN(parseInt(args[4]))) {
        totalRounds = parseInt(args[4]);
    }
    if (args[5] && !isNaN(parseInt(args[5]))) {
        selectSet = parseInt(args[4]);
        totalRounds = parseInt(args[5]);
    }

    if (bot) {
        await runMultiRoundFarmManager(startX, startY, startZ, selectSet, totalRounds);
    }
}

async function runMultiRoundFarmManager(startX, targetY, startZ, selectSet, totalRounds) {
    buildActive = true;
    
    for (let currentRound = 1; currentRound <= totalRounds; currentRound++) {
        if (!buildActive) break;

        let activeRoundStartZ = startZ + ((currentRound - 1) * 13);

        console.log(`\n🎰 ==================== [ 🎮 FARM ROUND ${currentRound} / ${totalRounds} ] ==================== 🎰`);
        console.log(`📐 พิกัดเริ่มต้นแกน Z ประจำรอบนี้: ${activeRoundStartZ}`);

        let config = {
            selectSet: selectSet,
            round2Mode: (activeRoundStartZ % 2 !== 0) ? 'koo' : 'kee',
            round3Mode: (activeRoundStartZ % 2 !== 0) ? 'kee' : 'koo'
        };

        await startCustomPlatformBuilder(startX, targetY, activeRoundStartZ, config);
        
        if (buildActive && currentRound < totalRounds) {
            console.log(`🛰️ จบลูปแผงรอบที่ ${currentRound} กำลังปรับแท่นขยับขึ้นเลนรอบถัดไป...`);
            await delay(1000);
        }
    }
    
    if (buildActive) {
        console.log(`\n🏆 [Mission Complete] ภารกิจรัน Multi-Round ฟาร์มครบทุกแถวเรียบร้อยครับพี่!`);
    }
    buildActive = false;
}

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
        } 
        else if (round === 2) {
            if (config.round2Mode === 'koo') {
                walkZ = (zCandidate1 % 2 === 0) ? zCandidate1 : zCandidate2;
            } else {
                walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            }
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
        } 
        else if (round === 3) {
            if (config.round3Mode === 'koo') {
                walkZ = (zCandidate1 % 2 === 0) ? zCandidate1 : zCandidate2;
            } else {
                walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            }
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
        }

        console.log(`\n🎬 [ชุดที่ ${round} / 3] -> สายซิ่งควบรวมระนาบ Z: ${walkZ} และ Z: ${parallelZ}`);
        console.log(`🔬 [CHECK SUPPLIES]: ตรวจสอบเสบียงก่อนออกตัว...`);
        await autoRefillSeedsFromInventory();

        if (getTotalSeedCount() <= 0 && getTotalPumpkinCount() <= 0) {
            console.log('❌ [⚡ STOP FARMING]: ทั้งเมล็ดและฟักทองหมดตัวเกลี้ยง! ระงับการทำงานครับพี่');
            buildActive = false;
            break;
        }

        console.log(`🚜 [TURBO-TILL]: เริ่มรันคิวพรวนดินเลนคู่ขนานพร้อมกัน [Z: ${walkZ} & Z: ${parallelZ}]`);
        await runDualTillEngine(startX, targetEndX, targetY, walkZ, parallelZ);
        if (!buildActive) break;

        if (getTotalSeedCount() > 0 || getTotalPumpkinCount() > 0) {
            console.log(`🌾 [TURBO-PLANT]: เริ่มรันคิวปลูกเมล็ดเลนคู่ขนานขากลับพร้อมกัน [Z: ${walkZ} & Z: ${parallelZ}]`);
            await runDualPlantEngine(targetEndX, startX, targetY, walkZ, parallelZ);
        } else {
            console.log('⚠️ [Warning] เมล็ดฟักทองหมดคลัง! ข้ามไปขึ้นชุดถัดไปด่วน');
        }

        if (!buildActive) break;
        console.log(`🚀 [REPORT] จบกระบวนการชุดที่ ${round} สำเร็จอย่างรวดเร็ว!`);
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
        const backupSeed = bot.inventory.items().find(item => item.name === 'pumpkin_seeds' && item.slot >= 9 && item.slot <= 35);
        if (backupSeed) {
            console.log(`📦 พบเมล็ดฟักทองสำรองช่องกระเป๋าที่ ${backupSeed.slot} ดึงลงมาใส่ Hotbar...`);
            bot.clearControlStates();
            await delay(150);
            try {
                await bot.moveSlotItem(backupSeed.slot, 36); 
                await delay(350); 
            } catch (err) {}
            return;
        }
    }

    if (getTotalSeedCount() === 0) {
        const craftPumpkinStack = bot.inventory.items().find(item => item.name === 'pumpkin');
        
        if (craftPumpkinStack) {
            console.log(`🔨 [CRAFT SYSTEM]: เมล็ดหมดตัว! เริ่มกระบวนการสลับสล็อตคราฟต์สูตร Shift-Click...`);
            bot.clearControlStates();
            await delay(200);

            let emptySlots = [];
            for (let invSlot = 9; invSlot <= 35; invSlot++) {
                if (!bot.inventory.slots[invSlot]) emptySlots.push(invSlot);
            }

            if (emptySlots.length < 4) {
                console.log(`🗑️ [SWAP-GUARD]: โยนฟักทองทิ้งล่วงหน้า 4 Stack เปิดสล็อตจองพื้นที่เมล็ดใหม่...`);
                let tossedCount = 0;
                for (let i = 0; i < 6; i++) {
                    const pumpkinToToss = bot.inventory.items().find(item => item.name === 'pumpkin' && item.slot !== craftPumpkinStack.slot);
                    if (pumpkinToToss && tossedCount < 4) {
                        try {
                            await bot.tossStack(pumpkinToToss);
                            tossedCount++;
                            await delay(250);
                        } catch (err) {}
                    }
                }
                
                emptySlots = [];
                for (let invSlot = 9; invSlot <= 35; invSlot++) {
                    if (!bot.inventory.slots[invSlot]) emptySlots.push(invSlot);
                }
            }

            try {
                console.log(`✨ [SHIFT-CRAFT]: กำลังนำฟักทอง 64 ลูกวางลงช่องคราฟต์...`);
                await bot.clickWindow(craftPumpkinStack.slot, 0, 0); await delay(150); 
                await bot.clickWindow(1, 0, 0); await delay(150); 

                console.log(`✨ [SHIFT-CRAFT]: ส่งแพ็คเก็ต Shift-Click ช่องผลลัพธ์ ดึงเมล็ด 4 Stack รวดเดียวจบ!`);
                await bot.clickWindow(0, 0, 1); await delay(250);

                if (bot.inventory.selectedItem) {
                    const emptyInv = bot.inventory.firstEmptyInventorySlot();
                    if (emptyInv !== null) await bot.clickWindow(emptyInv, 0, 0);
                    await delay(150);
                }

                const newSeeds = bot.inventory.items().find(item => item.name === 'pumpkin_seeds');
                if (newSeeds && newSeeds.slot !== 36) {
                    await bot.moveSlotItem(newSeeds.slot, 36); await delay(200);
                }
            } catch (err) {
                console.log(`❌ บั๊กระบบเมธอด Shift-Craft: ${err.message}`);
            }
        }
    }
}

// 🎯 🔥 [THE HOE RESCUE ENGINE]: ฟังก์ชันกู้จอบอัจฉริยะ ลากจอบจากช่องกระเป๋าลึกกลับคืนสู่ Hotbar สล็อต 1 ชัวร์ร้อยเปอร์เซ็นต์
async function pullHoeToHotbarSafely() {
    if (!bot || !bot.inventory) return false;
    
    // 1. ตรวจสอบว่ามีจอบพร้อมใช้งานใน Hotbar (ช่อง 36 ถึง 44) หรือยัง
    for (let slot = 0; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (item && item.name.endsWith('_hoe')) {
            if (bot.quickBarSlot !== slot) {
                bot.setQuickBarSlot(slot);
                await delay(50);
            }
            return true;
        }
    }

    // 2. 🚨 [RESCUE IN ACTION]: ถ้าใน Hotbar ไม่มีเลย แสดงว่าโดนเด้งหลุดไปสล็อตกระเป๋าหลัก (9-35)
    const deepHoe = bot.inventory.items().find(item => item.name.endsWith('_hoe') && item.slot >= 9 && item.slot <= 35);
    if (deepHoe) {
        console.log(`🛡️ [HOE-RESCUE]: ตรวจพบจอบโดนดีดหลุดไปสล็อตลึกที่ ${deepHoe.slot}! กำลังกู้ลากกลับลงมาที่ Hotbar ช่อง 1...`);
        bot.clearControlStates();
        await delay(100);
        try {
            // ย้ายจอบจากสล็อตที่โดนดีดหลุด กลับลงมานอนประจำการที่ Hotbar ช่อง 1 (สล็อตไอดี 37)
            await bot.moveSlotItem(deepHoe.slot, 37);
            await delay(250);
            bot.setQuickBarSlot(1); // สั่งสับเปลี่ยนไอเทมมาถือช่อง 1 ทันที
            await delay(50);
            return true;
        } catch (err) {
            console.log(`❌ กู้จอบล้มเหลว: ${err.message}`);
        }
    }
    return false;
}

// 🚜 [DUAL TILL ENGINE]: พรวนดินคู่ขนานขาไป
async function runDualTillEngine(fromX, toX, targetY, z1, z2) {
    const stepX = fromX <= toX ? 1 : -1;
    let currentX = fromX;
    if (bot) bot.clearControlStates();

    while (buildActive) {
        if (getHoeDurabilityPercent() <= 1) break;

        const standPos = new Vec3(currentX, targetY + 1, z1);
        if (bot && bot.entity) {
            const distance = bot.entity.position.distanceTo(standPos);
            if (distance > 0.8) {
                await bot.lookAt(standPos.offset(0.5, 0, 0.5), true);
                bot.setControlState('forward', true);
                while (bot.entity.position.distanceTo(standPos) > 1.2 && buildActive) {
                    await delay(20);
                }
            }
        }

        const plantCheckPos1 = new Vec3(currentX, targetY + 1, z1);
        const plantCheckPos2 = new Vec3(currentX, targetY + 1, z2);
        let plantBlock1 = bot.blockAt(plantCheckPos1, true);
        let plantBlock2 = bot.blockAt(plantCheckPos2, true);

        // เลน Z1
        const blockPos1 = new Vec3(currentX, targetY, z1);
        let blockState1 = bot.blockAt(blockPos1, true);
        if (blockState1 && (blockState1.name === 'dirt' || blockState1.name === 'grass_block')) {
            if (!plantBlock1 || (!plantBlock1.name.includes('stem') && plantBlock1.name !== 'pumpkin_seeds')) {
                // 🎯 บังคับกู้จอบกลับเข้ามือ Hotbar ทุกครั้งก่อนลงมือสับหน้าดิน
                const hoeReady = await pullHoeToHotbarSafely();
                if (hoeReady) {
                    try {
                        await bot.lookAt(blockPos1.plus(new Vec3(0.5, 0.5, 0.5)), true);
                        await bot.activateBlock(blockState1);
                        await delay(25);
                    } catch (e) {}
                }
            }
        }

        // เลน Z2
        const blockPos2 = new Vec3(currentX, targetY, z2);
        let blockState2 = bot.blockAt(blockPos2, true);
        if (blockState2 && (blockState2.name === 'dirt' || blockState2.name === 'grass_block')) {
            if (!plantBlock2 || (!plantBlock2.name.includes('stem') && plantBlock2.name !== 'pumpkin_seeds')) {
                // 🎯 บังคับกู้จอบกลับเข้ามือ Hotbar ทุกครั้งก่อนลงมือสับหน้าดิน
                const hoeReady = await pullHoeToHotbarSafely();
                if (hoeReady) {
                    try {
                        await bot.lookAt(blockPos2.plus(new Vec3(0.5, 0.5, 0.5)), true);
                        await bot.activateBlock(blockState2);
                        await delay(25);
                    } catch (e) {}
                }
            }
        }

        if (currentX === toX) break;
        currentX += stepX;
    }
    if (bot) bot.clearControlStates();
}

// 🌾 [DUAL PLANT ENGINE]: ปลูกเมล็ดคู่ขนานขากลับ
async function runDualPlantEngine(fromX, toX, targetY, z1, z2) {
    const stepX = fromX <= toX ? 1 : -1;
    let currentX = fromX;
    if (bot) bot.clearControlStates();

    while (buildActive) {
        await autoRefillSeedsFromInventory();
        if (getTotalSeedCount() <= 0 && getTotalPumpkinCount() <= 0) break;

        const standPos = new Vec3(currentX, targetY + 1, z1);
        if (bot && bot.entity) {
            const distance = bot.entity.position.distanceTo(standPos);
            if (distance > 0.8) {
                await bot.lookAt(standPos.offset(0.5, 0, 0.5), true);
                bot.setControlState('forward', true);
                while (bot.entity.position.distanceTo(standPos) > 1.2 && buildActive) {
                    await delay(20);
                }
            }
        }

        let hotbarSeedSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const item = bot.inventory.slots[36 + slot];
            if (item && item.name === 'pumpkin_seeds' && item.count > 0) { hotbarSeedSlot = slot; break; }
        }

        // ==================== เลน Z1 ====================
        const blockPos1 = new Vec3(currentX, targetY, z1);
        const topPos1 = new Vec3(currentX, targetY + 1, z1);
        let blockState1 = bot.blockAt(blockPos1, true);
        let topState1 = bot.blockAt(topPos1, true);

        if (topState1 && (topState1.name.includes('stem') || topState1.name === 'pumpkin_seeds')) {
            // มีเมล็ดแล้ว ข้าม
        } else {
            if (blockState1 && (blockState1.name === 'dirt' || blockState1.name === 'grass_block')) {
                // 🎯 ดักกู้จอบเข้าสล็อต Hotbar ชัวร์ ๆ
                const hoeReady = await pullHoeToHotbarSafely();
                if (hoeReady) {
                    await bot.lookAt(blockPos1.plus(new Vec3(0.5, 0.5, 0.5)), true);
                    await bot.activateBlock(blockState1); await delay(30);
                    blockState1 = bot.blockAt(blockPos1, true);
                }
            }
            if (blockState1 && blockState1.name === 'farmland') {
                try {
                    if (hotbarSeedSlot !== -1) bot.setQuickBarSlot(hotbarSeedSlot);
                    forceSneakLocked = true; if (bot) bot.setControlState('sneak', true);
                    await bot.lookAt(blockPos1.plus(new Vec3(0.5, 0.5, 0.5)), true);
                    await bot.placeBlock(blockState1, new Vec3(0, 1, 0));
                    await delay(35);
                } catch (err) {}
            }
        }

        // ==================== เลน Z2 ====================
        const blockPos2 = new Vec3(currentX, targetY, z2);
        const topPos2 = new Vec3(currentX, targetY + 1, z2);
        let blockState2 = bot.blockAt(blockPos2, true);
        let topState2 = bot.blockAt(topPos2, true);

        if (topState2 && (topState2.name.includes('stem') || topState2.name === 'pumpkin_seeds')) {
            // มีเมล็ดแล้ว ข้าม
        } else {
            if (blockState2 && (blockState2.name === 'dirt' || blockState2.name === 'grass_block')) {
                // 🎯 ดักกู้จอบเข้าสล็อต Hotbar ชัวร์ ๆ
                const hoeReady = await pullHoeToHotbarSafely();
                if (hoeReady) {
                    await bot.lookAt(blockPos2.plus(new Vec3(0.5, 0.5, 0.5)), true);
                    await bot.activateBlock(blockState2); await delay(30);
                    blockState2 = bot.blockAt(blockPos2, true);
                }
            }
            if (blockState2 && blockState2.name === 'farmland') {
                try {
                    if (hotbarSeedSlot !== -1) bot.setQuickBarSlot(hotbarSeedSlot);
                    forceSneakLocked = true; if (bot) bot.setControlState('sneak', true);
                    await bot.lookAt(blockPos2.plus(new Vec3(0.5, 0.5, 0.5)), true);
                    await bot.placeBlock(blockState2, new Vec3(0, 1, 0));
                    await delay(35);
                } catch (err) {}
            }
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
        buildActive = false; forceSneakLocked = false;
        if (bot) bot.clearControlStates();
        console.log('🛑 สั่งหยุดกระบวนการฟาร์มชั่วคราว!'); return;
    }
    if (input === 'tpa') {
        if (bot && bot.entity) bot.chat('/tpa DukDikauai'); return;
    }
    if (input === 'drop') {
        if (!bot || !bot.inventory) return;
        const currentHoe = bot.inventory.items().find(i => i.name.endsWith('_hoe'));
        if (currentHoe) {
            try {
                await bot.equip(currentHoe, 'hand'); await new Promise(r => setTimeout(r, 200));
                await bot.tossStack(currentHoe);
            } catch (err) {}
        }
        return;
    }
    if (input.startsWith('farm')) {
        await parseAndExecuteFarm(input);
    }
});