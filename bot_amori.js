const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { Vec3 } = require('vec3');

// 🎯 [อัปเกรดคีย์หลัก]: ดึงโมดูลล็อกอิน Amory ออโต้จากไฟล์ร่วม login.js ตามสั่งพี่ครับ
const { setupAmoryLogin } = require('./login');

const { GoalBlock } = goals;

// 🚀 [รายชื่อไอดีทั้งหมดของพี่]
let accountList = [
'obs1', 'Morgan05', 'Domertown', 'Nattanon09', 'Nanepez', 'Sudlorkayeejai', 'Wood_Skel', 'sindirt', 'Pompamz', 'Netherboy', 'quast', 'Geyman'
            , 'Jolibee','Posma2','Rxzy3','mecular','tutipong', 'Iron34','d456','llMasterll','Ixcw2534','ShadowEmpress','gulnwza007','Monosox','twenty29','0zow29'
];

const bots = {}; 
const botDisplayStatus = {}; 

// 🪙 [ตัวแปรแรม]: สำหรับเก็บค่าจำนวนบิทที่ดักจับได้จาก Scoreboard ขวามือ
const botBits = {}; 

accountList.forEach(name => {
    botBits[name] = 0; 
    botDisplayStatus[name] = "OFFLINE";
});

process.on('uncaughtException', (err) => {
    if (!err) return;
    try {
        const errString = err.toString() || '';
        if (errString.includes('PartialReadError') || errString.includes('particles') || errString.includes('protodef')) {
            return; 
        }
    } catch (e) { return; }
    console.error('⚠️ [System Uncaught Error]:', err);
});

function reportBotStatusToGui(username) {
    print(`BIT_DATA:${JSON.stringify({
        username: username,
        status: botDisplayStatus[username] || "OFFLINE",
        bits: botBits[username] || 0
    })}`);
}

function print(text) {
    console.log(text);
}

function pushToQueueEnd(username) {
    console.log(`⏳ [Queue Engine]: ไอดี [${username}] กำลังย้ายพิกัดไปต่อคิวท้ายแถวสุดเพื่อรอโหลดระบบใหม่...`);
    const index = accountList.indexOf(username);
    if (index !== -1) {
        accountList.splice(index, 1);
        accountList.push(username);
    }
}

function createBotInstance(username) {
    if (bots[username]) return; 

    botDisplayStatus[username] = "🟡 LOADING...";
    reportBotStatusToGui(username);
    
    const bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: username,
        version: '1.21.11'
    });

    if (bot._client) {
        bot._client.on('packet', (data, metadata) => {
            // 🪙 TAB Scoreboard Radar แกะแต้มบิทดิบ
            if (metadata.name === 'teams' || metadata.name === 'scoreboard_team') {
                try {
                    let prefixStr = data.prefix ? (data.prefix.text || JSON.stringify(data.prefix)) : '';
                    let suffixStr = data.suffix ? (data.suffix.text || JSON.stringify(data.suffix)) : '';
                    let fullPacketString = (prefixStr + " " + suffixStr).toString();

                    if (fullPacketString.includes('บิท')) {
                        let cleanVisibleText = "";
                        const valueMatches = fullPacketString.match(/"text"\s*:\s*"\s*([^"]*?)\s*"/g) || 
                                             fullPacketString.match(/"value"\s*:\s*"\s*([^"]*?)\s*"/g);
                        
                        if (valueMatches) {
                            valueMatches.forEach(m => {
                                const txt = m.replace(/"(text|value)"\s*:\s*"/, '').replace(/"$/, '');
                                if (!txt.includes('type') && !txt.includes('compound') && !txt.includes('list')) {
                                    cleanVisibleText += txt;
                                }
                            });
                        }

                        if (!cleanVisibleText) {
                            cleanVisibleText = fullPacketString.replace(/§[0-9a-fk-or]/gi, '').replace(/[{}'":\[\]]/g, ' ');
                        }

                        let bitValue = 0;
                        const colorHexMatch = cleanVisibleText.match(/#12DBF6(\d+)/i);

                        if (colorHexMatch && colorHexMatch[1]) {
                            bitValue = parseInt(colorHexMatch[1].trim());
                        }

                        botBits[username] = bitValue;
                        reportBotStatusToGui(username);
                        console.log(`🪙 [${username} TAB Radar]: ยอดบิทปัจจุบันของคุณคือ -> ${bitValue} บิท`);
                    }
                } catch (teamErr) {}
            }

            if (metadata.name === 'world_particles' || metadata.name === 'packet_world_particles') {
                metadata.size = 0;
                return false; 
            }
        });
    }

    // 🎯 [ระบบสับเปลี่ยนกลไก]: สั่งให้ไอดีตัวนี้ผูกระบบล็อกอิน ฝ่าด่านสมุด และคลิกเข็มทิศอัตโนมัติจากไฟล์ login.js กลาง
    setupAmoryLogin(bot);

    // 🎯 [ขุมพลังดักแปลงคอมมานด์]: ดักจังหวะหน้าต่างหญ้าวาร์ปสำเร็จ เพื่อสั่งแก้ทางให้ยิงคำสั่ง /afk แทนคำสั่งเดิมตามสั่งพี่เลย!
    bot.on('windowOpen', async (window) => {
        // รอช่องไฟเล็งจิ้มบล็อกหญ้าสล็อต 10 
        setTimeout(() => {
            if (bots[username]) {
                // รอแพ็คเก็ตวาร์ปข้ามเซิร์ฟย่อยเคลียร์เรียบร้อย 2.5 วินาที แล้วพิมพ์คำสั่ง /afk ทันที!
                setTimeout(() => {
                    if (bots[username]) {
                        console.log(`✍️ [Auto Action -> ${username}]: เดินทางถึงเซิร์ฟ Spawn ย่อยแล้ว ยิงมาโครคุมฟาร์ม -> /afk`);
                        bots[username].chat('/afk');
                    }
                }, 2500);
            }
        }, 1600);
    });

    bot.loadPlugin(pathfinder);

    bot.on('error', (err) => {
        if (!err) return;
        console.error(`⚠️ [${username} Error]:`, err.message);
        pushToQueueEnd(username);
    });

    bot.once('spawn', () => {
        console.log(`🛰️ บอท [${username}] เหยียบพื้นผิวเซิร์ฟเวอร์สำเร็จ!`);
        botBits[username] = 0;
        botDisplayStatus[username] = "🟢 ONLINE";
        reportBotStatusToGui(username);
    });

    bot.on('death', () => {
        botDisplayStatus[username] = "🟡 LOADING...";
        reportBotStatusToGui(username);
        setTimeout(() => { try { bot.respawn(); } catch(e){} }, 2000);
    });

    bot.on('message', async (jsonMsg, position) => {
        const plainMessage = jsonMsg.toString().trim();
        if (!plainMessage) return;
        if (plainMessage.includes('Chunk size') || plainMessage.includes('partial packet')) return;
        if (plainMessage.includes('botx1') && plainMessage.includes('botx2')) return;
        console.log(`💬 [SERVER CHAT -> ${username}]: ${plainMessage}`);
    });

    bot.on('end', () => {
        bots[username] = null; 
        botDisplayStatus[username] = "OFFLINE";
        reportBotStatusToGui(username);
        console.log(`⚠️ [🚨 คิวแจ้งเตือน]: ไอดี [${username}] ตัดสายเชื่อมต่อออกจากเซิร์ฟเวอร์แล้ว`);
        pushToQueueEnd(username);
    });

    bots[username] = bot;
}

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) return;

    if (input.startsWith('connect ')) {
        const targetName = input.replace('connect ', '').trim();
        if (accountList.includes(targetName)) { createBotInstance(targetName); }
        return;
    }
    
    if (input.startsWith('disconnect ')) {
        const targetName = input.replace('disconnect ', '').trim();
        if (bots[targetName]) {
            bots[targetName].removeAllListeners('end');
            bots[targetName].quit();
            print(`🛑 สั่ง Disconnect เตะไอดี ${targetName} เรียบร้อย`);
        }
        return;
    }
});