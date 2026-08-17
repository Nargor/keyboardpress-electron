# Changelog

บันทึกการเปลี่ยนแปลงของแอป KeyPress Overlay แต่ละเวอร์ชัน (เรียงจากใหม่ไปเก่า)

## [1.1.0] - 2026-08-17

### เพิ่มใหม่
- 🔲 **ปรับขนาดหน้าต่างได้** — เปิด `resizable: true` บน BrowserWindow ให้ลากขอบหน้าต่างปรับขนาดได้ตามใจชอบ (ขั้นต่ำ 320×220)
  - ฟอนต์ key chip และ stat value ใช้ `clamp()` สเกลตามขนาดหน้าต่างโดยอัตโนมัติ — ไม่ overflow เมื่อหน้าต่างเล็ก, ไม่ดูเล็กเกินไปเมื่อหน้าต่างใหญ่
- 🔏 **Code signing (Windows exe)** — Release pipeline ส่ง exe ไป sign ผ่าน SignPath API อัตโนมัติก่อน publish ขึ้น GitHub Releases ช่วยให้ Windows ไม่ขึ้น SmartScreen warning

---

## [1.0.0] - 2026-08-17


### เพิ่มใหม่
- ⌨️ **KeyPress Overlay แอปตัวแรก** — หน้าต่างโปร่งใสขนาดเล็กโชว์ปุ่มที่กดบนคีย์บอร์ด เอาไปใส่ในโปรแกรมไลฟ์ (OBS, Twitch Studio ฯลฯ)
  - จับคีย์**ทั่วระบบ** (แม้แอปไม่ได้โฟกัส) ด้วย koffi เรียก `GetAsyncKeyState` ของ Windows โดยตรงใน main process ของ Electron
  - โชว์ประวัติปุ่มที่กด 14 ปุ่มล่าสุด พร้อมแอนิเมชันไฮไลต์ปุ่มล่าสุด
  - ไฟแสดง Shift / Ctrl / Alt / Win ขณะกดค้าง
  - ตัวนับ Total (จำนวนกดทั้งหมด), Keys/s (ความเร็วต่อวินาที), Top keys (ปุ่มที่กดบ่อยสุด)
  - ปุ่มรีเซ็ตตัวนับ และปุ่มปิดแอป
  - หน้าต่างโปร่งใส always-on-top ลากได้ ไม่มีกรอบ (frameless)
- 🖥️ **ข้ามแพลตฟอร์ม** — build ได้ทั้ง Windows (portable exe), Linux (AppImage), macOS (dmg/zip)
- 🚀 **Release ผ่าน GitHub Actions** — รัน `npm run release:win` / `release:linux` / `release:win:linux` / `release:all` เพื่อสั่ง build บน cloud และ publish ลง GitHub Releases ของ repo นี้โดยอัตโนมัติ (release notes อ่านจาก CHANGELOG.md)
- 🧪 **โหมดทดสอบ** — `npm test` ส่งคีย์จำลองให้ดู UI ทำงานโดยไม่รบกวนคีย์บอร์ดจริง
- 📝 TypeScript + esbuild, typecheck ด้วย tsc

### หมายเหตุ
- เปลี่ยนจาก Neutralino.js มาเป็น Electron (เวอร์ชันแรกที่ปล่อยจริง) — จับคีย์ + หน้าต่างอยู่ใน process เดียว เสถียรกว่า ไม่ต้องมี daemon แยก
- ไม่ใช้ไลบรารี keylogger สำเร็จรูป (`node-global-key-listener` / `iohook`) เพราะ Windows Defender ลบ binary ที่ไม่ได้เซ็นชื่อทิ้ง — เลยใช้ koffi เรียก Win32 API ตรง ๆ
