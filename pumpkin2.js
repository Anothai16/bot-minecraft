const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');

// 🎯 เรียกใช้งานโมดูลล็อกอิน Amory ออโต้จากไฟล์ร่วม login.js
const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let buildActive = false;

// ตัวแปรสถานะควบคุมการย่องค้างระดับ Hardware System
let forceSneakLocked = false;

// พิกัดจุดเซฟความจำบอทป้องกันการเอ๋อ
const progressFilePath = path.join(__dirname, 'progress.txt');

// ฟังก์ชันหาค่าความถึกสูงสุดของจอบแต่ละประเภทในเกม Minecraft
function getMaxDurability(itemName) {
    if (itemName.startsWith('netherite_')) return 2031;
    if (itemName.startsWith('diamond_')) return 1561;
    if (itemName.startsWith('iron_')) return 250;
    if (itemName.startsWith('golden_')) return 32;
    if (itemName.startsWith('stone_')) return 131;
    return 59; 
}

// ฟังก์ชันคำนวณหาเปอร์เซ็นต์ความคงทนของจอบในตัวปัจจุบัน
function getHoeDurabilityPercent() {
    if (!bot || !bot.inventory) return 0;
    const hoe = bot.inventory.items().find(i => i.name.endsWith('_hoe'));
    if (!hoe) return 0;
    const maxDur = getMaxDurability(hoe.name);
    const usedDur = hoe.durabilityUsed || 0;
    return Math.max(0, Math.floor(((maxDur - usedDur) / maxDur) * 100));
}

// ฟังก์ชันเช็คจำนวนเมล็ดฟักทองทั้งหมดในตัวบอท (รวมทั้งตัว)
function getTotalSeedCount() {
    if (!bot || !bot.inventory) return 0;
    return bot.inventory.items()
        .filter(item => item.name === 'pumpkin_seeds')
        .reduce((sum, item) => sum + item.count, 0);
}

// 📊 ฟังก์ชันรายงานข้อมูลจอบและเมล็ดลง Terminal GUI
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
        username: 'Kaitom_4',
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

        if (message.startsWith('farm')) {
            await parseAndExecuteFarm(message);
        }
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

// 🧭 ฟังก์ชันวิเคราะห์อาร์กิวเมนต์ คาดเดาระบบกริดคี่คู่จากพิกัด Z เริ่มต้นอัตโนมัติ
async function parseAndExecuteFarm(inputStr) {
    const args = inputStr.split(' ');
    let startX = parseInt(args[1]);
    const startY = parseInt(args[2]);
    const startZ = parseInt(args[3]);

    if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
    if (startX === -2718) startX = -2719;

    let config = {
        selectSet: null,
        round2Mode: 'koo', // ค่าเริ่มต้นชั่วคราว
        round3Mode: 'kee'  // ค่าเริ่มต้นชั่วคราว
    };

    // 🎯 [หัวใจหลัก]: เช็คว่าพิกัด Z ที่ส่งมาเป็นเลขคี่หรือเลขคู่
    const isStartZOdd = (startZ % 2 !== 0);

    if (isStartZOdd) {
        // Z เริ่มต้นเป็นเลขคี่ (เช่น 14543) -> ชุด 2 วิ่งคู่ / ชุด 3 วิ่งคี่
        config.round2Mode = 'koo';
        config.round3Mode = 'kee';
    } else {
        // Z เริ่มต้นเป็นเลขคู่ (เช่น 14556) -> ชุด 2 วิ่งคี่ / ชุด 3 วิ่งคู่
        config.round2Mode = 'kee';
        config.round3Mode = 'koo';
    }

    // ดักจับเคสการสั่งแยกชุดเดี่ยวๆ เช่น farm -2718 63 14556 2 หรือ farm -2718 63 14543 3
    if (args[4] && !isNaN(parseInt(args[4]))) {
        config.selectSet = parseInt(args[4]);
    }

    if (bot) {
        await startCustomPlatformBuilder(startX, startY, startZ, config);
    }
}

// 🧱 ฟังก์ชันหลักคุมขบวนสลับชุด รันแปลงล็อกแกน Z อัตโนมัติตามสเต็ปคำนวณพิกัด
async function startCustomPlatformBuilder(startX, targetY, startZ, config) {
    buildActive = true;
    setupMovements(bot);

    const targetEndX = -2638;
    
    let startRound = config.selectSet ? config.selectSet : 1;
    let endRound = config.selectSet ? config.selectSet : 3;

    console.log(`\n============================ [ ระบบออโต้ล็อกเลนฟาร์มความเร็วสูง ] ============================`);
    console.log(`📊 ตรวจพบพิกัด Z ตั้งต้น: ${startZ} (${startZ % 2 !== 0 ? 'เลขคี่' : 'เลขคู่'})`);
    console.log(`🤖 แผนการวิ่งอัตโนมัติ -> ชุดที่ 2 ล็อกแกน: [${config.round2Mode.toUpperCase()}] | ชุดที่ 3 ล็อกแกน: [${config.round3Mode.toUpperCase()}]`);

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
            // ชุดที่ 1: เดินแนวเริ่มต้นปกติ
            walkZ = zCandidate1;
            parallelZ = zCandidate2;
            console.log(`\n🎰 [ชุดที่ 1 / 3] -> เท้าล็อกเดินบนแกน Z: ${walkZ} | สะบัดหน้าทำงานแกน Z: ${parallelZ}`);
        } 
        else if (round === 2) {
            // ทำงานตามโหมดที่ Auto-Detect ได้ของชุดที่ 2
            if (config.round2Mode === 'koo') {
                walkZ = (zCandidate1 % 2 === 0) ? zCandidate1 : zCandidate2;
            } else {
                walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            }
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
            console.log(`\n🎰 [ชุดที่ 2 / 3 - ระบบเลือก Z ${config.round2Mode.toUpperCase()}] -> เดินบน Z: ${walkZ} | ทำงานแนว Z: ${parallelZ}`);
        } 
        else if (round === 3) {
            // ทำงานตามโหมดที่ Auto-Detect ได้ของชุดที่ 3
            if (config.round3Mode === 'koo') {
                walkZ = (zCandidate1 % 2 === 0) ? zCandidate1 : zCandidate2;
            } else {
                walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            }
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
            console.log(`\n🎰 [ชุดที่ 3 / 3 - ระบบเลือก Z ${config.round3Mode.toUpperCase()}] -> เดินบน Z: ${walkZ} | ทำงานแนว Z: ${parallelZ}`);
        }

        // ====================================================================
        // ⚡ [สเต็ปที่ 1]: สับสายพานพรวนดินความเร็วสูง (ไปกลับบนเลน walkZ ช่องเดียว)
        // ====================================================================
        console.log(`🚜 เริ่มสเต็ป 1: วิ่งสับพรวนดินเลนคู่ขนาน [เท้าล็อกเหยียบ Z: ${walkZ}]`);
        await runTurboTillEngine(startX, targetEndX, targetY, walkZ, walkZ);
        
        if (!buildActive) break;

        await runTurboTillEngine(targetEndX, startX, targetY, walkZ, parallelZ);

        if (!buildActive) break;

        // ====================================================================
        // ⚡ [สเต็ปที่ 2]: สับเกียร์ย้อนศรกลับมา "ไล่ปักเมล็ดฟักทองเต็มเลนคู่"
        // ====================================================================
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

    console.log(`\n🏆 [All Job Completed] ภารกิจฟาร์มล็อกแกนเท้า Auto-Z Detection เสร็จสมบูรณ์เรียบร้อยครับพี่!`);
    buildActive = false;
}

// 📦 ฟังก์ชันโอนย้ายเมล็ดฟักทองจาก Inventory ข้างบน ลงมาเติมแถว Hotbar ล่างออโต้
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
            console.log(`\n📦 [คลังสแกนเจอเมล็ดค้างกระเป๋า]: ตรวจพบเมล็ดฟักทองช่องที่ ${backupItem.slot} สั่งหยุดเท้าเติมของลง Hotbar ด่วน...`);
            bot.clearControlStates();
            await new Promise(res => setTimeout(res, 150));

            try {
                await bot.moveSlotItem(backupItem.slot, 36); 
                await new Promise(res => setTimeout(res, 350)); 
            } catch (err) {}
        }
    }
}

// ⚡ ENGINE เฟส 1: วิ่งตรงพรวนดินความเร็วสูง (เท้าล็อกอยู่แกน walkZ แขนเอื้อมไปสับแกน workZ)
async function runTurboTillEngine(fromX, toX, targetY, walkZ, workZ) {
    const stepX = fromX <= toX ? 1 : -1;
    let currentX = fromX;

    if (bot) bot.clearControlStates();

    while (buildActive) {
        const hoePercent = getHoeDurabilityPercent();
        if (hoePercent <= 1) break;

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

// ⚡ ENGINE เฟส 2: วิ่งตรงไล่ปักเมล็ดความเร็วสูง (เท้าล็อกอยู่แกน walkZ แขนสะบัดไปปลูกแกน workZ)
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
        const blockName = currentBlockState ? currentBlockState.name : 'null';

        if (bot && bot.entity) {
            const botEyePos = bot.entity.position.offset(0, bot.entity.height, 0);
            const dist = botEyePos.distanceTo(blockPos.plus(new Vec3(0.5, 0.5, 0.5))).toFixed(2);
            const heldItemName = bot.heldItem ? `${bot.heldItem.name} (${bot.heldItem.count} เมล็ด)` : 'empty-hand';
            console.log(`[RADAR DEBUGGER] พิกัดเดิน X:${currentX} Z:${walkZ} | บล็อกงานแกน Z:${workZ}: ${blockName} | ระยะ: ${dist}ม.`);
        }

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

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    
    if (input === 'tpa') {
        if (bot && bot.entity) {
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
        await parseAndExecuteFarm(input);
    }
});