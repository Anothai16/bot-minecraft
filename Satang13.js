const express = require('express');
const multer = require('multer');
const promptpayQR = require('promptpay-qr');
const QRCode = require('qrcode');
const axios = require('axios');
const FormData = require('form-data');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');
const os = require('os');
const http = require('http');

// ==========================================
// ⚙️ ตั้งค่าระบบ & บอท
// ==========================================
const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_USERNAME = 'Satang13';
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3006;

const PROMPTPAY_ID = '0922569972'; // ⚠️ ใส่เบอร์พร้อมเพย์ หรือเลข ปชช. 13 หลัก
const RATE_PER_BAHT = 2000000;           // 1 บาท = กี่เงินในเกม
const SLIPOK_API_KEY = '';         // ใส่ API Key จาก slipok.com (ถ้าว่างไว้จะเป็นโหมดทดสอบ Dev Mode)
const SLIPOK_BRANCH_ID = '';

const sharedData = minecraftData(MC_VERSION);
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

function log(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.log(`[${time}] ${msg}`);
}

function logError(msg) {
    const time = new Date().toLocaleTimeString('th-TH', { hour12: false });
    console.error(`[${time}] ${msg}`);
}

// ==========================================
// 🤖 จัดการตัวละคร Mineflayer Satang13
// ==========================================
let botInstance = null;
let currentBotBalance = 'ยังไม่ได้เช็ค';

let botStatus = {
    name: BOT_USERNAME,
    status: 'Stopped',
    step: 'กำลังเตรียมระบบ...',
    onlineInSurvival: false,
    lastUpdate: ''
};

const processedSlips = new Set();
let paySession = null; // ติดตามสถานะการโอนเงินสดๆ

function updateStatus(status, step, inSurvival = false) {
    botStatus.status = status;
    if (step) botStatus.step = step;
    botStatus.onlineInSurvival = inSurvival;
    botStatus.lastUpdate = new Date().toLocaleTimeString('th-TH', { hour12: false });
}

function triggerLobbyCompass(bot) {
    if (bot.compassTimer) clearTimeout(bot.compassTimer);
    bot.authStage = 'IN_LOBBY';
    log(`[🏠] [${BOT_USERNAME}] เข้าสู่ Lobby -> รอ 13s ก่อนหาเข็มทิศ...`);
    updateStatus('In Lobby', 'วาร์ปเข้า Lobby (รอ 13s)');

    bot.compassTimer = setTimeout(() => {
        useCompass(bot);
    }, 13000);
}

async function useCompass(bot) {
    if (!bot || !bot.inventory) return;
    updateStatus('In Lobby', 'กำลังถือเข็มทิศ');
    log(`[🧭] [${BOT_USERNAME}] กำลังค้นหาและเตรียมถือเข็มทิศ...`);

    const compass = bot.inventory.items().find(i => i.name.includes('compass'));
    if (compass) {
        try {
            await bot.equip(compass, 'hand');
            log(`[🧭] [${BOT_USERNAME}] ถือเข็มทิศแล้ว -> รอ 3s คลิกขวา...`);
            await bot.sleep(3000);
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
        } catch (e) {
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
        }
    } else {
        try {
            await bot.sleep(3000);
            bot.authStage = 'WAIT_COMPASS_MENU';
            bot.activateItem();
        } catch (e) {}
    }
}

function createBot() {
    log(`[+] [${BOT_USERNAME}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);
    updateStatus('Connecting', 'กำลังเชื่อมต่อ...');

    const bot = mineflayer.createBot({
        host: SERVER_HOST,
        port: SERVER_PORT,
        username: BOT_USERNAME,
        version: MC_VERSION,
        data: sharedData,
        physicsEnabled: false,
        checkTimeoutInterval: 60000
    });

    botInstance = bot;
    bot.authStage = 'START';

    // 🎯 1. ดักจับข้อความแชตทั้งหมดจากเซิร์ฟเวอร์
    bot.on('message', (jsonMsg) => {
        const rawText = jsonMsg.toString().trim();
        if (!rawText) return;

        log(`[💬 ALL CHAT]: "${rawText}"`);

        // ตรวจหายอดเงินจากการเช็ค /money
        if (/economy|เงิน|balance|คงเหลือ|คอยน์|\$|coin/i.test(rawText)) {
            const match = rawText.match(/[\d,]+(?:\.\d+)?/);
            if (match) {
                currentBotBalance = match[0];
                log(`[💰 PARSED BALANCE]: อัปเดตยอดเงิน -> ${currentBotBalance}`);
            }
        }

        // ถ้าอยู่ในระหว่างกระบวนการโอนเงิน ให้บันทึกข้อความตอบกลับ
        if (paySession) {
            paySession.logs.push(rawText);
            if (/คุณโอนเงินจำนวน|โอนเงินสำเร็จ|successfully paid/i.test(rawText)) {
                paySession.isConfirmed = true;
                log(`[🎉 PAY SUCCESS CONFIRMED]: เซิร์ฟเวอร์ยืนยันการโอนสำเร็จ!`);
            } else if (/ยอดเงินไม่พอ|ไม่พบผู้เล่น|player not found|cooldown|ข้อผิดพลาด/i.test(rawText)) {
                paySession.error = rawText;
                logError(`[❌ PAY FAILED BY SERVER]: ${rawText}`);
            }
        }
    });

    // 🎯 2. ดักจับหน้าต่าง GUI / Anvil / Dialog ทุกบานที่เด้งขึ้นมา
    bot.on('windowOpen', async (window) => {
        log(`[🪟 WINDOW OPENED] Type: ${window.type} | Title: "${window.title}" | Slots: ${window.slots.length}`);

        // ถ้าอยู่ในช่วงที่สั่ง /pay แล้วมีหน้าต่างเด้งขึ้นมา (GUI ยืนยันการโอนเงิน)
        if (botStatus.onlineInSurvival && paySession) {
            log(`[🔍 PAY GUI DETECTED] กำลังวิเคราะห์ไอเทมในหน้าต่างยืนยัน...`);
            
            // แสดงไอเทมทุกชิ้นใน GUI เพื่อดูว่าปุ่มกดยืนยันอยู่ Slot ไหน
            window.slots.forEach((item, slotIndex) => {
                if (item) {
                    log(`   👉 Slot [${slotIndex}]: ${item.name} (${item.displayName || ''})`);
                }
            });

            // คลิกยืนยันอัตโนมัติ (ทดสอบคลิก Slot 11 สำหรับ GUI ยืนยัน หรือ Slot 1 สำหรับ Dialog)
            setTimeout(async () => {
                try {
                    log(`[🖱️ AUTO CLICK] กำลังคลิกยืนยัน Slot 11...`);
                    await bot.clickWindow(11, 0, 0);
                } catch (e) {
                    logError(`[-] คลิก Slot 11 พลาด: ${e.message}`);
                }
            }, 800);
            return;
        }

        // ลำดับการล็อกอินปกติ
        // STAGE 1: กด Slot 1 (สมุด)
        if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'START') {
            bot.authStage = 'OPENING_ANVIL';
            log(`[1/4] [${BOT_USERNAME}] พบ GUI ล็อกอิน -> รอ 3.5s กด Slot 1 (สมุด)...`);
            updateStatus('Logging in', 'รอเปิด Anvil (Slot 1)');

            setTimeout(async () => {
                try {
                    await bot.clickWindow(1, 0, 0);
                    bot.anvilCheckTimer = setTimeout(() => {
                        if (bot.authStage === 'OPENING_ANVIL') {
                            log(`[⚡] [${BOT_USERNAME}] ข้ามไป Lobby ทันที (เคยล็อกอินแล้ว)`);
                            triggerLobbyCompass(bot);
                        }
                    }, 4000);
                } catch (e) {}
            }, 3500);
        }
        // STAGE 2: พิมพ์รหัสผ่านใน Anvil
        else if (window.type === 'minecraft:anvil' && (bot.authStage === 'OPENING_ANVIL' || bot.authStage === 'START')) {
            if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
            bot.authStage = 'PASS_TYPED';
            log(`[2/4] [${BOT_USERNAME}] Anvil เปิดแล้ว -> กำลังพิมพ์รหัสผ่าน...`);
            updateStatus('Logging in', 'กำลังพิมพ์รหัสผ่าน');

            setTimeout(() => {
                try {
                    bot._client.write('name_item', { name: BOT_PASSWORD });
                    setTimeout(async () => {
                        await bot.clickWindow(2, 0, 0);
                    }, 1500);
                } catch (e) {}
            }, 2500);
        }
        // STAGE 3: ยืนยันรหัสผ่าน Slot 2
        else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'PASS_TYPED') {
            log(`[3/4] [${BOT_USERNAME}] พิมพ์รหัสแล้ว -> รอ 2.5s เพื่อกด Slot 2...`);
            updateStatus('Logging in', 'กด Slot 2 ยืนยัน');

            setTimeout(async () => {
                try {
                    await bot.clickWindow(2, 0, 0);
                    triggerLobbyCompass(bot);
                } catch (e) {}
            }, 2500);
        }
        // STAGE 4: เลือก Survival Slot 10
        else if (window.type === 'minecraft:generic_9x3' && bot.authStage === 'WAIT_COMPASS_MENU') {
            bot.authStage = 'SURVIVAL_DONE';
            log(`[4/4] [${BOT_USERNAME}] GUI เข็มทิศเปิดแล้ว -> รอ 3s เลือก Survival (Slot 10)...`);
            updateStatus('Selecting Mode', 'เลือก Survival (Slot 10)');

            setTimeout(async () => {
                try {
                    await bot.clickWindow(10, 0, 0);
                    log(`[🚀] [${BOT_USERNAME}] เลือก Survival สำเร็จ! (รอโหลดเข้าโลก 12s...)`);
                    updateStatus('Entering Survival', 'กำลังวาร์ปเข้า Survival');

                    setTimeout(() => {
                        log(`[✓] [${BOT_USERNAME}] พร้อมทำงาน! ยืนประจำการใน Survival เรียบร้อย`);
                        updateStatus('Online (Ready)', 'พร้อมจ่ายเงินใน Survival', true);

                        setTimeout(() => {
                            log(`[🔍 CHECK] บอทเข้าโลกสำเร็จ สั่ง /money เช็คเงินตั้งต้น...`);
                            bot.chat('/money');
                        }, 2000);

                        if (bot.afkInterval) clearInterval(bot.afkInterval);
                        bot.afkInterval = setInterval(() => {
                            try { bot.look(bot.entity.yaw + 0.1, bot.entity.pitch, true); } catch (e) {}
                        }, 60000);
                    }, 12000);
                } catch (err) {
                    logError(`[-] กดเลือก Survival ล้มเหลว: ${err.message}`);
                }
            }, 3000);
        }
    });

    bot.on('kicked', (reason) => {
        let kickReasonStr = reason;
        try { kickReasonStr = JSON.parse(reason).text || reason; } catch (e) {}
        logError(`[🚨 KICKED] [${BOT_USERNAME}] โดนเตะ: ${kickReasonStr}`);
        updateStatus('Kicked', `โดนเตะ: ${kickReasonStr}`, false);
    });

    bot.on('end', (reason) => {
        if (bot.compassTimer) clearTimeout(bot.compassTimer);
        if (bot.anvilCheckTimer) clearTimeout(bot.anvilCheckTimer);
        if (bot.afkInterval) clearInterval(bot.afkInterval);
        botInstance = null;
        log(`[!] [${BOT_USERNAME}] หลุดการเชื่อมต่อ (${reason}) -> ต่อใหม่อีกครั้งใน 20 วินาที...`);
        updateStatus('Offline', `หลุด (${reason})`, false);
        setTimeout(createBot, 20000);
    });

    bot.on('error', (err) => {
        logError(`[❌ Error] ${err.message}`);
        updateStatus('Error', err.message, false);
    });
}

createBot();

// 🛡️ ฟังก์ชันสั่งโอนเงินในเกมแบบมี Promise ติดตามผลจริง
async function executePayInGame(targetPlayer, amount) {
    if (!botInstance || !botStatus.onlineInSurvival) {
        throw new Error('บอท Satang13 ยังไม่พร้อมออนไลน์ใน Survival');
    }

    // เริ่มต้น Session ติดตามการโอนเงิน
    paySession = {
        targetPlayer,
        amount,
        isConfirmed: false,
        error: null,
        logs: []
    };

    log(`==================================================`);
    log(`[💸 INITIATING PAY] เตรียมส่งเงินให้: ${targetPlayer} จำนวน: ${amount}`);
    log(`==================================================`);

    // ส่งคำสั่ง /pay เข้าเกม
    botInstance.chat(`/pay ${targetPlayer} ${amount}`);
    log(`[📤 SENT CHAT]: /pay ${targetPlayer} ${amount}`);

    // รอการตอบกลับจากเซิร์ฟเวอร์เป็นเวลา 3.5 วินาที
    for (let i = 0; i < 35; i++) {
        await new Promise((r) => setTimeout(r, 100));
        if (paySession.isConfirmed || paySession.error) break;
    }

    const sessionResult = { ...paySession };
    paySession = null; // เคลียร์ session

    // สั่งเช็คยอดเงินคงเหลือใหม่หลังจบการโอน
    setTimeout(() => {
        if (botInstance) botInstance.chat('/money');
    }, 1500);

    return sessionResult;
}

// ==========================================
// 📡 REST API
// ==========================================

app.get('/api/bot-status', (req, res) => {
    res.json(botStatus);
});

app.get('/api/refresh-balance', async (req, res) => {
    log(`[🌐 API REQUEST] มีคำขอเช็คยอดเงินจากหน้าเว็บ...`);

    if (!botInstance || !botStatus.onlineInSurvival) {
        logError(`[❌ CHECK FAILED] บอท Satang13 ยังไม่ออนไลน์ใน Survival`);
        return res.json({ success: false, balance: 'บอทไม่ออนไลน์' });
    }

    const previousBalance = currentBotBalance;
    botInstance.chat('/money');

    for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 200));
        if (currentBotBalance !== previousBalance && currentBotBalance !== 'ยังไม่ได้เช็ค') {
            break;
        }
    }

    res.json({
        success: currentBotBalance !== 'ยังไม่ได้เช็ค',
        balance: currentBotBalance
    });
});

app.post('/api/generate-qr', async (req, res) => {
    const amount = parseFloat(req.body.amount);
    if (isNaN(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'กรุณาระบุจำนวนเงินให้ถูกต้อง' });
    }

    try {
        const payload = promptpayQR(PROMPTPAY_ID, { amount: amount });
        const qrImage = await QRCode.toDataURL(payload, { scale: 8 });
        res.json({ success: true, qrImage, amount, promptpayId: PROMPTPAY_ID });
    } catch (e) {
        res.status(500).json({ success: false, message: 'สร้าง QR Code ไม่สำเร็จ' });
    }
});

app.post('/api/verify-slip', upload.single('slip'), async (req, res) => {
    let { targetPlayer, expectedAmount } = req.body;
    targetPlayer = String(targetPlayer || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
    expectedAmount = parseFloat(expectedAmount);

    if (!targetPlayer || isNaN(expectedAmount) || expectedAmount <= 0) {
        return res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
    }

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'กรุณาแนบรูปภาพสลิปโอนเงิน' });
    }

    if (!botStatus.onlineInSurvival) {
        return res.status(503).json({ success: false, message: 'บอท Satang13 ยังไม่พร้อมในโลก Survival กรุณารอสักครู่' });
    }

    try {
        let verifiedAmount = 0;
        let transRef = '';

        if (SLIPOK_API_KEY) {
            const formData = new FormData();
            formData.append('files', req.file.buffer, { filename: 'slip.jpg' });

            const checkRes = await axios.post(`https://api.slipok.com/api/line/apikey/${SLIPOK_BRANCH_ID}`, formData, {
                headers: { ...formData.getHeaders(), 'x-authorization': SLIPOK_API_KEY }
            });

            if (!checkRes.data.success) {
                return res.status(400).json({ success: false, message: checkRes.data.message || 'สลิปไม่ถูกต้อง' });
            }

            verifiedAmount = parseFloat(checkRes.data.data.amount);
            transRef = checkRes.data.data.transRef;

            if (processedSlips.has(transRef)) {
                return res.status(400).json({ success: false, message: 'สลิปนี้ถูกใช้งานไปแล้ว' });
            }
        } else {
            log('⚠️ [DEV MODE] อนุมัติสลิปโหมดทดสอบ');
            verifiedAmount = expectedAmount;
            transRef = 'DEV_' + Date.now();
        }

        if (verifiedAmount < expectedAmount) {
            return res.status(400).json({ 
                success: false, 
                message: `ยอดเงินในสลิป (${verifiedAmount}) น้อยกว่ายอดที่ต้องจ่าย (${expectedAmount})` 
            });
        }

        // สั่งโอนเงินในเกมและรอผลจริง
        const inGameCoins = verifiedAmount * RATE_PER_BAHT;
        const payResult = await executePayInGame(targetPlayer, inGameCoins);

        if (payResult.error) {
            return res.status(400).json({
                success: false,
                message: `เซิร์ฟเวอร์ปฏิเสธการโอนเงิน: ${payResult.error}`
            });
        }

        processedSlips.add(transRef);

        res.json({
            success: true,
            message: `โอนเงินสำเร็จ! Satang13 ได้ส่งคำสั่งโอน ${inGameCoins.toLocaleString()} ให้กับ ${targetPlayer} แล้ว (ผลตรวจ: ${payResult.isConfirmed ? 'ยืนยันสำเร็จ' : 'ส่งคำสั่งแล้ว กำลังดำเนินการ'})`,
            transRef,
            serverLogs: payResult.logs
        });

    } catch (err) {
        logError(`[❌ Slip Error] ${err.message}`);
        res.status(500).json({ success: false, message: 'ดำเนินการล้มเหลว: ' + err.message });
    }
});

// ==========================================
// 🌐 หน้า Web Frontend (Port 3006)
// ==========================================
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Satang13 - PromptPay Auto Pay</title>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Prompt', sans-serif; }
        body { background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
        .card { background: #1e293b; border-radius: 16px; border: 1px solid #334155; max-width: 460px; width: 100%; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); text-align: center; }
        h2 { color: #38bdf8; margin-bottom: 4px; font-weight: 700; }
        .sub { color: #94a3b8; font-size: 13px; margin-bottom: 14px; }
        
        .bot-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 20px; font-size: 12px; margin-bottom: 12px; font-weight: 600; background: #0f172a; border: 1px solid #334155; }
        .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; background: #ef4444; }
        .dot.online { background: #22c55e; }

        .balance-card {
            background: #090d13;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 12px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        .balance-label { font-size: 12px; color: #94a3b8; text-align: left; }
        .balance-val { font-family: 'JetBrains Mono', monospace; font-size: 20px; color: #facc15; font-weight: 700; text-align: left; }
        .btn-refresh {
            background: #1e293b;
            color: #38bdf8;
            border: 1px solid #38bdf8;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 6px;
            cursor: pointer;
            transition: 0.15s;
        }
        .btn-refresh:hover { background: #38bdf8; color: #000; }

        .input-group { text-align: left; margin-bottom: 14px; }
        label { display: block; font-size: 13px; color: #cbd5e1; margin-bottom: 6px; font-weight: 600; }
        input { width: 100%; padding: 12px; background: #0f172a; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 15px; outline: none; }
        input:focus { border-color: #38bdf8; }

        .btn { width: 100%; padding: 12px; background: #0284c7; color: white; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; transition: 0.2s; margin-top: 5px; }
        .btn:hover { background: #0369a1; }
        .btn-green { background: #16a34a; }
        .btn-green:hover { background: #15803d; }

        .qr-section { margin-top: 18px; display: none; padding-top: 18px; border-top: 1px solid #334155; }
        .qr-img { width: 220px; height: 220px; border-radius: 12px; margin: 12px auto; background: white; padding: 8px; display: block; }
        .drop-box { background: #0f172a; border: 2px dashed #475569; padding: 14px; border-radius: 8px; cursor: pointer; font-size: 13px; color: #94a3b8; margin-top: 12px; }
        .status-msg { margin-top: 14px; font-size: 14px; font-weight: 600; }
        .text-green { color: #4ade80; }
        .text-red { color: #f87171; }
    </style>
</head>
<body>
    <div class="card">
        <h2>⚡ เติมเงินอัตโนมัติ Satang13</h2>
        <div class="sub">สแกนพร้อมเพย์ เงินเข้าตัวละครในเกมทันที</div>

        <div class="bot-badge">
            <span id="botDot" class="dot"></span>
            <span id="botText">กำลังตรวจสอบสถานะบอท...</span>
        </div>

        <div class="balance-card">
            <div>
                <div class="balance-label">ยอดเงินคงเหลือในบอท</div>
                <div class="balance-val" id="displayBalance">กำลังเช็ค...</div>
            </div>
            <button class="btn-refresh" onclick="fetchBalance()">🔄 เช็คเงิน</button>
        </div>

        <div id="step-1">
            <div class="input-group">
                <label>ชื่อตัวละครในเกม (Player Name)</label>
                <input type="text" id="targetPlayer" placeholder="เช่น Kaitom_4" autocomplete="off">
            </div>
            <div class="input-group">
                <label>จำนวนเงินที่ต้องการเติม (บาท)</label>
                <input type="number" id="amount" placeholder="เช่น 20 หรือ 100" min="1">
            </div>
            <button class="btn" onclick="generateQR()">สร้าง QR Code ชำระเงิน</button>
        </div>

        <div id="step-2" class="qr-section">
            <h3 style="font-size: 16px;">สแกนเพื่อชำระเงิน</h3>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">พร้อมเพย์: <b style="color: #fff;">${PROMPTPAY_ID}</b></div>
            <img id="qr-display" class="qr-img" src="" alt="PromptPay QR">
            <div id="amount-display" style="font-size: 18px; font-weight: 700; color: #facc15;"></div>

            <label class="drop-box" style="display: block;">
                📎 คลิกเพื่อแนบรูปสลิปโอนเงิน
                <input type="file" id="slip-file" accept="image/*" style="display: none;" onchange="showFileName(this)">
            </label>
            <div id="file-name" style="font-size: 12px; color: #38bdf8; margin-top: 6px;"></div>

            <button class="btn btn-green" style="margin-top: 14px;" onclick="verifySlip()">ยืนยันสลิปและรับเงิน</button>
            <div id="status" class="status-msg"></div>
        </div>
    </div>

    <script>
        let currentAmount = 0;

        async function fetchBalance() {
            const btn = document.querySelector('.btn-refresh');
            const display = document.getElementById('displayBalance');
            btn.innerText = 'กำลังเช็ค...';
            btn.disabled = true;

            try {
                const res = await fetch('/api/refresh-balance');
                const data = await res.json();
                if (data.success) {
                    display.innerText = data.balance;
                } else {
                    display.innerText = data.balance || 'ไม่พบข้อความตอบกลับ';
                }
            } catch (e) {
                display.innerText = 'เกิดข้อผิดพลาด';
            } finally {
                btn.innerText = '🔄 เช็คเงิน';
                btn.disabled = false;
            }
        }

        async function checkBotStatus() {
            try {
                const res = await fetch('/api/bot-status');
                const data = await res.json();
                const dot = document.getElementById('botDot');
                const text = document.getElementById('botText');

                if (data.onlineInSurvival) {
                    dot.className = 'dot online';
                    text.innerText = 'บอท Satang13 พร้อมใช้งานในเกม';
                } else {
                    dot.className = 'dot';
                    text.innerText = 'Satang13: ' + data.step;
                }
            } catch (e) {}
        }

        async function generateQR() {
            const player = document.getElementById('targetPlayer').value.trim();
            const amount = document.getElementById('amount').value.trim();

            if (!player || !amount) {
                alert('กรุณากรอกชื่อตัวละครและจำนวนเงิน');
                return;
            }

            const res = await fetch('/api/generate-qr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });

            const data = await res.json();
            if (data.success) {
                currentAmount = data.amount;
                document.getElementById('qr-display').src = data.qrImage;
                document.getElementById('amount-display').innerText = 'ยอดชำระ: ' + Number(data.amount).toLocaleString() + ' บาท';
                document.getElementById('step-2').style.display = 'block';
            } else {
                alert(data.message);
            }
        }

        function showFileName(input) {
            if (input.files && input.files[0]) {
                document.getElementById('file-name').innerText = 'สลิป: ' + input.files[0].name;
            }
        }

        async function verifySlip() {
            const player = document.getElementById('targetPlayer').value.trim();
            const fileInput = document.getElementById('slip-file');
            const statusDiv = document.getElementById('status');

            if (!fileInput.files[0]) {
                alert('กรุณาแนบรูปภาพสลิป');
                return;
            }

            statusDiv.className = 'status-msg';
            statusDiv.innerText = 'กำลังตรวจสอบสลิปและดำเนินการในเกม...';

            const formData = new FormData();
            formData.append('slip', fileInput.files[0]);
            formData.append('targetPlayer', player);
            formData.append('expectedAmount', currentAmount);

            try {
                const res = await fetch('/api/verify-slip', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                if (data.success) {
                    statusDiv.className = 'status-msg text-green';
                    statusDiv.innerText = '✅ ' + data.message;
                    setTimeout(fetchBalance, 2500);
                } else {
                    statusDiv.className = 'status-msg text-red';
                    statusDiv.innerText = '❌ ' + data.message;
                }
            } catch (e) {
                statusDiv.className = 'status-msg text-red';
                statusDiv.innerText = '❌ ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ';
            }
        }

        checkBotStatus();
        fetchBalance();
        setInterval(checkBotStatus, 4000);
    </script>
</body>
</html>
    `);
});

app.listen(WEB_PORT, () => {
    log('==================================================');
    log(`🚀 SATANG13 MINEFLAYER + PROMPTPAY SERVER STARTED`);
    log(`🌐 Dashboard: http://localhost:${WEB_PORT}`);
    log('==================================================');
});