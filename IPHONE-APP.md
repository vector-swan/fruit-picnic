# Fruit Picnic on your iPhone

The game is wrapped in a real iPhone app using Capacitor. The app adds:

- **Haptics:** a light tap on merges, a stronger bump for each new tile, a
  happy buzz when you win and a soft warning buzz on game over.
- **Vibration button:** a phone icon next to the sound button turns haptics
  on or off. It only shows in the app, not on the website.
- **Full-screen play:** the game fills the screen, stays clear of the notch,
  and the status bar switches between dark and light text with the theme.
- **Basket launch screen** and the basket as the home-screen icon.
- **Portrait only**, so the board never flips sideways.

The website at https://fruitpicnic.io keeps working as before.

## One-time setup on your Mac

1. **Install Xcode** from the Mac App Store (it's free and large, so give it a
   while). Open it once and let it install any extra parts it asks for.
2. **Install Node.js** (the "LTS" version) from https://nodejs.org.
3. **Download the game.** Open the Terminal app and paste:

   ```
   git clone https://github.com/vector-swan/2048.git
   cd 2048
   git checkout claude/2048-game-app-LkTh3
   npm install
   ```

## Put the app on your iPhone

1. In Terminal, inside the `2048` folder, run:

   ```
   npm run ios
   ```

   This copies the latest game into the app and opens it in Xcode.
2. **Sign in to Xcode:** Xcode menu → Settings → Accounts → **+** → Apple ID.
3. **Pick your team:** in the left sidebar click **App** (the blue icon at the
   top), then the **Signing & Capabilities** tab. Under **Team**, choose your
   name (Personal Team).
   - If Xcode says the bundle identifier isn't available, change
     `io.github.vectorswan.fruitpicnic` to something unique, like
     `com.yourname.fruitpicnic`.
4. **Connect your iPhone** with a cable and tap **Trust** on the phone.
5. **Turn on Developer Mode** on the iPhone: Settings → Privacy & Security →
   Developer Mode → on. The phone restarts.
6. At the top of Xcode, choose **your iPhone** as the device, then press the
   **▶ Run** button.
7. The first time, the iPhone won't open the app until you trust yourself as
   a developer: Settings → General → VPN & Device Management → your Apple ID
   → **Trust**. Then open Fruit Picnic from the home screen.

With a free Apple ID the app stops opening after **7 days**. Plug the phone
in and press ▶ Run again to reinstall it. Your scores are kept.

## After the game changes

```
git pull
npm run ios
```

Then press ▶ Run in Xcode.

## Sharing with friends (later)

Join the Apple Developer Program ($99 a year). In Xcode, choose
**Product → Archive**, upload it, and invite friends through **TestFlight**
in App Store Connect. They install it from the TestFlight app and get
updates automatically. The same account is what you'd use for the App Store.

## How it's put together

- `index.html`, `style.css`, `game.js`, `tiles.js`: the game. The same
  files run the website and the app.
- `npm run build` copies the game into `www/`, which the app is built from.
- `ios/`: the Xcode project. The app icon and launch screen are in
  `ios/App/App/Assets.xcassets`.
- `capacitor.config.json`: app name, app ID and launch-screen settings.
