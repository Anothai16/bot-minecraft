const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

// 🎯 เรียกใช้งานโมดูลล็อกอินออโต้ ฝ่าด่านสมุด-หน้าต่าง จากไฟล์ร่วม login.js
const { setupAmoryLogin } = require('./login');

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

    // 🎯 สั่งผูกระบบล็อกอิน ฝ่าด่านสมุด และเข้าเซิร์ฟอัตโนมัติจากไฟล์ส่วนกลาง
    setupAmoryLogin(bot);

    bot.loadPlugin(pathfinder);

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        if (message.startsWith('mine')) {
            await startStationMining();
        }
    });

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
    
    // 🎯 [ปรับตามสั่งพี่]: ลดแกน X ลงมา 1 แต้ม -> -2742 69 14524
    const targetStandPos = new Vec3(-2742, 69, 14524);
    console.log(`runs กำลังเดินทางไปตั้งหลักพิกัดสถานีขุดใหม่: X:-2742 Y:69 Z:14524 ...`);
    
    setupMiningMovements(bot);
    try {
        await bot.pathfinder.goto(new GoalBlock(targetStandPos.x, targetStandPos.y, targetStandPos.z));
    } catch (err) {}

    bot.pathfinder.stop();
    bot.clearControlStates();
    console.log(`... ประจำสถานีเรียบร้อย!`);

    // 🎯 [ปรับตามสั่งพี่]: หน้ากล้องขยับลด X ลง 1 แต้ม ล็อกสายตามองตรงไปทิศ EAST ล็อกนิ่ง
    const exactLookTarget = new Vec3(-2739.5, 69.5, 14524.5); 
    await bot.lookAt(exactLookTarget, true);
    await new Promise(res => setTimeout(res, 400)); 

    console.log(`🧭 ล็อกหน้ากล้องไปทางทิศ EAST สำเร็จ! เริ่มต้นมาโครส่งแพ็คเก็ตสับบล็อก...`);

    // 🎯 [ปรับตามสั่งพี่]: คิวบล็อกขุดใหม่ 4 บล็อก ขยับลด X ลงมาบล็อกละ 1 แต้มพอดีเป๊ะครับ
    const cleanBlocksQueue = [
        new Vec3(-2740, 70, 14524),
        new Vec3(-2739, 70, 14524),
        new Vec3(-2738, 70, 14524),
        new Vec3(-2737, 70, 14524)
    ];

    while (miningActive) {
        try {
            await handleAutoEatEngine();

            let pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'));
            if (pickaxe) await bot.equip(pickaxe, 'hand');

            await bot.lookAt(exactLookTarget, true);

            for (const blockPos of cleanBlocksQueue) {
                // ระบบเซฟตี้ดักความทนทานรายบล็อก ล็อกหนาแน่นพิเศษ ป้องกันของแตก
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

        // ดักคัตเอาต์ความทนทานเหลือต่ำกว่า 40 สั่งหยุดขุดและดีดโยนที่ขุดออกจากตัวลงพื้นทันทีเพื่อเซฟของพัง
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

startBot();

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    if (input === 'mine') {
        await startStationMining();
    }
});