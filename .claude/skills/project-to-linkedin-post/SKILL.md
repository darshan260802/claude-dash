---
name: project-to-linkedin-post
description: Turn the project you are standing in — a repo, npm package, side project, or internal tool — into a ready-to-publish LinkedIn launch post, with a hook, use case, target users, features, setup steps, CTA and hashtags, delivered as 3 variants to choose from. Use this whenever someone wants to announce, launch, share, show off, or "post about" a project, repo, package, or thing they built, on LinkedIn or a similar professional feed. Trigger on phrasings like "write a LinkedIn post about this project", "help me announce my npm package", "draft something for LinkedIn about what I built", "I want to share this repo publicly", or a bare "make a post" said from inside a project directory. Also use it when someone wants to write a project up for professional visibility, hiring reach, or portfolio purposes and hasn't said the word LinkedIn — a social launch post is what they mean.
---

# Project → LinkedIn post

Somebody built a thing and now wants the feed to care about it. The job is to read their actual codebase, extract the true story, and write a post that survives the two hardest filters on LinkedIn: the three-line preview before "…see more", and the reader's suspicion that this is another AI-generated launch announcement.

Everything in the post has to come from the repo or from the person. Nothing invented.

## Workflow

### 1. Gather facts from the repo

The user is usually sitting in the project root, so start there. Run the bundled inspector:

```bash
python3 scripts/inspect_project.py .
```

It reads manifests (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, and friends), the README, git history, the file tree, and deployment/demo hints, then prints a compact fact sheet. It is stdlib-only and touches no network.

Then read the README yourself — the whole thing if it's short, the headings and install/usage blocks if it's long. The inspector gives you structure; the README gives you voice and intent. If the README is thin or missing, read the entry-point source files (`src/index.*`, `main.*`, the largest exported module) to work out what the thing actually does. A project's real capabilities live in its exported API, not its marketing.

What you are trying to walk away with:

- **The one-sentence what** — what it does, in the plainest possible words
- **The problem it removes** — what was annoying or manual before this existed
- **Who it's for** — the specific developer or team, not "everyone"
- **3–5 real features** — things the code actually implements
- **How you get it running** — the actual install command and minimum usage snippet
- **Where it lives** — npm, PyPI, GitHub, a live demo URL
- **What's honest about its state** — v0.1.0 with three commits is a different post from v2.4 with 40 releases

### 2. Fill the gaps before drafting

The repo can't tell you everything. Ask for what's missing, in one batch, not one question at a time. Usually this is:

- The link they want people to click (repo, npm, demo — pick one primary)
- Whether it's public yet, or launching with this post
- Any real traction worth mentioning (downloads, stars, users, "we run this in production")
- Whether the project is personal or employer-owned, since that changes what can be said publicly

Show the fact sheet you assembled and mark the unknowns clearly, so answering is fast. If they say "just write it," write it and leave a visible `[link]` placeholder rather than inventing a URL.

**Never fabricate traction.** No invented download counts, star counts, user numbers, benchmark percentages, or "trusted by" claims. A made-up number is the fastest way to embarrass someone in front of their professional network, and it is the single worst failure mode of this skill. If a number would strengthen the post and you don't have one, ask for it or leave it out.

### 3. Draft 3 variants

All three carry the same beats and the same facts. They differ in **angle**, not in adjectives — three tone-shuffles of one post are useless, because the user can't make a real choice between them.

- **Variant A — Problem-first.** Open on the friction, the reader nods because they've hit it too, then the project arrives as the answer. Best when the pain is widely felt.
- **Variant B — Build story.** Open on the decision or constraint that led to building it, and what building it taught you. Reads human, gets the most comments, works even when the project is small.
- **Variant C — Straight launch.** Open on the thing itself, stated confidently and concretely. Shortest and most scannable. Best when the project is genuinely novel or the name carries weight.

Present all three in full. Don't rank them unless asked; do add one line under each saying who it plays best to.

### 4. Hand it over

Output all three variants as plain text in the chat, ready to copy. Under them, add:

- The suggested first comment (if the link is going there — see below)
- A one-line note on anything you left as a placeholder or couldn't verify

## Post anatomy

Follow this order — it's the shape the user asked for, and it happens to match how people actually read a launch post: they decide in the first two lines, then skim for whether it applies to them, then look for how to try it.

```
[HOOK]           1–2 lines. Must land above the "…see more" fold.
[USE CASE]       The concrete situation where this helps.
[WHO IT'S FOR]   The specific audience. Named, not implied.
[WHAT IT DOES]   One tight paragraph or 2–3 lines.
[FEATURES]       3–5 lines, one feature each, emoji-anchored.
[SETUP / USAGE]  The install command and the smallest useful snippet.
[CTA + LINK]     One clear ask, one link.
[HASHTAGS]       3–5, on their own line at the end.
```

### The hook is the whole ballgame

LinkedIn truncates around 140–210 characters (roughly 2–3 lines) before "…see more". Everything after that only gets read by people who already decided to keep reading. So the first two lines must do real work.

What works: a specific frustration stated plainly, a surprising concrete detail, a number that is actually true, a sharp statement of what the thing does.

What doesn't: "I'm excited to announce", "I'm thrilled to share", rhetorical questions like "Ever wondered why...?", generic throat-clearing, and any sentence that could preface any project. If the first line would survive a find-and-replace of the project name with a different project, it isn't a hook.

Write the hook last, after you know what the strongest true fact is.

### Formatting mechanics

LinkedIn renders none of your markdown. `**bold**` shows up as literal asterisks, `#` headings look like typos, `- ` bullets are just hyphens. So:

- Structure with **line breaks and blank lines**, which is the only formatting tool that actually exists there
- Use emojis as bullet anchors and section markers — one per line, chosen to mean something (🎯 audience, ⚡ performance, 🔌 integration, 📦 install), not sprinkled for decoration. Roughly 5–8 across the whole post; past that it reads like a flyer
- Resist Unicode "bold" letters (𝗹𝗶𝗸𝗲 𝘁𝗵𝗶𝘀). Screen readers render them as noise, so they trade accessibility for a bit of visual weight
- Keep code to one short install line and one minimal snippet. Long code blocks lose formatting and kill scroll-through
- Hard limit is 3,000 characters. Aim for **1,200–1,800** — long enough to be substantive, short enough that the "see more" expansion doesn't feel like a chore

### Hashtags

3–5, at the end, on their own line. Mix one or two broad tags with two or three specific ones — the specific ones are where a post actually gets found. `#Angular #TypeScript #OpenSource` beats `#coding #tech #innovation #developers #software`, which is where posts go to be seen by nobody.

### The link

The user wants the link in the post, so put it in the CTA. Also offer the first-comment alternative and let them decide: many creators believe LinkedIn suppresses reach on posts with outbound links and move them to the first comment. LinkedIn has pushed back on that claim, and the evidence is mostly anecdotal — so present it as a tradeoff (in-post = fewer clicks lost, first comment = possible reach upside, unproven), not as a rule. If the link goes to the first comment, the post's CTA should say so ("link in the comments") or the ask goes nowhere.

## Voice

Write like the person who built the thing, not like a press release.

- First person, past or present tense, contractions welcome
- Specific over impressive: "cut our build from 90s to 12s" beats "dramatically improved performance"
- Say what it doesn't do yet. A line like "still rough around auth" buys more credibility than three superlatives
- No "game-changer", "revolutionary", "leverage", "seamless", "robust solution", "in today's fast-paced world"
- Match the README's register. Someone whose README is dry and technical will not want a post full of exclamation marks

If the user has other posts you can see, or a resume, or a README written in a distinctive voice, mirror that instead of a generic default.

## Edge cases

**Work project they can't open-source.** Write it around the problem, approach, and outcome; skip install/usage; drop the repo CTA and end on a question or an invitation to talk. Check what they're allowed to name — company, metrics, client names — before it goes in.

**Tiny project, few commits.** Don't inflate it. Small tools posted honestly do fine; the build-story angle carries them. "I got tired of X so I built a 200-line thing that does Y" is a real post.

**Rewrite or v2 of something existing.** The hook is the delta — what changed and why — not the original pitch.

**Monorepo or ambiguous root.** If the inspector finds multiple packages, ask which one the post is about before drafting. Don't average them into one vague post.

**Not a code project at all** (a design system, a dataset, a write-up). The beats still hold; swap install/usage for how to access or use it.

## Example

Input: a small Angular library, `angular-video-controller`, that wraps HTML5 video playback controls, README shows a one-line install and a directive usage snippet, git history over four months, published to npm.

Hook that works:

> Every Angular project I joined had its own hand-rolled video player wrapper. Same bugs, rewritten four times.

Hook that doesn't:

> 🚀 Excited to announce the launch of my new open-source Angular library!

The first one is a specific observation only this author could make and it sets up the project as the obvious fix. The second could sit on top of literally any repo on GitHub, which is exactly why nobody reads past it.
