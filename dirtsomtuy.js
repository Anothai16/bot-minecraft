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

// ตัวแปรพิกัดไฟล์ความจำเฉพาะตัวบอท
let progressFilePath = '';

// 💾 ฟังก์ชันบันทึกพิกัดลงไฟล์ TXT ประจำตัวบอท
function saveProgress(startX, targetY, startZ, currentX, forwardZ) {
    if (!progressFilePath) return;
    try {
        const data = `${startX},${targetY},${startZ},${currentX},${forwardZ ? 1 : 0}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

// 📖 ฟังก์ชันอ่านพิกัดจากไฟล์ TXT ประจำตัวบอท
function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [startX, targetY, startZ, currentX, forwardZStr] = data.split(',');
        return {
            startX: parseInt(startX),
            targetY: parseInt(targetY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX),
            forwardZ: parseInt(forwardZStr) === 1
        };
    } catch (e) {
        return null;
    }
}

// 🧹 ฟังก์ชันล้างประวัติเมื่อบอททำงานเสร็จสิ้นสมบูรณ์
function clearProgress() {
    try {
        if (progressFilePath && fs.existsSync(progressFilePath)) {
            fs.unlinkSync(progressFilePath);
        }
    } catch (e) {}
}

// ฟังก์ชันคำนวณดินทั้งหมดในตัวส่งกลับเป็นตัวเลข
function getTotalDirtCount() {
    if (!bot || !bot.inventory) return 0;
    const dirtTotal = bot.inventory.items()
        .filter(item => item.name === 'dirt' || item.name === 'grass_block' || item.name === 'coarse_dirt')
        .reduce((sum, item) => sum + item.count, 0);
    
    const held = bot.heldItem;
    const heldCount = (held && (held.name === 'dirt' || held.name === 'grass_block' || held.name === 'coarse_dirt')) ? held.count : 0;
    return dirtTotal + heldCount;
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com',
        username: 'dirtsomtuy',
        version: '1.21.11',
        viewDistance: 'tiny' // ⚡ จำกัดระยะสายตาบอทประชิดตัวเพื่อลด CPU คอมพี่ลงฮวบๆ
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
        console.log(`🛰️ บอท [${bot.username}] ออนไลน์สำเร็จ! แยกไฟล์เซฟแต้มไปที่: progress_${bot.username}.txt`);
    });

    let hasRecovered = false;
    bot.on('windowOpen', async (window) => {
        if (hasRecovered) return;
        hasRecovered = true;

        setTimeout(async () => {
            if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
            
            const savedData = loadProgress();
            if (savedData) {
                const currentDirt = getTotalDirtCount();
                if (currentDirt <= 0) {
                    clearProgress();
                    buildActive = false;
                    return;
                }
                await startCustomPlatformBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData);
            }
        }, 12000);
    });

    bot.on('physicsTick', () => {
        if (!bot || !bot.entity) return;
        if (buildActive && forceSneakLocked) {
            bot.setControlState('sneak', true);
            if (bot.controlState.forward) {
                bot.setControlState('sprint', false);
            }
        } else if (buildActive && !forceSneakLocked) {
            bot.setControlState('sneak', false);
        }
    });

    bot.on('death', () => {
        buildActive = false;
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    // 🎯 ดักจับรายละเอียดใบสั่งเตะจริงจากเซิร์ฟเวอร์มาโชว์ใน Log ไม่ให้โปรแกรมคราสดับ
    bot.on('kicked', (reason) => { 
        buildActive = false;
        let kickMessage = reason;
        try {
            if (typeof reason === 'object') {
                kickMessage = reason.text || JSON.stringify(reason);
            }
        } catch (e) {}
        console.log(`\n🚨🚨🚨 [⚠️ DETECTED KICK - ${bot.username}]: บอทโดนเซิร์ฟเวอร์เตะออก!!`);
        console.log(`📝 เหตุผลการโดนเตะจริงหน้างาน: "\x1b[31m${kickMessage}\x1b[0m"`);
    });
    
    bot.on('error', (err) => { 
        buildActive = false;
        console.log(`\n❌❌❌ [💥 SYSTEM ERROR]: ข้อผิดพลาดสัญญาณเครือข่าย Socket: ${err.code || err.message}`);
    });

    // 🎯 ระบบ Reconnect สุ่มเวลาตื่นระหว่าง 15-35 วินาที กระจายคิวเน็ตเวิร์กบ้านพี่ไม่ให้ชนหลุดหมู่
    bot.on('end', () => { 
        buildActive = false; 
        forceSneakLocked = false;
        if (bot) { try { bot.clearControlStates(); } catch(e){} }
        
        const randomReconnectDelay = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
        console.log(`🔌 การเชื่อมต่อสิ้นสุดลง [${bot.username}] กำลังเตรียมออโต้รีคอนเน็กเข้าใหม่ใน ${(randomReconnectDelay/1000).toFixed(1)} วินาที...`);
        
        setTimeout(startBot, randomReconnectDelay); 
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        if (message.startsWith('build')) {
            const args = message.split(' ');
            const startX = parseInt(args[1]);
            const startY = parseInt(args[2]);
            const startZ = parseInt(args[3]);
            if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
            clearProgress();
            await startCustomPlatformBuilder(startX, startY, startZ);
        }
    });
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

// 🧱 ฟังก์ชันหลักรันแปลนปูเต็มแผงทึบหนา 13 บล็อกงูเลื้อย (ไม่มีเว้นรู)
async function startCustomPlatformBuilder(startX, targetY, startZ, recoveryData = null) {
    buildActive = true;
    setupMovements(bot);

    const endX = -2638;
    const stepX = startX <= endX ? 1 : -1;
    
    let currentX = recoveryData ? recoveryData.currentX : startX;
    let forwardZ = recoveryData ? recoveryData.forwardZ : true;

    console.log(`\n================== [ 🚀เริ่มเดินสายพานปูดินเต็มแผงทึบความเร็วสูง บอท: ${bot.username} ] ==================`);

    let isFirstLine = true;
    const realWorldStartX = recoveryData ? recoveryData.startX : startX;

    while (buildActive && bot && bot.entity) {
        if (getTotalDirtCount() <= 0) {
            console.log(`❌ [⚡ STOP BUILDING]: ดินหมดคลัง เคลียร์งานหยุดเท้าทันที`);
            clearProgress();
            buildActive = false;
            break;
        }

        // 🎯 กลับมาปูเต็มแผงทึบ 13 บล็อกเหมือนเดิมเป๊ะๆ[cite: 1]
        let zQueue = [];
        for (let zOffset = 0; zOffset < 13; zOffset++) {
            zQueue.push(startZ + zOffset);
        }
        if (!forwardZ) zQueue.reverse();

        saveProgress(realWorldStartX, targetY, startZ, currentX, forwardZ);

        if (isFirstLine && !recoveryData) {
            currentX = startX - stepX;
            isFirstLine = false;
        }

        for (let currentZ of zQueue) {
            if (!buildActive || !bot || !bot.entity) break;

            const blockPos = new Vec3(currentX, targetY, currentZ);
            let currentBlockState = bot.blockAt(blockPos, true);
            const isAlreadyPaved = currentBlockState && (currentBlockState.name === 'dirt' || currentBlockState.name === 'grass_block' || currentBlockState.name === 'coarse_dirt' || currentBlockState.name === 'farmland');

            if (isAlreadyPaved) continue;

            if (bot && bot.entity) {
                const safePavedX = currentX - stepX;
                const safeGoalBlock = new Vec3(safePavedX, targetY + 1, currentZ);
                
                try { 
                    setupMovements(bot);
                    await bot.pathfinder.goto(new GoalBlock(safeGoalBlock.x, safeGoalBlock.y, safeGoalBlock.z));
                } catch(e) {}
            }

            if (bot) bot.clearControlStates();
            await placeFarmDirtHotbarOnly(blockPos, stepX, targetY + 1, currentZ);
        }

        if (currentX === endX) break;
        currentX += stepX;
        forwardZ = !forwardZ;
    }

    if (bot && bot.pathfinder) {
        try { bot.pathfinder.stop(); } catch(e) {}
        try { bot.clearControlStates(); } catch(e) {}
    }
    buildActive = false;
}

async function placeFarmDirtHotbarOnly(targetPos, stepX, standY, standZ) {
    if (!bot || !bot.entity) return;

    try {
        let checkBlock = bot.blockAt(targetPos, true);
        if (checkBlock && (checkBlock.name === 'dirt' || checkBlock.name === 'grass_block' || checkBlock.name === 'coarse_dirt')) return;

        const botEyePos = bot.entity.position.offset(0, bot.entity.height, 0);
        const blockCenter = targetPos.plus(new Vec3(0.5, 0.5, 0.5));
        const distance = botEyePos.distanceTo(blockCenter);
        if (distance > 4.3) return; // ล็อกระยะเอื้อมปลอดภัยกันสไลด์ตัวหลุดกรอบแปลง

        let hotbarDirtSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const itemInSlot = bot.inventory.slots[36 + slot];
            if (itemInSlot && (itemInSlot.name === 'dirt' || itemInSlot.name === 'grass_block' || itemInSlot.name === 'coarse_dirt')) {
                hotbarDirtSlot = slot;
                break;
            }
        }

        if (hotbarDirtSlot === -1) return;

        const scanFaces = [
            { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) },
            { offset: new Vec3(0, 1, 0), face: new Vec3(0, -1, 0) },
            { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },
            { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },
            { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },
            { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) }
        ];

        let referenceBlock = null;
        let placeFaceVector = null;

        for (const side of scanFaces) {
            const neighbor = bot.blockAt(targetPos.plus(side.offset));
            if (neighbor && neighbor.name !== 'air' && neighbor.name !== 'water' && neighbor.name !== 'lava') {
                referenceBlock = neighbor;
                placeFaceVector = side.face;
                break;
            }
        }

        if (!referenceBlock || referenceBlock.name === 'air') {
            referenceBlock = bot.blockAt(targetPos.offset(0, -1, 0));
            placeFaceVector = new Vec3(0, 1, 0);
        }

        if (!referenceBlock || referenceBlock.name === 'air') return;

        const distStr = distance.toFixed(2);
        console.log(`\x1b[35m[PLACE TRACKER - ${bot.username}]\x1b[0m พิกัด X: ${targetPos.x} Z: ${targetPos.z} | ระยะ: ${distStr} เมตร`);

        if (bot.quickBarSlot !== hotbarDirtSlot) {
            bot.setQuickBarSlot(hotbarDirtSlot);
            await new Promise(resolve => setTimeout(resolve, 45)); // 🎯 เพิ่มจังหวะหายใจเน็ตตอนสลับช่อง Hotbar
        }
        
        await bot.lookAt(targetPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
        await bot.activateBlock(referenceBlock, placeFaceVector);
        await new Promise(resolve => setTimeout(resolve, 120)); // 🎯 หน่วงเวลากัน Anti-Cheat ดักจับ Packet ถี่
    } catch (err) {
        console.log(`📡 [Network Packet Protected] ข้ามสัญญาณการวาง 1 บล็อกเพื่อป้องกันท่อดีเลย์กระตุก`);
    }
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
        return;
    }
    if (input === 'tpa') {
        if (bot && bot.entity) {
            console.log(`✍️ [Terminal Action] /tpa DukDikauai จากบอท ${bot.username}`);
            bot.chat('/tpa DukDikauai');
        }
        return;
    }
    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1]);
        const startY = parseInt(args[2]);
        const startZ = parseInt(args[3]);
        if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
        clearProgress();
        await startCustomPlatformBuilder(startX, startY, startZ);
    }
});