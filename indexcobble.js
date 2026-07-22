const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;
let bot;
let miningActive = false;
let isRepairing = false;
let currentMode = 'fortune';

function startBot() {
    console.log('🔌 กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'cobblequast', 
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

    bot.on('kicked', (reason) => {
        console.log('🚨 [KICKED BY SERVER] โดนเซิร์ฟเวอร์เตะหลุด! สาเหตุ:', JSON.stringify(reason));
    });

    bot.on('error', (err) => {
        console.log('❌ [BOT ERROR]:', err);
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        const msg = message.trim().toLowerCase();
        
        if (msg === 'mine f' || msg === 'mine fortune') {
            await startStationMining('fortune');
        } else if (msg === 'msg === mine s' || msg === 'mine silk' || msg === 'mine silktouch') {
            await startStationMining('silktouch');
        } else if (msg === 'mine') {
            await startStationMining('fortune');
        } else if (msg === 'c' || msg === 'cancel' || msg === 'stop') {
            stopMining();
        }
    });

    bot.on('end', (reason) => { 
        console.log(`🔌 [DISCONNECTED] การเชื่อมต่อดับลง (Reason: ${reason})`);
        miningActive = false; 
        isRepairing = false;
        setTimeout(startBot, 10000); 
    });
}

function stopMining() {
    if (miningActive) {
        miningActive = false;
        isRepairing = false;
        console.log('🛑 [Cancel] สั่งยกเลิกการทำงานเรียบร้อยแล้ว!');
        if (bot && bot.pathfinder) {
            bot.pathfinder.stop();
            bot.clearControlStates();
        }
    } else {
        console.log('ℹ️ บอทไม่ได้กำลังขุดอยู่ครับ');
    }
}

function setupMiningMovements(botInstance) {
    const registry = botInstance.registry;
    const movements = new Movements(botInstance, registry);
    movements.allowSprinting = false; 
    movements.allowParkour = false;
    movements.canDig = true; 
    movements.allow1by1towers = false;
    movements.maxDropDown = 1; 
    botInstance.pathfinder.setMovements(movements);
}

// 🔒 ดึงที่ขุดจาก Hotbar ช่อง 1 (Slot 36) หรือ ช่อง 2 (Slot 37)
function getPickaxeFromLockedHotbar(mode) {
    const targetInventorySlot = (mode === 'silktouch') ? 36 : 37;
    const item = bot.inventory.slots[targetInventorySlot];

    if (item && item.name.includes('pickaxe')) {
        return item;
    }
    return null;
}


// 🧪 ระบบ Mending สุดคลีน: ถือที่ขุดไว้มือขวา + ย้ายขวด EXP ไปปาจากมือซ้าย (Off-hand)
async function repairPickaxeWithExp(mode) {
    if (isRepairing) return;
    isRepairing = true;

    console.log(`🧪 [Auto-Mending Active] เริ่มซ่อมที่ขุด ${mode.toUpperCase()} (ปาขวด EXP จากมือซ้าย)...`);
    
    try {
        // 1. ยกเลิกการขุดเดิม และหน่วงเวลา 1 วินาที ให้ Packet เคลียร์สมบูรณ์
        bot._client.write('block_dig', { status: 1, location: { x: 0, y: 0, z: 0 }, face: 0 });
        bot.clearControlStates();
        await new Promise(res => setTimeout(res, 800));

        // 2. ล็อกมือขวาให้ถือที่ขุดที่ Hotbar ช่อง 1 (Index 0 = Silk Touch) หรือ ช่อง 2 (Index 1 = Fortune)
        const pickHotbarIndex = (mode === 'silktouch') ? 0 : 1;
        const targetPickSlot = (mode === 'silktouch') ? 36 : 37;
        
        bot.setQuickBarSlot(pickHotbarIndex);
        await new Promise(res => setTimeout(res, 400));

        const OFFHAND_SLOT = 45; // Slot 45 = มือซ้าย (Off-hand)
        let thrownCount = 0;

        // 3. ย้ายขวด EXP สแตกแรกไปไว้ที่มือซ้าย (Slot 45)
        const expBottle = bot.inventory.items().find(i => i.name === 'experience_bottle');
        if (!expBottle) {
            console.log('⚠️ [Out of EXP Bottles] ไม่พบขวด EXP ในกระเป๋า!');
            miningActive = false;
        } else {
            console.log('🍾 [LOG] ย้ายขวด EXP ไปไว้ที่มือซ้าย (Off-hand)...');
            await bot.moveSlotItem(expBottle.slot, OFFHAND_SLOT);
            await new Promise(res => setTimeout(res, 600));
        }

        console.log('🍾 เริ่มต้นปาขวด EXP จากมือซ้ายรัวๆ ...');

        // 4. ลูปปาขวด EXP จากมือซ้ายต่อเนื่อง
        while (miningActive && isRepairing) {
            // ตรวจสอบที่ขุดในมือขวา
            const mainHandPick = bot.inventory.slots[targetPickSlot];
            if (!mainHandPick || !mainHandPick.name.includes('pickaxe')) {
                console.log(`🛑 ไม่พบที่ขุดใน Hotbar ช่อง ${pickHotbarIndex + 1} สำหรับซ่อม ยกเลิกกระบวนการ`);
                break;
            }

            // คำนวณความทนทานปัจจุบันของที่ขุดในมือขวา
            const maxDur = 2031;
            const currentDamage = mainHandPick.durabilityUsed || 0;
            const remaining = maxDur - currentDamage;
            const durabilityPercent = Math.floor((remaining / maxDur) * 100);

            // 🎯 หากซ่อมเต็ม 100% แล้ว ให้หยุดปาทันที!
            if (currentDamage <= 0 || remaining >= maxDur - 15) {
                console.log(`✅ [Repair Complete] ซ่อมที่ขุดเต็ม 100% เรียบร้อย! (ความทนทาน: ${remaining}/${maxDur} - ใช้ไปทั้งหมด ${thrownCount} ขวด)`);
                break;
            }

            // ตรวจสอบว่ายังมีขวด EXP เหลือในตัวไหม
            const hasExpInInv = bot.inventory.items().some(item => item.name === 'experience_bottle');
            const offhandItem = bot.inventory.slots[OFFHAND_SLOT];
            
            if (!hasExpInInv && (!offhandItem || offhandItem.name !== 'experience_bottle')) {
                console.log('⚠️ [Out of EXP Bottles] ขวด EXP หมดกระเป๋าแล้ว!');
                miningActive = false;
                break;
            }

            // ถ้าขวด EXP ในมือซ้ายหมด ให้ย้ายสแตกใหม่จากเป้มาใส่แทน
            if (!offhandItem || offhandItem.name !== 'experience_bottle') {
                const nextExp = bot.inventory.items().find(i => i.name === 'experience_bottle');
                if (nextExp) {
                    console.log('📦 [LOG] เติมขวด EXP สแตกใหม่เข้ามือซ้าย...');
                    await bot.moveSlotItem(nextExp.slot, OFFHAND_SLOT);
                    await new Promise(res => setTimeout(res, 500));
                }
            }

            // การันตีว่ามือขวาถือที่ขุดช่องล็อกเดิมเสมอ
            bot.setQuickBarSlot(pickHotbarIndex);

            // 🎯 สั่งปาขวด EXP จากมือซ้าย (Off-hand): activateItem(true) = offhand
            bot.activateItem(true); 
            thrownCount++;

            if (thrownCount % 10 === 0 || thrownCount === 1) {
                console.log(`🍾 [LOG] ปาขวดที่ ${thrownCount} -> Mending มือขวา: ${remaining}/${maxDur} (${durabilityPercent}%)`);
            }

            // หน่วงเวลาปาแต่ละขวด (180ms)
            await new Promise(res => setTimeout(res, 180));
        }

        // 5. เมื่อซ่อมเสร็จ ย้ายขวด EXP ที่เหลือในมือซ้ายกลับเข้ากระเป๋าหลัก (เพื่อเคลียร์มือซ้ายให้ว่าง)
        const remainingOffhand = bot.inventory.slots[OFFHAND_SLOT];
        if (remainingOffhand) {
            console.log('🧹 [LOG] เคลียร์มือซ้าย เก็บขวด EXP ที่เหลือเข้ากระเป๋า...');
            const emptyMainSlot = bot.inventory.firstEmptyContainerSlot();
            if (emptyMainSlot) {
                await bot.moveSlotItem(OFFHAND_SLOT, emptyMainSlot);
                await new Promise(res => setTimeout(res, 500));
            }
        }

    } catch (err) {
        console.error('⚠️ เกิดข้อผิดพลาดในระบบซ่อมแซม:', err.message);
    } finally {
        isRepairing = false;
    }
}

async function startStationMining(mode = 'fortune') {
    if (miningActive) {
        stopMining();
        return;
    }

    currentMode = mode;
    miningActive = true;
    console.log(`\n🚀 [East-Axis Mining Active] โหมดที่เลือก: ⛏️ ${currentMode.toUpperCase()}`);

    const targetStandPos = new Vec3(-2742, 69, 14524);
    console.log(`กำลังเดินทางไปตั้งหลักพิกัดสถานีขุด: X:-2742 Y:69 Z:14524 ...`);
    
    setupMiningMovements(bot);
    try {
        await bot.pathfinder.goto(new GoalBlock(targetStandPos.x, targetStandPos.y, targetStandPos.z));
    } catch (err) {}

    if (!miningActive) return;

    bot.pathfinder.stop();
    bot.clearControlStates();
    console.log(`... ประจำสถานีเรียบร้อย!`);

    // หน่วงเวลาให้เซิร์ฟเวอร์ Sync การเคลื่อนที่เสร็จสมบูรณ์ก่อนจะล็อกกล้องขุด
    await new Promise(res => setTimeout(res, 800));

    const exactLookTarget = new Vec3(-2739.5, 69.5, 14524.5); 
    await bot.lookAt(exactLookTarget, true);
    await new Promise(res => setTimeout(res, 400)); 

    console.log(`🧭 ล็อกหน้ากล้องไปทางทิศ EAST สำเร็จ! เริ่มต้นสับบล็อก...`);

    const cleanBlocksQueue = [
        new Vec3(-2740, 70, 14524),
        new Vec3(-2739, 70, 14524),
        new Vec3(-2738, 70, 14524),
        new Vec3(-2737, 70, 14524)
    ];

    while (miningActive) {
        try {
            await handleAutoEatEngine();

            if (isRepairing) {
                await new Promise(res => setTimeout(res, 500));
                continue;
            }

            // เช็กไอเทมใน Hotbar ช่องที่ล็อกไว้
            let selectedPickaxe = getPickaxeFromLockedHotbar(currentMode);
            
            // ถ้าไม่พบใน Hotbar ลองเช็กในมือซ้าย เผื่อค้างอยู่
            if (!selectedPickaxe && bot.inventory.slots[45] && bot.inventory.slots[45].name.includes('pickaxe')) {
                const targetHotbarSlot = (currentMode === 'silktouch') ? 36 : 37;
                console.log('⚠️ [RECOVERY] เจอมือซ้ายถือที่ขุดค้างไว้! กำลังย้ายกลับ Hotbar...');
                await bot.moveSlotItem(45, targetHotbarSlot);
                await new Promise(res => setTimeout(res, 600));
                selectedPickaxe = getPickaxeFromLockedHotbar(currentMode);
            }

            if (!selectedPickaxe) {
                const slotNum = (currentMode === 'silktouch') ? 1 : 2;
                console.log(`🛑 หยุดการทำงานเนื่องจากไม่พบที่ขุดใน Hotbar ช่อง ${slotNum} สำหรับโหมด ${currentMode.toUpperCase()}`);
                miningActive = false;
                break;
            }

            const pickHotbarIndex = (currentMode === 'silktouch') ? 0 : 1;
            bot.setQuickBarSlot(pickHotbarIndex);

            await bot.lookAt(exactLookTarget, true);

            for (const blockPos of cleanBlocksQueue) {
                const checkResult = await checkAndHandleDurability(selectedPickaxe);
                if (!checkResult || !miningActive || isRepairing) {
                    break;
                }

                if (bot.heldItem && bot.heldItem.name.includes('pickaxe')) {
                    bot._client.write('block_dig', { status: 0, location: blockPos, face: 1 });
                    bot.swingArm('right');

                    await new Promise(resolve => setTimeout(resolve, 140));

                    bot._client.write('block_dig', { status: 2, location: blockPos, face: 1 });
                } else {
                    console.log('⚠️ มือไม่ได้ถือที่ขุด ข้ามการขุดบล็อกนี้เพื่อความปลอดภัย');
                    break;
                }
            }

            if (!miningActive) break; 
            await new Promise(res => setTimeout(res, 20));

        } catch (err) {
            console.error('⚠️ เกิดข้อผิดพลาดในลูปควบคุม:', err.message);
            await new Promise(res => setTimeout(res, 500));
        }
    }
}

// ตัวแปรเก็บค่าเปอร์เซ็นต์ความทนทานล่าสุด ป้องกันLog ยิงซ้ำ
let lastLoggedDurability = -1;

async function checkAndHandleDurability(pickaxe) {
    if (!pickaxe) {
        console.log("👉 PICKAXE_NOT_FOUND");
        miningActive = false;
        return false; 
    }

    if (pickaxe.durabilityUsed !== undefined) {
        const maxDur = 2031; 
        const currentDamage = pickaxe.durabilityUsed;
        const remaining = maxDur - currentDamage;
        const durabilityPercent = Math.floor((remaining / maxDur) * 100);

        // 🎯 พิมพ์ Log เฉพาะตอนที่ % ลดลง หรือเป็นครั้งแรกที่ขุดเท่านั้น!
        if (durabilityPercent !== lastLoggedDurability) {
            console.log(`👉 PICKAXE_DURABILITY (${currentMode.toUpperCase()}): ${durabilityPercent}% (แต้มคงเหลือ: ${remaining}/${maxDur})`);
            lastLoggedDurability = durabilityPercent;
        }

        if (remaining <= 60 || durabilityPercent <= 3) {
            if (!isRepairing) {
                console.log(`⚠️ [Durability Warning] ที่ขุด ${currentMode.toUpperCase()} เหลือแต้มขุด: ${remaining} สั่งเข้าสู่ระบบ Auto-Mending!`);
                await repairPickaxeWithExp(currentMode);
                lastLoggedDurability = -1; // รีเซ็ตค่าเพื่อให้ Log อัปเดตใหม่หลังซ่อมเสร็จ
            }
            if (!miningActive) return false;
        }
    }
    return true;
}

async function handleAutoEatEngine() {
    if (bot.food <= 16) {
        const carrot = bot.inventory.items().find(i => i.name === 'golden_carrot');
        if (carrot) {
            try {
                await bot.equip(carrot, 'hand');
                await bot.consume();
                await new Promise(res => setTimeout(res, 100));
            } catch (e) {}
        }
    }
}

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim().toLowerCase();
    if (input === 'mine f' || input === 'mine fortune') {
        await startStationMining('fortune');
    } else if (input === 'mine s' || input === 'mine silk' || input === 'mine silktouch') {
        await startStationMining('silktouch');
    } else if (input === 'mine') {
        await startStationMining('fortune');
    } else if (input === 'c' || input === 'cancel' || input === 'stop') {
        stopMining();
    }
});