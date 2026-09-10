# SEVEN Popup Guard

This optional Chrome/Edge Manifest V3 extension blocks new windows and top-level navigations initiated by SEVEN's configured embedded-player domains. It is a popup guard, not a media proxy: it does not read, store, transmit, rewrite, or extract playback requests.

## Install locally

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `CompanionExtension` folder.
4. Pin **SEVEN Popup Guard** if you want to use its ON/OFF button.

The badge shows **ON** while blocking is enabled. It requests access only to SEVEN and the four configured player domains. The browser may briefly create a tab before closing it; the declarative rule blocks the navigation itself, while the navigation listener is a fallback for popup types the rule does not see.

This extension does not filter general browsing, analyze provider pages, or collect browsing history, credentials, or playback URLs.
