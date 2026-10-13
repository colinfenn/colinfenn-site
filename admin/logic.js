/* Shared rules for the phone uploader. No browser APIs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ColinUpload = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CATEGORIES = ["Pitching", "Hitting", "Fielding", "Workouts/Training", "Game Highlights"];
  const PITCHES = ["Fastball", "Sinker", "Slider", "Curveball", "Changeup", "Cutter"];
  const ANGLES = ["Open side", "Behind mound", "Front", "Side"];
  const SETTINGS = ["Game", "Bullpen"];
  const HITTING_RESULTS = ["Single", "Double", "Triple", "Home run", "Walk", "Line drive out"];
  const PITCH_FACED = ["Fastball", "Breaking ball", "Off-speed"];
  const BATTED_BALLS = ["Line drive", "Ground ball", "Fly ball"];
  const HITTING_WHERE = ["Game", "Batting practice"];
  const FIELD_PLAYS = ["Catch", "Diving catch", "Throw/assist", "Ground ball", "Fly ball", "Relay"];
  const POSITIONS = ["LF", "CF", "RF", "P"];
  const FIELD_WHERE = ["Game", "Practice"];
  const WORKOUTS = ["Velo", "Long toss", "Weights", "Speed/agility", "Bullpen"];
  const STEPS = ["video", "category", "tags", "details", "preview"];
  const TAG_LABELS = {
    pitch: "Pitch",
    result: "Result",
    pitchFaced: "Pitch faced",
    battedBall: "Batted ball",
    play: "Play",
    position: "Position",
    workout: "Workout",
    setting: "Where"
  };
  const MAX_CUSTOM_TAG = 30;
  const MAX_CUSTOM_TAGS = 10;
  const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const CAPTION_HINTS = {
    Pitching: "First-pitch slider, swing and miss.",
    Hitting: "Opposite-field double in the third.",
    Fielding: "Backhand at short and the throw to first.",
    "Workouts/Training": "Long toss before practice.",
    "Game Highlights": "Two strikeouts and a double."
  };

  function tagsFor(category) {
    if (category === "Pitching") return { pitch: PITCHES, setting: SETTINGS };
    if (category === "Hitting") return { result: HITTING_RESULTS, pitchFaced: PITCH_FACED, battedBall: BATTED_BALLS, setting: HITTING_WHERE };
    if (category === "Fielding") return { play: FIELD_PLAYS, position: POSITIONS, setting: FIELD_WHERE };
    if (category === "Workouts/Training") return { workout: WORKOUTS };
    return {};
  }

  function hasTags(category) {
    return Object.keys(tagsFor(category)).length > 0;
  }

  function stepsFor() {
    return STEPS.slice();
  }

  function cleanTag(text) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_TAG).trim();
  }

  function normalizeTags(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach(item => {
      const tag = cleanTag(item);
      const key = tag.toLowerCase();
      if (!tag || seen.has(key) || out.length >= MAX_CUSTOM_TAGS) return;
      seen.add(key);
      out.push(tag);
    });
    return out;
  }

  function addCustomTag(list, text) {
    return normalizeTags((Array.isArray(list) ? list : []).concat([text]));
  }

  function showOpponent(draft) {
    return !!draft && (draft.category === "Game Highlights" || draft.setting === "Game");
  }

  function suggestedTitle(draft) {
    const parts = [];
    const tags = tagsFor(draft.category);
    if (draft.category === "Pitching" && draft.pitch) parts.push(draft.pitch);
    else if (draft.category === "Hitting" && draft.result) parts.push(draft.result);
    else if (draft.category === "Fielding" && draft.play) parts.push(draft.play);
    else if (draft.category === "Workouts/Training" && draft.workout) parts.push(draft.workout);
    else if (draft.category) parts.push(draft.category);
    if (tags.setting && draft.setting) parts.push(draft.setting);
    return parts.join(" · ");
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayISO(date) {
    const d = date || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function formatISODate(iso) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(n => !n)) return "";
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return "";
    return MONTHS[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
  }

  function stamp(date) {
    const d = date || new Date();
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function slug(text) {
    const clean = String(text || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return clean || "video";
  }

  function extensionFor(name, type) {
    const n = String(name || "").toLowerCase();
    const t = String(type || "").toLowerCase();
    if (n.endsWith(".mov") || t === "video/quicktime") return "mov";
    if (n.endsWith(".webm") || t === "video/webm") return "webm";
    return "mp4";
  }

  function mediaRepoPath(title, fileName, fileType, date) {
    return "media/videos/" + slug(title) + "-" + stamp(date) + "." + extensionFor(fileName, fileType);
  }

  function publicUrl(repoPath) {
    return "/" + String(repoPath || "").replace(/^\/+/, "");
  }

  function mediaPathFromUrl(url) {
    if (!url) return null;
    let path = String(url).trim();
    if (/^blob:/i.test(path)) return null;
    if (/^https?:\/\//i.test(path)) {
      try {
        const parsed = new URL(path);
        const host = parsed.hostname;
        if (host !== "colinfenn.com" && !host.endsWith(".netlify.app")) return null;
        path = parsed.pathname;
      } catch (err) {
        return null;
      }
    }
    path = path.replace(/^\/+/, "");
    if (!path.startsWith("media/videos/")) return null;
    if (path.includes("..") || path.includes("\\") || path.includes("//")) return null;
    return path;
  }

  function youtubeId(url) {
    const match = String(url || "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    return match ? match[1] : "";
  }

  function tooBig(bytes) {
    return Number(bytes) > MAX_VIDEO_BYTES;
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024 * 1024) return Math.max(1, Math.round(n / 1024)) + " KB";
    const mb = n / (1024 * 1024);
    return (mb >= 10 ? mb.toFixed(0) : mb.toFixed(1)) + " MB";
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function buildEntry(draft) {
    const tags = tagsFor(draft.category);
    const entry = {
      title: String(draft.title || "").trim(),
      type: draft.type,
      url: String(draft.url || "").trim()
    };
    Object.keys(TAG_LABELS).forEach(key => {
      if (tags[key] && draft[key]) entry[key] = draft[key];
    });
    const velo = String(draft.velo || "").trim();
    if (velo) entry.velo = velo;
    const opponent = String(draft.opponent || "").trim();
    if (opponent && showOpponent(draft)) entry.opponent = opponent;
    entry.date = draft.date || "";
    entry.caption = String(draft.caption || "").trim();
    entry.category = draft.category;
    const custom = normalizeTags(draft.tags);
    if (custom.length) entry.tags = custom;
    if (draft.featured) entry.featured = true;
    return entry;
  }

  function cardTags(video) {
    return ["pitch", "result", "pitchFaced", "battedBall", "play", "position", "workout", "setting", "velo", "opponent"]
      .map(key => video[key])
      .concat(normalizeTags(video.tags), [video.date])
      .filter(Boolean);
  }

  function filterTags(video) {
    return cardTags(video).filter(tag => tag !== video.date);
  }

  function cardHtml(video) {
    const tags = cardTags(video).map(tag => '<span class="tag">' + esc(tag) + "</span>").join("");
    const caption = video.caption ? "<p>" + esc(video.caption) + "</p>" : "";
    return '<article class="vcard"><div class="vmedia">' + (video.mediaHtml || "") + '</div><div class="vbody"><h4>' + esc(video.title) + '</h4><div class="tags">' + tags + "</div>" + caption + "</div></article>";
  }

  function videoKey(video) {
    return JSON.stringify([
      video.title || "",
      video.type || "",
      video.url || "",
      video.category || "",
      video.caption || "",
      video.date || "",
      video.pitch || "",
      video.result || "",
      video.pitchFaced || "",
      video.battedBall || "",
      video.play || "",
      video.position || "",
      video.workout || "",
      video.angle || "",
      video.setting || "",
      video.velo || "",
      video.opponent || "",
      video.featured ? "1" : "",
      normalizeTags(video.tags).join("|")
    ]);
  }

  function isReal(video) {
    return video && video.type !== "placeholder" && !!video.url;
  }

  function cloneData(data) {
    return {
      categories: (data && data.categories && data.categories.length ? data.categories : CATEGORIES).slice(),
      videos: ((data && data.videos) || []).map(video => Object.assign({}, video))
    };
  }

  function validateEntry(entry) {
    if (!CATEGORIES.includes(entry.category)) return "Pick a category.";
    if (!entry.title) return "Add a title.";
    if (entry.type === "youtube" && !youtubeId(entry.url)) return "That doesn't look like a YouTube link. Open the video and copy the address.";
    if (entry.type !== "youtube" && entry.type !== "mp4") return "Choose a video or paste a YouTube link.";
    if (entry.type === "mp4" && !entry.url) return "Choose a video first.";
    return "";
  }

  function keepOneFeatured(videos, keeper) {
    if (!keeper || !keeper.featured) return;
    videos.forEach(video => {
      if (video !== keeper) delete video.featured;
    });
  }

  function featuredReel(profile, videos, removedUrl) {
    const list = (videos && videos.videos) || [];
    const current = {
      url: "",
      title: "",
      caption: "",
      ...((profile && profile.highlightReel) || {})
    };
    const featured = list.find(video => video.featured && video.url && video.type !== "placeholder");
    if (featured) {
      const next = { url: featured.url, title: featured.title || "", caption: featured.caption || "" };
      if (current.url === next.url && (current.title || "") === next.title && (current.caption || "") === next.caption) return null;
      return next;
    }
    if (removedUrl && current.url === removedUrl) return { url: "", title: "", caption: "" };
    if (current.url && list.some(video => video.url === current.url)) return { url: "", title: current.title || "", caption: "" };
    return null;
  }

  function profileWithReel(profile, reel) {
    const copy = JSON.parse(JSON.stringify(profile || {}));
    copy.highlightReel = { url: reel.url || "", title: reel.title || "", caption: reel.caption || "" };
    return JSON.stringify(copy, null, 2) + "\n";
  }

  function serializeVideos(data) {
    return JSON.stringify({ categories: data.categories, videos: data.videos }, null, 2) + "\n";
  }

  function prepareSave(data, action) {
    const next = cloneData(data);
    if (action.kind === "add") {
      const problem = validateEntry(action.entry);
      if (problem) return { ok: false, error: problem };
      next.videos.unshift(action.entry);
      keepOneFeatured(next.videos, action.entry);
      return {
        ok: true,
        data: next,
        json: serializeVideos(next),
        message: "Post video: " + action.entry.title,
        removePaths: [],
        removedUrl: ""
      };
    }
    const index = next.videos.findIndex(video => videoKey(video) === action.key);
    if (index < 0) return { ok: false, error: "That video isn't in the list anymore. Go back and check My Videos." };
    if (action.kind === "delete") {
      const removed = next.videos[index];
      next.videos.splice(index, 1);
      const removePath = mediaPathFromUrl(removed.url);
      return {
        ok: true,
        data: next,
        json: serializeVideos(next),
        message: "Remove video: " + (removed.title || "Untitled"),
        removePaths: removePath ? [removePath] : [],
        removedUrl: removed.url || ""
      };
    }
    if (action.kind === "update") {
      const problem = validateEntry(action.entry);
      if (problem) return { ok: false, error: problem };
      next.videos[index] = action.entry;
      keepOneFeatured(next.videos, action.entry);
      return {
        ok: true,
        data: next,
        json: serializeVideos(next),
        message: "Update video: " + action.entry.title,
        removePaths: [],
        removedUrl: ""
      };
    }
    return { ok: false, error: "That didn't work. Try again." };
  }

  function friendlyError(err) {
    const status = err && err.status;
    const message = (err && err.message) || "";
    if (message === "popup") return "The login window didn't open. Allow pop-ups for this site, then try again.";
    if (message === "closed") return "Login was closed before it finished. Tap Log in again.";
    if (message === "denied") return "GitHub didn't finish the login. Try again.";
    if (message === "aborted") return "Canceled. Nothing was saved.";
    if (message === "too-big") return "That video is over 50 MB, so it can't go straight on the site. Upload it to YouTube (unlisted is fine), then paste the link here.";
    if (status === 401) return "Please log in again.";
    if (status === 403 || status === 404) return "GitHub didn't allow that save. Ask JT to check that your GitHub login can edit the site.";
    if ((err && err.conflict) || status === 422) return "That didn't save because the list changed. Tap the button again.";
    if (status === 0 || message === "network") return "Couldn't reach GitHub. Check your Wi-Fi and try again.";
    if (/size|too large|payload|blob/i.test(message)) return "That video is too big to send from the phone. Put it on YouTube and paste the link.";
    return "That didn't save. Check your Wi-Fi and try again.";
  }

  const REPO = "colinfenn/colinfenn-site";
  const BRANCH = "main";

  function bytesToBase64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
    }
    return btoa(binary);
  }

  function utf8ToBase64(text) {
    const bytes = typeof TextEncoder !== "undefined" ? new TextEncoder().encode(text) : Buffer.from(text, "utf8");
    return bytesToBase64(bytes);
  }

  function base64ToUtf8(b64) {
    const clean = String(b64 || "").replace(/\s/g, "");
    if (typeof Buffer !== "undefined") return Buffer.from(clean, "base64").toString("utf8");
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function repoPath(suffix) {
    return "/repos/" + REPO + suffix;
  }

  async function readVideos(request) {
    const file = await request("GET", repoPath("/contents/data/videos.json?ref=" + BRANCH));
    return JSON.parse(base64ToUtf8(file.content));
  }

  async function commitChanges(request, plan, extras) {
    const extra = extras || {};
    const ref = await request("GET", repoPath("/git/ref/heads/" + BRANCH));
    const parentSha = ref.object.sha;
    const parent = await request("GET", repoPath("/git/commits/" + parentSha));
    const tree = [];
    if (extra.mediaPath) {
      const blob = await request("POST", repoPath("/git/blobs"), {
        content: extra.mediaBase64,
        encoding: "base64"
      }, extra.onProgress);
      tree.push({ path: extra.mediaPath, mode: "100644", type: "blob", sha: blob.sha });
    }
    const jsonBlob = await request("POST", repoPath("/git/blobs"), {
      content: utf8ToBase64(plan.json),
      encoding: "base64"
    });
    tree.push({ path: "data/videos.json", mode: "100644", type: "blob", sha: jsonBlob.sha });
    if (plan.profileJson) {
      const profileBlob = await request("POST", repoPath("/git/blobs"), {
        content: utf8ToBase64(plan.profileJson),
        encoding: "base64"
      });
      tree.push({ path: "data/profile.json", mode: "100644", type: "blob", sha: profileBlob.sha });
    }
    (plan.removePaths || []).forEach(path => {
      tree.push({ path: path, mode: "100644", type: "blob", sha: null });
    });
    const createdTree = await request("POST", repoPath("/git/trees"), {
      base_tree: parent.tree.sha,
      tree: tree
    });
    const commit = await request("POST", repoPath("/git/commits"), {
      message: plan.message,
      tree: createdTree.sha,
      parents: [parentSha]
    });
    try {
      await request("PATCH", repoPath("/git/refs/heads/" + BRANCH), { sha: commit.sha });
    } catch (err) {
      if (err && (err.status === 422 || err.status === 409)) err.conflict = true;
      throw err;
    }
    return commit.sha;
  }

  function previewDocument(video) {
    return '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<link rel="stylesheet" href="/css/style.css">' +
      '<link rel="stylesheet" href="/css/theme.css">' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap">' +
      "<style>body{margin:0;background:#f6f7f9;padding:8px 4px 16px}.vcard{max-width:100%}.vcard:hover{transform:none}</style></head><body>" +
      cardHtml(video) + "</body></html>";
  }

  function mediaHtml(video) {
    const id = video.type === "youtube" ? youtubeId(video.url) : "";
    if (id) {
      return '<iframe src="https://www.youtube-nocookie.com/embed/' + esc(id) + '" title="' + esc(video.title) + '" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
    }
    if (video.url && video.type !== "placeholder") {
      return '<video controls preload="metadata" playsinline><source src="' + esc(video.url) + '">' + esc(video.caption || "") + "</video>";
    }
    return "<span>▶ Video coming soon</span>";
  }

  return {
    CATEGORIES,
    PITCHES,
    ANGLES,
    SETTINGS,
    HITTING_RESULTS,
    PITCH_FACED,
    BATTED_BALLS,
    FIELD_PLAYS,
    POSITIONS,
    WORKOUTS,
    STEPS,
    TAG_LABELS,
    MAX_CUSTOM_TAG,
    cleanTag,
    normalizeTags,
    addCustomTag,
    MAX_VIDEO_BYTES,
    CAPTION_HINTS,
    tagsFor,
    hasTags,
    stepsFor,
    showOpponent,
    suggestedTitle,
    filterTags,
    featuredReel,
    profileWithReel,
    todayISO,
    formatISODate,
    stamp,
    slug,
    extensionFor,
    mediaRepoPath,
    publicUrl,
    mediaPathFromUrl,
    youtubeId,
    tooBig,
    formatBytes,
    esc,
    buildEntry,
    cardTags,
    cardHtml,
    videoKey,
    isReal,
    cloneData,
    validateEntry,
    serializeVideos,
    prepareSave,
    friendlyError,
    previewDocument,
    mediaHtml,
    REPO,
    BRANCH,
    bytesToBase64,
    utf8ToBase64,
    base64ToUtf8,
    readVideos,
    commitChanges
  };
});
