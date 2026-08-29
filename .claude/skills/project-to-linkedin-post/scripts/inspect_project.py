#!/usr/bin/env python3
"""Print a compact fact sheet about a project directory.

Reads manifests, README, git history, file tree and deploy hints so a post can be
written from what the repo actually contains. Standard library only, no network,
read-only.

Usage:
    python3 inspect_project.py [path]
"""

import json
import os
import re
import subprocess
import sys
from collections import Counter

SKIP_DIRS = {
    ".git", "node_modules", "dist", "build", "out", ".next", ".nuxt", "vendor",
    "__pycache__", ".venv", "venv", "env", ".tox", "target", "coverage",
    ".pytest_cache", ".mypy_cache", ".idea", ".vscode", ".angular", ".cache",
    "bower_components", "Pods", ".gradle", "bin", "obj",
}

LANG_BY_EXT = {
    ".ts": "TypeScript", ".tsx": "TypeScript (React)", ".js": "JavaScript",
    ".jsx": "JavaScript (React)", ".mjs": "JavaScript", ".cjs": "JavaScript",
    ".py": "Python", ".rb": "Ruby", ".go": "Go", ".rs": "Rust",
    ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".m": "Objective-C",
    ".c": "C", ".h": "C/C++ header", ".cpp": "C++", ".cc": "C++", ".cs": "C#",
    ".php": "PHP", ".dart": "Dart", ".vue": "Vue", ".svelte": "Svelte",
    ".scss": "SCSS", ".sass": "Sass", ".css": "CSS", ".html": "HTML",
    ".sql": "SQL", ".sh": "Shell", ".ipynb": "Jupyter",
}

DEPLOY_HINTS = {
    "Dockerfile": "Docker", "docker-compose.yml": "Docker Compose",
    "docker-compose.yaml": "Docker Compose", "vercel.json": "Vercel",
    "netlify.toml": "Netlify", "fly.toml": "Fly.io", "Procfile": "Heroku",
    "render.yaml": "Render", "app.yaml": "Google App Engine",
    "serverless.yml": "Serverless", "firebase.json": "Firebase",
    ".github/workflows": "GitHub Actions CI", ".gitlab-ci.yml": "GitLab CI",
    "kubernetes": "Kubernetes", "k8s": "Kubernetes",
}


def out(line=""):
    print(line)


def read(path, limit=200_000):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read(limit)
    except OSError:
        return ""


def git(root, *args):
    try:
        res = subprocess.run(
            ["git", "-C", root, *args],
            capture_output=True, text=True, timeout=15,
        )
        return res.stdout.strip() if res.returncode == 0 else ""
    except (OSError, subprocess.SubprocessError):
        return ""


# --- manifests ---------------------------------------------------------------

def node_manifest(root):
    raw = read(os.path.join(root, "package.json"))
    if not raw:
        return None
    try:
        pkg = json.loads(raw)
    except json.JSONDecodeError:
        return None
    repo = pkg.get("repository")
    if isinstance(repo, dict):
        repo = repo.get("url")
    deps = list((pkg.get("dependencies") or {}).keys())
    peer = list((pkg.get("peerDependencies") or {}).keys())
    return {
        "ecosystem": "npm / Node",
        "name": pkg.get("name"),
        "version": pkg.get("version"),
        "description": pkg.get("description"),
        "keywords": pkg.get("keywords") or [],
        "license": pkg.get("license"),
        "homepage": pkg.get("homepage"),
        "repository": repo,
        "private": pkg.get("private", False),
        "scripts": list((pkg.get("scripts") or {}).keys()),
        "deps": deps + peer,
        "workspaces": pkg.get("workspaces"),
    }


def python_manifest(root):
    raw = read(os.path.join(root, "pyproject.toml")) or read(os.path.join(root, "setup.py"))
    if not raw:
        return None
    def grab(key):
        m = re.search(rf'^\s*{key}\s*=\s*["\']([^"\']+)["\']', raw, re.M)
        return m.group(1) if m else None
    return {
        "ecosystem": "Python",
        "name": grab("name"),
        "version": grab("version"),
        "description": grab("description"),
        "license": grab("license"),
        "deps": re.findall(r'["\']([a-zA-Z0-9_.-]+)\s*[><=~!]', raw)[:25],
    }


def simple_manifest(root, filename, ecosystem, name_pat, ver_pat=None):
    raw = read(os.path.join(root, filename))
    if not raw:
        return None
    name = re.search(name_pat, raw, re.M)
    ver = re.search(ver_pat, raw, re.M) if ver_pat else None
    return {
        "ecosystem": ecosystem,
        "name": name.group(1) if name else None,
        "version": ver.group(1) if ver else None,
    }


def detect_manifests(root):
    found = [
        node_manifest(root),
        python_manifest(root),
        simple_manifest(root, "go.mod", "Go", r"^module\s+(\S+)"),
        simple_manifest(root, "Cargo.toml", "Rust",
                        r'^\s*name\s*=\s*"([^"]+)"', r'^\s*version\s*=\s*"([^"]+)"'),
        simple_manifest(root, "composer.json", "PHP", r'"name"\s*:\s*"([^"]+)"'),
        simple_manifest(root, "pubspec.yaml", "Dart/Flutter", r"^name:\s*(\S+)"),
    ]
    return [m for m in found if m]


# --- readme ------------------------------------------------------------------

def find_readme(root):
    for entry in sorted(os.listdir(root)):
        if entry.lower().startswith("readme"):
            return os.path.join(root, entry)
    return None


def readme_facts(path):
    text = read(path)
    if not text:
        return None
    lines = text.splitlines()
    headings = [l.strip("# ").strip() for l in lines if l.startswith("#")][:20]
    body, in_fence = [], False
    for line in lines:
        if line.lstrip().startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence or not line.strip():
            continue
        if line.startswith(("#", "!", "[", ">", "|", "    ")):
            continue
        body.append(line.strip())
    install = re.findall(
        r"^\s*\$?\s*((?:npm|yarn|pnpm|pip|pip3|go|cargo|brew|composer|docker)\s+"
        r"(?:i|install|add|get|run|pull)\s+[^\n`]+)", text, re.M)
    badges = re.findall(r"!\[[^\]]*\]\((https?://[^)]+)\)", text)[:6]
    urls = [u for u in re.findall(r"\((https?://[^)\s]+)\)", text)
            if "badge" not in u and "shields.io" not in u][:8]
    images = re.findall(r"!\[[^\]]*\]\(([^)]+\.(?:png|jpg|jpeg|gif|webp|svg))\)", text, re.I)
    return {
        "chars": len(text),
        "headings": headings,
        "intro": " ".join(body[:3])[:600],
        "install_cmds": list(dict.fromkeys(install))[:5],
        "badges": badges,
        "links": list(dict.fromkeys(urls)),
        "media": images[:5],
    }


# --- tree, git, extras -------------------------------------------------------

def scan_tree(root):
    exts, files, top = Counter(), 0, []
    for entry in sorted(os.listdir(root)):
        if entry in SKIP_DIRS or entry.startswith("."):
            continue
        if os.path.isdir(os.path.join(root, entry)):
            top.append(entry + "/")
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            ext = os.path.splitext(fn)[1].lower()
            if ext in LANG_BY_EXT:
                exts[ext] += 1
                files += 1
        if files > 20_000:
            break
    langs = Counter()
    for ext, n in exts.items():
        langs[LANG_BY_EXT[ext]] += n
    return top[:15], langs.most_common(6), files


def git_facts(root):
    if not os.path.isdir(os.path.join(root, ".git")):
        return None
    count = git(root, "rev-list", "--count", "HEAD")
    return {
        "remote": git(root, "config", "--get", "remote.origin.url"),
        "branch": git(root, "rev-parse", "--abbrev-ref", "HEAD"),
        "commits": count,
        "first": git(root, "log", "--reverse", "--date=short", "--format=%ad", "--max-count=1"),
        "last": git(root, "log", "-1", "--date=short", "--format=%ad"),
        "authors": git(root, "shortlog", "-sne", "--all").splitlines()[:6],
        "tags": git(root, "tag", "--sort=-creatordate").splitlines()[:6],
        "recent": git(root, "log", "-12", "--format=%s").splitlines(),
    }


def deploy_and_test_hints(root):
    hints, tests = [], []
    for marker, label in DEPLOY_HINTS.items():
        if os.path.exists(os.path.join(root, marker)):
            hints.append(label)
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if re.search(r"(\.spec\.|\.test\.|^test_|_test\.)", fn):
                tests.append(os.path.relpath(os.path.join(dirpath, fn), root))
    return sorted(set(hints)), tests[:5], len(tests)


def find_subpackages(root):
    subs = []
    for parent in ("packages", "apps", "libs", "projects", "services"):
        pdir = os.path.join(root, parent)
        if os.path.isdir(pdir):
            for entry in sorted(os.listdir(pdir)):
                if os.path.exists(os.path.join(pdir, entry, "package.json")):
                    subs.append(f"{parent}/{entry}")
    return subs[:12]


# --- report ------------------------------------------------------------------

def section(title):
    out()
    out(f"## {title}")


def kv(label, value):
    if value:
        out(f"- {label}: {value}")


def main():
    root = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else ".")
    if not os.path.isdir(root):
        sys.exit(f"Not a directory: {root}")

    out(f"# Project fact sheet — {os.path.basename(root)}")
    out(f"(path: {root})")

    manifests = detect_manifests(root)
    if manifests:
        section("Package")
        for m in manifests:
            out(f"### {m['ecosystem']}")
            for key in ("name", "version", "description", "license", "homepage",
                        "repository", "private"):
                if m.get(key):
                    kv(key, m[key])
            if m.get("keywords"):
                kv("keywords", ", ".join(m["keywords"][:12]))
            if m.get("scripts"):
                kv("scripts", ", ".join(m["scripts"][:12]))
            if m.get("deps"):
                kv("notable deps", ", ".join(m["deps"][:15]))
            if m.get("workspaces"):
                kv("workspaces", m["workspaces"])
    else:
        section("Package")
        out("- no manifest found — read the source to work out what this is")

    subs = find_subpackages(root)
    if subs:
        kv("sub-packages (monorepo? ask which one the post is about)", ", ".join(subs))

    rd_path = find_readme(root)
    section("README")
    if not rd_path:
        out("- none found")
    else:
        rd = readme_facts(rd_path)
        kv("file", os.path.basename(rd_path))
        kv("length", f"{rd['chars']} chars")
        if rd["headings"]:
            kv("headings", " | ".join(rd["headings"]))
        if rd["intro"]:
            out(f"- intro: {rd['intro']}")
        for cmd in rd["install_cmds"]:
            out(f"- install cmd: {cmd}")
        if rd["media"]:
            kv("screenshots/demos in README", ", ".join(rd["media"]))
        if rd["links"]:
            kv("links", ", ".join(rd["links"]))
        if rd["badges"]:
            kv("badges", f"{len(rd['badges'])} (may hint at CI, coverage, downloads)")

    section("Code")
    top, langs, nfiles = scan_tree(root)
    if top:
        kv("top-level dirs", " ".join(top))
    if langs:
        kv("languages", ", ".join(f"{name} ({n} file{'s' if n != 1 else ''})" for name, n in langs))
    kv("source files counted", nfiles)
    hints, sample_tests, ntests = deploy_and_test_hints(root)
    if hints:
        kv("infra/deploy", ", ".join(hints))
    kv("test files", f"{ntests} (e.g. {', '.join(sample_tests)})" if ntests else "none found")

    section("Git")
    g = git_facts(root)
    if not g:
        out("- not a git repository")
    else:
        for label, key in (("remote", "remote"), ("branch", "branch"),
                           ("commits", "commits"), ("first commit", "first"),
                           ("last commit", "last")):
            kv(label, g[key])
        if g["tags"]:
            kv("recent tags", ", ".join(g["tags"]))
        if g["authors"]:
            kv("contributors", " | ".join(a.strip() for a in g["authors"]))
        if g["recent"]:
            out("- recent commits:")
            for line in g["recent"]:
                out(f"    - {line}")

    section("Still unknown — ask the user")
    out("- primary link for the CTA (repo / package page / live demo)")
    out("- is it public already, or launching with this post?")
    out("- any real traction worth naming (downloads, stars, production use)?")
    out("- personal project or employer-owned, and what can be said publicly?")


if __name__ == "__main__":
    main()
