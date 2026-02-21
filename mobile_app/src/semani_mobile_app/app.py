"""Semani mobile application entry point."""

import os

import toga
from toga.style import Pack
from toga.style.pack import COLUMN


DEFAULT_WEBSITE_URL = "https://your-website-url.example"


class SemaniMobile(toga.App):
    def startup(self):
        website_url = os.getenv("SEMANI_WEBSITE_URL", DEFAULT_WEBSITE_URL)

        webview = toga.WebView(url=website_url, style=Pack(flex=1))
        container = toga.Box(style=Pack(direction=COLUMN, flex=1), children=[webview])

        self.main_window = toga.MainWindow(title=self.formal_name)
        self.main_window.content = container
        self.main_window.show()


def main():
    return SemaniMobile()
