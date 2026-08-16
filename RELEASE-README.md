# KeyPress Overlay

**คู่มือการใช้งานแอปเดสก์ท็อปโชว์ปุ่มคีย์บอร์ดสำหรับไลฟ์สตรีม** — หน้าต่างโปร่งใสขนาดเล็กแสดงปุ่มที่กด เอาไปวางใน OBS / Twitch Studio ได้เลย

[![Latest Release](https://img.shields.io/github/v/release/Nargor/keyboardpress-electron?label=เวอร์ชันล่าสุด&color=blue)](https://github.com/Nargor/keyboardpress-electron/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Nargor/keyboardpress-electron/total?label=ดาวน์โหลดแล้ว&color=success)](https://github.com/Nargor/keyboardpress-electron/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey)](https://github.com/Nargor/keyboardpress-electron/releases/latest)
[![Author](https://img.shields.io/badge/author-%40Nargor-blueviolet)](https://github.com/Nargor)

> 📦 release ไฟล์ติดตั้งทั้งหมดอยู่ที่หน้า **Releases** ของ repo นี้ — โค้ดกับตัวแจกจ่ายอยู่ในที่เดียวกัน

---

## ดาวน์โหลด & ติดตั้ง

ไปที่หน้า **[Releases](https://github.com/Nargor/keyboardpress-electron/releases/latest)** แล้วเลือกไฟล์ให้ตรงกับเครื่องของคุณ:

| ระบบปฏิบัติการ | ไฟล์ที่ต้องดาวน์โหลด | วิธีใช้งาน |
|---|---|---|
| 🪟 Windows | `KeyPressOverlay-x.x.x.exe` | ดับเบิลคลิกแล้วใช้ได้เลย (portable — ไม่ต้องติดตั้ง) |
| 🐧 Linux | `KeyPressOverlay-x.x.x.AppImage` | ให้สิทธิ์รันไฟล์ (`chmod +x`) แล้วเปิดได้เลย |
| 🍎 macOS | `KeyPressOverlay-x.x.x.dmg` | เปิดไฟล์แล้วลากเข้าลง Applications (ต้อง build บนเครื่อง Mac) |

> ⚠️ **Windows SmartScreen แจ้งเตือน "Windows protected your PC"** — เกิดขึ้นเพราะแอปยังไม่มี code-signing certificate (ไม่ใช่ไวรัส) ให้กด **More info → Run anyway** เพื่อเปิดต่อได้ตามปกติ

## วิธีใช้

1. เปิดแอป — หน้าต่างโปร่งใส always-on-top จะเด้งขึ้นมา
2. กดคีย์อะไรก็จะเห็นปุ่มเด้งขึ้นมาทันที — **จับคีย์ทั่วระบบแม้แอปไม่ได้โฟกัส** (กดเกมอยู่ก็เห็น)
3. ปุ่มบนแถบด้านบน: `↺` รีเซ็ตตัวนับ, `✕` ปิดแอป — ลากหน้าต่างได้จากแถบด้านบน

### เอาไปใส่ OBS

1. เปิด OBS → Sources → **+** → **Window Capture**
2. เลือก window: **KeyPressOverlay**
3. วางมุมจอตามที่ชอบ (ถ้าพื้นหลังเห็นเป็นดำ → Filter → Chroma Key → เลือกสีดำ)

---

## เกี่ยวกับการ Release

Repo นี้ใช้ **GitHub Actions** build แบบ cloud และ publish ลง GitHub Releases ของ repo นี้เอง

**ขั้นตอนการปล่อยเวอร์ชันใหม่ (สำหรับผู้พัฒนา):**

1. อัปเดต `version` ใน `package.json` + เพิ่ม section ใหม่ใน `CHANGELOG.md` (รูปแบบ `## [x.y.z] - วันที่`) — release notes จะดึงจาก section นี้ไปใส่ในหน้า Releases อัตโนมัติ
2. commit + push ขึ้น `main`
3. รันคำสั่ง release (ต้องมี `GH_TOKEN` หรือ `GITHUB_TOKEN` ใน environment หรือไฟล์ `.env`):

```bash
npm run release:win         # build เฉพาะ Windows
npm run release:linux       # build เฉพาะ Linux
npm run release:win:linux   # build ทั้ง Windows + Linux
npm run release:all         # build ทั้งหมด
```

คำสั่งจะ trigger workflow `release.yml` บน GitHub Actions → build ตาม platform ที่เลือก → สร้าง release ตัวเดียว (tag `v<version>`) → อัปโหลด installer + latest.yml เข้า release

**หมายเหตุ:**
- ต้องตั้ง **`RELEASE_TOKEN`** secret ใน repo (Personal Access Token ที่มีสิทธิ์ `repo` — ใช้ token ที่ไม่หมดอายุดีที่สุด)
- macOS ไม่มีใน matrix ของ workflow (ต้อง build บนเครื่อง Mac ด้วย `npm run build:mac` แล้วอัปโหลดเอง)
- token อ่านจาก environment หรือไฟล์ `.env` ที่ gitignore ไว้ (`GH_TOKEN=...`)

## System Requirements

- Windows 10/11, Linux (AppImage), macOS 11+
- RAM ~200MB (Electron)
