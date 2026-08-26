# StellaStatus

**[한국어](README.md)** | English | [日本語](README.jp.md)

A Linux-focused unofficial fork of StellaStatus that checks CHZZK streaming status for StellaLive members and shows desktop notifications when streams start.

> This repository is a fork of the original project: https://github.com/tabiluv/stellastatus_app  
> This fork adds Linux support and AppImage builds. The original project's functionality and MIT license are retained except for Linux-specific changes.

This is an unofficial fan-made project and is not an official StellaLive service.

## Features

- Periodically checks CHZZK live status
- Desktop notifications when subscribed members go live
- Optional automatic opening of live streams
- Member profiles, live title/category/viewers, and thumbnails
- Today's streaming schedule based on StelLight
- System tray support and launch-at-login option
- GitHub Releases update checking and Linux AppImage download

## Linux support

Currently supported distribution target:

- Linux x86_64 (x64)
- AppImage

## Install

Download the `.AppImage` file from GitHub Releases, then:

```bash
chmod +x StellaStatus-*.AppImage
./StellaStatus-*.AppImage
```

## Development

Node.js 24 or newer is recommended.

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm start
```

## Build

```bash
npm ci
npm run gen-icon
npm run gen-logos
npm run dist
```

The AppImage is generated under `dist/`.

## License

MIT License.

Original project: https://github.com/tabiluv/stellastatus_app  
Linux fork: https://github.com/Maroshall/stellastatus_app

See `LICENSE` for the full license text.
