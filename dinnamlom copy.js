const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');
const fs = require('fs');
const path = require('path');
const { setupAmoryLogin } = require('./login');

let bot;
let buildActive = false;
let progressFilePath = '';

function saveProgress(startX, targetY, startZ, currentX, forwardZ) {
    if (!progressFilePath) return;
    try {
        const data = `${startX},${targetY},${startZ},${currentX},${forwardZ ? 1 : 0}`;
        fs.writeFileSync(progressFilePath, data, 'utf8');
    } catch (e) {}
}

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
    } catch (e) { return null; }
}

function clearProgress() {
    try { if (progressFilePath && fs.existsSync(progressFilePath)) fs.unlinkSync(progressFilePath); } catch (e) {}
}

function getTotalDirtCount() {
    if (!bot || !bot.inventory) return 0;
    const dirtTotal = bot.inventory.items()
        .filter(item => item.name === 'dirt' || item.name === 'grass_block' || item.name === 'coarse_dirt')
        .reduce((sum, item) => sum + item.count, 0);
    const held = bot.heldItem;
    const heldCount = (held && (held.name === 'dirt' || held.name === 'grass_block' || held.name === 'coarse_dirt')) ? held.count : 0;
    return dirtTotal + heldCount;
}

async function autoRefillDirtFromInventory() {
    if (!bot || !bot.inventory) return;

    let hasDirtInHotbar = false;
    for (let slot = 0; slot < 9; slot++) {
        const item = bot.inventory.slots[36 + slot];
        if (item && (item.name === 'dirt' || item.name === 'grass_block' || item.name === 'coarse_dirt') && item.count > 0) {
            hasDirtInHotbar = true;
            break;
        }
    }

    if (!hasDirtInHotbar) {
        const backupDirt = bot.inventory.items().find(item => 
            (item.name === 'dirt' || item.name === 'grass_block' || item.name === 'coarse_dirt') && 
            item.slot >= 9 && item.slot <= 35
        );
        
        if (backupDirt) {
            console.log(`📦 ดินใน Hotbar หมด ดึงดินช่องที่ ${backupDirt.slot} เติมลงช่องแรก...`);
            bot.clearControlStates();
            await new Promise(res => setTimeout(res, 50));

            try {
                await bot.moveSlotItem(backupDirt.slot, 36); 
                await new Promise(res => setTimeout(res, 150)); 
            } catch (err) {}
        }
    }
}

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com',
        username: 'dinnamlom',
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
        console.log(`🛰️ บอท [${bot.username}] ออนไลน์สำเร็จ!`);
        console.log(`👉 พิมพ์ 'build พิกัด' หรือ 'tpa' ใน Terminal ด้านล่างได้เลยครับพี่`);
    });

    let hasRecovered = false;
    bot.on('windowOpen', async (window) => {
        if (hasRecovered) return;
        hasRecovered = true;
        setTimeout(async () => {
            if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
            const savedData = loadProgress();
            if (savedData && getTotalDirtCount() > 0) {
                console.log('🔄 [AUTO RECOVERY]: ตรวจพบจังหวะหลุดออโต้ สั่งรันต่อจากไฟล์เซฟความจำเดิมทันที...');
                await startCustomPlatformBuilder(savedData.startX, savedData.targetY, savedData.startZ, savedData);
            }
        }, 12000);
    });

    bot.on('death', () => {
        buildActive = false;
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('kicked', (reason) => { 
        buildActive = false;
        console.log(`\n🚨 บอทโดนเซิร์ฟเวอร์เตะออก!!`);
    });
    
    bot.on('error', (err) => { buildActive = false; });

    bot.on('end', () => { 
        buildActive = false; 
        const randomReconnectDelay = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
        setTimeout(startBot, randomReconnectDelay); 
    });
}

async function startCustomPlatformBuilder(startX, targetY, startZ, recoveryData = null) {
    buildActive = true;
    
    const endX = -2637;
    const stepX = startX <= endX ? 1 : -1;
    let currentX = recoveryData ? recoveryData.currentX : startX;
    
    let forwardZ = true;
    if (recoveryData) {
        const distToStartSide = Math.abs(bot.entity.position.z - startZ);
        const distToEndSide = Math.abs(bot.entity.position.z - (startZ + 64));
        if (distToEndSide < distToStartSide) {
            forwardZ = false;
        }
    } else if (recoveryData) {
        forwardZ = recoveryData.forwardZ;
    }

    console.log(`\n⚡⚡⚡ [ ENGINE MODE: HYPERSPEED ZERO-TURN PACKET ENGINE ] ⚡⚡⚡`);
    if (recoveryData) {
        console.log(`🎯 [RESUME ACTIVE]: ทำงานต่อจาก X:${currentX} | ทิศทางเลื้อย Z: ${forwardZ ? 'วิ่งขึ้น (Z+)' : 'วิ่งกลับ (Z-)'}`);
    }

    const realWorldStartX = recoveryData ? recoveryData.startX : startX;

    while (buildActive && bot && bot.entity) {
        if (getTotalDirtCount() <= 0) {
            console.log(`❌ ดินหมดคลัง! หยุดระบบ`);
            clearProgress();
            buildActive = false;
            break;
        }

        let zQueue = [];
        for (let zOffset = 0; zOffset < 65; zOffset++) {
            zQueue.push(startZ + zOffset);
        }
        if (!forwardZ) zQueue.reverse();

        saveProgress(realWorldStartX, targetY, startZ, currentX, forwardZ);

        const targetEndZ = forwardZ ? (startZ + 64) : startZ;
        const safeWalkDestination = new Vec3(currentX - stepX, targetY + 1, targetEndZ);

        await autoRefillDirtFromInventory();
        let initSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const item = bot.inventory.slots[36 + slot];
            if (item && (item.name === 'dirt' || item.name === 'grass_block' || item.name === 'coarse_dirt')) {
                initSlot = slot;
                break;
            }
        }
        if (initSlot !== -1 && bot.quickBarSlot !== initSlot) {
            bot.setQuickBarSlot(initSlot);
            await new Promise(res => setTimeout(res, 35));
        }

        // 🎯 สั่งล็อกหน้ากล้องมองดิ่งไปข้างหน้าทางจุดหมายเลนถาวร (หน้าไม่สะบัดสั่นหลอนอีกต่อไป)
        bot.clearControlStates();
        await bot.lookAt(safeWalkDestination.offset(0.5, 0, 0.5), true);
        bot.setControlState('forward', true); 

        // [BURST ENGINE LOOP]
        while (buildActive && bot && bot.entity) {
            const currentZDist = Math.abs(bot.entity.position.z - targetEndZ);
            if (currentZDist < 0.8) {
                bot.clearControlStates();
                break; 
            }

            await autoRefillDirtFromInventory();

            for (let currentZ of zQueue) {
                const blockPos = new Vec3(currentX, targetY, currentZ);
                const distToBlock = bot.entity.position.distanceTo(blockPos.plus(new Vec3(0.5, 0.5, 0.5)));
                
                if (distToBlock <= 4.5) { // ขยายระบายสอยบล็อกข้ามช่องได้กว้างขึ้น
                    let currentBlockState = bot.blockAt(blockPos, true);
                    const isAlreadyPaved = currentBlockState && (currentBlockState.name === 'dirt' || currentBlockState.name === 'grass_block' || currentBlockState.name === 'coarse_dirt');
                    
                    if (!isAlreadyPaved) {
                        // 🔥 เปลี่ยนมาใช้การยิงระดับโครงข่าย Socket ดิบ ๆ ไม่หันบิดมองหน้าบล็อก
                        await injectPlaceDirtNetworkRaw(blockPos, stepX);
                    }
                }
            }

            // ⚡ ซอยช่องไฟสับขาให้กระชับความเร็วสูงสุดขึ้นเป็น 10ms รูดยาวสปีดนรกชัวร์
            await new Promise(res => setTimeout(res, 10));
            
            if (buildActive && !bot.controlState.forward) {
                await bot.lookAt(safeWalkDestination.offset(0.5, 0, 0.5), true);
                bot.setControlState('forward', true);
            }
        }

        if (currentX === endX) {
            console.log('🏆 ปูดินเต็มแผงทึบครบ 5 ชุดสุดพิกัดเรียบร้อยครับพี่!');
            clearProgress();
            break;
        }
        currentX += stepX;
        forwardZ = !forwardZ; // สลับทิศฟันปลา
    }

    if (bot) bot.clearControlStates();
    buildActive = false;
}

// 🎯 [🎯 NEW OVERHAUL ENGINE - ZERO-TURN NETWORK SOCKET INJECTOR]:
// หักดิบระบบสับกล้องเล็ง แก้ทางปัญหาตัวละครหันเอ๋อหลุดระนาบจนตกตาย ป้อนแพ็คเกจคลิกขวาดิ่งเข้าบล็อกข้างเคียงทันที
async function injectPlaceDirtNetworkRaw(targetPos, stepX) {
    if (!bot || !bot._client) return;

    try {
        let hotbarDirtSlot = -1;
        for (let slot = 0; slot < 9; slot++) {
            const itemInSlot = bot.inventory.slots[36 + slot];
            if (itemInSlot && (itemInSlot.name === 'dirt' || itemInSlot.name === 'grass_block' || itemInSlot.name === 'coarse_dirt')) {
                hotbarDirtSlot = slot;
                break;
            }
        }

        if (hotbarDirtSlot === -1) return;
        if (bot.quickBarSlot !== hotbarDirtSlot) bot.setQuickBarSlot(hotbarDirtSlot);

        // คำนวณหาเหลี่ยมบล็อกดินเก่าขนานข้างตัว (currentX - stepX) ที่เท้ากำลังยืนเหยียบสไลด์อยู่จริงเพื่อใช้เป็นจุดเกาะ
        let referencePos = targetPos.offset(-stepX, 0, 0);
        let directionFace = stepX === 1 ? 5 : 4; // Face 5 = East (+X), Face 4 = West (-X)

        let refBlock = bot.blockAt(referencePos, true);
        
        // ถ้าหากแผ่นดินด้านข้างหลุดโหลด Chunk ไม่ทัน ให้หันไปดึงเหลี่ยมบล็อกแกน Z ก่อนหน้าหรือด้านหลังมาเกาะคานแทน
        if (!refBlock || refBlock.name === 'air') {
            referencePos = targetPos.offset(0, 0, -1);
            directionFace = 3; // Face 3 = South (+Z)
            refBlock = bot.blockAt(referencePos, true);
        }
        if (!refBlock || refBlock.name === 'air') {
            referencePos = targetPos.offset(0, 0, 1);
            directionFace = 2; // Face 2 = North (-Z)
            refBlock = bot.blockAt(referencePos, true);
        }

        // ⚡ ยิงแพ็คเกจระดับรากแกนเน็ตเวิร์กอัดเข้า Socket ตรง ๆ หน้าบอทจะล็อกนิ่งดิ่งไปข้างหน้า ไม่วืดส่ายคอหลอนแน่นอน
        bot._client.write('block_place', {
            hand: 0, // มือหลัก Main Hand
            location: referencePos,
            direction: directionFace,
            cursorX: 0.5,
            cursorY: 0.5,
            cursorZ: 0.5,
            insideBlock: false
        });

        // สวิงซอยสับจังหวะแขน 8ms หลบการจับตา Anti-Cheat
        await bot.swingArm('mainhand');
        await new Promise(resolve => setTimeout(resolve, 8));
    } catch (err) {}
}

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'c') {
        buildActive = false;
        if (bot) bot.clearControlStates();
        console.log('🛑 สั่งหยุดการทำงานบอทชั่วคราว (บันทึกจุดค้างไว้ในระบบแล้ว!)');
        return;
    }
    
    if (input === 'tpa') {
        if (bot && bot.entity) {
            console.log(`✍️ [Terminal Action] ยิงคำสั่ง /tpa DukDikauai ผ่านเบื้องหลัง`);
            bot.chat('/tpa DukDikauai');
        }
        return;
    }
    
    if (input.startsWith('build')) {
        const args = input.split(' ');
        const startX = parseInt(args[1]);
        const startY = parseInt(args[2]);
        const startZ = parseInt(args[3]);
        if (isNaN(startX) || isNaN(startY) || isNaN(startZ)) {
            console.log('⚠️ รูปแบบไม่ถูกต้อง! ลองใหม่: build -2719 118 14503');
            return;
        }

        if (!progressFilePath) progressFilePath = path.join(__dirname, `progress_${bot.username}.txt`);
        const savedData = loadProgress();

        if (savedData && savedData.startX === startX && savedData.targetY === startY && savedData.startZ === startZ) {
            console.log(`🔄 [SMART RESUME]: ตรวจพบว่าพี่สั่งรันเลนเดิม พิกัดตรงกัน! บอทจะเริ่มลุยต่อจาก X: ${savedData.currentX} ทันที`);
            await startCustomPlatformBuilder(startX, startY, startZ, savedData);
        } else {
            console.log(`🤖 ไม่พบประวัติเลนนี้ หรือพี่เปลี่ยนพิกัดแปลงใหม่: เริ่มต้นวิ่งเจาะพิกัด X:${startX} Y:${startY} Z:${startZ}`);
            clearProgress();
            await startCustomPlatformBuilder(startX, startY, startZ);
        }
    }
});