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
function saveProgress(startX, targetY, startZ, currentX, currentRound, totalRounds) {
    if (!progressFilePath) return;
    try {
        const data = `${startX},${targetY},${startZ},${currentX},${currentRound},${totalRounds}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

// 📖 ฟังก์ชันอ่านพิกัดจากไฟล์ TXT ประจำตัวบอท
function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [startX, targetY, startZ, currentX, currentRound, totalRounds] = data.split(',');
        return {
            startX: parseInt(startX),
            targetY: parseInt(targetY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX),
            currentRound: parseInt(currentRound || 1),
            totalRounds: parseInt(totalRounds || 1)
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

// ฟังก์ชันเช็คจำนวน Slab ในตัวทั้งหมด
function getTotalSlabCount() {
    if (!bot || !bot.inventory) return 0;
    const slabTotal = bot.inventory.items()
        .filter(item => item.name === 'cobblestone_slab')
        .reduce((sum, item) => sum + item.count, 0);
    
    const held = bot.heldItem;
    const heldCount = (held && held.name === 'cobblestone_slab') ? held.count : 0;
    return slabTotal + heldCount;
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com',
        username: 'Kaitom_3', 
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
                const currentSlabs = getTotalSlabCount();
                if (currentSlabs <= 0) {
                    clearProgress();
                    buildActive = false;
                    return;
                }
                await startMultiRoundSlabBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData.totalRounds, savedData);
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

    bot.on('kicked', (reason) => { 
        buildActive = false;
        let kickMessage = reason;
        try { if (typeof reason === 'object') kickMessage = reason.text || JSON.stringify(reason); } catch (e) {}
        console.log(`\n🚨🚨🚨 [⚠️ DETECTED KICK - ${bot.username}]: บอทโดนเตะออก!! เหตุผล: "${kickMessage}"`);
    });
    
    bot.on('error', (err) => { 
        buildActive = false;
        console.log(`\n❌❌❌ [💥 SYSTEM ERROR]: สัญญาณ Socket ขัดข้อง: ${err.code || err.message}`);
    });

    bot.on('end', () => { 
        buildActive = false; 
        forceSneakLocked = false;
        const randomReconnectDelay = Math.floor(Math.random() * (35000 - 15000 + 1)) + 15000;
        console.log(`🔌 สายหลุด... [${bot.username}] กำลังเตรียมออโต้รีคอนเน็กใน ${(randomReconnectDelay/1000).toFixed(1)} วินาที...`);
        setTimeout(startBot, randomReconnectDelay); 
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        // พิมพ์สั่งงานในแชทเกม เช่น: build -2715 103 14508 2
        if (message.startsWith('build')) {
            const args = message.split(' ');
            const startX = parseInt(args[1]);
            const startY = parseInt(args[2]);
            const startZ = parseInt(args[3]);
            const totalRounds = args[4] ? parseInt(args[4]) : 1; // ดักรับจำนวนรอบ (ถ้าไม่มีระบุจะเป็น 1 รอบ)
            
            if (isNaN(startX) || isNaN(startY) || isNaN(startZ) || isNaN(totalRounds)) return;
            clearProgress();
            await startMultiRoundSlabBuilder(startX, startY, startZ, totalRounds);
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

// 🧱 ฟังก์ชันหลักวนลูปมัลติรอบ (Multi-Round Hub)
async function startMultiRoundSlabBuilder(startX, targetY, startZ, totalRounds, recoveryData = null) {
    buildActive = true;
    setupMovements(bot);

    let currentRound = recoveryData ? recoveryData.currentRound : 1;
    
    // ลูปใหญ่สำหรับคุมชุดเลนขยับขึ้นทีละ 13 บล็อก
    for (let r = currentRound; r <= totalRounds; r++) {
        if (!buildActive) break;

        // คำนวณแกน Z เริ่มต้นประจำรอบนั้น ๆ (รอบแรก = สั่งตรง, รอบต่อมา = บวกสะสมทีละ 13)
        let activeRoundStartZ = startZ + ((r - 1) * 13);
        let activeStartX = (recoveryData && r === currentRound) ? recoveryData.currentX : startX;

        console.log(`\n🎰 ==================== [ 🎮 ROUND ${r} / ${totalRounds} ] ==================== 🎰`);
        console.log(`📐 พิกัดฐานงานรอบนี้ -> Z เริ่มต้น: ${activeRoundStartZ}`);

        // เรียกเอนจิ้นลุยงานขุดปูเลนขยับ X
        const success = await executeSingleLineBuilder(startX, activeStartX, targetY, activeRoundStartZ, r, totalRounds);
        
        if (!success || !buildActive) break;

        console.log(`🎉 จบรอบที่ ${r} สำเร็จถล่มทลาย!`);
        if (r < totalRounds) {
            console.log(`🛰️ กำลังปรับแท่นขยับแกน Z เตรียมขึ้นลูปก้าวถัดไป...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    if (buildActive) {
        console.log('\n🏆 [Mission Complete] สำเร็จภารกิจก่อสร้างหลุม Slab ทุกรอบคิวเรียบร้อยครับพี่!');
        clearProgress();
    }
    buildActive = false;
}

// 🚜 ENGINE วิ่งเจาะขุดทุบในหนึ่งแถวแกน X (ฉบับแก้ลอจิกล็อกตายตัวห้ามวางเบิ้ล -2641)
async function executeSingleLineBuilder(baseStartX, currentX, targetY, roundStartZ, currentRound, totalRounds) {
    const endX = -2642; 
    const walkZ = roundStartZ + 2; 

    while (buildActive && bot && bot.entity) {
        if (getTotalSlabCount() <= 0) {
            console.log(`❌ [⚡ STOP BUILDING]: หิน Slab หมดคลัง ระงับตัวเครื่องเฟสงานทันที`);
            clearProgress();
            buildActive = false;
            return false;
        }

        // 🎯 [จุดแก้ไขที่ 1]: ดักตรวจตั้งแต่หัวลูปเลย ถ้าค่า X ปัจจุบันมันวิ่งมาถึงหรือเกินเป้าหมายสุดท้าย (-2642) แล้ว 
        // แปลว่ารอบที่แล้วเราปูบล็อกสุดท้ายเสร็จเรียบร้อยแล้ว ให้ดีดตัวออกไปขึ้น ROUND ถัดไปทันที ห้ามรันลูปซ้ำ!
        if (currentX >= endX) {
            console.log(`🏁 [LINE DONE] ปูถึงพิกัดสุดท้าย ${currentX} แล้ว สั่งตัดจบเลนป้องกันหินงอกครับพี่`);
            return true;
        }

        // เซฟประวัติความจำกันไฟตก
        saveProgress(baseStartX, targetY, roundStartZ - ((currentRound - 1) * 13), currentX, currentRound, totalRounds);

        const breakPos1 = new Vec3(currentX, targetY, roundStartZ);       
        const breakPos2 = new Vec3(currentX, targetY, roundStartZ + 5);   

        // เดินเท้าล็อกเข้าเลนปลอดภัย
        if (bot && bot.entity) {
            const safeGoalBlock = new Vec3(currentX, targetY + 1, walkZ);
            try {
                setupMovements(bot);
                await bot.pathfinder.goto(new GoalBlock(safeGoalBlock.x, safeGoalBlock.y, safeGoalBlock.z));
            } catch (e) {}
        }
        if (bot) bot.clearControlStates();

        // 🔨 ลงมือทำจุดขนาบ Z ซ้าย-ขวา
        if (buildActive) await breakAndPlaceSlab(breakPos1);
        if (buildActive) await breakAndPlaceSlab(breakPos2);

        // 🎯 [จุดแก้ไขที่ 2]: เช็คหลังวางเสร็จสดๆ ร้อนๆ อีกชั้น ถ้าเท่ากับตัวจบ ให้ return true จบลูปทันที ไม่ต้องบวกเลขเพิ่มด้านล่าง
        if (currentX === endX) {
            return true;
        }

        // ขยับเพิ่มระยะก้าวไปจุดถัดไปทีละ 9 ช่อง
        currentX += 9;
        
        // ทิศทางลบ ยิ่งน้อยค่ายิ่งมาก (เช่น -2633 > -2642) ถ้าเกินเป้าหมายให้ดึงกลับมาล็อกที่ตัวจบพอดี
        if (currentX > endX) {
            currentX = endX;
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    return false;
}

// 🔨 ฟังก์ชันย่อยควบคุมการคว้าที่ขุดมาทุบบล็อก และวางหิน Slab ครึ่งบล็อคล่างเกาะขอบข้าง
async function breakAndPlaceSlab(targetPos) {
    if (!bot || !bot.entity) return;

    try {
        let block = bot.blockAt(targetPos);
        if (block && block.name === 'cobblestone_slab') return;

        await bot.lookAt(targetPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
        await new Promise(res => setTimeout(res, 80));

        // 🔨 ขุดทุบบล็อกทิ้ง
        if (block && block.name !== 'air') {
            const currentMovements = bot.pathfinder.movements;
            let tool = null;
            
            if (currentMovements && typeof currentMovements.bestHarvestTool === 'function') {
                tool = currentMovements.bestHarvestTool(block);
            }
            if (!tool) {
                tool = bot.inventory.items().find(item => item.name.endsWith('pickaxe'));
            }
            if (tool) {
                await bot.equip(tool, 'hand');
                await new Promise(res => setTimeout(res, 50));
            }
            
            await bot.dig(block); 
            await new Promise(res => setTimeout(res, 150)); 
        }

        // 📦 คัดแยกไอเทม Cobblestone Slab ใน Hotbar
        let hotbarSlabSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const item = bot.inventory.slots[36 + slot];
            if (item && item.name.includes('slab')) { 
                hotbarSlabSlot = slot;
                break;
            }
        }

        if (hotbarSlabSlot === -1) {
            console.log(`❌ ไม่มีหิน Slab ใน Hotbar! ข้ามพิกัด X:${targetPos.x} Z:${targetPos.z}`);
            return; 
        }

        if (bot.quickBarSlot !== hotbarSlabSlot) {
            bot.setQuickBarSlot(hotbarSlabSlot);
            await new Promise(resolve => setTimeout(resolve, 60));
        }

        // 📐 ลอจิกสแกนหาบล็อกรอบตัว 5 ทิศเพื่อหาหน้าสัมผัสคลิกขวาแปะ Slab ลอยฟ้า
        const scanSides = [
            { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) },  
            { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },  
            { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },  
            { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },  
            { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) }   
        ];

        let referenceBlock = null;
        let placeFaceVector = null;

        for (const side of scanSides) {
            const checkPos = targetPos.plus(side.offset);
            
            // 🎯 [จุดแก้ไขล็อกเป้า]: ถ้าพิกัดบล็อกข้างเคียงตัวไหนมันเกินล้ำไปที่ X > -2642 (เช่น -2641) ให้สั่งข้ามทันที ห้ามเอามาอ้างอิง!
            if (checkPos.x > -2642) {
                continue;
            }

            const neighbor = bot.blockAt(checkPos);
            if (neighbor && neighbor.name !== 'air' && neighbor.name !== 'water' && neighbor.name !== 'lava') {
                referenceBlock = neighbor;
                placeFaceVector = side.face;
                break;
            }
        }

        // 🧱 ทำการคลิกขวาวาง Slab ลงตำแหน่งเป้าหมาย
        if (referenceBlock) {
            await bot.lookAt(targetPos.plus(new Vec3(0.5, 0.1, 0.5)), true); 
            
            forceSneakLocked = true;
            if (bot) bot.setControlState('sneak', true);

            await bot.placeBlock(referenceBlock, placeFaceVector);
            await new Promise(resolve => setTimeout(resolve, 150)); 
            console.log(`✅ [SUCCESS] ทุบและปู Slab สำเร็จ ณ พิกัด X:${targetPos.x} Z:${targetPos.z}`);
        } else {
            console.log(`⚠️ ไม่พบตัวบล็อกอ้างอิงรอบ ๆ พิกัด X:${targetPos.x} Z:${targetPos.z} เลย!`);
        }

    } catch (err) {
        console.log(`📡 [Slab Debug] บั๊กขัดข้องจริง: ${err.message}`);
    } finally {
        forceSneakLocked = false;
        if (bot) bot.setControlState('sneak', false);
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
            bot.chat('/tpa DukDikauai');
        }
        return;
    }
    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1]);
        const startY = parseInt(args[2]);
        const startZ = parseInt(args[3]);
        const totalRounds = args[4] ? parseInt(args[4]) : 1;
        if (isNaN(startX) || isNaN(startY) || isNaN(startZ) || isNaN(totalRounds)) return;
        clearProgress();
        await startMultiRoundSlabBuilder(startX, startY, startZ, totalRounds);
    }
});