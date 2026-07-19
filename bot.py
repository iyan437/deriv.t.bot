import asyncio
import websockets
import json
import ssl
import os
import sys

# Put your token and app_id here for testing. For safety later, use Environment Variables
TOKEN = os.getenv("DERIV_TOKEN", "PASTE_YOUR_TOKEN_HERE") 
APP_ID = os.getenv("DERIV_APP_ID", "1089")
URL = f"wss://ws.derivws.com/websockets/v3?app_id={APP_ID}"

TARGET_7_COUNT = 20  # Keep this low on GitHub Actions. 50 will timeout
COOLDOWN_TICKS = 2

seven_count = 0
cooldown = 0

ssl_context = ssl.create_default_context()

async def run_bot():
    global seven_count, cooldown
    print("Bot Starting...")
    while True:
        try:
            async with websockets.connect(URL, ssl=ssl_context, ping_interval=20, ping_timeout=20) as ws:
                print("Connected to Deriv")
                # Authorize
                await ws.send(json.dumps({"authorize": TOKEN}))
                auth_resp = await ws.recv()
                print("Authorized:", json.loads(auth_resp).get("msg_type"))
                
                # Subscribe to ticks
                await ws.send(json.dumps({"ticks": "R_100", "subscribe": 1}))
                
                while True:
                    msg = await ws.recv()
                    data = json.loads(msg)
                    
                    if "tick" in data:
                        last_digit = int(str(data["tick"]["quote"])[-1])
                        if last_digit == 7:
                            seven_count += 1
                        
                        cooldown += 1
                        print(f"Tick | LastDigit: {last_digit} | 7 count: {seven_count}/{TARGET_7_COUNT} | Cooldown: {cooldown}/{COOLDOWN_TICKS}")
                        
                        if seven_count >= TARGET_7_COUNT and cooldown >= COOLDOWN_TICKS:
                            print("SIGNAL! Place trade here")
                            # Your trade logic goes here
                            seven_count = 0
                            cooldown = 0
                            
        except websockets.exceptions.ConnectionClosed:
            print("Connection closed. Reconnecting in 5s...")
            await asyncio.sleep(5)
        except Exception as e:
            print("Error:", e)
            await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(run_bot())
    except KeyboardInterrupt:
        print("Bot stopped")
        sys.exit(0)
