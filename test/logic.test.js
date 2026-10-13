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
  assert.equal(L.suggestedTitle({ category: "Pitching", pitch: "Fastball", angle: "Open side", setting: "Bullpen" }), "Fastball · Open side · Bullpen");
  assert.equal(L.suggestedTitle({ category: "Hitting", result: "Double", angle: "Open side", setting: "Game" }), "Double · Open side · Game");
  assert.equal(L.suggestedTitle({ category: "Fielding", play: "Diving catch", position: "CF", setting: "Game" }), "Diving catch · Game");
  assert.equal(L.suggestedTitle({ category: "Workouts/Training", workout: "Long toss" }), "Long toss");
  assert.equal(L.suggestedTitle({ category: "Game Highlights" }), "Game Highlights");
});

test("every category uses the same five steps, with its own tags", () => {
  assert.deepEqual(L.STEPS, ["video", "category", "tags", "details", "preview"]);
  for (const category of ["", "Pitching", "Hitting", "Fielding", "Workouts/Training", "Game Highlights"]) {
    assert.deepEqual(L.stepsFor(category), L.STEPS);
  }
  assert.deepEqual(L.tagsFor("Pitching").pitch, ["Fastball", "Sinker", "Slider", "Curveball", "Changeup", "Cutter"]);
  assert.deepEqual(L.tagsFor("Pitching").angle, ["Open side", "Behind mound", "Front", "Side"]);
  assert.deepEqual(L.tagsFor("Hitting").result, ["Single", "Double", "Triple", "Home run", "Walk", "Line drive out"]);
  assert.deepEqual(L.tagsFor("Hitting").pitchFaced, ["Fastball", "Breaking ball", "Off-speed"]);
  assert.deepEqual(L.tagsFor("Hitting").battedBall, ["Line drive", "Ground ball", "Fly ball"]);
  assert.deepEqual(L.tagsFor("Hitting").setting, ["Game", "Batting practice"]);
  assert.deepEqual(L.tagsFor("Hitting").angle, L.tagsFor("Pitching").angle);
  assert.deepEqual(L.tagsFor("Fielding").play, ["Catch", "Diving catch", "Throw/assist", "Ground ball", "Fly ball", "Relay"]);
  assert.deepEqual(L.tagsFor("Fielding").position, ["LF", "CF", "RF", "P"]);
  assert.deepEqual(L.tagsFor("Fielding").setting, ["Game", "Practice"]);
  assert.deepEqual(L.tagsFor("Fielding").angle, L.tagsFor("Pitching").angle);
  assert.equal(L.tagsFor("Workouts/Training").angle, undefined);
  assert.deepEqual(L.tagsFor("Workouts/Training").workout, ["Velo", "Long toss", "Weights", "Speed/agility", "Bullpen"]);
  assert.equal(L.hasTags("Game Highlights"), false);
  assert.equal(L.hasTags("Workouts/Training"), true);
});

test("dates use the calendar day, not UTC shifting", () => {
  assert.equal(L.formatISODate("2026-10-12"), "October 12, 2026");
  assert.equal(L.formatISODate("2026-04-12"), "April 12, 2026");
  assert.equal(L.todayISO(new Date(2026, 9, 12, 23, 30)), "2026-10-12");
});

test("a pitching post keeps the site's video shape and drops unused tags", () => {
  const entry = L.buildEntry({
    title: "Fastball · Bullpen",
    type: "mp4",
    url: "/media/videos/fastball.mp4",
    category: "Pitching",
    pitch: "Fastball",
    angle: "Open side",
    setting: "Bullpen",
    date: "October 12, 2026",
    caption: "First-pitch slider, swing and miss."
  });
  assert.deepEqual(Object.keys(entry), ["title", "type", "url", "pitch", "angle", "setting", "date", "caption", "category"]);
  const saved = L.prepareSave(base, { kind: "add", entry });
  assert.equal(saved.ok, true);
  assert.equal(saved.data.videos[0].title, entry.title);
  assert.equal(saved.data.videos[1].title, "Sinker (Placeholder)");
  assert.equal(saved.data.categories[0], "Pitching");
  assert.match(saved.json, /"url": "\/media\/videos\/fastball.mp4"/);
  assert.equal(saved.message, "Post video: Fastball · Bullpen");
});

test("leaving pitching removes the pitch tag", () => {
  const original = base.videos[0];
  const entry = L.buildEntry({
    title: "Hitting · Game",
    type: "youtube",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    category: "Hitting",
    pitch: "Sinker",
    angle: "Open side",
    setting: "Game",
    date: "October 12, 2026",
    caption: "Opposite-field double."
  });
  assert.equal(entry.pitch, undefined);
  assert.equal(entry.angle, "Open side");
  const saved = L.prepareSave(base, { kind: "update", key: L.videoKey(original), entry });
  assert.equal(saved.ok, true);
  assert.equal(saved.data.videos.length, 1);
  assert.equal(saved.data.videos[0].category, "Hitting");
  assert.equal(saved.data.videos[0].pitch, undefined);
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

test("optional speed, opponent, and one featured clip", () => {
  const game = L.buildEntry({
    title: "Double · Game",
    type: "youtube",
    url: "https://youtu.be/abcdefghijk",
    category: "Hitting",
    result: "Double",
    pitchFaced: "Fastball",
    battedBall: "Line drive",
    setting: "Game",
    velo: "75 mph",
    opponent: "Marin Catholic",
    featured: true,
    date: "October 12, 2026",
    caption: "Opposite field."
  });
  assert.equal(game.velo, "75 mph");
  assert.equal(game.opponent, "Marin Catholic");
  assert.equal(game.featured, true);
  assert.deepEqual(L.filterTags(game), ["Double", "Fastball", "Line drive", "Game", "75 mph", "Marin Catholic"]);
  const bullpen = L.buildEntry({
    title: "Fastball",
    type: "mp4",
    url: "/media/videos/fastball.mp4",
    category: "Pitching",
    pitch: "Fastball",
    setting: "Bullpen",
    opponent: "Should not stick",
    velo: "74 mph",
    date: "October 12, 2026",
    caption: ""
  });
  assert.equal(bullpen.opponent, undefined);
  assert.equal(bullpen.velo, "74 mph");
  const older = { title: "Old reel", type: "youtube", url: "https://youtu.be/aaaaaaaaaaa", category: "Game Highlights", featured: true, date: "", caption: "Old" };
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

test("the public site filters every clip tag inside a tab", () => {
  const src = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  assert.match(src, /function clipTags\(v\)\{return \[v\.pitch,v\.result,v\.pitchFaced,v\.battedBall,v\.play,v\.position,v\.workout,v\.angle,v\.setting,v\.velo,v\.opponent,\.\.\.\(Array\.isArray\(v\.tags\)\?v\.tags:\[\]\)\]/);
  assert.match(src, /clipTags\(v\)\.includes\(f\)/);
  assert.match(src, /v\.featured&&v\.url/);
});

test("the preview card uses the same markup as the site", () => {
  const html = L.cardHtml({
    title: "Fastball · Game",
    pitch: "Fastball",
    setting: "Game",
    date: "October 12, 2026",
    caption: "Swing and miss.",
    mediaHtml: "<video></video>"
  });
  assert.match(html, /^<article class="vcard"><div class="vmedia"><video><\/video><\/div><div class="vbody"><h4>Fastball · Game<\/h4><div class="tags"><span class="tag">Fastball<\/span><span class="tag">Game<\/span><span class="tag">October 12, 2026<\/span><\/div><p>Swing and miss\.<\/p><\/div><\/article>$/);
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
  assert.equal(data.categories.length, 5);
  assert.equal(data.videos[0].pitch, "Sinker");
  assert.equal(L.isReal(data.videos[0]), false);
});

test("pitching, hitting, and fielding share the camera-angle chips", () => {
  const angles = ["Open side", "Behind mound", "Front", "Side"];
  assert.deepEqual(L.tagsFor("Pitching").angle, angles);
  assert.deepEqual(L.tagsFor("Hitting").angle, angles);
  assert.deepEqual(L.tagsFor("Fielding").angle, angles);
  assert.equal(L.tagsFor("Workouts/Training").angle, undefined);
  assert.equal(L.tagsFor("Game Highlights").angle, undefined);
  assert.equal(L.TAG_LABELS.angle, "Camera angle");
  const hitting = L.buildEntry({ title: "Double · Open side · Game", type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", category: "Hitting", result: "Double", angle: "Open side", setting: "Game", date: "October 12, 2026", caption: "" });
  assert.equal(hitting.angle, "Open side");
  assert.ok(L.filterTags(hitting).includes("Open side"));
  const workout = L.buildEntry({ title: "Long toss", type: "youtube", url: "https://youtu.be/dQw4w9WgXcQ", category: "Workouts/Training", workout: "Long toss", angle: "Front", date: "October 12, 2026", caption: "" });
  assert.equal(workout.angle, undefined);
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
    assert.deepEqual(entry.tags, ["vs. lefty"]);
    assert.ok(L.cardTags(entry).includes("vs. lefty"));
    assert.ok(L.filterTags(entry).includes("vs. lefty"));
    assert.match(L.cardHtml(entry), /vs\. lefty/);
  }
  const none = L.buildEntry({ title: "T", type: "youtube", url: "u", category: "Pitching", tags: [] });
  assert.equal(none.tags, undefined);
});
