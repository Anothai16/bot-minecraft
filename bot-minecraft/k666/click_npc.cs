// MCC Script: click_npc.cs
// วัตถุประสงค์: หา Entity ที่ยืนอยู่ตรงพิกัด NPC (102.5, -630.5) แล้วส่งคำสั่ง Interact ทันที

int targetEntityId = -1;
double minDistanceToNpcSpot = 3.0; // รัศมีรอบจุดยืนของ NPC

// ดึงรายชื่อ Entity ทั้งหมดที่โหลดอยู่ใน Memory รอบตัว
var entities = GetEntities();

foreach (var pair in entities)
{
    var entity = pair.Value;
    
    // เช็คว่ายืนอยู่ใกล้แท่นพิกัด X: 102.5, Z: -630.5 หรือไม่
    double dx = entity.Location.X - 102.5;
    double dz = entity.Location.Z - (-630.5);
    double distFromSpot = Math.Sqrt(dx * dx + dz * dz);

    if (distFromSpot < minDistanceToNpcSpot)
    {
        targetEntityId = pair.Key;
        LogToConsole("[SCRIPT] เจอตู้/ตัว NPC แล้ว! Entity ID: " + targetEntityId + " (ห่างจากแท่น " + distFromSpot.ToString("F2") + " บล็อก)");
        break;
    }
}

if (targetEntityId != -1)
{
    LogToConsole("[SCRIPT] กำลังส่งคำสั่งคลิก Entity ID: " + targetEntityId);
    // สลับมือว่างก่อนคลิกเพื่อป้องกันไอเทมกวน
    PerformInternalCommand("changeSlot 8");
    Thread.Sleep(500);
    
    // สั่งคลิกด้วย ID จริงที่เพิ่งสแกนเจอ
    PerformInternalCommand("entity " + targetEntityId + " use");
}
else
{
    LogToConsole("[SCRIPT] ไม่พบ Entity ที่จุด 102.5, -630.5! กำลังใช้แผนสำรอง (คลิกตัวที่ใกล้ที่สุด)");
    PerformInternalCommand("entity near Player use");
}