const CONSOLE_LOG = path.join(__dirname, 'satang_console.log');

// 📌 API สั่งเช็คยอดเงิน /money
app.get('/api/check-balance', async (req, res) => {
  if (!fs.existsSync(PIPE)) {
    return res.status(500).json({ success: false, message: 'บอท Satang13 ไม่ออนไลน์' });
  }

  const startSize = fs.existsSync(CONSOLE_LOG) ? fs.statSync(CONSOLE_LOG).size : 0;

  // ส่งคำสั่ง /money ตรงเข้าตัวบอท
  sendCommand('/money');

  // รอข้อความตอบกลับจากเซิร์ฟเวอร์ (วนลูปเช็กสูงสุด 3 วินาที)
  let foundBalance = null;
  let rawText = '';

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 200));

    if (fs.existsSync(CONSOLE_LOG)) {
      const currentSize = fs.statSync(CONSOLE_LOG).size;
      if (currentSize > startSize) {
        const stream = fs.readFileSync(CONSOLE_LOG, 'utf-8');
        const newLines = stream.slice(startSize).split('\n');

        for (const line of newLines) {
          // ล้างโค้ดสี (§a, §e, §r ฯลฯ)
          const cleanLine = line.replace(/§[0-9a-fk-or]/gi, '').trim();

          // ตรวจหาคำที่เกี่ยวข้องกับเงิน
          if (/economy|เงิน|balance|คงเหลือ|คอยน์|\$/i.test(cleanLine)) {
            // แกะตัวเลขยอดเงิน (รองรับแบบมีจุลภาค เช่น 1,500 หรือทศนิยม 250.00)
            const match = cleanLine.match(/[\d,]+(?:\.\d+)?/);
            if (match) {
              foundBalance = match[0];
              rawText = cleanLine;
              break;
            }
          }
        }
      }
    }
    if (foundBalance) break;
  }

  if (foundBalance) {
    return res.json({ success: true, balance: foundBalance, raw: rawText });
  }

  res.json({
    success: false,
    message: 'ไม่พบข้อความตอบกลับจากเซิร์ฟเวอร์ (ลองกดเช็กอีกครั้ง)'
  });
});