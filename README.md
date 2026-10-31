# MR. DOOD – PREMIUM INTERACTIVE QR LETTER HUNT EXPERIENCE
### High-Engagement Mobile Game for AccroNex 2026 & University Events

A mobile-first, arcade-style treasure hunt where participants explore the event venue, scan 7 hidden QR codes, unlock the letters of **MR.DOOD**, and claim prizes at the event booth.

---

## 🚀 Key Features

1. **Pure Client-Side Architecture**:
   - Zero database, zero external APIs, zero backend server required.
   - Saves all player progress locally in `localStorage` (`mrdood_hunt_player`).
   - Resilient against network drops, spotty Wi-Fi, and crowded event cell reception.

2. **Creative 3D Arcade Visual Design**:
   - Vibrant Mr. Dood palette: Deep Navy (`#101827`), Fresh Lime (`#B7E44A`), Mr. Dood Green (`#8CC63F`), Warm Cream (`#FFF9EC`), and Accent Orange (`#FF9F43`).
   - Tactile 3D Collectible Letter Tiles with locked depth, unlocked golden sheen, embossed bevels, and animated pop bounces.
   - Floating fresh produce illustrations (apples, carrots, oranges, broccoli, stars).
   - High-performance continuous celebration confetti engine.

3. **In-App Camera QR Scanner (Offline)**:
   - Full-screen scanner with glowing lime corner brackets and moving laser sweep.
   - Zero external CDN reliance: `jsQR.min.js` bundled locally.
   - Camera flip (front/back), flashlight/torch toggle, and photo library fallback.

4. **Multi-Format QR Parser**:
   - Compatible with URLs (e.g. `https://your-domain.com/1/`, `?scan=1`, `?q=1`), numbers (`1` to `7`), and direct letters (`M`, `R`, `.`, `D`, `O`, `O`, `D`).
   - Supports out-of-order scanning.
   - Prevents duplicate scans with a friendly animated modal.

5. **Letter Discovery Reward Moment**:
   - 3D rotating collectible token emergence.
   - Particle bursts and Web Audio chime sound effects.
   - Token flies across the screen and snaps into its matching dashboard slot with bounce and golden shine.

6. **Final Victory Screen & Prize Presentation Mode**:
   - Full celebration takeover with confetti shower.
   - Staggered drop-in animation for each letter of **MR.DOOD**.
   - Official **Prize Presentation Certificate** featuring:
     - Verified Explorer Name.
     - Rotating security seal.
     - Live anti-tamper verification clock (prevents fake screenshots).
     - Unique verification ticket code.

7. **Interactive Explorer Leaderboard & Speedrun Podium**:
   - Tap the 🏆 button in the top navigation or on the dashboard/victory screens.
   - 3D Podium for Top 3 Champions (1st 🥇 Gold Crown, 2nd 🥈 Silver, 3rd 🥉 Bronze) with speedrun times and initials avatars.
   - Live rankings list sorted by fastest completion time (`MM:SS`).
   - Personal high score tracking: automatically records player's official time and highlights their rank with a glowing `"YOU"` badge.
   - Bottom status bar showing current player's live rank and speedrun time.

8. **Event Organizer & Test Hub**:
   - Tap the ⚙️ icon in the top right to open the Organizer Drawer.
   - One-click "Simulate Scan" buttons to test any letter immediately without physical QR codes.
   - Built-in scannable QR cards with `qrcode.min.js`.
   - One-click progress reset.
   - Printable QR Sheet (`qr-sheet.html`).

---

## 📂 File Structure

```
mr-dood-game/
├── index.html        # Main mobile game application
├── styles.css        # Premium 3D arcade styling & animations
├── app.js            # Game engine, Web Audio FX, QR parser, localStorage state
├── qr-sheet.html     # High-resolution printable QR code sheet
├── assets/
│   ├── logo.png      # Official Mr. Dood brand logo
│   ├── jsQR.min.js   # Embedded offline QR scanner engine
│   └── qrcode.min.js # Embedded offline QR generator
├── 1/                # Smart landing page for Letter M (auto-redirects to ?scan=1)
├── 2/                # Smart landing page for Letter R (auto-redirects to ?scan=2)
├── 3/                # Smart landing page for Dot . (auto-redirects to ?scan=3)
├── 4/                # Smart landing page for Letter D (auto-redirects to ?scan=4)
├── 5/                # Smart landing page for Letter O (auto-redirects to ?scan=5)
├── 6/                # Smart landing page for Letter O (auto-redirects to ?scan=6)
└── 7/                # Smart landing page for Letter D (auto-redirects to ?scan=7)
```

---

## 📱 How to Test on Mobile Phones

### Option A: Local Network Testing (Same Wi-Fi)
1. Start a local HTTP server in this directory:
   ```bash
   python -m http.server 8080
   ```
2. Find your computer's local IP address (e.g. `192.168.1.5`):
   ```bash
   ipconfig
   ```
3. Open `http://<YOUR_IP>:8080` in Safari on an iPhone or Chrome on an Android phone.
4. Open `http://<YOUR_IP>:8080/qr-sheet.html` on your desktop screen and scan the QR codes using your phone!

### Option B: Free Static Deployment (Render / GitHub Pages / Vercel)
1. Deploy this folder as a **Static Site** on [Render.com](https://render.com) (or GitHub Pages).
2. Your public URL will be `https://your-site.onrender.com`.
3. Open on any mobile phone!
