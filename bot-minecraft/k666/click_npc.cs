//MCCScript 1.0
//MCCScript Extensions

using System;
using System.Threading;

int targetEntityId = -1;
double minDistanceToNpcSpot = 3.0; // รัศมีรอบแท่น NPC

// ดึง Entity ทั้งหมดรอบตัวจาก Memory ของ MCC
var entities = GetEntities();

foreach (var pair in entities)
{
    var entity = pair.Value;
    
    // ตรวจสอบพิกัดใกล้ตำแหน่งยืนของ NPC (102.5, -630.5)
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
    PerformInternalCommand("changeSlot 8");
    Thread.Sleep(500);
    PerformInternalCommand("entity " + targetEntityId + " use");
}
else
{
    LogToConsole("[SCRIPT] ไม่พบ Entity ตรงพิกัดแท่น กำลังสแกนหาตัวใกล้สุด...");
    PerformInternalCommand("entity near Player use");
}