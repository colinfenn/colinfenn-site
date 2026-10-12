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
  assert.equal(L.suggestedTitle({ category: "Hitting", angle: "Front", setting: "Game" }), "Hitting · Front · Game");
  assert.equal(L.suggestedTitle({ category: "Fielding", angle: "Side" }), "Fielding · Side");
  assert.equal(L.suggestedTitle({ category: "Workouts/Training" }), "Workouts/Training");
  assert.equal(L.suggestedTitle({ category: "Game Highlights", setting: "Game" }), "Game Highlights");
});

test("tag steps match the category", () => {
  assert.deepEqual(Object.keys(L.tagsFor("Pitching")), ["pitch", "angle", "setting"]);
  assert.deepEqual(L.tagsFor("Pitching").pitch, ["Fastball", "Sinker", "Slider", "Curveball", "Changeup", "Cutter"]);
  assert.equal(L.hasTags("Hitting"), true);
  assert.equal(L.hasTags("Workouts/Training"), false);
  assert.equal(L.hasTags("Game Highlights"), false);
  assert.deepEqual(L.stepsFor("Pitching"), ["video", "category", "tags", "details", "preview"]);
  assert.deepEqual(L.stepsFor("Workouts/Training"), ["video", "category", "details", "preview"]);
});

test("dates use the calendar day, not UTC shifting", () => {
  assert.equal(L.formatISODate("2026-10-12"), "October 12, 2026");
  assert.equal(L.formatISODate("2026-04-12"), "April 12, 2026");
  assert.equal(L.todayISO(new Date(2026, 9, 12, 23, 30)), "2026-10-12");
});

test("a pitching post keeps the site's video shape and drops unused tags", () => {
  const entry = L.buildEntry({
    title: "Fastball · Open side · Bullpen",
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
  assert.equal(saved.message, "Post video: Fastball · Open side · Bullpen");
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
