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
        console.log('🛰️ บอท ออนไลน์สำเร็จ!');
        console.log(`👉 พิมพ์ 'con' ใน Terminal เพื่อดึงประวัติมาปู Glowstone ต่อได้เลยครับพี่`);
    });

    bot.on('windowOpen', (window) => {});

    bot.on('physicsTick', () => {
        if (!bot || !bot.entity) return;
        if (buildActive) {
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

async function startGlowstonePlatformBuilder(startX, targetY, startZ, recoveryData = null) {
    buildActive = true;
    setupMovements(bot);

    const endX = -2638;
    const zOffsets = [0, 4, 7]; 

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
            if (getTotalGlowstoneCount() <= 0) {
                console.log(`❌ [⚡ STOP BUILDING]: บล็อก Glowstone หมดคลัง หยุดทำงานทันที`);
                clearProgress();
                buildActive = false;
                bot.clearControlStates();
                return;
            }

            let rawX = bot.entity.position.x;
            let rawY = bot.entity.position.y;
            let rawZ = bot.entity.position.z;
            let botFeetX = Math.round(rawX);
            let currentFloorX = Math.floor(rawX); 
            
            console.log(`🏃‍♂️ [MOTION LOG]: เท้าขยับอยู่ที่พิกัด -> X: ${rawX.toFixed(3)} | Y: ${rawY.toFixed(3)} | Z: ${rawZ.toFixed(3)}`);

            saveProgress(startX, targetY, startZ, botFeetX, zIdx);

            // พิกัดเป้าหมาย Glowstone เกิดลอยฟ้าที่ Y: 142 (targetY + 3 ช่องชั้นโลก)
            const dynamicCeilingY = targetY + 3;
            const targetPos = new Vec3(botFeetX, dynamicCeilingY, currentZ);
            
            // ⚡ [RAW PACKET INTERCEPTOR]: ยิงลั่นไกดิบระดับเบราวเซอร์ Socket ไม่ต้องรอ Raycast เบรกฝีเท้า
            if (currentFloorX !== lastPlacedBlockX) {
                let currentBlockState = bot.blockAt(targetPos, true);
                const isAlreadyPaved = currentBlockState && currentBlockState.name === 'glowstone';

                console.log(`  └─🎯 [TARGET CHECK]: เป้าหมายปูไฟ X: ${targetPos.x} | Y: ${targetPos.y} | Z: ${currentZ} | บล็อกปัจจุบันคือ: "${currentBlockState ? currentBlockState.name : 'null'}"`);

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
                await new Promise(res => setTimeout(res, 12)); // ความถี่สับเกียร์ขา 12ms รูดสปีดปรู๊ดปร๊าด
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

// 🎯 [🎯 OVERHAUL NET SOCKET DRIVER - ANTI-MISS CRITICAL]:
// เปลี่ยนมาใช้การยิงผ่านช่องทางระดับเน็ตเวิร์กแพ็คเกจโดยตรง บีบให้เซิร์ฟเวอร์ตอบรับและสร้างบล็อกงอกทันทีโดยบอทไม่ต้องชะงักฝีเท้า
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

        // ล็อกพิกัดคานดินเหนือหัวพิกัดทึบแท้จริง Y: 143 (targetY + 4 ช่องชั้น)
        const referencePos = new Vec3(targetPos.x, targetY + 4, targetPos.z);

        console.log(`    └─🧱 [PLACING ACTION]: ⚡ ยิงแพ็คเกจ Socket ดิ่งตรงเกาะคานดิน Y: ${referencePos.y}`);

        // 🔥 สั่งข้ามขั้นตอนของ Mineflayer ยิงช่องแพ็คเกจระดับเครือข่ายอัดตรงเข้าเซิร์ฟเวอร์
        // ทิศทางคว่ำลงล่างเสยใต้ท้องคานดิน (Direction 0 = Down) บล็อกงอกเรียงเม็ดต่อเนื่องไม่มีเว้นว่าง
        bot._client.write('block_place', {
            hand: 0,
            location: referencePos,
            direction: 0, 
            cursorX: 0.5,
            cursorY: 0.0,
            cursorZ: 0.5,
            insideBlock: false
        });

        // จำลองการขยับสวิงแขนอัดแอนตี้ชีทความเร็วสูง 10ms เคลียร์ท่อเน็ต
        await bot.swingArm('mainhand');
        await new Promise(resolve => setTimeout(resolve, 10)); 
    } catch (err) {}
}

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

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
        console.log('🛑 สั่งเบรกหยุดสายพานทำงานเรียบร้อยครับพี่');
        return;
    }
    if (input === 'con') {
        if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
        
        const savedData = loadProgress();
        if (savedData) {
            const currentGlow = getTotalGlowstoneCount();
            if (currentGlow <= 0) {
                console.log('⚠️ ไม่สามารถสืบงานต่อได้เนื่องจาก Glowstone ในตัวหมดคลังคครับพี่');
                clearProgress();
                return;
            }
            console.log(`🔄 [RECOVERY SYSTEM]: ตรวจพบไฟล์ประวัติเก่า รันงานต่อจากจุดล่าสุดทันที...`);
            await startGlowstonePlatformBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData);
        } else {
            console.log('⚠️ ไม่พบไฟล์ประวัติงานเก่าค้างในระบบเลยครับพี่ พิมพ์สั่ง build ใหม่ยาว ๆ ได้เลย');
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
            console.log('⚠️ รูปแบบพิกัดพิมพ์ผิดพี่! พิมพ์: build [startX] [Y] [startZ] [จำนวนรอบ]');
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

        console.log('\n🏆 [ALL ROUNDS COMPLETE]: บอทปูแนวไฟ Glowstone เสร็จสิ้นสมบูรณ์ครบทุกรอบแล้วครับพี่!');
        buildActive = false;
    }
});