const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

const { GoalBlock } = goals;
let bot;
let miningActive = false;

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

    bot.loadPlugin(pathfinder);

    bot.once('spawn', () => {
        console.log('🛰️ บอท [cobblequast] ออนไลน์เหยียบพื้นผิวสำเร็จ! เริ่มระบบออโต้ล็อกอิน...');
        
        setTimeout(() => {
            if (bot) {
                console.log(`✍️ [Auto Login]: พิมพ์รหัสผ่านทางแชทเซฟตี้ -> /login 112233`);
                bot.chat('/login 112233');
            }
        }, 1500);

        setTimeout(async () => {
            if (!bot) return;
            console.log(`📡 [AI Watchdog]: บอทเริ่มกลไกคว้าเข็มทิศฟ้าคัดท้ายเข้าเกม...`);
            triggerCompassSelectorMacro(bot);
        }, 5000);
    });

    bot.on('death', () => {
        miningActive = false;
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('windowOpen', async (window) => {
        let windowTitle = 'ไม่ระบุชื่อเมนู';
        try {
            if (window.title) {
                if (typeof window.title === 'string') {
                    windowTitle = window.title.includes('{') ? JSON.parse(window.title).text || window.title : window.title;
                } else if (typeof window.title === 'object') {
                    windowTitle = window.title.text || (window.title.value && window.title.value.text && window.title.value.text.value) || JSON.stringify(window.title);
                }
            }
        } catch (e) { windowTitle = ''; }

        const titleClean = windowTitle.toLowerCase();
        console.log(`🚨 [WINDOW OPEN]: หน้าต่างเมนูเด้งขึ้นมาสำเร็จ! ชื่อเมนู: "${windowTitle}"`);

        if (titleClean.includes('login') || titleClean.includes('password') || titleClean.includes('กรอกรหัส') || titleClean.includes('รหัสผ่าน')) {
            const pinCode = [1, 1, 2, 2, 3, 3];
            for (let digit of pinCode) {
                if (!bot) return;
                let targetSlot = window.slots.findIndex(slot => slot && slot.displayName && slot.displayName.includes(digit.toString()));
                if (targetSlot === -1) { targetSlot = digit; }
                try {
                    await bot.clickWindow(targetSlot, 0, 0);
                    await new Promise(res => setTimeout(res, 600));
                } catch (err) {}
            }
            let confirmSlot = window.slots.findIndex(slot => slot && (slot.name.includes('green') || slot.name.includes('emerald') || slot.displayName.includes('ยืนยัน') || slot.displayName.includes('submit')));
            if (confirmSlot === -1) confirmSlot = window.slots.length - 1 - 9;
            try { await bot.clickWindow(confirmSlot, 0, 0); } catch (err) {}
            return;
        }

        await new Promise(res => setTimeout(res, 1500));
        const targetSlotID = 10; 
        const targetItem = window.slots[targetSlotID];

        if (targetItem) {
            try {
                await bot.clickWindow(targetSlotID, 0, 0);
                console.log(`🚀 [Success]: ส่งคำสั่งคลิกซ้ายสล็อตบล็อกหญ้าเรียบร้อย!`);
                
                setTimeout(() => {
                    if (bot) {
                        console.log(`✍️ [Auto Action]: เข้าสู่ Spawn Server สมบูรณ์! บังคับยิงคำสั่งกลับพิกัดบ้าน -> /home home`);
                        bot.chat('/home home');
                    }
                }, 2500);
            } catch (clickErr) {}
        } else {
            try {
                await bot.clickWindow(targetSlotID, 0, 0);
                setTimeout(() => { if (bot) bot.chat('/home home'); }, 2500);
            } catch (fErr) {}
        }
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        if (message.startsWith('mine')) {
            await startStationMining();
        }
    });

    bot.on('message', () => {}); 
    bot.on('end', () => { miningActive = false; setTimeout(startBot, 10000); });
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

async function triggerCompassSelectorMacro(botInstance) {
    if (!botInstance || !botInstance.inventory) return;
    const blueCompass = botInstance.inventory.items().find(i => i.name === 'recovery_compass');
    if (blueCompass) {
        try {
            await botInstance.equip(blueCompass, 'hand');
            await new Promise(res => setTimeout(res, 800)); 
            await botInstance.activateItem();
            console.log(`✅ คลิกขวาเข็มทิศสำเร็จ รอกล่องเมนูตอบรับเด้งขึ้นหน้าจอ...`);
        } catch (equipErr) {}
    }
}

// 🧱 ENGINE V15: ระบบขุดหินล็อกพิกัดทิศ East ขุดลึกเจาะทะลวงแนวหน้าแกน X
async function startStationMining() {
    if (miningActive) {
        miningActive = false;
        console.log('🛑 สั่งหยุดระบบขุดหิน...');
        bot.pathfinder.stop();
        bot.clearControlStates();
        return;
    }

    miningActive = true;
    console.log('\n🚀 [East-Axis Multi-Block Mining Engine Active]');
    
    const targetStandPos = new Vec3(-2697, 69, 14550);
    console.log(`runs กำลังเดินทางไปตั้งหลักพิกัดสถานีขุด: X:-2697 Y:69 Z:14550 ...`);
    
    setupMiningMovements(bot);
    try {
        await bot.pathfinder.goto(new GoalBlock(targetStandPos.x, targetStandPos.y, targetStandPos.z));
    } catch (err) {}

    bot.pathfinder.stop();
    bot.clearControlStates();
    console.log(`... ประจำสถานีเรียบร้อย!`);

    const exactLookTarget = new Vec3(-264.5, 69.5, 14550); 
    await bot.lookAt(exactLookTarget, true);
    await new Promise(res => setTimeout(res, 400)); 

    console.log(`🧭 ล็อกหน้ากล้องไปทางทิศ EAST สำเร็จ! เริ่มต้นมาโครส่งแพ็คเก็ตสับบล็อก...`);

    const targetBlocksQueue = [
        new Vec3(-2696, 70, 14550), 
        new Vec3(-2695, 70, 14550), 
        new Vec3(-2694, 70, 14550), 
        new Vec3(-2693, 70, 14550)  
    ];

    while (miningActive) {
        try {
            await handleAutoEatEngine();

            let pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
            if (pickaxe) await bot.equip(pickaxe, 'hand');

            await bot.lookAt(exactLookTarget, true);

            for (const blockPos of targetBlocksQueue) {
                const pickaxeCheck = await checkAndTossPickaxe();
                if (!pickaxeCheck || !miningActive) {
                    console.log('🛑 [Safety Lock Triggered]: ดักเจอที่ขุดใกล้พังคาลูป สั่งยกเลิกทำงานด่วน!');
                    miningActive = false; 
                    bot.clearControlStates();
                    break;
                }

                bot._client.write('block_dig', { status: 0, location: blockPos, face: 1 });
                bot.swingArm('right');

                await new Promise(resolve => setTimeout(resolve, 140));

                bot._client.write('block_dig', { status: 2, location: blockPos, face: 1 });
            }

            if (!miningActive) break; 
            await new Promise(res => setTimeout(res, 20));

        } catch (err) {
            console.error('⚠️ เกิดข้อผิดพลาดในลูปควบคุม:', err.message);
            await new Promise(res => setTimeout(res, 500));
        }
    }
}

async function checkAndTossPickaxe() {
    const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
    if (!pickaxe) {
        console.log("👉 PICKAXE_BROKEN");
        console.log("👉 PICKAXE_DURABILITY: 0"); 
        miningActive = false;
        return false; 
    }

    if (pickaxe.durabilityUsed !== undefined) {
        const maxDur = 2031; 
        const currentDamage = pickaxe.durabilityUsed;
        const remaining = maxDur - currentDamage;
        
        const durabilityPercent = Math.floor((remaining / maxDur) * 100);
        console.log(`👉 PICKAXE_DURABILITY: ${durabilityPercent}`);

        if (remaining <= 40 || durabilityPercent <= 2) {
            console.log(`⚠️ [Durability Buffer Alert] ที่ขุดเหลือแต้มขุด: ${remaining} กำลังปิดมาโครและโยนของเซฟชีวิตด่วน!`);
            
            console.log("👉 PICKAXE_BROKEN");
            miningActive = false; 
            
            bot.clearControlStates();
            await new Promise(resolve => setTimeout(resolve, 150));
            
            try {
                await bot.toss(pickaxe.type, null, pickaxe.count);
                console.log("✅ [Safety Toss Complete] ดีดโยนที่ขุดออกจากตัวลงพื้นเรียบร้อยแล้วครับพี่!");
            } catch (e) {
                console.log(`⚠️ เกิดข้อผิดพลาดในคำสั่งโยนของเซฟตี้: ${e.message}`);
            }
            
            return false; 
        }
    } else {
        console.log("👉 PICKAXE_DURABILITY: 100");
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

// 🎯 สตาร์ทเปิดฟังก์ชันหลักของระบบ
startBot();

// =========================================================================
// 🎯 [ขุมพลังปลดล็อกกระบอกเสียงดักคอมมานด์ดิบ - Readline Interface]
// ใส่ท่อนนี้ลงไป ช่อง Terminal จะพิมพ์ได้ทันที และแอป Python ยิงสั่ง 'mine' ติด 100%!
// =========================================================================
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'mine') {
        await startStationMining();
    }
});