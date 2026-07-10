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

// 💾 ฟังก์ชันบันทึกพิกัดลงไฟล์ TXT
function saveProgress(startX, targetY, startZ, currentX, forwardZ) {
    const data = `${startX},${targetY},${startZ},${currentX},${forwardZ ? 1 : 0}`;
    fs.writeFileSync(progressFilePath, data, 'utf8');
}

// 📖 ฟังก์ชันอ่านพิกัดจากไฟล์ TXT
function loadProgress() {
    if (!fs.existsSync(progressFilePath)) return null;
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
    if (fs.existsSync(progressFilePath)) {
        fs.unlinkSync(progressFilePath);
    }
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
        console.log('🛰️ บอท [dirtsomtuy] ออนไลน์สำเร็จ! รอรับคำสั่งปูพื้นจากพี่ครับ...');
    });

    let hasRecovered = false;
    bot.on('windowOpen', async (window) => {
        if (hasRecovered) return;
        hasRecovered = true;

        setTimeout(async () => {
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

    bot.on('kicked', () => { buildActive = false; });
    bot.on('error', () => { buildActive = false; });

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

    bot.on('end', () => { buildActive = false; setTimeout(startBot, 10000); });
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

// 🧱 ฟังก์ชันหลักรันแปลนเว้นรูบล็อกตรงๆ พร้อมเขียนสคริปต์เซฟแต้มลง .txt
async function startCustomPlatformBuilder(startX, targetY, startZ, recoveryData = null) {
    buildActive = true;
    setupMovements(bot);

    const endX = -2638;
    const stepX = startX <= endX ? 1 : -1;
    
    let currentX = recoveryData ? recoveryData.currentX : startX;
    let forwardZ = recoveryData ? recoveryData.forwardZ : true;

    console.log(`\n================== [ 🚀เริ่มเดินสายพานปูดินแนวตรงแกน Z ดิ่งยาว ] ==================`);

    let isFirstLine = true;
    const realWorldStartX = recoveryData ? recoveryData.startX : startX;

    let lastCheckedZ = null;
    let stuckCounter = 0;

    while (buildActive) {
        if (getTotalDirtCount() <= 0) {
            console.log(`❌ [⚡ STOP BUILDING]: ดินหมดคลัง เคลียร์งานหยุดเท้าทันที`);
            clearProgress();
            buildActive = false;
            break;
        }

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
            if (!buildActive) break;

            const blockPos = new Vec3(currentX, targetY, currentZ);

            // 🎯 [แก้ไขสูตรวิกฤตเว้นรูเพี้ยน]: ปรับมาใช้พิกัดโลกจริงดั้งเดิมที่พิมพ์พิมพ์สั่ง (realWorldStartX)
            // มาคำนวณค่า xDiff ตรงๆ แบบไม่ผ่านสมการชดเชย ขจัดปัญหาสูตรเพี้ยนและมองข้ามรูฟาร์มแถวแรกหายขาดครับ!
            const isSkipZLine = (currentZ === startZ + 5 || currentZ === startZ + 10);
            const xDiff = Math.abs(currentX - realWorldStartX); 

            let isAHole = false;
            if (isSkipZLine) {
                if (xDiff === 5) {
                    isAHole = true;
                } else if (xDiff > 5) {
                    if ((xDiff - 5) % 9 === 0) isAHole = true;
                }
            }

            // ระบบคัดกรองข้ามบล็อกดินแน่นล่วงหน้าด่วนความเร็วสูง
            let currentBlockState = bot.blockAt(blockPos, true);
            const isAlreadyPaved = currentBlockState && (currentBlockState.name === 'dirt' || currentBlockState.name === 'grass_block' || currentBlockState.name === 'coarse_dirt' || currentBlockState.name === 'farmland');

            if (isAlreadyPaved && !isAHole) {
                continue;
            }

            // ระบบดักจับและทำลายลูปยืนค้าง
            if (lastCheckedZ === currentZ) {
                stuckCounter++;
                if (stuckCounter >= 3) {
                    console.log(`\n🚨 [STUCK DETECTOR] -> พพบอทยืนสั่นกระตุกค้างพิกัด Z: ${currentZ}`);
                    console.log(`⚔️ [AUTO X-SHIFT] -> บังคับขยับแกน X ล่วงหน้าเคลียร์บัค...\n`);
                    stuckCounter = 0;
                    break; 
                }
            } else {
                lastCheckedZ = currentZ;
                stuckCounter = 0;
            }

            console.log(`\x1b[36m[GRID HOLE DETECTOR]\x1b[0m ตรวจพิกัด -> X: ${currentX} Z: ${currentZ} | แปลน: ${isAHole ? '\x1b[31m🕳️ [SKIP HOLE]\x1b[0m' : '🧱 [DIRT PLAN]'}`);

            // ด่านขุดกู้ภัยขาปู: ถ้าเป็นหลุมแล้วสแกนเจอดินอุดอยู่ สั่งถอยยืนบนบล็อกทึบข้างๆ ทุบทิ้งทันที
            if (isAHole) {
                let targetBlock = bot.blockAt(blockPos, true);
                if (targetBlock && (targetBlock.name === 'dirt' || targetBlock.name === 'grass_block' || targetBlock.name === 'coarse_dirt' || targetBlock.name === 'farmland')) {
                    console.log(`⛏️ [FOUND DIRT IN HOLE] -> เจอสิ่งเจือปนอุดรูพิกัด X: ${currentX} Z: ${currentZ} กำลังเข้าขุดเคลียร์พื้นที่...`);
                    try {
                        setupMovements(bot);
                        const safeStandX = currentX - stepX;
                        
                        await Promise.race([
                            bot.pathfinder.goto(new GoalBlock(safeStandX, targetY + 1, currentZ)),
                            new Promise(resolve => setTimeout(resolve, 1000))
                        ]);
                        
                        bot.pathfinder.stop();
                        await bot.lookAt(blockPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
                        await bot.dig(targetBlock);
                    } catch (digErr) {}
                }
                continue;
            }

            // ระบบเดินเลาะอ้อมแนวราบแกน Z ดั้งเดิมของพี่
            if (bot && bot.entity) {
                const safePavedX = currentX - stepX;
                const safeGoalBlock = new Vec3(safePavedX, targetY + 1, currentZ);
                
                try { 
                    setupMovements(bot);
                    await Promise.race([
                        bot.pathfinder.goto(new GoalBlock(safeGoalBlock.x, safeGoalBlock.y, safeGoalBlock.z)),
                        new Promise(resolve => setTimeout(resolve, 1500))
                    ]);
                } catch(e) {}
            }

            if (bot) bot.clearControlStates();
            
            // ส่งค่าตัวแปรสูตรแปลนรูฟาร์มเข้าไปในฟังก์ชันวาง เพื่อดักเช็ค Real-time ป้องกันวางพลาดอุดรู
            await placeFarmDirtHotbarOnly(blockPos, isAHole, stepX, targetY + 1, currentZ);
        }

        if (currentX === endX) break;
        currentX += stepX;
        forwardZ = !forwardZ;
    }

    if (bot) {
        bot.pathfinder.stop();
        bot.clearControlStates();
    }
    buildActive = false;
}

// ฟังก์ชันคว้าไอเทมบล็อกดินช่อง Hotbar แถวล่างสุดจิ้มวางด่วน
async function placeFarmDirtHotbarOnly(targetPos, isAHolePlan, stepX, standY, standZ) {
    let checkBlock = bot.blockAt(targetPos, true);
    if (checkBlock && (checkBlock.name === 'dirt' || checkBlock.name === 'grass_block' || checkBlock.name === 'coarse_dirt')) return;

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

    // ระบบ LOG วางเร็วผิดรัศมี
    if (bot && bot.entity) {
        const botEyePos = bot.entity.position.offset(0, bot.entity.height, 0);
        const blockCenter = targetPos.plus(new Vec3(0.5, 0.5, 0.5));
        const distance = botEyePos.distanceTo(blockCenter).toFixed(2);
        
        console.log(`\x1b[35m[PLACE TRACKER]\x1b[0m ปูดินพิกัด X: ${targetPos.x} Z: ${targetPos.z} | ใช้ฐานบล็อก: ${referenceBlock ? referenceBlock.name : 'air'} | ระยะรัศมี: ${distance} เมตร`);
    }

    if (referenceBlock && referenceBlock.name === 'air') return;

    try {
        if (bot.quickBarSlot !== hotbarDirtSlot) {
            bot.setQuickBarSlot(hotbarDirtSlot);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        await bot.lookAt(targetPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
        await bot.activateBlock(referenceBlock, placeFaceVector);
        await new Promise(resolve => setTimeout(resolve, 80));

        // ดักจับและทำลายทิ้ง Real-time หลังกดวางพลาดทับรูฟาร์ม
        let verifyBlock = bot.blockAt(targetPos, true);
        if (isAHolePlan && verifyBlock && (verifyBlock.name === 'dirt' || verifyBlock.name === 'grass_block' || verifyBlock.name === 'coarse_dirt' || verifyBlock.name === 'farmland')) {
            console.log(`🛑 [🚨 REAL-TIME OVERRIDE]: เผลอวางบล็อกพลาดทับรูพิกัด X: ${targetPos.x} Z: ${targetPos.z}! สั่งถอยทุบทิ้งออกทันที!`);
            
            setupMovements(bot);
            const safeBackX = targetPos.x - stepX;
            await Promise.race([
                bot.pathfinder.goto(new GoalBlock(safeBackX, standY, standZ)),
                new Promise(res => setTimeout(res, 1000))
            ]);
            
            bot.pathfinder.stop();
            await bot.lookAt(targetPos.plus(new Vec3(0.5, 0.5, 0.5)), true);
            await bot.dig(verifyBlock);
            console.log(`✅ [REAL-TIME CLEAR]: ขุดบล็อกดินพลาดหลุดรูออกเรียบร้อย!\n`);
        }

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
        if (bot) {
            bot.pathfinder.stop();
            bot.clearControlStates();
        }
        return;
    }
    if (input === 'tpa') {
        if (bot && bot.entity) {
            console.log('✍️ [Terminal Action] ยิงคำสั่งด่วน -> /tpa DukDikauai');
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