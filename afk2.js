const http = require('http');
const os = require('os');
const mineflayer = require('mineflayer');
const minecraftData = require('minecraft-data');

const SERVER_HOST = 'play.amorycraft.com';
const SERVER_PORT = 25565;
const BOT_PASSWORD = '112233';
const MC_VERSION = '1.20.1';
const WEB_PORT = 3000;
const DELAY_BETWEEN_BOTS = 20000; // เว้นระยะปล่อยบอทตัวละ 20 วินาที

const sharedData = minecraftData(MC_VERSION);

const BOT_NAMES = [
    'obs1', 'Morgan05', 'Domertown', 'Nattanon09', 'Nanepez', 'Sudlorkayeejai', 'Wood_Skel', 'sindirt', 'Pompamz', 'quast', 'Geyman',
    'Jolibee', 'Posma2', 'Rxzy3', 'mecular', 'Iron34', 'd456',  'Ixcw2534', 'ShadowEmpress', 'gulnwza007', 'Monosox', 'twenty29', '0zow29'
];

// เก็บสถานะบอท Real-time
const botStatusMap = {};
BOT_NAMES.forEach(name => {
    botStatusMap[name] = { status: 'Offline', step: 'รอคิวเชื่อมต่อ...', lastUpdate: new Date().toLocaleTimeString('th-TH') };
});

function updateStatus(name, status, step) {
    botStatusMap[name] = {
        status,
        step: step || botStatusMap[name]?.step || '-',
        lastUpdate: new Date().toLocaleTimeString('th-TH')
    };
}

// ฟังก์ชันดึง Local IP ของเครื่อง VPS
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

function createBotInstance(username, delayMs) {
    setTimeout(() => {
        console.log(`[+] [${username}] กำลังเชื่อมต่อเข้าเซิร์ฟเวอร์...`);
        updateStatus(username, 'Connecting', 'กำลังเชื่อมต่อ...');

        const bot = mineflayer.createBot({
            host: SERVER_HOST,
            port: SERVER_PORT,
            username: username,
            version: MC_VERSION,
            data: sharedData,
            physicsEnabled: false,
            checkTimeoutInterval: 60000
        });

        bot.flowState = 0;

        bot.on('windowOpen', async (window) => {
            if (window.type === 'minecraft:generic_9x3' && bot.flowState === 0) {
                bot.flowState = 1;
                console.log(`[1/3] [${username}] พบ GUI ล็อกอิน -> กำลังกดปุ่มเข้าสู่ระบบ (Slot 2)...`);
                updateStatus(username, 'Logging in', 'กดเข้าสู่ระบบ (Slot 2)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(2, 0, 0);
                        console.log(`[✓] [${username}] กดเข้าสู่ระบบเรียบร้อย! (กำลังวาร์ปไปห้องโถง...)`);
                        updateStatus(username, 'In Lobby', 'วาร์ปเข้าห้องโถง');

                        setTimeout(async () => {
                            console.log(`[2/3] [${username}] ถึงห้องโถงแล้ว -> กำลังสแกนถือเข็มทิศ...`);
                            updateStatus(username, 'In Lobby', 'สแกนถือเข็มทิศ');
                            
                            const compass = bot.inventory.items().find(i => i.name.includes('compass'));
                            if (compass) {
                                try {
                                    await bot.equip(compass, 'hand');
                                    await bot.sleep(500);
                                    bot.activateItem();
                                } catch (e) {
                                    bot.activateItem();
                                }
                            } else {
                                try { bot.activateItem(); } catch (e) {}
                            }

                        }, 6000);

                    } catch (err) {
                        console.error(`[-] [${username}] กดเข้าสู่ระบบพลาด: ${err.message}`);
                    }
                }, 1500);
            }
            else if (window.type === 'minecraft:generic_9x3' && bot.flowState === 1) {
                bot.flowState = 2;
                console.log(`[3/3] [${username}] GUI เข็มทิศเปิดขึ้นมาแล้ว! -> กำลังกดเลือก Survival (Slot 10)...`);
                updateStatus(username, 'Selecting Mode', 'เลือก Survival (Slot 10)');

                setTimeout(async () => {
                    try {
                        await bot.clickWindow(10, 0, 0);
                        console.log(`[>] [${username}] เลือกโหมด Survival เรียบร้อย!`);
                        updateStatus(username, 'Entering Survival', 'กำลังเข้าโลก Survival');

                        setTimeout(() => {
                            bot.chat('/afk');
                            console.log(`[✓] [✓] [${username}] พิมพ์ /afk สำเร็จ! (ออนไลน์สมบูรณ์)`);
                            updateStatus(username, 'Online (AFK)', 'ออนไลน์ปกติ (/afk)');
                        }, 8000);

                    } catch (err) {
                        console.error(`[-] [${username}] กดเลือก Survival พลาด: ${err.message}`);
                    }
                }, 1800);
            }
        });

        bot.on('spawn', () => {
            console.log(`[✓] [${username}] โหลดฉากสำเร็จ`);
        });

        bot.on('error', () => {});

        bot.on('end', (reason) => {
            console.log(`[!] [${username}] หลุดการเชื่อมต่อ (${reason}) -> จะต่อใหม่ใน 20 วินาที...`);
            updateStatus(username, 'Offline', `หลุด (${reason})`);
            createBotInstance(username, 20000);
        });

    }, delayMs);
}

// Web Dashboard
const server = http.createServer((req, res) => {
    if (req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(botStatusMap));
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Minecraft Multi-Bot Status</title>
    <style>
        body { font-family: monospace, sans-serif; background: #121212; color: #e0e0e0; margin: 20px; }
        h2 { color: #4caf50; margin-bottom: 10px; }
        .stats { margin-bottom: 15px; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; background: #1e1e1e; font-size: 13px; }
        th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; }
        th { background: #2a2a2a; color: #aaa; }
        .Online { color: #4caf50; font-weight: bold; }
        .Connecting, .Logging, .Selecting, .In { color: #ffeb3b; }
        .Offline { color: #f44336; }
    </style>
</head>
<body>
    <h2>🤖 Minecraft Multi-Bot Dashboard</h2>
    <div class="stats" id="summary">กำลังโหลดข้อมูล...</div>
    <table>
        <thead>
            <tr>
                <th>#</th>
                <th>ชื่อบอท</th>
                <th>สถานะ</th>
                <th>ขั้นตอนล่าสุด</th>
                <th>อัปเดตเมื่อ</th>
            </tr>
        </thead>
        <tbody id="bot-table"></tbody>
    </table>

    <script>
        async function fetchStatus() {
            try {
                const res = await fetch('/api/status');
                const data = await res.json();
                const tbody = document.getElementById('bot-table');
                
                let onlineCount = 0;
                let total = 0;
                let html = '';

                Object.keys(data).forEach((name, index) => {
                    total++;
                    const bot = data[name];
                    const isOnline = bot.status.includes('Online');
                    if (isOnline) onlineCount++;

                    let statusClass = 'Offline';
                    if (isOnline) statusClass = 'Online';
                    else if (bot.status !== 'Offline') statusClass = 'Connecting';

                    html += \`<tr>
                        <td>\${index + 1}</td>
                        <td><b>\${name}</b></td>
                        <td class="\${statusClass}">\${bot.status}</td>
                        <td>\${bot.step}</td>
                        <td>\${bot.lastUpdate}</td>
                    </tr>\`;
                });

                tbody.innerHTML = html;
                document.getElementById('summary').innerHTML = 
                    \`ออนไลน์ทั้งหมด: <b>\${onlineCount}/\${total}</b> ตัว | อัปเดตอัตโนมัติทุก 3 วินาที\`;
            } catch (e) {}
        }

        fetchStatus();
        setInterval(fetchStatus, 3000);
    </script>
</body>
</html>
    `);
});

server.listen(WEB_PORT, () => {
    // ดึง Public IP ของ VPS มาแสดงบน Log
    http.get('http://api.ipify.org', (res) => {
        let publicIp = '';
        res.on('data', chunk => publicIp += chunk);
        res.on('end', () => printStartupLogs(publicIp.trim()));
    }).on('error', () => {
        printStartupLogs(getLocalIP());
    });
});

function printStartupLogs(ipAddress) {
    console.log('==================================================');
    console.log(`🚀 STARTING MINEFLAYER MULTI-BOT SYSTEM`);
    console.log('==================================================');
    console.log(` [+] Target Server   : ${SERVER_HOST}:${SERVER_PORT}`);
    console.log(` [+] Minecraft Ver.  : ${MC_VERSION}`);
    console.log(` [+] Total Bots      : ${BOT_NAMES.length} ตัว`);
    console.log(` [+] Delay / Bot     : ${DELAY_BETWEEN_BOTS / 1000} วินาที`);
    console.log(` [🌐] Web Dashboard  : http://${ipAddress}:${WEB_PORT}`);
    console.log(` [🌐] Local Access   : http://localhost:${WEB_PORT}`);
    console.log('==================================================');

    // เริ่มปล่อยบอททีละตัว
    BOT_NAMES.forEach((name, index) => {
        createBotInstance(name, index * DELAY_BETWEEN_BOTS);
    });
}