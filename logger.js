const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'bot_status');
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function createBotLogger(botName) {
    const filePath = path.join(LOG_DIR, `${botName}.json`);
    const logs = [];

    const save = (isOnline) => {
        try {
            // เขียนทับเฉพาะ 30 บรรทัดล่าสุด ขนาดไฟล์จะคงที่ 2-3 KB เสมอ
            fs.writeFileSync(filePath, JSON.stringify({
                name: botName,
                online: isOnline,
                updatedAt: new Date().toLocaleTimeString('th-TH'),
                logs: logs.slice(-30)
            }, null, 2));
        } catch (e) {}
    };

    return {
        log: (msg) => {
            const time = new Date().toLocaleTimeString('th-TH');
            const entry = `[${time}] ${msg}`;
            logs.push(entry);
            if (logs.length > 50) logs.shift();
            console.log(`[${botName}] ${msg}`);
            save(true);
        },
        setStatus: (isOnline) => save(isOnline)
    };
}

module.exports = { createBotLogger, LOG_DIR };