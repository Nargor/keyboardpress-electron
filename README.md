# KeyPress Overlay ⌨️

หน้าต่างโปร่งใสขนาดเล็กไว้ **โชว์ปุ่มที่เรากดบนคีย์บอร์ด** เอาไปใส่ในโปรแกรมไลฟ์ (OBS, Twitch Studio ฯลฯ) — เหมาะกับสตรีมเกม ไลฟ์โค้ด หรือคอนเทนต์ที่ต้องโชว์คีย์บอร์ด

## สร้างด้วยอะไร?

- **Electron** — หน้าต่างโปร่งใส always-on-top + จับคีย์อยู่ใน process เดียวกัน ไม่ต้องมี daemon แยก
- **koffi** (FFI) เรียก `GetAsyncKeyState` ของ Windows โดยตรงจาก main process — จับคีย์ทั่วระบบ (แม้แอปไม่ได้โฟกัส) โค้ดเป็น JS ล้วน ไม่ต้องคอมไพล์
- **TypeScript + esbuild** สำหรับ UI

> จุดสำคัญ: **เบราว์เซอร์จับคีย์ตอนแอปไม่ได้ focus ไม่ได้** (security ของเว็บ) เพราะฉะนั้นต้องจับคีย์ผ่าน native — koffi เรียก Win32 API โดยตรงใน main process ของ Electron

## ความต้องการ (สำหรับ dev)

- Windows 10/11
- Node.js 18+

## เริ่มใช้งาน

```bash
npm install
npm start
```

หน้าต่างโปร่งใสจะเด้งขึ้นมา กดคีย์อะไรก็จะเห็นปุ่มเด้งทันที — **ทำงานแม้แอปไม่ได้โฟกัส** (จับคีย์ทั้งระบบ)

ปุ่มบนแถบด้านบน: `↺` รีเซ็ตตัวนับ, `✕` ปิดแอป — ลากหน้าต่างได้จากแถบด้านบน

### โหมดทดสอบ (ไม่ต้องแตะคีย์บอร์ดจริง)

```bash
npm test
```

จะส่งคีย์จำลองให้ดู UI ทำงาน โดยไม่รบกวนคีย์บอร์ดจริง

## เอาไปใส่ OBS

1. เปิด OBS → Sources → **+** → **Window Capture**
2. เลือก window: **KeyPressOverlay** (ถ้าหาไม่เจอ ให้เปิดแอปก่อนแล้วกลับมาที่ OBS แล้วกด Refresh)
3. วางมุมจอตามที่ชอบ — หน้าต่าง **always-on-top** อยู่แล้ว
4. ถ้าพื้นหลังโปร่งใสไม่เห็น (เห็นเป็นดำ) → Filter ที่ source นั้น → **+** → **Chroma Key** แล้วเลือกสีดำ

## สร้าง Release (portable exe ตัวเดียว)

```bash
npm run dist
```

จะได้ **`release/KeyPressOverlay 1.0.0.exe`** (~90 MB) — portable exe ตัวเดียว เอาไปแจกได้เลย
ดับเบิลคลิกแล้วใช้ได้ทันที ไม่ต้องติดตั้ง Node หรืออะไรทั้งนั้น

## โครงสร้างโปรเจค

```
electron/main.js      # main process: หน้าต่าง + จับคีย์ (koffi) + ส่ง IPC
electron/preload.js   # contextBridge: ส่ง key events เข้า renderer
ui/main.ts            # UI (TypeScript) build ด้วย esbuild → resources/js/main.js
resources/            # HTML/CSS ของ overlay
```

## การพัฒนา

```bash
npm run build:ui    # compile ui/main.ts → resources/js/main.js
npm run typecheck   # ตรวจ TypeScript
npm run dist        # build portable exe
```

## ทำไมถึงไม่ใช้ keylogger library ทั่วไป?

`node-global-key-listener` / `iohook` ใช้ exe binary ที่ไม่ได้เซ็นชื่อ → **Windows Defender ลบไฟล์ทิ้งทันที** (เจอจริงตอนพัฒนา) เลยเลือกใช้ koffi เรียก Win32 API โดยตรง ปลอดภัยกว่าและโค้ดยังเป็น JS ล้วน
