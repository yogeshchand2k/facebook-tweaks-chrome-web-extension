# Facebook Tweaks

A small, dependency-free Chrome extension built with Manifest V3, HTML, CSS, and plain JavaScript. It provides persistent popup settings for Facebook and a content script that applies them to Facebook pages as they load.

## Included settings

- **Hide left panel** hides the left-side navigation landmark. **Hide right panel** hides the right-side complementary landmark (`role="complementary"`). **Hide top post bar** looks for the `xod5an3` class together with a nested `role="region" aria-label="Create a post"` landmark, avoiding other Facebook elements that reuse the class. **Hide story bar** targets the Facebook stories landmark (`role="region" aria-label="Stories" data-focus-target="stories_tray"`). **Hide tab bar** targets the Facebook-labeled navigation containing the Home, Reels, Friends, Marketplace, and Groups links. **Hide Reels section** finds the `role="grid" aria-label="Reels"` grid and hides its nearest ancestor that also contains an `h3` heading named “Reels”. **Hide new message button** targets Facebook's button labeled `New message`. The **Enable compact mode** and **Hide Ad sections** controls are currently hidden from the popup; their existing settings and behavior remain in the code.
- Facebook panel detection runs after page mutations and retries during the first few seconds after load so it can match panels whose layout appears after Facebook's initial markup.

Settings are stored in one Facebook profile.

On a fresh install, visible Facebook options are enabled by default. The hidden **Hide Ad sections** and **Enable compact mode** settings default to disabled. These defaults are saved the first time the popup opens; subsequent changes are preserved. When upgrading, only profiles that exactly match an older untouched Facebook default are updated; customized Facebook profiles are preserved. Settings for unsupported sites are discarded during the settings migration.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose this folder.
4. Open Facebook and select the Facebook Tweaks toolbar button to change its settings.

The extension requests access only to Facebook (`facebook.com`, including its subdomains) and only injects its content script there. After updating an existing installation, reload the extension at `chrome://extensions` and approve any site-access prompt Chrome shows. Chrome does not allow extensions to run on certain restricted pages (such as Chrome's own settings pages). Settings are stored with `chrome.storage.sync`.

## Project files

- `manifest.json` declares the Manifest V3 extension, limited site permissions, and content script matches.
- `popup.html`, `popup.css`, and `popup.js` implement the settings panel.
- `content.js` loads saved preferences and responds to changes.
- `styles.css` contains the opt-in page adjustments.

## Reference

The structure follows the official [Chrome Extensions "Hello World" tutorial](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world/) and [content script documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts/).
