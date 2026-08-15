// Self-contained gate page — no dependency on dist-web/ having been built,
// and no client-side framework, so it works even in dev (where Vite serves
// the frontend on its own port and this API process never has a bundle to
// fall back to). Posts the code to /api/access and reloads on success.
//
// Ported from cursor-dash's server/share.js renderGatePage (commit
// 7ff503b), retthemed to claude-dash's actual dark tokens (src/index.css's
// `.dark` block) instead of cursor-dash's palette, and with the brand mark
// as an inline "CD" monogram — the same one the splash screen and
// AppSidebar use — instead of an <img src="/logo.png">. claude-dash has no
// such file, and inlining it here means this page needs zero unauthenticated
// static-asset bypass (cursor-dash's PUBLIC_ASSET_PATHS) at all.
//
// The access-code field imitates shadcn/ui's input-otp component — 8 boxed
// slots in two groups of 4 — the same way that component does it under the
// hood: one real <input> (for typing, paste, and mobile keyboards) rendered
// invisibly on top of styled slot <div>s that mirror its value. It can't be
// the actual React component without pulling a build step into this
// otherwise-static page, so this reproduces its behavior directly.

export function renderGatePage({ error = false }: { error?: boolean } = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Claude Dash — Enter access code</title>
<style>
  :root {
    color-scheme: dark;
    --background: oklch(0 0 0);
    --foreground: oklch(0.9330 0.0108 76.5962);
    --card: oklch(0.1448 0 0);
    --border: oklch(0.2178 0 0);
    --input: oklch(0.2178 0 0);
    --muted-foreground: oklch(0.6248 0.0159 84.5928);
    --primary: oklch(0.4911 0.0904 37.5793);
    --primary-foreground: oklch(1 0 0);
    --destructive: oklch(0.6373 0.2078 25.3313);
    --radius: 0.5rem;
    --font-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-mono: ui-monospace, "SF Mono", monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100dvh; display: flex; align-items: center; justify-content: center;
    background: var(--background); color: var(--foreground);
    font: 15px/1.5 var(--font-sans); letter-spacing: -0.01em;
    padding: 24px;
  }
  .card {
    width: 100%; max-width: 380px; background: var(--card); border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 2); padding: 32px 28px;
    box-shadow: 0 20px 40px -10px rgb(0 0 0 / 0.5);
  }
  .brand { display: flex; align-items: center; gap: 10px; margin: 0 0 6px; }
  .brand .mark {
    width: 34px; height: 34px; flex-shrink: 0; border-radius: calc(var(--radius) * 0.8);
    background: var(--primary); color: var(--primary-foreground);
    display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px; letter-spacing: -0.4px;
  }
  .brand span.name {
    font-size: 21px; font-weight: 700; letter-spacing: -0.02em; color: var(--foreground);
  }
  p.desc { color: var(--muted-foreground); font-size: 13px; margin: 0 0 22px; }

  /* OTP field: a real input, sized to cover the slot row exactly, with its
     own text made invisible (transparent color, no caret) so only the
     rendered slots underneath show — the input still receives every
     keystroke, paste, and screen-reader interaction normally. */
  .otp { position: relative; width: 100%; height: 52px; }
  .otp input {
    position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0;
    border: 0; outline: none; background: transparent; color: transparent;
    caret-color: transparent; font: 20px var(--font-mono); letter-spacing: 0;
    text-transform: uppercase;
  }
  /* The real input's text sits at its natural (left-packed, monospace)
     width, not stretched to match the widely-gapped boxes below it — that
     mismatch is invisible in the ordinary case (color: transparent), but a
     native text-selection highlight ignores color and paints its own
     system color regardless, revealing a gray patch over roughly the first
     few boxes whenever the value is selected (e.g. focus+select() after a
     failed attempt). Neutralizing ::selection keeps the visible-slot
     illusion intact either way. */
  .otp input::selection { background: transparent; color: transparent; }
  .otp input::-moz-selection { background: transparent; color: transparent; }
  /* No align-items here — the default (stretch) is load-bearing: it's what
     makes .otp-group (and via its height:100%, every .otp-slot) actually
     fill the row's height instead of collapsing to their own content
     height, which for an empty slot is ~0. .otp-sep opts back out with its
     own align-self so the divider stays a thin line, not full height. */
  .otp-slots { position: absolute; inset: 0; display: flex; gap: 7px; pointer-events: none; }
  .otp-group { display: flex; gap: 7px; flex: 1; height: 100%; }
  .otp-slot {
    flex: 1; height: 100%; display: flex; align-items: center; justify-content: center;
    font-family: var(--font-mono); font-size: 19px; font-weight: 500;
    border: 1px solid var(--input); background: color-mix(in oklab, var(--input) 35%, transparent);
    border-radius: calc(var(--radius) * 0.7); color: var(--foreground);
    transition: border-color 120ms, box-shadow 120ms;
  }
  .otp-slot.filled { border-color: color-mix(in oklab, var(--border), var(--foreground) 15%); }
  .otp-slot.active { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in oklab, var(--primary) 30%, transparent); }
  .otp-sep { width: 10px; height: 1px; background: var(--border); flex-shrink: 0; align-self: center; }

  button {
    width: 100%; margin-top: 16px; padding: 12px; border-radius: calc(var(--radius) * 0.9); border: none;
    background: var(--primary); color: var(--primary-foreground); font-weight: 600; font-size: 14px; cursor: pointer;
    font-family: var(--font-sans);
  }
  button:disabled { opacity: 0.6; cursor: default; }
  .msg { min-height: 18px; margin-top: 10px; font-size: 12.5px; color: var(--destructive); }
</style>
</head>
<body>
  <form class="card" id="gate" autocomplete="off">
    <div class="brand"><span class="mark">CD</span><span class="name">Claude Dash</span></div>
    <p class="desc">Enter the 8-character access code shown by the person who shared this with you.</p>

    <div class="otp">
      <input id="code" name="code" maxlength="9" inputmode="text" autocapitalize="characters"
             autocomplete="one-time-code" spellcheck="false" autofocus
             aria-label="8-character access code">
      <div class="otp-slots" id="slots" aria-hidden="true">
        <div class="otp-group" id="group1"></div>
        <div class="otp-sep"></div>
        <div class="otp-group" id="group2"></div>
      </div>
    </div>

    <button type="submit">Continue</button>
    <div class="msg" id="msg">${error ? 'Incorrect code. Try again.' : ''}</div>
  </form>
  <script>
    const form = document.getElementById('gate');
    const input = document.getElementById('code');
    const msg = document.getElementById('msg');
    const btn = form.querySelector('button');
    const group1 = document.getElementById('group1');
    const group2 = document.getElementById('group2');

    // 8 slot divs, 4 per group — value characters map straight across; a
    // hyphen (typed or pasted from the Share page's "XXXX-XXXX" display) is
    // ignored for slot purposes but left in the underlying input value,
    // same as the server-side normalization does.
    const slots = [];
    for (let i = 0; i < 8; i++) {
      const el = document.createElement('div');
      el.className = 'otp-slot';
      (i < 4 ? group1 : group2).appendChild(el);
      slots.push(el);
    }

    function render() {
      const chars = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').split('');
      const active = Math.min(chars.length, 7);
      slots.forEach((slot, i) => {
        slot.textContent = chars[i] || '';
        slot.classList.toggle('filled', i < chars.length);
        slot.classList.toggle('active', document.activeElement === input && i === active);
      });
    }
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', render);
    slots.forEach((slot) => slot.style.pointerEvents = 'none');
    document.querySelector('.otp').addEventListener('click', () => input.focus());
    render();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      btn.disabled = true;
      msg.textContent = '';
      try {
        const res = await fetch('/api/access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: input.value }),
        });
        if (res.ok) {
          location.reload();
          return;
        }
        const body = await res.json().catch(() => ({}));
        msg.textContent = body.reason === 'locked'
          ? 'Too many wrong attempts. Try again in a few minutes.'
          : 'Incorrect code. Try again.';
      } catch {
        msg.textContent = 'Could not reach the server. Try again.';
      }
      btn.disabled = false;
      input.focus();
      input.select();
    });
  </script>
</body>
</html>`
}
