#!/usr/bin/env python3
"""Build the static user guide in public/docs from docs/content/*.md."""

from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "docs" / "content"
OUT = ROOT / "public" / "docs"

SECTION_ORDER = [
    "Start here",
    "Account",
    "Communication",
    "The work",
    "Money",
    "Growth",
]


def parse_frontmatter(text: str) -> tuple[dict[str, str], str]:
    if not text.startswith("---\n"):
        raise SystemExit("missing frontmatter")
    _, raw, body = text.split("---", 2)
    meta: dict[str, str] = {}
    for line in raw.strip().splitlines():
        key, value = line.split(":", 1)
        meta[key.strip()] = value.strip()
    return meta, body.strip() + "\n"


def slugify(text: str) -> str:
    text = re.sub(r"<[^>]+>", "", text)
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "section"


def inline(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"`([^`]+)`", r"<code>\1</code>", escaped)
    escaped = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(
        r"\[([^\]]+)\]\(([^)]+)\)",
        r'<a href="\2">\1</a>',
        escaped,
    )
    return escaped


def markdown_to_html(body: str) -> tuple[str, list[tuple[str, str, int]]]:
    lines = body.splitlines()
    blocks: list[str] = []
    toc: list[tuple[str, str, int]] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith("### "):
            title = line[4:].strip()
            sid = slugify(title)
            toc.append((sid, title, 3))
            blocks.append(f'<h3 id="{sid}">{inline(title)}</h3>')
            i += 1
            continue
        if line.startswith("## "):
            title = line[3:].strip()
            sid = slugify(title)
            toc.append((sid, title, 2))
            blocks.append(f'<h2 id="{sid}">{inline(title)}</h2>')
            i += 1
            continue
        if line.startswith("> "):
            quote = []
            while i < len(lines) and lines[i].startswith("> "):
                quote.append(lines[i][2:])
                i += 1
            blocks.append(f'<div class="docs-callout"><p>{inline(" ".join(quote))}</p></div>')
            continue
        if line.strip() == "{{directory}}":
            blocks.append("<!--DIRECTORY-->")
            i += 1
            continue
        if line.startswith("- "):
            items = []
            while i < len(lines) and lines[i].startswith("- "):
                items.append(f"<li>{inline(lines[i][2:].strip())}</li>")
                i += 1
            blocks.append("<ul>\n" + "\n".join(items) + "\n</ul>")
            continue
        if re.match(r"\d+\. ", line):
            items = []
            while i < len(lines) and re.match(r"\d+\. ", lines[i]):
                item = re.sub(r"^\d+\. ", "", lines[i]).strip()
                items.append(f"<li>{inline(item)}</li>")
                i += 1
            blocks.append("<ol>\n" + "\n".join(items) + "\n</ol>")
            continue
        para = [line.strip()]
        i += 1
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(
            ("#", "-", ">", "```")
        ) and not re.match(r"\d+\. ", lines[i]):
            para.append(lines[i].strip())
            i += 1
        blocks.append(f"<p>{inline(' '.join(para))}</p>")
    return "\n".join(blocks), toc


def load_pages() -> list[dict]:
    pages = []
    for path in sorted(CONTENT.glob("*.md")):
        meta, body = parse_frontmatter(path.read_text())
        html_body, toc = markdown_to_html(body)
        pages.append(
            {
                "slug": path.stem,
                "title": meta["title"],
                "description": meta["description"],
                "section": meta["section"],
                "order": int(meta.get("order", "0")),
                "search": meta.get("search", ""),
                "html": html_body,
                "toc": toc,
            }
        )
    pages.sort(key=lambda page: (SECTION_ORDER.index(page["section"]), page["order"], page["title"]))
    return pages


def chrome(title: str, description: str, body: str) -> str:
    full_title = "User guide — Olyve" if title == "User guide" else f"{title} — Olyve guide"
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{html.escape(full_title)}</title>
    <meta name="description" content="{html.escape(description)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/styles.css" />
    <link rel="stylesheet" href="/docs.css" />
    <script type="module" src="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.20.1/cdn/components/drawer/drawer.js"></script>
    <script>
      (() => {{
        try {{
          const stored = localStorage.getItem("theme");
          const theme =
            stored === "light" || stored === "dark"
              ? stored
              : window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
          document.documentElement.setAttribute("data-theme", theme);
        }} catch (e) {{}}
      }})();
    </script>
  </head>
  <body class="docs-body">
    <div class="page-bg" aria-hidden="true"></div>
    <header class="site-header">
      <div class="header-inner">
        <button class="nav-toggle" type="button" aria-label="Open menu" aria-expanded="false" data-nav-open>
          <span class="hamburger" aria-hidden="true"><span></span></span>
        </button>
        <a class="wordmark" href="/" aria-label="Olyve home">
          <img class="logo logo-light" src="/olyve_logo.png" alt="Olyve" width="140" height="36" />
          <img class="logo logo-dark" src="/olyve_logo_dark.png" alt="Olyve" width="140" height="36" />
        </a>
        <nav class="site-nav">
          <a href="/#overview">Product</a>
          <a class="is-current" href="/docs">Guide</a>
          <a href="/support">Support</a>
          <a href="https://axialmotion.com">Axial Motion</a>
          <button class="theme-toggle" type="button" data-theme-toggle aria-label="Toggle color theme">Dark</button>
        </nav>
      </div>
    </header>
    <sl-drawer class="nav-drawer" label="Menu" placement="start" no-header data-nav-drawer>
      <nav class="drawer-nav">
        <a href="/#overview">Product</a>
        <a class="is-current" href="/docs">Guide</a>
        <a href="/support">Support</a>
        <a href="https://axialmotion.com">Axial Motion</a>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Toggle color theme">Dark</button>
      </nav>
    </sl-drawer>
    {body}
    <footer class="site-footer">
      <p>© <span id="year"></span> Axial Motion. Olyve is a product of Axial Motion.</p>
      <div class="footer-links">
        <a href="/docs">Guide</a>
        <a href="/billing">Billing</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/refunds">Refunds</a>
        <a href="/support">Support</a>
        <a href="/delete-account">Delete account</a>
      </div>
    </footer>
    <script src="/site.js"></script>
    <script src="/docs.js"></script>
  </body>
</html>
"""


def href(slug: str) -> str:
    return "/docs" if slug == "index" else f"/docs/{slug}"


def nav_html(pages: list[dict], current: str) -> str:
    groups: dict[str, list[dict]] = {}
    for page in pages:
        if page["slug"] == "index":
            continue
        groups.setdefault(page["section"], []).append(page)
    parts = [
        '<aside class="docs-nav" data-docs-nav>',
        '<input class="docs-search" type="search" placeholder="Search the guide" aria-label="Search the guide" data-docs-search />',
    ]
    for section in SECTION_ORDER:
        items = groups.get(section, [])
        if not items:
            continue
        parts.append('<div class="docs-nav-group" data-docs-group>')
        parts.append(f'<p class="docs-nav-label">{html.escape(section)}</p>')
        for page in items:
            current_attr = ' class="is-current"' if page["slug"] == current else ""
            search = html.escape(f"{page['title']} {page['description']} {page['search']}")
            parts.append(
                f'<a{current_attr} href="{href(page["slug"])}" data-search="{search}">{html.escape(page["title"])}</a>'
            )
        parts.append("</div>")
    parts.append('<p class="docs-search-empty" data-docs-empty>No pages match that search.</p>')
    parts.append("</aside>")
    return "\n".join(parts)


def toc_html(toc: list[tuple[str, str, int]]) -> str:
    headings = [item for item in toc if item[2] == 2]
    if not headings:
        return ""
    links = "\n".join(
        f'<a href="#{sid}">{html.escape(title)}</a>' for sid, title, _level in headings
    )
    return f'<aside class="docs-toc"><p class="docs-toc-label">On this page</p>{links}</aside>'


def directory_html(pages: list[dict]) -> str:
    groups: dict[str, list[dict]] = {}
    for page in pages:
        if page["slug"] == "index":
            continue
        groups.setdefault(page["section"], []).append(page)
    parts = ['<div class="docs-directory">']
    for section in SECTION_ORDER:
        items = groups.get(section, [])
        if not items:
            continue
        parts.append("<section>")
        parts.append(f"<h2>{html.escape(section)}</h2>")
        parts.append('<div class="docs-cards">')
        for page in items:
            parts.append(
                f'<a class="docs-card" href="{href(page["slug"])}"><strong>{html.escape(page["title"])}</strong><span>{html.escape(page["description"])}</span></a>'
            )
        parts.append("</div></section>")
    parts.append("</div>")
    return "\n".join(parts)


def pager_html(pages: list[dict], index: int) -> str:
    articles = [page for page in pages if page["slug"] != "index"]
    if pages[index]["slug"] == "index":
        return ""
    article_index = articles.index(pages[index])
    parts = ['<nav class="docs-pager" aria-label="Guide pages">']
    if article_index > 0:
        prev_page = articles[article_index - 1]
        parts.append(
            f'<a href="{href(prev_page["slug"])}"><small>Previous</small><strong>{html.escape(prev_page["title"])}</strong></a>'
        )
    else:
        parts.append('<a href="/docs"><small>Previous</small><strong>User guide</strong></a>')
    if article_index < len(articles) - 1:
        next_page = articles[article_index + 1]
        parts.append(
            f'<a class="is-next" href="{href(next_page["slug"])}"><small>Next</small><strong>{html.escape(next_page["title"])}</strong></a>'
        )
    parts.append("</nav>")
    return "\n".join(parts)


def render(pages: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.html"):
        old.unlink()
    for index, page in enumerate(pages):
        body_html = page["html"].replace("<!--DIRECTORY-->", directory_html(pages))
        article = f"""
    <div class="docs-shell">
      <button class="docs-menu-btn" type="button" data-docs-menu aria-expanded="false">Guide pages</button>
      {nav_html(pages, page["slug"])}
      <article class="docs-article">
        <p class="docs-kicker">{html.escape(page["section"])}</p>
        <h1>{html.escape(page["title"])}</h1>
        <p class="docs-lede">{html.escape(page["description"])}</p>
        {body_html}
        {pager_html(pages, index)}
      </article>
      {toc_html(page["toc"])}
    </div>
"""
        filename = "index.html" if page["slug"] == "index" else f"{page['slug']}.html"
        (OUT / filename).write_text(chrome(page["title"], page["description"], article))
        print(filename)


def main() -> None:
    pages = load_pages()
    if not any(page["slug"] == "index" for page in pages):
        raise SystemExit("docs/content/index.md is required")
    render(pages)


if __name__ == "__main__":
    main()
