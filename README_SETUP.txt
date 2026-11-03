MR.DOOD QR HUNT - SERVER SETUP (Render, free)
==============================================
1) GitHub: create a NEW *PRIVATE* repo and upload everything in this folder
   (server.js, package.json, render.yaml, public/, private/).  Private matters: the letter images are inside.
2) Render: delete the OLD static site called mr-dood-game (so the name is free), then
   New > Web Service > pick the repo.   Runtime: Node.   Build command: echo "no build".   Start command: node server.js
   Instance type: Free.
3) Render > Environment, add:
      SECRET          (copy from KEYS_PRIVATE.txt in the QR zip)
      ADMIN_PASSWORD  (copy from KEYS_PRIVATE.txt, or choose your own)
4) Deploy. Open  https://mr-dood-game.onrender.com/healthz  -> should say ok.
   Admin:  https://mr-dood-game.onrender.com/admin   (log in; keep it open during the event)
   If Render gives you a different address, regenerate the cards with it (see README_CARDS.txt).
5) BEFORE THE EVENT: scan one card yourself, check the admin feed shows it, then Admin > Danger zone > Reset.

KEEP IT AWAKE (important on the free plan): add a free monitor at uptimerobot.com that opens /healthz every 5 minutes,
otherwise the first scan after 15 idle minutes can take ~50 seconds.

OPTIONAL
- Keep scores if Render restarts: make a free Upstash Redis database, then add
      UPSTASH_REDIS_REST_URL   and   UPSTASH_REDIS_REST_TOKEN   in Render.
- Phone push when the admin page is closed: install the free "ntfy" app, subscribe to a long random topic,
  add  NTFY_TOPIC=<that topic>  in Render.   (Or Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.)
- MIN_SCAN_GAP_SEC (default 10): scanning two cards faster than this flags the player as suspicious.

HOW THE GAME WORKS
Players open the site or scan a card, type a name, scan all 7 hidden cards (each reveals one letter picture),
then type the secret word to win. Winners get a place number and a claim code to show you.
Admin sees every scan live (name + QR number), flagged fast scans, winners, and can pause, disqualify, remove or reset.
