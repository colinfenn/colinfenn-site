# colinfenn.com

Static recruiting site for Colin Fenn. There is no build step. The pages are plain HTML, CSS, and JavaScript, and they read the JSON files in `data/`.

Preview on your computer:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

| File | What it controls |
| --- | --- |
| `data/profile.json` | Name, photo, GPA, metrics, pitches, coaches, highlight reel |
| `data/stats.json` | Hitting and pitching season tables |
| `data/schedule.json` | Games, showcases, and camps |
| `data/videos.json` | Video clips (a YouTube link or an MP4) |

Colin can edit those files from his phone at `/admin` after the one-time setup in [ADMIN-SETUP.md](ADMIN-SETUP.md). Netlify publishes this repository as-is (`netlify.toml`).
