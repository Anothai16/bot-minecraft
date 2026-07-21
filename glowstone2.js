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
let progressFilePath = '';
// ตัวแปรคุมหน้ากล้อง Yaw ระหว่างทำงานรันเลน
let currentWorkingYaw = 0;

// ตัวล็อกความจำช่องบล็อกแกน X ล่าสุด เพื่อตรวจสอบการเคลื่อนที่ทีละช่อง
let lastPlacedBlockX = null; 

// 🛒 ตัวแปรล็อกสถานะระบบ Auto Shop
let isBuyingGlowstone = false;
let shopStep = 0; // ตัวแปรคุม State การเปิดร้านค้า (1 -> 2 -> 3)

// 🛡️ [ANTI-CRASH GLOBAL GUARD]: ดักจับ Error ป้องกันโปรแกรมบึ้มดับ
process.on('uncaughtException', (err) => {
    console.log(`⚠️ [NETWORK WARNING]: ตรวจพบสัญญาณเน็ตขัดข้อง (${err.code || err.message}) กำลังเตรียมเชื่อมต่อใหม่...`);
    buildActive = false;
    isBuyingGlowstone = false;
    shopStep = 0;
});

process.on('unhandledRejection', (reason, promise) => {});

function saveProgress(startX, targetY, startZ, currentX, currentZIdx) {
    if (!progressFilePath) return;
    try {
        const data = `${startX},${targetY},${startZ},${currentX},${currentZIdx}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [startX, targetY, startZ, currentX, currentZIdx] = data.split(',');
        return {
            startX: parseInt(startX),
            targetY: parseInt(targetY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX),
            currentZIdx: parseInt(currentZIdx)
        };
    } catch (e) { return null; }
}

function clearProgress() {
    try {
        if (progressFilePath && fs.existsSync(progressFilePath)) {
            fs.unlinkSync(progressFilePath);
        }
    } catch (e) {}
}

function getTotalGlowstoneCount() {
    if (!bot || !bot.inventory) return 0;
    const glowTotal = bot.inventory.items()
        .filter(item => item.name === 'glowstone')
        .reduce((sum, item) => sum + item.count, 0);
    
    const held = bot.heldItem;
    const heldCount = (held && held.name === 'glowstone') ? held.count : 0;
    return glowTotal + heldCount;
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com',
        username: 'Kaitom_1',
        version: '1.21.11',
        viewDistance: 'tiny' 
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
        progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
        console.log(`🛰️ บอท [${bot.username}] ออนไลน์สำเร็จ! Ready to work!`);
        console.log(`👉 พิมพ์ 'con' ใน Terminal เพื่อดึงประวัติมาปู Glowstone ต่อได้เลยครับ`);
    });

    // 🛒 [AUTO SHOP DRIVER]: ระบบสั่งซื้อ 3 ขั้นตอน (Totem -> Glowstone -> Slot 16)
    bot.on('windowOpen', async (window) => {
        if (!isBuyingGlowstone) return;

        // หน่วงเวลาให้ Server Sync GUI สมบูรณ์
        await new Promise(r => setTimeout(r, 600));
        if (!bot.currentWindow || bot.currentWindow.id !== window.id) return;

        // 📌 STEP 1: อยู่หน้าแรก /shop -> กดเลือกหมวดหมู่ Totem (สล็อต 2)
        if (shopStep === 1) {
            console.log(`🛒 [SHOP STEP 1]: อยู่หน้าแรก /shop ➔ กดเลือกหมวดหมู่ Totem (สล็อต 2)...`);
            shopStep = 2; 
            await bot.clickWindow(2, 0, 0);
            return;
        }

        // 📌 STEP 2: อยู่หน้าหมวด Gear -> กดเลือกไอคอน Glowstone (สล็อต 39)
        if (shopStep === 2) {
            console.log(`🛒 [SHOP STEP 2]: อยู่หน้าหมวด Gear ➔ กดเลือกไอคอน Glowstone (สล็อต 39)...`);
            shopStep = 3; 
            await bot.clickWindow(39, 0, 0);
            return;
        }

        // 📌 STEP 3: อยู่หน้าสั่งซื้อ -> กดสล็อต 16 ย้ำซื้อทีละ 64 ชิ้นจนเต็มตัว
        if (shopStep === 3) {
            console.log(`🛒 [SHOP STEP 3]: อยู่หน้าเลือกจำนวน ➔ สั่งกดซื้อ Glowstone ยก Stack (สล็อต 16)...`);
            
            for (let i = 0; i < 36; i++) {
                if (!bot.currentWindow) break;
                
                // เช็กกระเป๋าเต็ม
                if (bot.inventory.firstEmptyInventorySlot() === null) {
                    console.log(`🎒 [SHOP FULL]: ช่องกระเป๋าบอทอัดแน่นเต็มทุกช่องแล้ว!`);
                    break;
                }

                // คลิกซ้ายสล็อต 16 (ซื้อยก Stack)
                await bot.clickWindow(16, 0, 0);
                
                await new Promise(r => setTimeout(r, 500)); 
                console.log(` └─ 📦 กดซื้อสล็อต 16 (รอบที่ ${i + 1}) | จำนวนในตัวปัจจุบัน: ${getTotalGlowstoneCount()} ชิ้น`);
            }
            
            try { bot.closeWindow(window); } catch(e){}
            await new Promise(r => setTimeout(r, 800));
            
            isBuyingGlowstone = false;
            shopStep = 0;
            console.log(`✅ [SHOP COMPLETE]: สรุปยอด Glowstone ในตัวทั้งหมด: ${getTotalGlowstoneCount()} ชิ้น พร้อมลุยงานต่อ!`);
            return;
        }
    });

    bot.on('physicsTick', () => {
        if (!bot || !bot.entity) return;
        if (buildActive && !isBuyingGlowstone) {
            bot.entity.pitch = -1.57; // ล็อกคอมองฟ้าตรงดิ่ง 90 องศา ค้างแข็งแน่นหนากันเดินเป๋เลน
            bot.entity.yaw = currentWorkingYaw;
            
            if (forceSneakLocked) {
                bot.setControlState('sneak', true);
                if (bot.controlState.forward) bot.setControlState('sprint', false);
            }
        } else if (!forceSneakLocked) {
            bot.setControlState('sneak', false);
        }
    });

    bot.on('death', () => {
        buildActive = false;
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('kicked', (reason) => { buildActive = false; });
    bot.on('error', (err) => { buildActive = false; });

    bot.on('end', () => { 
        buildActive = false; 
        forceSneakLocked = false;
        if (bot) { try { bot.clearControlStates(); } catch(e){} }
        const randomReconnectDelay = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
        setTimeout(startBot, randomReconnectDelay); 
    });

    bot.on('chat', async (username, message) => { return; });
}

function setupMovements(botInstance) {
    const registry = botInstance.registry;
    const movements = new Movements(botInstance, registry);
    movements.allowSprinting = false; 
    movements.allowParkour = false;
    movements.canDig = true;
    movements.allow1by1towers = false;
    movements.maxDropDown = 1;
    movements.allowFreeMotion = false;
    botInstance.pathfinder.setMovements(movements);
}

// 🛍️ ฟังก์ชันสั่งวาร์ปเข้า /shop ซื้อของออโต้เมื่อของหมด
async function autoBuyGlowstone() {
    console.log(`\n🛒 [AUTO SHOP]: Glowstone หมดคลัง! สั่งเปิด /shop ซื้อเติมออโต้...`);
    if (bot) bot.clearControlStates();
    
    isBuyingGlowstone = true;
    shopStep = 1; // เริ่มต้นที่ Step 1 เสมอ
    
    await new Promise(r => setTimeout(r, 300));
    bot.chat('/shop');

    for (let wait = 0; wait < 80; wait++) {
        if (!isBuyingGlowstone && getTotalGlowstoneCount() > 0) {
            return true;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    isBuyingGlowstone = false;
    shopStep = 0;
    return getTotalGlowstoneCount() > 0;
}

async function startGlowstonePlatformBuilder(startX, targetY, startZ, recoveryData = null) {
    buildActive = true;
    setupMovements(bot);

    const endX = -2638;
    const zOffsets = [0, 4, 9]; 

    let currentZIdx = recoveryData ? recoveryData.currentZIdx : 0;
    let currentX = recoveryData ? recoveryData.currentX : startX;

    console.log(`\n================== [ 🚀เริ่มสายพานยิง GLOWSTONE โหมดสปีดเทอร์โบ บอท: ${bot.username} ] ==================`);

    for (let zIdx = currentZIdx; zIdx < zOffsets.length; zIdx++) {
        if (!buildActive || !bot || !bot.entity) break;

        let currentZ = startZ + zOffsets[zIdx];
        let lineStartX = (zIdx % 2 === 0) ? startX : endX;
        let lineEndX = (zIdx % 2 === 0) ? endX : startX;
        let stepX = lineStartX <= lineEndX ? 1 : -1;

        if (recoveryData && zIdx === currentZIdx) {
            currentX = recoveryData.currentX;
            recoveryData = null; 
        } else {
            currentX = lineStartX;
        }

        console.log(`🎬 [LINE START]: นำทางเข้าจุดสตาร์ทเลนแกน Z: ${currentZ}`);
        try {
            setupMovements(bot);
            await bot.pathfinder.goto(new GoalBlock(currentX, targetY, currentZ));
        } catch(e) {}

        bot.clearControlStates();
        currentWorkingYaw = (stepX === 1) ? -1.57 : 1.57;
        await bot.look(currentWorkingYaw, -1.57, true);
        await new Promise(res => setTimeout(res, 100));

        console.log(`🏎️ [SPEED RAIL DRIVE]: ล็อกเดินหน้าตรง รูดวิ่งปูไฟสปีดนรก...`);
        lastPlacedBlockX = null; 

        while (buildActive && bot && bot.entity) {
            
            // 🛒 ตรวจสอบเสบียง Glowstone ถ้าหมดสั่งเปิด /shop ซื้อออโต้ทันที!
            if (getTotalGlowstoneCount() <= 0) {
                const boughtSuccess = await autoBuyGlowstone();
                if (!boughtSuccess) {
                    console.log(`❌ [⚡ STOP BUILDING]: ซื้อ Glowstone ไม่สำเร็จ หรือเงินหมด หยุดทำงานครับ`);
                    clearProgress();
                    buildActive = false;
                    bot.clearControlStates();
                    return;
                }
            }

            let rawX = bot.entity.position.x;
            let rawY = bot.entity.position.y;
            let rawZ = bot.entity.position.z;
            let botFeetX = Math.round(rawX);
            let currentFloorX = Math.floor(rawX); 
            
            console.log(`🏃‍♂️ [MOTION LOG]: เท้าขยับอยู่ที่พิกัด -> X: ${rawX.toFixed(3)} | Y: ${rawY.toFixed(3)} | Z: ${rawZ.toFixed(3)}`);

            saveProgress(startX, targetY, startZ, botFeetX, zIdx);

            // พิกัดเป้าหมาย Glowstone (ใช้ลอจิกเดิมของคุณที่วางตรงตำแหน่ง)
            const dynamicCeilingY = targetY + 3;
            const targetPos = new Vec3(botFeetX, dynamicCeilingY, currentZ);
            
            if (currentFloorX !== lastPlacedBlockX) {
                let currentBlockState = bot.blockAt(targetPos, true);
                const isAlreadyPaved = currentBlockState && currentBlockState.name === 'glowstone';

                console.log(` └─🎯 [TARGET CHECK]: เป้าหมายปูไฟ X: ${targetPos.x} | Y: ${targetPos.y} | Z: ${currentZ} | บล็อกปัจจุบันคือ: "${currentBlockState ? currentBlockState.name : 'null'}"`);

                if (!isAlreadyPaved) {
                    await placeGlowstoneCeilingOnly(targetPos, targetY);
                    lastPlacedBlockX = currentFloorX; 
                }
            }

            let currentIntX = Math.round(rawX);
            let isEndOfLine = false;

            if (stepX === 1) {
                if (currentIntX === lineEndX || rawX >= -2637.7) isEndOfLine = true;
            } else {
                if (currentIntX === lineEndX || rawX <= -2719.3) isEndOfLine = true;
            }

            if (!isEndOfLine) {
                bot.setControlState('forward', true);
                await new Promise(res => setTimeout(res, 12)); 
            } else {
                bot.clearControlStates();
                console.log(`✅ [RAIL SUCCESS]: ตัวเลขปัดเศษล็อกเข้าล็อกเลี้ยวฉีกตัวหลบมุมเสร็จสิ้น จบเลน Z: ${currentZ}`);
                await new Promise(res => setTimeout(res, 200)); 
                break;
            }
        }
        bot.clearControlStates();
    }

    if (bot && bot.pathfinder) {
        try { bot.pathfinder.stop(); } catch(e) {}
        try { bot.clearControlStates(); } catch(e){}
    }
    buildActive = false;
}

// 🎯 [วางบล็อกตามลอจิกเดิมของคุณที่ตำแหน่ง Y แม่นยำ]:
async function placeGlowstoneCeilingOnly(targetPos, targetY) {
    if (!bot || !bot.entity || !bot._client) return;

    try {
        let hotbarGlowSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const itemInSlot = bot.inventory.slots[36 + slot];
            if (itemInSlot && itemInSlot.name === 'glowstone') {
                hotbarGlowSlot = slot;
                break;
            }
        }

        if (hotbarGlowSlot === -1) {
            let backupGlowItem = bot.inventory.items().find(item => item.name === 'glowstone' && item.slot >= 9 && item.slot <= 35);
            if (backupGlowItem) {
                try {
                    await bot.moveSlotItem(backupGlowItem.slot, 36);
                    await new Promise(resolve => setTimeout(resolve, 15)); 
                    hotbarGlowSlot = 0; 
                } catch (err) { return; }
            } else { return; }
        }

        if (hotbarGlowSlot === -1) return;

        if (bot.quickBarSlot !== hotbarGlowSlot) {
            bot.setQuickBarSlot(hotbarGlowSlot);
            await new Promise(resolve => setTimeout(resolve, 8)); 
        }

        const exactGlowstoneY = targetY + 4; 

        // เช็กบล็อกเหนือหัวว่ามีคานดินอยู่ไหม
        const topBlockPos = new Vec3(targetPos.x, exactGlowstoneY + 1, targetPos.z);
        const topBlock = bot.blockAt(topBlockPos);

        let referencePos;
        let placeDirection;

        if (topBlock && topBlock.name !== 'air' && topBlock.name !== 'water') {
            referencePos = topBlockPos;
            placeDirection = 0; // Down
            console.log(` └─🧱 [PLACING]: แปะใต้คานดิน Y: ${topBlockPos.y} -> วางลง Y: ${exactGlowstoneY}`);
        } else {
            referencePos = new Vec3(targetPos.x, exactGlowstoneY - 1, targetPos.z);
            placeDirection = 1; // Up
            console.log(` └─🧱 [PLACING]: ไม่มีคานดิน! เปลี่ยนไปวางตั้งบน Y: ${referencePos.y} -> วางขึ้น Y: ${exactGlowstoneY}`);
        }

        bot._client.write('block_place', {
            hand: 0,
            location: referencePos,
            direction: placeDirection, 
            cursorX: 0.5,
            cursorY: (placeDirection === 0) ? 0.0 : 1.0,
            cursorZ: 0.5,
            insideBlock: false
        });

        await bot.swingArm('mainhand');
        await new Promise(resolve => setTimeout(resolve, 10)); 
    } catch (err) {}
}

startBot();

const readline = require('readline');
const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
});

rl.on('error', (err) => {});

rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'c') {
        buildActive = false;
        forceSneakLocked = false;
        clearProgress();
        if (bot && bot.pathfinder) {
            try { bot.pathfinder.stop(); } catch(e) {}
            try { bot.clearControlStates(); } catch(e) {}
        }
        console.log('🛑 สั่งเบรกหยุดสายพานทำงานเรียบร้อยครับ');
        return;
    }
    if (input === 'con') {
        if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
        
        const savedData = loadProgress();
        if (savedData) {
            const currentGlow = getTotalGlowstoneCount();
            if (currentGlow <= 0) {
                console.log('⚠️ ไม่สามารถสืบงานต่อได้เนื่องจาก Glowstone ในตัวหมดคลังครับ');
                clearProgress();
                return;
            }
            console.log(`🔄 [RECOVERY SYSTEM]: ตรวจพบไฟล์ประวัติเก่า รันงานต่อจากจุดล่าสุดทันที...`);
            await startGlowstonePlatformBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData);
        } else {
            console.log('⚠️ ไม่พบไฟล์ประวัติงานเก่าค้างในระบบเลยครับ พิมพ์สั่ง build ใหม่ยาว ๆ ได้เลย');
        }
        return;
    }
    if (input === 'tpa') {
        if (bot && bot.entity) {
            console.log(`✍️ [Terminal Chat Action] /tpa DukDikauai`);
            bot.chat('/tpa DukDikauai');
        }
        return;
    }
    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1]);
        const startY = parseInt(args[2]);
        let startZ = parseInt(args[3]);
        
        let maxLoops = args[4] ? parseInt(args[4]) : 1;

        if (isNaN(startX) || isNaN(startY) || isNaN(startZ) || isNaN(maxLoops)) {
            console.log('⚠️ รูปแบบพิกัดพิมพ์ผิด! พิมพ์: build [startX] [Y] [startZ] [จำนวนรอบ]');
            return;
        }

        console.log(`\n⚙️ [AUTOMATION ACTIVE]: สั่งบอทเดินสายปูไฟ Glowstone ทั้งหมด [ ${maxLoops} รอบ ]`);
        clearProgress();

        for (let loopRound = 1; loopRound <= maxLoops; loopRound++) {
            console.log(`\n🎬 ==================== [ 📦 STARTING LIGHT SLICE: ${loopRound}/${maxLoops} ] ==================== 🎬`);
            console.log(`📍 จุดพิกัดแกนสตาร์ทแผงรอบนี้: X:${startX} Y:${startY} Z:${startZ}`);

            await startGlowstonePlatformBuilder(startX, startY, startZ);

            if (loopRound < maxLoops) {
                startZ += 13;
                console.log(`🔄 [AUTO TRANSFER]: ย้ายเป้าหมายขยับแกน Z+ เพิ่มขึ้น 13 บล็อก -> พิกัด Z สตาร์ทรอบถัดไป: ${startZ}`);
                await new Promise(res => setTimeout(res, 1500)); 
            }
        }

        console.log('\n🏆 [ALL ROUNDS COMPLETE]: บอทปูแนวไฟ Glowstone เสร็จสิ้นสมบูรณ์ครบทุกรอบแล้วครับ!');
        buildActive = false;
    }
});