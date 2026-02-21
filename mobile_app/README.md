# Semani Mobile App (Android + iPhone)

This folder contains a Python-based mobile app using [BeeWare Briefcase](https://briefcase.readthedocs.io/) and Toga.
The app wraps your website in a native mobile shell for:

- Android
- iOS (iPhone)

## 1) Set your website URL

By default, the app opens:

`https://your-website-url.example`

Set your actual URL before building:

```bash
export SEMANI_WEBSITE_URL="https://your-real-website.com"
```

Or edit `DEFAULT_WEBSITE_URL` in `src/semani_mobile_app/app.py`.

## 2) Install tooling

From this `mobile_app` directory:

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install briefcase
```

## 3) Build and run Android app

```bash
briefcase create android
briefcase build android
briefcase run android
```

## 4) Build and run iPhone app (iOS)

> Requires macOS + Xcode.

```bash
briefcase create iOS
briefcase build iOS
briefcase run iOS
```

## Notes

- This is a thin wrapper app around your website.
- For app store release, update app icon/splash screen, bundle metadata, and signing settings.
