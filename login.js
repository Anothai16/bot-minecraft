const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ฟังก์ชันจัดการระบบออโต้ล็อกอิน ฝ่าด่านสมุด และเข้าเซิร์ฟเวอร์ Survival
 * @param {import('mineflayer').Bot} botInstance ตัวแปร bot ของ Mineflayer
 */
function setupAmoryLogin(botInstance) {
    const username = botInstance.username || 'Bot';
    let isBookSolved = false;
    let isCompassUsed = false;
    let isSurvivalJoined = false;
    let isFinished = false;

    if (!botInstance._client) return;
    botInstance._client.setMaxListeners(0);

    const markSuccess = () => {
        if (!isFinished) {
            isFinished = true;
            console.log(`🏠 [${username}]: ล็อกอินสำเร็จ เข้าสู่บ้านเรียบร้อยครับพี่!`);
        }
    };

    // 🎯 1. ทะลวงด่านสมุด (Packet Level)
    botInstance._client.on('packet', async (data, metadata) => {
        if (!metadata || !metadata.name) return;

        if (metadata.name === 'open_book' || metadata.name.includes('book')) {
            if (isBookSolved) return;
            isBookSolved = true;

            console.log(`🚨 [${username}]: ตรวจพบด่านสมุดล็อกหน้าจอ กำลังแก้ทาง...`);
            await sleep(800);

            if (botInstance && !botInstance._client.ended) {
                botInstance.chat('/login 112233');
                console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 1 [/login 112233]`);
            }

            await sleep(1500);
            try {
                botInstance.closeWindow(0);
                console.log(`✅ [${username}]: ปลดล็อกด่านตรวจสมุดสำเร็จ!`);
            } catch (e) {}

            await sleep(3000);
            if (botInstance && !botInstance._client.ended) {
                botInstance.chat('/login 112233');
                console.log(`✍️ [${username}]: ยิงรหัสผ่านรอบที่ 2 ซ้ำเพื่อความชัวร์`);
            }
        }
    });

    // 🧭 2. สเต็ปกดเข็มทิศ + ย้ายเข้า Survival
    botInstance.on('spawn', async () => {
        // ถ้าเข้า Survival เรียบร้อยแล้ว ให้สั่งวาร์ปเข้าบ้านทันที
        if (isSurvivalJoined) {
            await sleep(2000);
            if (botInstance && !botInstance._client.ended) {
                botInstance.chat('/home home');
                markSuccess();
            }
            return;
        }

        // จังหวะเกิดใน Lobby ให้เตรียมกดเข็มทิศ
        await sleep(7000);
        if (isCompassUsed || !botInstance || botInstance._client.ended) return;
        isCompassUsed = true;

        const blueCompass = botInstance.inventory ? botInstance.inventory.items().find(i => i.name === 'recovery_compass') : null;
        if (blueCompass) {
            try {
                await botInstance.equip(blueCompass, 'hand');
                await sleep(1000);
                await botInstance.activateItem();
                console.log(`🧭 [${username}]: กดใช้งานเข็มทิศฟ้าเรียบร้อย`);
            } catch (e) {}
        } else {
            botInstance.chat('/server survival');
        }
    });

    // 🚨 3. สเต็ปจิ้มเลือก Survival ใน GUI
    botInstance.on('windowOpen', async (window) => {
        if (isSurvivalJoined) return;
        
        await sleep(2000);
        if (!botInstance || botInstance._client.ended) return;

        try {
            await botInstance.clickWindow(10, 0, 0);
            console.log(`จิ้มเมนูเลือกเซิร์ฟ Survival เรียบร้อย`);
            isSurvivalJoined = true;

            // หน่วงเวลา 8 วินาทีหลังจิ้ม แล้วสั่ง /home home ทันที (กันอาการมึนรอ Event)
            await sleep(8000);
            if (botInstance && !botInstance._client.ended) {
                botInstance.chat('/home home');
                markSuccess();
            }
        } catch (err) {}
    });

    // 🛡️ 4. Watchdog Fallback (ถ้าผ่านไป 25 วินาทีแล้วยังไม่ขึ้นสำเร็จ แต่บอทยังต่ออยู่ ให้ยิง /home home บังคับเสร็จ)
    setTimeout(() => {
        if (!isFinished && botInstance && !botInstance._client.ended) {
            botInstance.chat('/home home');
            markSuccess();
        }
    }, 25000);
}

module.exports = { setupAmoryLogin };