const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const L = require("../admin/logic.js");

const base = {
  categories: L.CATEGORIES.slice(),
  videos: [
    {
      title: "Sinker (Placeholder)",
      type: "placeholder",
      url: "",
      pitch: "Sinker",
      angle: "Open side",
      setting: "Bullpen",
      date: "TBD",
      caption: "Video coming soon.",
      category: "Pitching"
    }
  ]
};

test("suggested titles follow the taps", () => {
  assert.equal(L.suggestedTitle({ category: "Pitching", tags: ["Bullpen", "Sinker"] }), "Sinker · Bullpen");
  assert.equal(L.suggestedTitle({ category: "Hitting", tags: ["Game", "Single"] }), "Single · Game");
  assert.equal(L.suggestedTitle({ category: "Fielding", tags: ["Catch", "Game"] }), "Catch · Game");
  assert.equal(L.suggestedTitle({ category: "Training/Workouts", tags: ["Weights"] }), "Weights");
  assert.equal(L.suggestedTitle({ category: "Pitching", tags: [] }), "Pitching");
});

test("every category uses the same five steps, with its own tags", () => {
  assert.deepEqual(L.CATEGORIES, ["Pitching", "Hitting", "Fielding", "Training/Workouts"]);
  assert.deepEqual(L.STEPS, ["video", "category", "tags", "details", "preview"]);
  for (const category of ["", ...L.CATEGORIES]) {
    assert.deepEqual(L.stepsFor(category), L.STEPS);
    assert.equal(L.stepsFor(category).length, 5);
  }
  assert.deepEqual(L.tagsFor("Pitching"), ["Sinker", "Curveball", "Slider", "Cutter", "Changeup", "K", "Pickoff", "Game", "Bullpen"]);
  assert.deepEqual(L.tagsFor("Hitting"), ["vs. Lefty", "vs. Righty", "Bunt", "Single", "Extra-base hit", "Game", "BP"]);
  assert.deepEqual(L.tagsFor("Fielding"), ["OF", "Pitcher", "Catch", "Throw", "Game", "Practice"]);
  assert.deepEqual(L.tagsFor("Training/Workouts"), ["Bullpen", "Weights", "Speed/Agility"]);
  for (const category of L.CATEGORIES) assert.equal(L.hasTags(category), true);
});

test("dates use the calendar day, not UTC shifting", () => {
  assert.equal(L.formatISODate("2026-10-12"), "October 12, 2026");
  assert.equal(L.formatISODate("2026-04-12"), "April 12, 2026");
  assert.equal(L.todayISO(new Date(2026, 9, 12, 23, 30)), "2026-10-12");
});

test("a pitching post keeps the site's video shape and drops unused tags", () => {
  const entry = L.buildEntry({
    title: "Sinker · Bullpen",
    type: "mp4",
    url: "/media/videos/sinker.mp4",
    category: "Pitching",
    tags: ["Bullpen", "Sinker", "  sinker "],
    velo: "75 mph",
    opponent: "Nope",
    thumbnail: "/media/videos/sinker.jpg",
    date: "October 12, 2026",
    caption: "First-pitch sinker, swing and miss."
  });
  assert.deepEqual(Object.keys(entry), ["title", "type", "url", "tags", "velo", "thumbnail", "date", "caption", "category"]);
  assert.deepEqual(entry.tags, ["Sinker", "Bullpen"]);
  assert.equal(entry.opponent, undefined);
  const saved = L.prepareSave(base, { kind: "add", entry });
  assert.equal(saved.ok, true);
  assert.equal(saved.data.videos[0].title, entry.title);
  assert.equal(saved.data.videos[1].title, "Sinker (Placeholder)");
  assert.equal(saved.data.categories[0], "Pitching");
  assert.equal(saved.data.categories.length, 4);
  assert.match(saved.json, /"url": "\/media\/videos\/sinker.mp4"/);
  assert.equal(saved.message, "Post video: Sinker · Bullpen");
});

test("speed stays on pitching clips and is dropped everywhere else", () => {
  const original = base.videos[0];
  const entry = L.buildEntry({
    title: "Single · Game",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Hitting",
    tags: ["Single", "Game", "Sinker"],
    velo: "75 mph",
    opponent: "Marin Catholic",
    date: "October 12, 2026",
    caption: "Opposite-field single."
  });
  assert.equal(entry.velo, undefined);
  assert.equal(entry.opponent, undefined);
  assert.deepEqual(entry.tags, ["Single", "Game", "Sinker"]);
  const saved = L.prepareSave(base, { kind: "update", key: L.videoKey(original), entry });
  assert.equal(saved.ok, true);
  assert.equal(saved.data.videos.length, 1);
  assert.equal(saved.data.videos[0].category, "Hitting");
  assert.equal(saved.data.videos[0].velo, undefined);
  assert.equal(L.youtubeId(saved.data.videos[0].url), "dQw4w9WgXcQ");
});

test("delete removes a repo video and leaves YouTube files alone", () => {
  const data = {
    categories: L.CATEGORIES.slice(),
    videos: [
      { title: "Phone clip", type: "mp4", url: "/media/videos/phone-clip.mp4", date: "October 12, 2026", caption: "Hi", category: "Hitting" },
      { title: "Link", type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", date: "October 12, 2026", caption: "", category: "Hitting" }
    ]
  };
  const fileDelete = L.prepareSave(data, { kind: "delete", key: L.videoKey(data.videos[0]) });
  assert.deepEqual(fileDelete.removePaths, ["media/videos/phone-clip.mp4"]);
  assert.equal(fileDelete.data.videos.length, 1);
  const linkDelete = L.prepareSave(data, { kind: "delete", key: L.videoKey(data.videos[1]) });
  assert.deepEqual(linkDelete.removePaths, []);
  assert.equal(L.mediaPathFromUrl("https://colinfenn.com/media/videos/ok.mp4"), "media/videos/ok.mp4");
  assert.equal(L.mediaPathFromUrl("/media/videos/../../data/profile.json"), null);
  assert.equal(L.mediaPathFromUrl("https://example.com/media/videos/x.mp4"), null);
});

test("oversized files and bad links get plain-language blocks", () => {
  assert.equal(L.tooBig(L.MAX_VIDEO_BYTES), false);
  assert.equal(L.tooBig(L.MAX_VIDEO_BYTES + 1), true);
  assert.equal(L.friendlyError({ message: "too-big" }).includes("YouTube"), true);
  assert.equal(L.friendlyError({ message: "popup" }).includes("pop-ups"), true);
  assert.equal(L.validateEntry({ title: "", type: "youtube", url: "https://vimeo.com/1", category: "Hitting" }), "Add a title.");
  const missing = L.buildEntry({ title: "Clip", type: "youtube", url: "https://vimeo.com/1", category: "Hitting", date: "October 12, 2026", caption: "" });
  assert.match(L.validateEntry(missing), /YouTube/);
  assert.equal(L.youtubeId("https://www.youtube.com/shorts/abcdefghijk"), "abcdefghijk");
  assert.equal(L.youtubeId("https://youtu.be/abcdefghijk"), "abcdefghijk");
});

test("file names stay inside media/videos", () => {
  const repoPath = L.mediaRepoPath("Fastball · Open side", "IMG_1.MOV", "video/quicktime", new Date(2026, 9, 12, 15, 4, 5));
  assert.equal(repoPath, "media/videos/fastball-open-side-20261012-150405.mov");
  assert.equal(L.extensionFor("clip.webm", ""), "webm");
  assert.equal(L.extensionFor("clip.m4v", "video/mp4"), "mp4");
  assert.equal(L.publicUrl(repoPath), "/" + repoPath);
});

test("optional pitching speed and one featured clip", () => {
  const game = L.buildEntry({
    title: "Single · Game",
    type: "youtube",
    url: "https://youtu.be/abcdefghijk",
    category: "Hitting",
    tags: ["Single", "Game"],
    velo: "75 mph",
    opponent: "Marin Catholic",
    featured: true,
    date: "October 12, 2026",
    caption: "Opposite field."
  });
  assert.equal(game.velo, undefined);
  assert.equal(game.opponent, undefined);
  assert.equal(game.featured, true);
  assert.deepEqual(L.filterTags(game), ["Single", "Game"]);
  const bullpen = L.buildEntry({
    title: "Sinker",
    type: "mp4",
    url: "/media/videos/sinker.mp4",
    category: "Pitching",
    tags: ["Sinker", "Bullpen"],
    opponent: "Should not stick",
    velo: "74 mph",
    date: "October 12, 2026",
    caption: ""
  });
  assert.equal(bullpen.opponent, undefined);
  assert.equal(bullpen.velo, "74 mph");
  assert.deepEqual(L.cardTags(bullpen), ["Sinker", "Bullpen", "74 mph"]);
  const older = { title: "Old reel", type: "youtube", url: "https://youtu.be/aaaaaaaaaaa", category: "Pitching", featured: true, date: "", caption: "Old" };
  const saved = L.prepareSave({ categories: L.CATEGORIES.slice(), videos: [older] }, { kind: "add", entry: game });
  assert.equal(saved.data.videos[0].featured, true);
  assert.equal(saved.data.videos[1].featured, undefined);
  const profile = { name: "Colin Fenn", highlightReel: { url: older.url, title: "Old", caption: "Old" } };
  const reel = L.featuredReel(profile, saved.data, "");
  assert.deepEqual(reel, { url: game.url, title: game.title, caption: game.caption });
  const cleared = L.prepareSave(saved.data, { kind: "update", key: L.videoKey(saved.data.videos[0]), entry: L.buildEntry({ ...game, featured: false }) });
  assert.equal(cleared.data.videos[0].featured, undefined);
  assert.deepEqual(L.featuredReel({ highlightReel: reel }, cleared.data, ""), { url: "", title: game.title, caption: "" });
  const removed = L.prepareSave(saved.data, { kind: "delete", key: L.videoKey(saved.data.videos[0]) });
  assert.equal(removed.removedUrl, game.url);
  assert.deepEqual(L.featuredReel({ highlightReel: reel }, removed.data, removed.removedUrl), { url: "", title: "", caption: "" });
});

test("the public site matches every selected tag and sorts newest first", () => {
  const src = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(src, /L\.matchesAllTags\(v, selected\)/);
  assert.match(src, /L\.sortByDate\(/);
  assert.match(src, /Videos coming soon/);
  assert.match(src, /v\.featured && v\.url/);
  const logic = fs.readFileSync(path.join(__dirname, "../admin/logic.js"), "utf8");
  assert.match(logic, /https:\/\/i\.ytimg\.com\/vi\//);
  assert.match(logic, /hqdefault\.jpg/);
  assert.match(logic, /#t=0\.5/);
  const videos = [
    { title: "old", date: "July 1, 2026", tags: ["Sinker", "Game"], category: "Pitching" },
    { title: "new", date: "October 12, 2026", tags: ["Sinker", "Bullpen"], category: "Pitching" },
    { title: "mid", date: "September 2, 2026", tags: ["Sinker", "Game"], category: "Pitching" },
    { title: "tbd", date: "TBD", tags: ["Sinker"], category: "Pitching" }
  ];
  assert.equal(L.matchesAllTags(videos[0], []), true);
  assert.equal(L.matchesAllTags(videos[0], ["Sinker", "Game"]), true);
  assert.equal(L.matchesAllTags(videos[1], ["Sinker", "Game"]), false);
  assert.deepEqual(L.sortByDate(videos).map(video => video.title), ["new", "mid", "old", "tbd"]);
});

test("the preview card uses the same markup as the site", () => {
  const html = L.cardHtml({
    title: "Sinker · Game",
    category: "Pitching",
    tags: ["Game", "Sinker"],
    velo: "75 mph",
    date: "October 12, 2026",
    caption: "Swing and miss.",
    mediaHtml: "<img>"
  });
  assert.match(html, /^<article class="vcard"><div class="vmedia"><img><\/div><div class="vbody"><div class="tags"><span class="tag">Sinker<\/span><span class="tag">Game<\/span><span class="tag">75 mph<\/span><\/div><p>Swing and miss\.<\/p><\/div><\/article>$/);
  assert.doesNotMatch(html, /October 12/);
  assert.match(L.mediaHtml({ type: "youtube", url: "https://youtu.be/abcdefghijk", title: "Clip" }), /https:\/\/i\.ytimg\.com\/vi\/abcdefghijk\/hqdefault\.jpg/);
  assert.match(L.mediaHtml({ type: "mp4", url: "/media/videos/a.mp4", title: "Clip" }), /preload="metadata"/);
  assert.match(L.mediaHtml({ type: "mp4", url: "/media/videos/a.mp4", title: "Clip" }), /#t=0\.5/);
  assert.match(L.previewDocument({ title: "A", mediaHtml: "" }), /\/css\/theme\.css/);
});

test("commit sends the video blob, then videos.json, and can delete a file", async () => {
  const entry = L.buildEntry({
    title: "Fastball",
    type: "mp4",
    url: "/media/videos/fastball.mp4",
    category: "Pitching",
    pitch: "Fastball",
    date: "October 12, 2026",
    caption: "Hi"
  });
  const plan = L.prepareSave(base, { kind: "add", entry });
  plan.removePaths = ["media/videos/old.mp4"];
  const calls = [];
  const sha = await L.commitChanges(async (method, url, body) => {
    calls.push({ method, url, body });
    if (url.endsWith("/git/ref/heads/main") && method === "GET") return { object: { sha: "parent" } };
    if (url.endsWith("/git/commits/parent")) return { tree: { sha: "tree0" } };
    if (url.endsWith("/git/blobs")) return { sha: "blob-" + calls.length };
    if (url.endsWith("/git/trees")) return { sha: "tree1" };
    if (url.endsWith("/git/commits") && method === "POST") return { sha: "commit1" };
    if (method === "PATCH") return { ref: "refs/heads/main" };
    throw new Error("unexpected " + method + " " + url);
  }, plan, { mediaPath: "media/videos/fastball.mp4", mediaBase64: "AAAA" });

  assert.equal(sha, "commit1");
  assert.deepEqual(calls.map(call => call.method + " " + call.url), [
    "GET /repos/colinfenn/colinfenn-site/git/ref/heads/main",
    "GET /repos/colinfenn/colinfenn-site/git/commits/parent",
    "POST /repos/colinfenn/colinfenn-site/git/blobs",
    "POST /repos/colinfenn/colinfenn-site/git/blobs",
    "POST /repos/colinfenn/colinfenn-site/git/trees",
    "POST /repos/colinfenn/colinfenn-site/git/commits",
    "PATCH /repos/colinfenn/colinfenn-site/git/refs/heads/main"
  ]);
  assert.equal(calls[2].body.content, "AAAA");
  assert.equal(L.base64ToUtf8(calls[3].body.content), plan.json);
  assert.deepEqual(calls[4].body.tree, [
    { path: "media/videos/fastball.mp4", mode: "100644", type: "blob", sha: "blob-3" },
    { path: "data/videos.json", mode: "100644", type: "blob", sha: "blob-4" },
    { path: "media/videos/old.mp4", mode: "100644", type: "blob", sha: null }
  ]);
  assert.deepEqual(calls[5].body.parents, ["parent"]);
  assert.equal(calls[6].body.sha, "commit1");
});

test("a rejected ref update is marked so the app can retry", async () => {
  const plan = { json: "{}\n", message: "Post video: X", removePaths: [] };
  await assert.rejects(() => L.commitChanges(async (method, url) => {
    if (method === "GET" && url.includes("/git/ref/")) return { object: { sha: "parent" } };
    if (method === "GET") return { tree: { sha: "tree0" } };
    if (url.endsWith("/git/blobs")) return { sha: "b" };
    if (url.endsWith("/git/trees")) return { sha: "t" };
    if (method === "POST") return { sha: "c" };
    const err = new Error("fast forward");
    err.status = 422;
    throw err;
  }, plan, {}), err => err.conflict === true && err.status === 422);
});

test("reading videos.json decodes GitHub's base64 content", async () => {
  const raw = fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8");
  const data = await L.readVideos(async () => ({ content: Buffer.from(raw, "utf8").toString("base64") }));
  assert.deepEqual(data.categories, ["Pitching", "Hitting", "Fielding", "Training/Workouts"]);
  assert.deepEqual(data.videos, []);
});

test("no category has a camera-angle tag group", () => {
  for (const category of L.CATEGORIES) assert.equal(L.tagsFor(category).angle, undefined);
  assert.equal(L.TAG_LABELS.angle, undefined);
});

test("custom tags are trimmed, deduped, capped, and saved with the video", () => {
  let tags = L.addCustomTag([], "  Walk-off   hit ");
  assert.deepEqual(tags, ["Walk-off hit"]);
  tags = L.addCustomTag(tags, "walk-off HIT");
  assert.deepEqual(tags, ["Walk-off hit"]);
  tags = L.addCustomTag(tags, "   ");
  assert.deepEqual(tags, ["Walk-off hit"]);
  tags = L.addCustomTag(tags, "x".repeat(50));
  assert.equal(tags[1].length, L.MAX_CUSTOM_TAG);
  for (const category of L.CATEGORIES) {
    const entry = L.buildEntry({ title: "T", type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", category, tags: [" vs. lefty ", "VS. LEFTY"], date: "October 12, 2026" });
    const expected = category === "Hitting" ? ["vs. Lefty"] : ["vs. lefty"];
    assert.deepEqual(entry.tags, expected);
    assert.ok(L.cardTags(entry).some(tag => tag.toLowerCase() === "vs. lefty"));
    assert.ok(L.filterTags(entry).some(tag => tag.toLowerCase() === "vs. lefty"));
    assert.match(L.cardHtml(entry), /vs\. lefty/i);
  }
  const none = L.buildEntry({ title: "T", type: "youtube", url: "u", category: "Pitching", tags: [] });
  assert.equal(none.tags, undefined);
});

test("deleting a clip also removes its poster", () => {
  const data = {
    categories: L.CATEGORIES.slice(),
    videos: [{ title: "Phone", type: "mp4", url: "/media/videos/phone.mp4", thumbnail: "/media/videos/phone.jpg", date: "October 12, 2026", caption: "", category: "Hitting", tags: ["Single"] }]
  };
  const saved = L.prepareSave(data, { kind: "delete", key: L.videoKey(data.videos[0]) });
  assert.deepEqual(saved.removePaths, ["media/videos/phone.mp4", "media/videos/phone.jpg"]);
  assert.equal(L.thumbnailRepoPath("media/videos/phone.mp4"), "media/videos/phone.jpg");
});

test("a poster image is committed next to the video", async () => {
  const entry = L.buildEntry({
    title: "Sinker",
    type: "mp4",
    url: "/media/videos/sinker.mp4",
    thumbnail: "/media/videos/sinker.jpg",
    category: "Pitching",
    tags: ["Sinker"],
    date: "October 12, 2026",
    caption: ""
  });
  const plan = L.prepareSave({ categories: L.CATEGORIES.slice(), videos: [] }, { kind: "add", entry });
  const calls = [];
  await L.commitChanges(async (method, url, body) => {
    calls.push({ method, url, body });
    if (url.endsWith("/git/ref/heads/main") && method === "GET") return { object: { sha: "parent" } };
    if (url.endsWith("/git/commits/parent")) return { tree: { sha: "tree0" } };
    if (url.endsWith("/git/blobs")) return { sha: "blob-" + calls.length };
    if (url.endsWith("/git/trees")) return { sha: "tree1" };
    if (url.endsWith("/git/commits") && method === "POST") return { sha: "commit1" };
    if (method === "PATCH") return { ref: "refs/heads/main" };
    throw new Error("unexpected " + method + " " + url);
  }, plan, { mediaPath: "media/videos/sinker.mp4", mediaBase64: "AAAA", thumbnailPath: "media/videos/sinker.jpg", thumbnailBase64: "BBBB" });
  const tree = calls.find(call => call.url.endsWith("/git/trees")).body.tree;
  assert.deepEqual(tree.map(item => item.path), ["media/videos/sinker.mp4", "media/videos/sinker.jpg", "data/videos.json"]);
});

test("pitch history expands newest first and draws a trend after two readings", () => {
  assert.equal(L.monthLabel("2026-10"), "Oct 2026");
  assert.equal(L.monthLabel("2026-07"), "Jul 2026");
  assert.equal(L.trendSvg([{ mph: 75, date: "2026-10" }]), "");
  const svg = L.trendSvg([{ mph: 70, date: "2026-09" }, { mph: 75, date: "2026-10" }]);
  assert.match(svg, /<svg/);
  assert.match(svg, /<path/);
  assert.deepEqual(L.historyNewestFirst([{ mph: 66, date: "2026-07" }, { mph: 70, date: "2026-09" }]).map(point => point.mph), [70, 66]);
  const pitches = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/pitches.json"), "utf8"));
  assert.deepEqual(pitches.pitches.map(pitch => pitch.name), ["Sinker", "Cutter", "Changeup", "Slider", "Curveball"]);
  assert.deepEqual(pitches.pitches.map(pitch => pitch.history.length), [1, 1, 1, 1, 1]);
  assert.deepEqual(pitches.pitches.map(pitch => pitch.history[0].mph), [75, 70, 66, 62, 57]);
  const stats = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/stats.json"), "utf8"));
  assert.equal(stats.tables[0].rows[0].obp, ".491");
  assert.equal(stats.tables[0].columns.some(column => column.key === "cpct"), false);
  assert.equal(stats.tables[1].rows[0].era, "5.29");
  assert.equal(stats.tables[1].rows[0].spct, "55.64%");
  assert.equal(stats.tables[1].rows[0].cpct, "89.80%");
  const yml = fs.readFileSync(path.join(__dirname, "../admin/advanced/config.yml"), "utf8");
  assert.match(yml, /data\/pitches\.json/);
  assert.match(yml, /do not overwrite older ones/);
  assert.doesNotMatch(yml, /Game Highlights/);
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /href="#videos"/);
  assert.match(html, /href="#about"/);
  assert.match(html, /About Me video coming soon/);
  assert.doesNotMatch(html, /id="academics"|id="schedule"|id="showcases"|id="references"|id="note"|FB Velo/);
  const uploader = fs.readFileSync(path.join(__dirname, "../admin/app.js"), "utf8");
  assert.match(uploader, /captureFrame/);
  assert.match(uploader, /canvas/);
  assert.match(uploader, /Videos coming soon/);
  assert.match(uploader, /You can pick more than one/);
});
