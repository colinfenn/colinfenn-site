/* Shared rules for the phone uploader and the public site. No browser APIs. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ColinUpload = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const CATEGORIES = ["Pitching", "Hitting", "Fielding", "Training/Workouts"];
  const TAGS = {
    Pitching: ["Sinker", "Curveball", "Slider", "Cutter", "Changeup", "K", "Pickoff", "Game", "Bullpen"],
    Hitting: ["vs. Lefty", "vs. Righty", "Bunt", "Single", "Extra-base hit", "Game", "BP"],
    Fielding: ["OF", "Pitcher", "Catch", "Throw", "Game", "Practice"],
    "Training/Workouts": ["Bullpen", "Weights", "Speed/Agility"]
  };
  const STEPS = ["video", "category", "tags", "details", "preview"];
  const TAG_LABELS = {};
  const MAX_CUSTOM_TAG = 30;
  const MAX_CUSTOM_TAGS = 10;
  const MAX_VIDEO_BYTES = 35 * 1024 * 1024;
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const CAPTION_HINTS = {
    Pitching: "First-pitch sinker, swing and miss.",
    Hitting: "Opposite-field single in the third.",
    Fielding: "Running catch in the gap.",
    "Training/Workouts": "Bullpen before practice."
  };

  function tagsFor(category) {
    return (TAGS[category] || []).slice();
  }

  function hasTags(category) {
    return tagsFor(category).length > 0;
  }

  function normalizeCategories(list) {
    const source = Array.isArray(list) ? list : (list ? [list] : []);
    const out = [];
    CATEGORIES.forEach(category => {
      if (source.some(item => String(item || "") === category)) out.push(category);
    });
    return out;
  }

  function videoCategories(video) {
    if (!video) return [];
    if (Array.isArray(video.categories) && video.categories.length) {
      const normalized = normalizeCategories(video.categories);
      if (normalized.length) return normalized;
    }
    return normalizeCategories(video.category ? [video.category] : []);
  }

  function inCategory(video, category) {
    return videoCategories(video).indexOf(category) >= 0;
  }

  function tagsForCategories(categories) {
    const out = [];
    const seen = {};
    videoCategories({ categories: categories }).forEach(category => {
      tagsFor(category).forEach(tag => {
        const key = tag.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        out.push(tag);
      });
    });
    return out;
  }

  function stepsFor() {
    return STEPS.slice();
  }

  function cleanTag(text) {
    return String(text == null ? "" : text).replace(/\s+/g, " ").trim().slice(0, MAX_CUSTOM_TAG).trim();
  }

  function isPresetTag(tag) {
    const key = String(tag || "").toLowerCase();
    return CATEGORIES.some(category => tagsFor(category).some(option => option.toLowerCase() === key));
  }

  function normalizeTags(list) {
    const out = [];
    const seen = new Set();
    let custom = 0;
    (Array.isArray(list) ? list : []).forEach(item => {
      const tag = cleanTag(item);
      const key = tag.toLowerCase();
      if (!tag || seen.has(key)) return;
      if (!isPresetTag(tag)) {
        if (custom >= MAX_CUSTOM_TAGS) return;
        custom += 1;
      }
      seen.add(key);
      out.push(tag);
    });
    return out;
  }

  function orderedTags(category, list) {
    const clean = normalizeTags(list);
    const options = Array.isArray(category) ? tagsForCategories(category) : tagsFor(category);
    const preset = options.filter(option => clean.some(tag => tag.toLowerCase() === option.toLowerCase()));
    const custom = clean.filter(tag => !options.some(option => option.toLowerCase() === tag.toLowerCase()));
    return preset.concat(custom);
  }

  function addCustomTag(list, text) {
    return normalizeTags((Array.isArray(list) ? list : []).concat([text]));
  }

  function shortDate(value) {
    const formatted = formatISODate(value);
    const source = formatted || String(value || "").trim();
    const match = source.match(/^([A-Za-z]+)\s+(\d{1,2})(?:,\s*\d{4})?$/);
    if (!match) return "";
    const long = MONTHS.findIndex(name => name.toLowerCase() === match[1].toLowerCase());
    const short = long >= 0 ? long : SHORT_MONTHS.findIndex(name => name.toLowerCase() === match[1].toLowerCase());
    if (short < 0) return "";
    return SHORT_MONTHS[short] + " " + Number(match[2]);
  }

  function suggestedTitle(draft) {
    const categories = videoCategories(draft);
    const chosen = orderedTags(categories, draft && draft.tags).filter(tag =>
      tagsForCategories(categories).some(option => option.toLowerCase() === tag.toLowerCase())
    );
    const head = chosen.length ? chosen.join(" · ") : (categories[0] || "");
    const when = shortDate(draft && (draft.dateISO || draft.date || draft.dateLabel));
    if (head && when) return head + " · " + when;
    return head || when || "";
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

  function calendarParts(value) {
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
    }
    const parts = String(value || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(n => !n)) return null;
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    if (date.getFullYear() !== parts[0] || date.getMonth() !== parts[1] - 1 || date.getDate() !== parts[2]) return null;
    return { y: parts[0], m: parts[1], d: parts[2] };
  }

  function ageParts(birthDate, today) {
    const birth = calendarParts(birthDate);
    const now = calendarParts(today == null ? new Date() : today);
    if (!birth || !now) return null;
    let years = now.y - birth.y;
    let months = now.m - birth.m;
    if (now.d < birth.d) months -= 1;
    if (months < 0) {
      years -= 1;
      months += 12;
    }
    if (years < 0) return null;
    return { years: years, months: months };
  }

  function ageUnit(count, singular, plural) {
    return count + " " + (count === 1 ? singular : plural);
  }

  function ageLabel(birthDate, today) {
    const parts = ageParts(birthDate, today);
    if (!parts) return "";
    return ageUnit(parts.years, "yr", "yrs") + " " + ageUnit(parts.months, "mo", "mos");
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

  function thumbnailRepoPath(videoRepoPath) {
    return String(videoRepoPath || "").replace(/\.[^./]+$/, ".jpg");
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

  function oversizeMessage(bytes) {
    const mb = Number(bytes) / (1024 * 1024);
    const rounded = Math.round(mb * 10) / 10;
    const label = (rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1)) + " MB";
    return "This clip is " + label + ". Trim it under 35 MB in Photos, or use a YouTube link.";
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
    const entry = {
      title: String(draft.title || "").trim() || suggestedTitle(draft),
      type: draft.type,
      url: String(draft.url || "").trim()
    };
    const categories = videoCategories(draft);
    const tags = orderedTags(categories, draft.tags);
    if (tags.length) entry.tags = tags;
    const velo = String(draft.velo || "").trim();
    if (velo && categories.indexOf("Pitching") >= 0) entry.velo = velo;
    const thumbnail = String(draft.thumbnail || "").trim();
    if (thumbnail) entry.thumbnail = thumbnail;
    entry.date = draft.date || "";
    entry.caption = String(draft.caption || "").trim();
    entry.category = categories[0] || "";
    if (categories.length) entry.categories = categories.slice();
    if (draft.featured) entry.featured = true;
    return entry;
  }

  function cardTags(video) {
    const categories = videoCategories(video);
    const tags = orderedTags(categories, video && video.tags);
    const velo = categories.indexOf("Pitching") >= 0 ? String(video && video.velo || "").trim() : "";
    return velo ? tags.concat([velo]) : tags;
  }

  function filterTags(video) {
    return orderedTags(videoCategories(video), video && video.tags);
  }

  function matchesAllTags(video, selected) {
    const need = normalizeTags(selected);
    if (!need.length) return true;
    const have = new Set(filterTags(video).map(tag => tag.toLowerCase()));
    return need.every(tag => have.has(tag.toLowerCase()));
  }

  function postedTime(video) {
    const match = String(video && video.date || "").match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (!match) return 0;
    const month = MONTHS.findIndex(name => name.toLowerCase() === match[1].toLowerCase());
    if (month < 0) return 0;
    return Date.UTC(Number(match[3]), month, Number(match[2]));
  }

  function sortByDate(list) {
    return (list || []).slice().sort((a, b) => postedTime(b) - postedTime(a));
  }

  function monthLabel(date) {
    const match = String(date || "").match(/^(\d{4})-(\d{2})/);
    if (!match) return String(date || "");
    const index = Number(match[2]) - 1;
    if (index < 0 || index > 11) return String(date || "");
    return SHORT_MONTHS[index] + " " + match[1];
  }

  function historyNewestFirst(history) {
    return (history || []).slice().sort((a, b) => String(b && b.date || "").localeCompare(String(a && a.date || "")));
  }

  function trendSvg(history) {
    const points = historyNewestFirst(history).slice().reverse().filter(point => point && point.mph != null && point.mph !== "");
    if (points.length < 2) return "";
    const nums = points.map(point => Number(point.mph));
    const min = Math.min.apply(null, nums);
    const max = Math.max.apply(null, nums);
    const w = 140;
    const h = 40;
    const pad = 4;
    const cmds = points.map((point, i) => {
      const x = pad + (i / (points.length - 1)) * (w - pad * 2);
      const mph = Number(point.mph);
      const y = max === min ? h / 2 : pad + (1 - (mph - min) / (max - min)) * (h - pad * 2);
      return (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    });
    return '<svg class="trend" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" aria-hidden="true" focusable="false"><path d="' + cmds.join("") + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
  }

  function cardHtml(video) {
    const tags = cardTags(video).map(tag => '<span class="tag">' + esc(tag) + "</span>").join("");
    const caption = video.caption ? "<p>" + esc(video.caption) + "</p>" : "";
    return '<article class="vcard"><div class="vmedia">' + (video.mediaHtml || "") + '</div><div class="vbody"><div class="tags">' + tags + "</div>" + caption + "</div></article>";
  }

  function videoKey(video) {
    return JSON.stringify([
      video.title || "",
      video.type || "",
      video.url || "",
      video.category || "",
      videoCategories(video).join("|"),
      video.caption || "",
      video.date || "",
      video.velo || "",
      video.thumbnail || "",
      video.featured ? "1" : "",
      normalizeTags(video.tags).join("|")
    ]);
  }

  function isReal(video) {
    return video && video.type !== "placeholder" && !!video.url;
  }

  function cloneData(data) {
    return {
      categories: CATEGORIES.slice(),
      videos: ((data && data.videos) || []).map(video => Object.assign({}, video))
    };
  }

  function isWebLink(url) {
    return /^https:\/\/\S+$/i.test(String(url || "").trim());
  }

  function validateEntry(entry) {
    if (!videoCategories(entry).length) return "Pick a category.";
    if (!entry.title) return "Add a title.";
    if (entry.type === "youtube" && !youtubeId(entry.url)) return "That doesn't look like a YouTube link. Open the video and copy the address.";
    if (entry.type === "link" && !isWebLink(entry.url)) return "That doesn't look like a link. Open the video and copy the address.";
    if (entry.type !== "youtube" && entry.type !== "mp4" && entry.type !== "link") return "Choose a video or paste a YouTube link.";
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
    return JSON.stringify({ categories: CATEGORIES.slice(), videos: data.videos }, null, 2) + "\n";
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
        message: "Post video: " + (suggestedTitle(action.entry) || action.entry.title),
        removePaths: [],
        removedUrl: ""
      };
    }
    const index = next.videos.findIndex(video => videoKey(video) === action.key);
    if (index < 0) return { ok: false, error: "That video isn't in the list anymore. Go back and check My Videos." };
    if (action.kind === "delete") {
      const removed = next.videos[index];
      next.videos.splice(index, 1);
      const removePaths = [];
      const videoPath = mediaPathFromUrl(removed.url);
      const posterPath = mediaPathFromUrl(removed.thumbnail);
      if (videoPath) removePaths.push(videoPath);
      if (posterPath && posterPath !== videoPath) removePaths.push(posterPath);
      return {
        ok: true,
        data: next,
        json: serializeVideos(next),
        message: "Remove video: " + (suggestedTitle(removed) || removed.title || "Untitled"),
        removePaths: removePaths,
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
        message: "Update video: " + (suggestedTitle(action.entry) || action.entry.title),
        removePaths: [],
        removedUrl: ""
      };
    }
    return { ok: false, error: "That didn't work. Try again." };
  }

  function githubDetail(err) {
    const parts = [];
    const message = String((err && err.message) || "").replace(/\s+/g, " ").trim();
    if (message && message !== "Save failed") parts.push(message);
    const errors = err && Array.isArray(err.errors) ? err.errors : [];
    errors.forEach(item => {
      const bit = [item && item.resource, item && item.field, item && item.code].filter(Boolean).join(" ");
      if (bit) parts.push(bit);
    });
    return parts.join(" — ") || "GitHub rejected that save.";
  }

  function friendlyError(err) {
    const status = err && err.status;
    const message = (err && err.message) || "";
    if (message === "popup") return "The login window didn't open. Allow pop-ups for this site, then try again.";
    if (message === "closed") return "Login was closed before it finished. Tap Log in again.";
    if (message === "denied") return "GitHub didn't finish the login. Try again.";
    if (message === "aborted") return "Canceled. Nothing was saved.";
    if (message === "too-big") return "This clip is too big. Trim it under 35 MB in Photos, or use a YouTube link.";
    if (/too large/i.test(message)) return "This clip is too big. Trim it under 35 MB in Photos, or use a YouTube link.";
    if (status === 401) return "Please log in again.";
    if (status === 403 || status === 404) return "GitHub didn't allow that save. Ask JT to check that your GitHub login can edit the site.";
    if (err && err.conflict) return "That didn't save because the list changed. Tap the button again.";
    if (status === 422 || status === 409) return githubDetail(err);
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

  function cacheBust(path) {
    return path + (path.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
  }

  async function readVideos(request) {
    const file = await request("GET", cacheBust(repoPath("/contents/data/videos.json?ref=" + BRANCH)));
    return JSON.parse(base64ToUtf8(file.content));
  }

  function alreadySaved(data, action) {
    const list = (data && data.videos) || [];
    if (!action) return false;
    if (action.kind === "add") {
      const url = action.entry && action.entry.url;
      return !!(url && list.some(video => video.url === url));
    }
    if (action.kind === "delete") return !list.some(video => videoKey(video) === action.key);
    if (action.kind === "update") return list.some(video => videoKey(video) === videoKey(action.entry));
    return false;
  }

  async function saveFresh(request, action, extras, decorate) {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const data = await readVideos(request);
      if (alreadySaved(data, action)) {
        const next = cloneData(data);
        const entry = action.entry || {};
        return {
          ok: true,
          data: next,
          json: serializeVideos(next),
          message: action.kind === "add" ? "Post video: " + (entry.title || "") : "Saved",
          removePaths: [],
          removedUrl: "",
          alreadySaved: true
        };
      }
      let plan = prepareSave(data, action);
      if (!plan.ok) throw Object.assign(new Error(plan.error), { friendly: plan.error });
      if (decorate) {
        const decorated = decorate(plan);
        if (decorated) plan = decorated;
      }
      try {
        await commitChanges(request, plan, extras);
        return plan;
      } catch (err) {
        lastErr = err;
        if (!(err && err.conflict) || attempt === 3) throw err;
      }
    }
    throw lastErr;
  }

  async function commitChanges(request, plan, extras) {
    const extra = extras || {};
    const ref = await request("GET", cacheBust(repoPath("/git/ref/heads/" + BRANCH)));
    const parentSha = ref.object.sha;
    const parent = await request("GET", repoPath("/git/commits/" + parentSha));
    const tree = [];
    if (extra.mediaPath) {
      if (typeof extra.mediaBase64 !== "string" || !extra.mediaBase64) {
        throw Object.assign(new Error("That video didn't come through. Try choosing it again."), {
          friendly: "That video didn't come through. Try choosing it again."
        });
      }
      const blob = await request("POST", repoPath("/git/blobs"), {
        content: extra.mediaBase64,
        encoding: "base64"
      }, extra.onProgress);
      if (!blob || typeof blob.sha !== "string" || !blob.sha) {
        throw Object.assign(new Error("GitHub did not accept the video file."), {
          friendly: "GitHub did not accept the video file."
        });
      }
      tree.push({ path: extra.mediaPath, mode: "100644", type: "blob", sha: blob.sha });
    }
    if (extra.thumbnailPath && typeof extra.thumbnailBase64 === "string" && extra.thumbnailBase64) {
      const thumbBlob = await request("POST", repoPath("/git/blobs"), {
        content: extra.thumbnailBase64,
        encoding: "base64"
      });
      if (thumbBlob && typeof thumbBlob.sha === "string" && thumbBlob.sha) {
        tree.push({ path: extra.thumbnailPath, mode: "100644", type: "blob", sha: thumbBlob.sha });
      }
    }
    const jsonBase64 = utf8ToBase64(plan.json);
    if (typeof jsonBase64 !== "string" || !jsonBase64) {
      throw Object.assign(new Error("The video list could not be prepared."), {
        friendly: "The video list could not be prepared."
      });
    }
    const jsonBlob = await request("POST", repoPath("/git/blobs"), {
      content: jsonBase64,
      encoding: "base64"
    });
    if (!jsonBlob || typeof jsonBlob.sha !== "string" || !jsonBlob.sha) {
      throw Object.assign(new Error("GitHub did not accept the video list."), {
        friendly: "GitHub did not accept the video list."
      });
    }
    tree.push({ path: "data/videos.json", mode: "100644", type: "blob", sha: jsonBlob.sha });
    if (plan.profileJson) {
      const profileBlob = await request("POST", repoPath("/git/blobs"), {
        content: utf8ToBase64(plan.profileJson),
        encoding: "base64"
      });
      tree.push({ path: "data/profile.json", mode: "100644", type: "blob", sha: profileBlob.sha });
    }
    const removals = (plan.removePaths || []).filter(path => path && !tree.some(item => item.path === path));
    if (removals.length) {
      const listing = await request("GET", cacheBust(repoPath("/git/trees/" + parent.tree.sha + "?recursive=1")));
      const entries = listing && Array.isArray(listing.tree) ? listing.tree : [];
      const present = new Set(entries.map(item => item && item.path).filter(Boolean));
      removals.forEach(path => {
        if (!present.has(path)) return;
        tree.push({ path: path, mode: "100644", type: "blob", sha: null });
      });
    }
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
    const label = suggestedTitle(video) || "Video";
    if (video.type === "link" && isWebLink(video.url)) {
      return '<a class="play link" href="' + esc(video.url) + '" target="_blank" rel="noopener noreferrer">Open clip</a>';
    }
    const id = youtubeId(video.url);
    if (id && video.type !== "mp4") {
      return '<button type="button" class="play" data-play="youtube" data-id="' + esc(id) + '"><img alt="' + esc(label) + '" src="https://i.ytimg.com/vi/' + esc(id) + '/hqdefault.jpg"></button>';
    }
    if (video.thumbnail && video.url && video.type !== "placeholder") {
      return '<button type="button" class="play" data-play="file" data-src="' + esc(video.url) + '"><img alt="' + esc(label) + '" src="' + esc(video.thumbnail) + '"></button>';
    }
    if (video.url && video.type !== "placeholder") {
      return '<video controls preload="metadata" playsinline aria-label="' + esc(label) + '" src="' + esc(video.url) + '#t=0.5"></video>';
    }
    return "<span>▶ Video coming soon</span>";
  }

  return {
    CATEGORIES,
    TAGS,
    STEPS,
    TAG_LABELS,
    MAX_CUSTOM_TAG,
    MAX_CUSTOM_TAGS,
    cleanTag,
    normalizeTags,
    orderedTags,
    addCustomTag,
    MAX_VIDEO_BYTES,
    CAPTION_HINTS,
    tagsFor,
    tagsForCategories,
    normalizeCategories,
    videoCategories,
    inCategory,
    isPresetTag,
    hasTags,
    stepsFor,
    suggestedTitle,
    filterTags,
    matchesAllTags,
    sortByDate,
    monthLabel,
    historyNewestFirst,
    trendSvg,
    featuredReel,
    profileWithReel,
    todayISO,
    formatISODate,
    ageParts,
    ageLabel,
    stamp,
    slug,
    extensionFor,
    mediaRepoPath,
    thumbnailRepoPath,
    publicUrl,
    mediaPathFromUrl,
    youtubeId,
    isWebLink,
    tooBig,
    oversizeMessage,
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
    commitChanges,
    saveFresh
  };
});
