const mineflayer = require('mineflayer');
const readline = require('readline'); // ดึงโมดูลอ่านค่า Terminal

// 🎯 1. เรียกใช้งานระบบออโต้ล็อกอินและเข้าเซิร์ฟย่อยจากไฟล์ login.js ที่แยกไว้
const { setupAmoryLogin } = require('./login');

let bot;

function startBot() {
    console.log('🔌 [Nanepez]: กำลังทำการเชื่อมต่อเข้าสู่เซิร์ฟเวอร์ AmoryCraft...');
    
    // 🎯 2. ตั้งชื่อตัวละครใหม่ตามใบสั่งพี่ -> Nanepez
    bot = mineflayer.createBot({ 
        host: 'play.amorycraft.com', 
        username: 'Nanepez', 
        version: '1.21.11'
    });

    // 🎯 3. เรียกใช้ระบบฝ่าด่านสมุด กรอกรหัส และคลิกเข็มทิศฟ้าออโต้ในบรรทัดเดียว!
    setupAmoryLogin(bot);

    bot.once('spawn', () => {
        console.log('✨ [Nanepez]: ออนไลน์พร้อมรับสัญญานคอมมานด์พิมพ์จากพี่แล้วครับ!');
        console.log('⌨️  พี่สามารถพิมพ์คำว่า "tpa" ลงใน Terminal นี้ได้เลยเพื่อส่งคำขอส่งตัวครับพี่');
    });

    bot.on('error', (err) => {
        console.error('⚠️ ตรวจพบข้อผิดพลาดในระบบ:', err.message);
    });

    bot.on('end', () => {
        console.log('❌ บอทหลุดออกจากเซิร์ฟเวอร์... กำลังเตรียมทำการเชื่อมต่อใหม่ใน 10 วินาที');
        setTimeout(startBot, 10000);
    });
}

// 🎯 4. เปิดระบบดักฟัง Terminal (Readline) เพื่อคอยแกะรหัสคำว่า tpa
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    const input = line.trim().toLowerCase();
    
    // 🎯 ถ้าพี่พิมพ์คำว่า tpa ลงช่องรันงาน
    if (input === 'tpa') {
        if (bot && bot.entity) {
            console.log('🚀 [Command Sent]: พิมพ์คำสั่งด่วน -> /tpa DukDikauai');
            bot.chat('/tpa DukDikauai'); // ยิงคำสั่งแชทเข้าเซิร์ฟเวอร์ทันที
        } else {
            console.log('⏳ บอทยังเชื่อมต่อเข้าเกมไม่สมบูรณ์ กรุณารอสักครู่นะพี่!');
        }
    }
});

// เริ่มต้นเปิดระบบงานรันบอท Nanepez
startBot();