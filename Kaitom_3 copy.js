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

// 💾 ฟังก์ชันบันทึกพิกัดลงไฟล์ TXT ประจำตัวบอท (ปรับปรุงให้จำแกน X งาน)
function saveProgress(startX, targetY, startZ, currentX) {
    if (!progressFilePath) return;
    try {
        const data = `${startX},${targetY},${startZ},${currentX}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

// 📖 ฟังก์ชันอ่านพิกัดจากไฟล์ TXT ประจำตัวบอท
function loadProgress() {
    if (!progressFilePath || !fs.existsSync(progressFilePath)) return null;
    try {
        const data = fs.readFileSync(progressFilePath, 'utf8').trim();
        if (!data) return null;
        const [startX, targetY, startZ, currentX] = data.split(',');
        return {
            startX: parseInt(startX),
            targetY: parseInt(targetY),
            startZ: parseInt(startZ),
            currentX: parseInt(currentX)
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
        username: 'Kaitom_3', // 🎯 เปลี่ยนชื่อบอทตามสั่งเรียบร้อยครับพี่
        version: '1.21.11',
        viewDistance: 'tiny'  // ⚡ จำกัดสายตาช่วยลด CPU คอมพี่ลงฮวบๆ
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
                await startCustomSlabBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData);
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
        // พิมพ์สั่งงานในแชทเกมเช่น: build -2714 103 14508
        if (message.startsWith('build')) {
            const args = message.split(' ');
            const startX = parseInt(args[1]);
            const startY = parseInt(args[2]);
            const startZ = parseInt(args[3]);
            if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
            clearProgress();
            await startCustomSlabBuilder(startX, startY, startZ);
        }
    });
}

function setupMovements(botInstance) {
    const registry = botInstance.registry;
    const movements = new Movements(botInstance, registry);
    movements.allowSprinting = false; 
    movements.allowParkour = false;
    movements.canDig = true; // 🎯 เปิดระบบให้บอทสามารถขุดบล็อกได้
    movements.allow1by1towers = false;
    movements.maxDropDown = 1;
    movements.allowFreeMotion = false;
    botInstance.pathfinder.setMovements(movements);
}

// 🧱 ฟังก์ชันหลักควบคุมงานทุบบล็อกก้าวละ 9 ช่องแกน X และวาง Slab ครึ่งล่างขนาบ Z
async function startCustomSlabBuilder(startX, targetY, startZ, recoveryData = null) {
    buildActive = true;
    setupMovements(bot);

    const endX = -2642; // ล็อกพิกัดสุดสายตามสั่งพี่เป๊ะ
    
    // คำนวณหาทิศทางก้าวเดินจริง (จาก -2714 ไป -2642 ค่าเพิ่มขึ้นทีละ 9 ช่อง)
    let currentX = recoveryData ? recoveryData.currentX : startX;
    
    // แกน Z ล็อกเลนวิ่งปลอดภัย = startZ + 2
    const walkZ = startZ + 2; 

    console.log(`\n================== [ 🚀 เริ่มกระบวนการสับเลนทุบปู Slab ทึบ บอท: ${bot.username} ] ==================`);
    console.log(`🎯 เลนเหยียบปลอดภัยแกน Z: ${walkZ} | พิกัดเป้าหมายทุบขนาบข้าง Z:${startZ} และ Z:${startZ + 5}`);

    while (buildActive && bot && bot.entity) {
        if (getTotalSlabCount() <= 0) {
            console.log(`❌ [⚡ STOP BUILDING]: หิน Slab หมดคลัง เคลียร์งานหยุดเท้าทันที`);
            clearProgress();
            buildActive = false;
            break;
        }

        saveProgress(startX, targetY, startZ, currentX);

        // 🎯 พิกัดงานทุบจุดซ้ายและขวาบนพิกัด X ปัจจุบัน
        const breakPos1 = new Vec3(currentX, targetY, startZ);       // จุดที่ 1 (เช่น 14508)
        const breakPos2 = new Vec3(currentX, targetY, startZ + 5);   // จุดที่ 2 (เช่น 14513)

        // 👣 เดินเท้าล็อกแกนเข้าพิกัดปลอดภัย (X ปัจจุบัน , Z ล็อกบวกสอง) ก่อนลงมือทุบ ป้องกันบอทยืนทับบล็อก!
        if (bot && bot.entity) {
            const safeGoalBlock = new Vec3(currentX, targetY + 1, walkZ);
            try {
                setupMovements(bot);
                await bot.pathfinder.goto(new GoalBlock(safeGoalBlock.x, safeGoalBlock.y, safeGoalBlock.z));
            } catch (e) {}
        }
        if (bot) bot.clearControlStates();

        // 🔨 ลงมือทำจุดที่ 1 (ทุบพิกัด startZ + วาง Slab)
        if (buildActive) {
            await breakAndPlaceSlab(breakPos1);
        }

        // 🔨 ลงมือทำจุดที่ 2 (ทุบพิกัด startZ + 5 + วาง Slab)
        if (buildActive) {
            await breakAndPlaceSlab(breakPos2);
        }

        // เช็คเงื่อนไขถ้าปูจนถึงจุดสิ้นสุดแกน X (-2642) ให้เคลียร์งานตัดระบบทันที
        if (currentX === endX) {
            console.log('🏆 [All Slab Completed] บอทปู Slab หลุมครึ่งบล็อคสุดพิกัดเรียบร้อยครับพี่!');
            clearProgress();
            break;
        }

        // 🎯 สั่งลดระยะ X ลงอีก 8 บล็อกและทำบล็อกที่ 9 (ก็คือบวกพิกัดเพิ่มขึ้นไปทีละ 9 ช่องในโลกจริงนั่นเองครับ)
        currentX += 9;
        
        // ดักกรณีถ้าคำนวณเลยพิกัดเป้าหมาย ให้กระโดดล็อกเท่าตัวจบหน้างานพอดี
        if (currentX > endX) currentX = endX;
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    if (bot && bot.pathfinder) {
        try { bot.pathfinder.stop(); } catch(e) {}
        try { bot.clearControlStates(); } catch(e) {}
    }
    buildActive = false;
}

// 🔨 ฟังก์ชันย่อยควบคุมการคว้าจอบ/ที่ขุดมาทุบบล็อก และวางหิน Slab ครึ่งบล็อคล่าง
async function breakAndPlaceSlab(targetPos) {
    if (!bot || !bot.entity) return;

    try {
        let block = bot.blockAt(targetPos);
        // ถ้าตรงนั้นเป็นหิน Slab เรียบร้อยแล้ว ข้ามงานได้เลย
        if (block && block.name === 'cobblestone_slab') return;

        // 🎯 1. ส่องสายตามองบล็อกให้ปิงนิ่งก่อนเริ่มงาน
        await bot.lookAt(targetPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
        await new Promise(res => setTimeout(res, 80));

        // 🔨 2. ขบวนการขุดทุบบล็อกทิ้ง
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
            
            // สั่งขุดบล็อก
            await bot.dig(block); 
            await new Promise(res => setTimeout(res, 150)); // ดีเลย์รอให้บล็อกแตกสลายจริง
        }

        // 📦 3. คัดแยกไอเทม Cobblestone Slab ใน Hotbar
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

        // 📐 4. ลอจิกอัจฉริยะ: สแกนหาบล็อกรอบตัว 6 ทิศเพื่อหาหน้าสัมผัสคลิกขวาแปะ Slab (ไม่ง้อข้างล่าง)
        const scanSides = [
            { offset: new Vec3(0, 0, 1), face: new Vec3(0, 0, -1) },  // ขอบด้าน Z+
            { offset: new Vec3(0, 0, -1), face: new Vec3(0, 0, 1) },  // ขอบด้าน Z-
            { offset: new Vec3(1, 0, 0), face: new Vec3(-1, 0, 0) },  // ขอบด้าน X+
            { offset: new Vec3(-1, 0, 0), face: new Vec3(1, 0, 0) },  // ขอบด้าน X-
            { offset: new Vec3(0, -1, 0), face: new Vec3(0, 1, 0) }   // ด้านล่าง (เผื่อมีบล็อก)
        ];

        let referenceBlock = null;
        let placeFaceVector = null;

        for (const side of scanSides) {
            const neighbor = bot.blockAt(targetPos.plus(side.offset));
            // ต้องเจอคู่ขนานที่เป็นบล็อกทึบ ไม่ใช่อากาศหรือน้ำ
            if (neighbor && neighbor.name !== 'air' && neighbor.name !== 'water' && neighbor.name !== 'lava') {
                referenceBlock = neighbor;
                placeFaceVector = side.face;
                break;
            }
        }

        // 🧱 5. ทำการคลิกขวาวาง Slab ลงตำแหน่งเป้าหมาย
        if (referenceBlock) {
            // เล็งพิกัดให้หัวบอทเฉียงลงพื้นค่อนไปทางครึ่งบล็อคล่าง (Y + 0.1) บล็อกจะฟิตลงครึ่งล่าง
            await bot.lookAt(targetPos.plus(new Vec3(0.5, 0.1, 0.5)), true); 
            
            forceSneakLocked = true;
            if (bot) bot.setControlState('sneak', true);

            // ยิงคำสั่งวางบล็อกใส่หน้าสัมผัสที่หาได้
            await bot.placeBlock(referenceBlock, placeFaceVector);
            await new Promise(resolve => setTimeout(resolve, 150)); 
            console.log(`✅ [SUCCESS] ทุบและปู Slab สำเร็จ ณ พิกัด X:${targetPos.x} Z:${targetPos.z}`);
        } else {
            console.log(`⚠️ ไม่พบตัวบล็อกอ้างอิงรอบ ๆ พิกัด X:${targetPos.x} Z:${targetPos.z} เลย! (หลุมอากาศ 360 องศา)`);
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
        if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) return;
        clearProgress();
        await startCustomSlabBuilder(startX, startY, startZ);
    }
});