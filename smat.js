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

const express = require('express');
const app = express();
const port = process.env.PORT || 8080;
app.get('/', (req, res) => res.send('Bot is running 24/7!'));
app.listen(port, () => console.log(`🌍 Health check listening on port ${port}`));

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
        username: 'Samatachai',
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

// 🧱 ฟังก์ชันหลักคุมขบวนสลับชุด ล็อกแกนเดินเท้าเลขคี่ตั้งแต่ชุดที่ 2 เป็นต้นไป
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

        // สมการคณิตศาสตร์ล็อกระยะฉากฟาร์มจริงชุดละ 4 บล็อกโลกจริง
        let currentBaseZ = startZ + ((round - 1) * 4);

        const zCandidate1 = currentBaseZ;      
        const zCandidate2 = currentBaseZ + 1;  

        let walkZ;         // แกน Z ที่เท้าบอทจะเหยียบเดินไปกลับตลอดทั้งชุด
        let parallelZ;     // แกน Z เลนคู่ขนานที่บอทจะเอื้อมมือสะบัดหน้าไปทำงานแทน

        // 🎯 [ปรับตามใบสั่งใหม่ของพี่เป๊ะๆ]: 
        // ชุดที่ 1 เดินตามพิกัดเริ่มต้นปกติ แต่ถ้าเป็นชุดที่ 2 และ 3 (หรือชุดต่อๆ ไป) บังคับเท้าล็อกเดินเฉพาะ "แกน Z เลขคี่" เสมอ!
        if (round === 1) {
            walkZ = zCandidate1;
            parallelZ = zCandidate2;
            console.log(`\n🎰 [ชุดที่ 1 / 3] -> เท้าล็อกเดินบนแกน Z: ${walkZ} | สะบัดหน้าทำงานแกน Z: ${parallelZ}`);
        } else {
            // ชุดที่ 2, 3, 4... บังคับใช้เงื่อนไขเดียวกันเลยคือ เท้าล็อกเดินบนแกน Z เลขคี่ เท่านั้น
            walkZ = (zCandidate1 % 2 !== 0) ? zCandidate1 : zCandidate2;
            parallelZ = (walkZ === zCandidate1) ? zCandidate2 : zCandidate1;
            console.log(`\n🎰 [ชุดที่ ${round} / 3 - โหมดเท้าล็อกแกน Z คี่ร่วม] -> ขาไปขากลับเดินบนแกน Z คี่: ${walkZ} | หันไปทำงานแกน Z คู่: ${parallelZ}`);
        }

        // ====================================================================
        // ⚡ [สเต็ปที่ 1]: สับสายพานพรวนดินความเร็วสูง (ไปกลับบนเลน walkZ ช่องเดียว)
        // ====================================================================
        console.log(`🚜 เริ่มสเต็ป 1: วิ่งสับพรวนดินเลนคู่ขนาน [เท้าล็อกเหยียบ Z: ${walkZ}]`);
        
        console.log(`🌱 พรวนดินเลนตัวเอง (ขาไป X) -> พรวนที่แนว Z: ${walkZ}`);
        await runTurboTillEngine(startX, targetEndX, targetY, walkZ, walkZ);
        
        if (!buildActive) break;

        console.log(`🌱 พรวนดินเลนคู่ขนาน (ขากลับ X) -> บอทเดินเลน Z:${walkZ} But หันไปพรวนแนว Z: ${parallelZ}`);
        await runTurboTillEngine(targetEndX, startX, targetY, walkZ, parallelZ);

        if (!buildActive) break;

        // ====================================================================
        // ⚡ [สเต็ปที่ 2]: สับเกียร์ย้อนศรกลับมา "ไล่ปักเมล็ดฟักทองเต็มเลนคู่"
        // ====================================================================
        if (getTotalSeedCount() > 0) {
            console.log(`\n🌾 เริ่มสเต็ป 2: วิ่งสับเกียร์ไล่ปลูกเมล็ดฟักทองเลนคู่ [เท้าล็อกเหยียบ Z: ${walkZ}]`);
            
            console.log(`เมล็ดปักเลนตัวเอง (ขาไป X) -> ปลูกที่แนว Z: ${walkZ}`);
            await runTurboPlantEngine(startX, targetEndX, targetY, walkZ, walkZ);
            
            if (!buildActive) break;

            console.log(`เมล็ดปักเลนคู่ขนาน (ขากลับ X) -> บอทเดินเลน Z:${walkZ} But หันไปปลูกแนว Z: ${parallelZ}`);
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
                console.log(`✅ [Refill Success] เติมเมล็ดฟักทองลง Hotbar เรียบร้อย! ลุยงานต่อครับพี่\n`);
            } catch (err) {
                console.log(`❌ ย้ายเมล็ดผิดพลาด: ${err.message}`);
            }
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
        if (hoePercent <= 1) {
            console.log(`⚠️ [🚨 HOE CRITICAL]: ความทนทานจอบวิกฤตต่ำกว่า 1% สั่งระงับตัวเครื่องเฟส 1 ด่วน!`);
            break;
        }

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

        if (currentX === toX) {
            if (bot) bot.clearControlStates();
            break;
        }
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
        if (getTotalSeedCount() <= 0) {
            console.log('🚨 [SEED EMPTY]: เมล็ดฟักทองหมดคลังคลังเบ็ดเสร็จ! ปิดระบบเฟส 2 ทันที');
            break;
        }

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
            console.log(`[RADAR DEBUGGER] พิกัดเดิน X:${currentX} Z:${walkZ} | บล็อกงานแกน Z:${workZ}: ${blockName} | ถืออยู่: ${heldItemName} | ระยะ: ${dist}ม.`);
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

        // ดักซ่อมดินดิบคืนสภาพบนแกนงาน (workZ)
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

        // จังหวะปักเมล็ดฟักทองลงล็อก Farmland บนแกนงาน (workZ)
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

        if (currentX === toX) {
            if (bot) bot.clearControlStates();
            break;
        }
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