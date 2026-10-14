const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
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

test("a clip can sit in more than one category", () => {
  assert.deepEqual(L.tagsForCategories(["Training/Workouts", "Pitching"]), [
    "Sinker", "Curveball", "Slider", "Cutter", "Changeup", "K", "Pickoff", "Game", "Bullpen", "Weights", "Speed/Agility"
  ]);
  const entry = L.buildEntry({
    title: "Bullpen mix",
    type: "mp4",
    url: "/media/videos/bullpen.mp4",
    categories: ["Training/Workouts", "Pitching"],
    tags: ["Weights", "Sinker", "Bullpen", "Game"],
    velo: "74 mph",
    date: "October 13, 2026",
    caption: "Both tabs"
  });
  assert.equal(entry.category, "Pitching");
  assert.deepEqual(entry.categories, ["Pitching", "Training/Workouts"]);
  assert.deepEqual(entry.tags, ["Sinker", "Game", "Bullpen", "Weights"]);
  assert.equal(entry.velo, "74 mph");
  assert.equal(L.inCategory(entry, "Pitching"), true);
  assert.equal(L.inCategory(entry, "Training/Workouts"), true);
  assert.equal(L.inCategory(entry, "Hitting"), false);
  assert.equal(L.matchesAllTags(entry, ["Sinker", "Weights"]), true);
  assert.equal(L.matchesAllTags(entry, ["Sinker", "Single"]), false);
  const legacy = { title: "Old", type: "mp4", url: "/media/videos/old.mp4", category: "Hitting", tags: ["Single"], date: "October 12, 2026" };
  assert.deepEqual(L.videoCategories(legacy), ["Hitting"]);
  assert.equal(L.inCategory(legacy, "Hitting"), true);
  assert.equal(L.validateEntry(legacy), "");
  assert.equal(L.validateEntry({ title: "T", type: "youtube", url: "https://youtu.be/abcdefghijk", categories: [] }), "Pick a category.");
  const listed = [entry, legacy];
  assert.deepEqual(L.sortByDate(listed.filter(video => L.inCategory(video, "Pitching"))).map(video => video.title), ["Bullpen mix"]);
  assert.deepEqual(listed.filter(video => L.inCategory(video, "Training/Workouts")).map(video => video.title), ["Bullpen mix"]);
  assert.equal(L.suggestedTitle({ categories: ["Hitting", "Pitching"], tags: ["Single", "Sinker"] }), "Sinker · Single");
  require("../admin/advanced/admin.js");
  const raw = fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8");
  const editor = global.ColinAdmin.videosFromFile(raw);
  assert.deepEqual(editor.videos[0].categories, ["Pitching", "Training/Workouts"]);
  assert.equal(editor.videos[0].category, undefined);
  const back = JSON.parse(global.ColinAdmin.videosToFile({ videos: editor.videos }));
  assert.equal(back.videos.length, editor.videos.length);
  assert.equal(back.videos[0].title, "Bullpen vs varsity batters");
  assert.equal(back.videos[0].category, "Pitching");
  assert.deepEqual(back.videos[0].categories, ["Pitching", "Training/Workouts"]);
  assert.deepEqual(back.videos[4].categories, ["Hitting"]);
  const fromCategory = global.ColinAdmin.videosFromFile(JSON.stringify({
    videos: [{ title: "Old", url: "https://youtu.be/abcdefghijk", category: "Fielding", tags: ["Catch"] }]
  }));
  assert.deepEqual(fromCategory.videos[0].categories, ["Fielding"]);
  const savedLegacy = JSON.parse(global.ColinAdmin.videosToFile(fromCategory));
  assert.equal(savedLegacy.videos[0].category, "Fielding");
  assert.deepEqual(savedLegacy.videos[0].categories, ["Fielding"]);
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
  assert.deepEqual(Object.keys(entry), ["title", "type", "url", "tags", "velo", "thumbnail", "date", "caption", "category", "categories"]);
  assert.deepEqual(entry.categories, ["Pitching"]);
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
    url: "https://www.youtube.com/watch?v=abcdefghijk",
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
  assert.equal(L.youtubeId(saved.data.videos[0].url), "abcdefghijk");
});

test("delete removes a repo video and leaves YouTube files alone", () => {
  const data = {
    categories: L.CATEGORIES.slice(),
    videos: [
      { title: "Phone clip", type: "mp4", url: "/media/videos/phone-clip.mp4", date: "October 12, 2026", caption: "Hi", category: "Hitting" },
      { title: "Link", type: "youtube", url: "https://youtu.be/abcdefghijk", date: "October 12, 2026", caption: "", category: "Hitting" }
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
  assert.equal(L.MAX_VIDEO_BYTES, 35 * 1024 * 1024);
  assert.equal(L.tooBig(L.MAX_VIDEO_BYTES), false);
  assert.equal(L.tooBig(L.MAX_VIDEO_BYTES + 1), true);
  assert.equal(L.tooBig(50 * 1024 * 1024), true);
  const big = Math.round(44.7 * 1024 * 1024);
  assert.equal(L.oversizeMessage(big), "This clip is 44.7 MB. Trim it under 35 MB in Photos, or use a YouTube link.");
  assert.equal(L.oversizeMessage(35 * 1024 * 1024), "This clip is 35 MB. Trim it under 35 MB in Photos, or use a YouTube link.");
  const uploader = fs.readFileSync(path.join(__dirname, "../admin/app.js"), "utf8");
  const styles = fs.readFileSync(path.join(__dirname, "../admin/app.css"), "utf8");
  assert.match(uploader, /state\.error = L\.oversizeMessage\(file\.size\)/);
  assert.match(uploader, /Videos over 35 MB need a YouTube link/);
  const thumb = uploader.slice(uploader.indexOf("function thumbHtml"), uploader.indexOf("function videoStep"));
  assert.doesNotMatch(thumb, /<video/);
  assert.match(thumb, /class="film"/);
  assert.match(styles, /\.thumb \{[^}]*overflow:\s*hidden/);
  assert.match(styles, /\.thumb video, \.thumb img, \.film \{[^}]*pointer-events:\s*none/s);
  assert.match(L.friendlyError({ message: "too-big" }), /35 MB/);
  assert.match(L.friendlyError({ status: 422, message: "input was too large" }), /Trim it under 35 MB/);
  assert.doesNotMatch(L.friendlyError({ status: 422, message: "input was too large" }), /list changed/);
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
  assert.match(src, /L\.inCategory\(v, c\)/);
  assert.match(src, /L\.inCategory\(v, cat\)/);
  assert.match(src, /L\.isPresetTag\(tag\)/);
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
    const apiPath = url.split("?")[0];
    if (apiPath.endsWith("/git/ref/heads/main") && method === "GET") return { object: { sha: "parent" } };
    if (apiPath.endsWith("/git/commits/parent")) return { tree: { sha: "tree0" } };
    if (method === "GET" && apiPath.includes("/git/trees/")) {
      return { tree: [{ path: "media/videos/old.mp4", type: "blob" }, { path: "data/videos.json", type: "blob" }] };
    }
    if (apiPath.endsWith("/git/blobs")) return { sha: "blob-" + calls.length };
    if (apiPath.endsWith("/git/trees")) return { sha: "tree1" };
    if (apiPath.endsWith("/git/commits") && method === "POST") return { sha: "commit1" };
    if (method === "PATCH") return { ref: "refs/heads/main" };
    throw new Error("unexpected " + method + " " + url);
  }, plan, { mediaPath: "media/videos/fastball.mp4", mediaBase64: "AAAA" });

  assert.equal(sha, "commit1");
  assert.match(calls[0].url, /[?&]t=\d+/);
  assert.deepEqual(calls.map(call => call.method + " " + call.url.split("?")[0]), [
    "GET /repos/colinfenn/colinfenn-site/git/ref/heads/main",
    "GET /repos/colinfenn/colinfenn-site/git/commits/parent",
    "POST /repos/colinfenn/colinfenn-site/git/blobs",
    "POST /repos/colinfenn/colinfenn-site/git/blobs",
    "GET /repos/colinfenn/colinfenn-site/git/trees/tree0",
    "POST /repos/colinfenn/colinfenn-site/git/trees",
    "POST /repos/colinfenn/colinfenn-site/git/commits",
    "PATCH /repos/colinfenn/colinfenn-site/git/refs/heads/main"
  ]);
  assert.equal(calls[2].body.content, "AAAA");
  assert.equal(L.base64ToUtf8(calls[3].body.content), plan.json);
  assert.deepEqual(calls[5].body.tree, [
    { path: "media/videos/fastball.mp4", mode: "100644", type: "blob", sha: "blob-3" },
    { path: "data/videos.json", mode: "100644", type: "blob", sha: "blob-4" },
    { path: "media/videos/old.mp4", mode: "100644", type: "blob", sha: null }
  ]);
  assert.deepEqual(calls[6].body.parents, ["parent"]);
  assert.equal(calls[7].body.sha, "commit1");
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
  }, plan, {}), err => err.conflict === true && err.status === 422 && /list changed/.test(L.friendlyError(err)));
});

test("only a rejected branch update is a conflict; other 422s keep GitHub's message", async () => {
  const plan = { json: "{}\n", message: "Post video: Link", removePaths: ["media/videos/missing.mp4"] };
  await assert.rejects(() => L.commitChanges(async (method, url) => {
    if (method === "GET" && url.includes("/git/ref/")) return { object: { sha: "parent" } };
    if (method === "GET" && url.includes("/git/commits/")) return { tree: { sha: "tree0" } };
    if (method === "GET" && url.includes("/git/trees/")) return { tree: [{ path: "data/videos.json", type: "blob" }] };
    const err = new Error("Validation Failed");
    err.status = 422;
    err.errors = [{ resource: "Blob", field: "content", code: "missing_field" }];
    throw err;
  }, plan, {}), err => {
    assert.notEqual(err.conflict, true);
    assert.equal(err.status, 422);
    assert.match(L.friendlyError(err), /Validation Failed/);
    assert.match(L.friendlyError(err), /Blob content missing_field/);
    assert.doesNotMatch(L.friendlyError(err), /list changed/);
    return true;
  });

  const treeErr = Object.assign(new Error("GitRPC::BadObjectState"), { status: 422 });
  assert.match(L.friendlyError(treeErr), /GitRPC::BadObjectState/);
  assert.doesNotMatch(L.friendlyError(treeErr), /list changed/);

  await assert.rejects(() => L.commitChanges(async (method, url) => {
    if (method === "GET" && url.includes("/git/ref/")) return { object: { sha: "parent" } };
    if (method === "GET" && url.includes("/git/commits/")) return { tree: { sha: "tree0" } };
    throw new Error("should not post a blob");
  }, plan, { mediaPath: "media/videos/clip.mp4", mediaBase64: null }), err => err.friendly === "That video didn't come through. Try choosing it again.");
});

test("a GameChanger link commit writes the list only and skips a missing file", async () => {
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8"));
  const entry = L.buildEntry({
    title: "Sinker · Slider · K · Game",
    type: "link",
    url: "https://web.gc.com/teams/san-marin/video/slider-k",
    category: "Pitching",
    tags: ["Sinker", "Slider", "K", "Game"],
    date: "October 13, 2026",
    caption: "Ordinary caption"
  });
  assert.equal(L.validateEntry(entry), "");
  const plan = L.prepareSave(existing, { kind: "add", entry });
  plan.removePaths = ["media/videos/does-not-exist.mp4"];
  const bodies = [];
  await L.commitChanges(async (method, url, body) => {
    const apiPath = url.split("?")[0];
    if (method === "GET" && apiPath.endsWith("/git/ref/heads/main")) return { object: { sha: "parent" } };
    if (method === "GET" && apiPath.includes("/git/commits/")) return { tree: { sha: "tree0" } };
    if (method === "GET" && apiPath.includes("/git/trees/")) {
      return { tree: existing.videos.map(video => ({ path: video.url.replace(/^\//, ""), type: "blob" })).concat([{ path: "data/videos.json", type: "blob" }]) };
    }
    if (method === "POST" && apiPath.endsWith("/git/blobs")) {
      bodies.push(body);
      return { sha: "blob-" + bodies.length };
    }
    if (method === "POST" && apiPath.endsWith("/git/trees")) {
      bodies.push(body);
      assert.equal(body.tree.some(item => item.sha === null), false);
      assert.deepEqual(body.tree.map(item => item.path), ["data/videos.json"]);
      const saved = JSON.parse(L.base64ToUtf8(bodies[0].content));
      assert.equal(saved.videos[0].url, entry.url);
      assert.equal(saved.videos[0].type, "link");
      assert.deepEqual(saved.videos[0].tags, ["Sinker", "Slider", "K", "Game"]);
      existing.videos.forEach(video => {
        assert.equal(saved.videos.filter(item => item.url === video.url).length, 1);
      });
      return { sha: "tree1" };
    }
    if (method === "POST" && apiPath.endsWith("/git/commits")) return { sha: "commit1" };
    if (method === "PATCH") return { ref: "refs/heads/main" };
    throw new Error("unexpected " + method + " " + url);
  }, plan, { thumbnailPath: "media/videos/empty.jpg", thumbnailBase64: null });
});

function gitHubStub(existing, options) {
  const opts = options || {};
  const state = { reads: 0, patches: 0, commits: 0 };
  const request = async (method, url) => {
    if (method === "GET" && url.includes("/contents/data/videos.json")) {
      assert.match(url, /ref=main/);
      assert.match(url, /[?&]t=\d+/);
      const body = opts.bodies ? opts.bodies[state.reads] : existing;
      state.reads += 1;
      return { content: Buffer.from(JSON.stringify(body), "utf8").toString("base64") };
    }
    if (method === "GET" && url.includes("/git/ref/")) {
      assert.match(url, /[?&]t=\d+/);
      return { object: { sha: "parent-" + state.reads } };
    }
    if (method === "GET" && url.includes("/git/commits/")) return { tree: { sha: "tree0" } };
    const apiPath = url.split("?")[0];
    if (apiPath.endsWith("/git/blobs")) return { sha: "blob" };
    if (apiPath.endsWith("/git/trees")) return { sha: "tree1" };
    if (method === "POST" && apiPath.endsWith("/git/commits")) {
      state.commits += 1;
      return { sha: "commit-" + state.commits };
    }
    if (method === "PATCH") {
      state.patches += 1;
      if (opts.patchStatus) {
        const status = opts.patchStatus(state.patches);
        if (status) {
          const err = new Error("Update is not a fast forward");
          err.status = status;
          throw err;
        }
      }
      return { ref: "refs/heads/main" };
    }
    throw new Error("unexpected " + method + " " + url);
  };
  return { request, state };
}

test("GitHub requests do not send Cache-Control or Pragma", () => {
  const uploader = fs.readFileSync(path.join(__dirname, "../admin/app.js"), "utf8");
  const allowed = new Set(["accept", "authorization", "content-type", "if-match", "if-none-match", "x-github-api-version", "x-requested-with"]);
  const names = [];
  for (const match of uploader.matchAll(/setRequestHeader\(\s*["']([^"']+)["']/g)) names.push(match[1]);
  const fetchHeaders = uploader.match(/fetch\("https:\/\/api\.github\.com"[\s\S]*?headers:\s*\{([^}]*)\}/);
  assert.ok(fetchHeaders, "GitHub fetch headers");
  for (const match of fetchHeaders[1].matchAll(/(?:["']([^"']+)["']|([A-Za-z][A-Za-z-]*))\s*:/g)) names.push(match[1] || match[2]);
  assert.ok(names.length > 0);
  names.forEach(name => {
    const lower = name.toLowerCase();
    assert.equal(lower === "cache-control" || lower === "pragma", false, name);
    assert.equal(allowed.has(lower), true, name);
  });
  assert.match(uploader, /cache:\s*"no-store"/);
  assert.doesNotMatch(uploader, /["']Cache-Control["']|["']Pragma["']/);
});

test("a GameChanger link saves onto a fresh list and retries a stale SHA", async () => {
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8"));
  assert.ok(existing.videos.length >= 5);
  const entry = L.buildEntry({
    title: "Slider K GameChanger",
    type: "link",
    url: "https://web.gc.com/teams/san-marin/video/slider-k",
    category: "Pitching",
    tags: ["Slider", "K", "Game"],
    date: "October 13, 2026",
    caption: "GameChanger link"
  });
  assert.equal(L.validateEntry(entry), "");
  assert.match(L.mediaHtml(entry), /href="https:\/\/web\.gc\.com\/teams\/san-marin\/video\/slider-k"/);
  assert.match(L.validateEntry(L.buildEntry({
    title: "Nope",
    type: "link",
    url: "not-a-url",
    category: "Pitching",
    date: "October 13, 2026"
  })), /link/i);
  const uploader = fs.readFileSync(path.join(__dirname, "../admin/app.js"), "utf8");
  assert.match(uploader, /cache:\s*"no-store"/);
  assert.match(uploader, /saveFresh/);

  const stub = gitHubStub(existing, {
    patchStatus: attempt => (attempt === 1 ? 422 : 0)
  });
  const plan = await L.saveFresh(stub.request, { kind: "add", entry }, {});
  assert.equal(stub.state.reads, 2);
  assert.equal(stub.state.patches, 2);
  assert.equal(plan.alreadySaved, undefined);
  assert.equal(plan.data.videos[0].url, entry.url);
  assert.equal(plan.data.videos[0].type, "link");
  assert.deepEqual(plan.data.videos[0].tags, ["Slider", "K", "Game"]);
  assert.equal(plan.data.videos.filter(video => video.url === entry.url).length, 1);
  existing.videos.forEach(video => {
    assert.equal(plan.data.videos.filter(saved => saved.url === video.url).length, 1);
  });
  assert.equal(JSON.parse(plan.json).videos.length, existing.videos.length + 1);
});

test("a conflict retry does not post the clip twice when the first attempt landed", async () => {
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8"));
  const entry = L.buildEntry({
    title: "Slider K GameChanger",
    type: "link",
    url: "https://web.gc.com/teams/san-marin/video/slider-k",
    category: "Pitching",
    tags: ["Slider", "K", "Game"],
    date: "October 13, 2026",
    caption: ""
  });
  const landed = {
    categories: existing.categories,
    videos: [entry].concat(existing.videos)
  };
  const stub = gitHubStub(existing, {
    bodies: [existing, landed],
    patchStatus: () => 422
  });
  const plan = await L.saveFresh(stub.request, { kind: "add", entry }, {});
  assert.equal(stub.state.reads, 2);
  assert.equal(stub.state.patches, 1);
  assert.equal(stub.state.commits, 1);
  assert.equal(plan.alreadySaved, true);
  assert.equal(plan.data.videos.filter(video => video.url === entry.url).length, 1);
  assert.equal(plan.data.videos.length, existing.videos.length + 1);
});

test("three stale branch updates give up instead of looping", async () => {
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8"));
  const entry = L.buildEntry({
    title: "Slider K GameChanger",
    type: "link",
    url: "https://web.gc.com/teams/san-marin/video/slider-k",
    category: "Pitching",
    tags: ["Slider", "K", "Game"],
    date: "October 13, 2026",
    caption: ""
  });
  const stub = gitHubStub(existing, { patchStatus: () => 409 });
  await assert.rejects(
    () => L.saveFresh(stub.request, { kind: "add", entry }, {}),
    err => err.conflict === true && err.status === 409
  );
  assert.equal(stub.state.reads, 3);
  assert.equal(stub.state.patches, 3);
});

test("editing tags and caption goes through a fresh save", async () => {
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8"));
  const current = existing.videos[0];
  const entry = L.buildEntry({
    title: current.title,
    type: current.type,
    url: current.url,
    category: current.category,
    categories: current.categories,
    tags: ["Sinker", "K", "Game"],
    date: current.date,
    caption: "Updated caption",
    thumbnail: current.thumbnail
  });
  const stub = gitHubStub(existing, { patchStatus: () => 0 });
  const plan = await L.saveFresh(stub.request, { kind: "update", key: L.videoKey(current), entry }, {});
  assert.equal(stub.state.patches, 1);
  assert.equal(plan.data.videos[0].caption, "Updated caption");
  assert.deepEqual(plan.data.videos[0].tags, ["Sinker", "K", "Game"]);
  assert.equal(plan.data.videos[0].url, current.url);
  assert.deepEqual(plan.data.videos[0].categories, current.categories);
  assert.equal(plan.data.videos[0].category, current.category);
  assert.equal(plan.data.videos.length, existing.videos.length);
  existing.videos.slice(1).forEach(video => {
    assert.equal(plan.data.videos.filter(saved => saved.url === video.url).length, 1);
  });
});

test("reading videos.json decodes GitHub's base64 content", async () => {
  const raw = fs.readFileSync(path.join(__dirname, "../data/videos.json"), "utf8");
  let requested = "";
  const data = await L.readVideos(async (method, url) => {
    requested = url;
    return { content: Buffer.from(raw, "utf8").toString("base64") };
  });
  assert.match(requested, /\/contents\/data\/videos\.json\?ref=main&t=\d+/);
  assert.deepEqual(data.categories, ["Pitching", "Hitting", "Fielding", "Training/Workouts"]);
  assert.deepEqual(data.videos.map(video => ({
    title: video.title,
    url: video.url,
    tags: video.tags,
    thumbnail: video.thumbnail,
    date: video.date,
    caption: video.caption,
    category: video.category,
    categories: video.categories
  })), [
    {
      title: "Bullpen vs varsity batters",
      url: "/media/videos/bullpen-vs-varsity-batters-20261013-220355.mp4",
      tags: ["Sinker", "Curveball", "Slider", "Changeup", "Bullpen"],
      thumbnail: undefined,
      date: "October 13, 2026",
      caption: "Mix of sinker, slider, changeup, and curveball",
      category: "Pitching",
      categories: ["Pitching", "Training/Workouts"]
    },
    {
      title: "K swinging vs Windsor righty",
      url: "/media/videos/k-swinging-vs-windsor-righty-20261013-144648.mov",
      tags: ["Sinker", "Slider", "K", "Game"],
      thumbnail: undefined,
      date: "October 13, 2026",
      caption: "Came inside with slider, then outside with sinker",
      category: "Pitching",
      categories: ["Pitching"]
    },
    {
      title: "Got the 3 hitter swinging",
      url: "/media/videos/got-the-3-hitter-swinging-20261013-124941.mp4",
      tags: ["Sinker", "K", "Game"],
      thumbnail: "/media/videos/got-the-3-hitter-swinging-20261013-124941.jpg",
      date: "October 13, 2026",
      caption: "Struck out the side, Top 1st, Casa Grande @ SM",
      category: "Pitching",
      categories: ["Pitching"]
    },
    {
      title: "K swinging vs Casa Grande @ SM",
      url: "/media/videos/slider-k-game-20261013-124104.mp4",
      tags: ["Slider", "K", "Game"],
      thumbnail: "/media/videos/slider-k-game-20261013-124104.jpg",
      date: "October 13, 2026",
      caption: "Struck out Casa Grande’s lefty leadoff hitter with a slider",
      category: "Pitching",
      categories: ["Pitching"]
    },
    {
      title: "Line drive single",
      url: "/media/videos/single-20261012-214250.mp4",
      tags: ["Single"],
      thumbnail: "/media/videos/single-20261012-214250.jpg",
      date: "October 12, 2026",
      caption: "Single to RF vs 17u pitcher",
      category: "Hitting",
      categories: ["Hitting"]
    },
    {
      title: "Got the K swinging vs lefty hitter",
      url: "/media/videos/curveball-game-20261012-204654.mov",
      tags: ["Curveball", "K", "Game"],
      thumbnail: "/media/videos/curveball-game-20261012-204654.jpg",
      date: "October 12, 2026",
      caption: "Finished him with my slider",
      category: "Pitching",
      categories: ["Pitching"]
    },
    {
      title: "K looking vs 17u hitter",
      url: "/media/videos/pitching-20261012-195823.mp4",
      tags: ["Slider", "K", "Game"],
      thumbnail: "/media/videos/pitching-20261012-195823.jpg",
      date: "October 12, 2026",
      caption: "Caught him looking with a slider on the outside corner",
      category: "Pitching",
      categories: ["Pitching"]
    }
  ]);
  assert.equal(data.videos.some(video => /placeholder/i.test(video.title)), false);
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
    const entry = L.buildEntry({ title: "T", type: "youtube", url: "https://youtu.be/abcdefghijk", category, tags: [" vs. lefty ", "VS. LEFTY"], date: "October 12, 2026" });
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
    const apiPath = url.split("?")[0];
    if (apiPath.endsWith("/git/ref/heads/main") && method === "GET") return { object: { sha: "parent" } };
    if (apiPath.endsWith("/git/commits/parent")) return { tree: { sha: "tree0" } };
    if (apiPath.endsWith("/git/blobs")) return { sha: "blob-" + calls.length };
    if (apiPath.endsWith("/git/trees")) return { sha: "tree1" };
    if (apiPath.endsWith("/git/commits") && method === "POST") return { sha: "commit1" };
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
  assert.deepEqual(stats.tables.map(table => table.title), ["Pitching", "Hitting"]);
  const pitching = stats.tables[0];
  const hitting = stats.tables[1];
  assert.equal(hitting.rows[0].obp, ".491");
  const hittingKeys = hitting.columns.map(column => column.key);
  assert.equal(hittingKeys[hittingKeys.indexOf("ops") + 1], "cpct");
  assert.equal(hitting.columns.find(column => column.key === "cpct").label, "C%");
  assert.equal(hitting.rows[0].cpct, "89.80%");
  assert.deepEqual(pitching.columns.map(column => column.key), ["season", "team", "ip", "so", "era", "bbIp", "spct"]);
  assert.equal(pitching.rows[0].era, "5.29");
  assert.equal(pitching.rows[0].so, "42");
  assert.equal(pitching.rows[0].spct, "55.64%");
  assert.equal(pitching.columns.some(column => column.key === "cpct"), false);
  assert.equal(pitching.rows[0].cpct, undefined);
  const yml = fs.readFileSync(path.join(__dirname, "../admin/advanced/config.yml"), "utf8");
  assert.match(yml, /name: categories/);
  assert.match(yml, /multiple: true/);
  assert.match(yml, /min: 1/);
  assert.doesNotMatch(yml, /name: category\n/);
  assert.match(yml, /data\/pitches\.json/);
  assert.match(yml, /do not overwrite older ones/);
  assert.doesNotMatch(yml, /Game Highlights/);
  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(html, /href="#videos">Videos<\/a><a href="#stats">Stats<\/a><a href="#velo">Velo<\/a><a href="#honors">Honors<\/a><a href="#about">About Me<\/a><a href="#contact">Contact<\/a>/);
  assert.match(html, /href="#about"/);
  assert.match(html, /About Me video coming soon/);
  assert.match(html, /Colin Fenn – LHP\/OF – Class of 2029/);
  assert.match(html, /id="teams-line">San Marin HS, NorCal Black 2029/);
  assert.match(fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8"), /join\(" – "\)/);
  assert.ok(html.indexOf('id="velo"') > 0 && html.indexOf('id="velo"') < html.indexOf('id="honors"'));
  assert.match(html, /id="velo" class="sec alt"/);
  assert.match(html, /id="honors" class="sec"/);
  assert.doesNotMatch(html, /id="honors" class="sec alt"|id="pitching"|gold banner/);
  assert.doesNotMatch(html, /id="academics"|id="schedule"|id="showcases"|id="references"|id="note"|FB Velo/);
  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/profile.json"), "utf8"));
  assert.equal(profile.honors[0].title, "Team MVP");
  assert.equal(profile.honors[0].level, "Freshman");
  assert.equal(profile.honors[0].season, "2026");
  assert.match(profile.honors[0].org, /San Marin/);
  assert.match(yml, /name: honors[\s\S]*name: level/);
  assert.doesNotMatch(yml, /gold banner/);
  const uploader = fs.readFileSync(path.join(__dirname, "../admin/app.js"), "utf8");
  assert.match(uploader, /captureFrame/);
  assert.match(uploader, /canvas/);
  assert.match(uploader, /Videos coming soon/);
  assert.match(uploader, /You can pick more than one/);
});

test("admin pages bust caches and stay parseable on iOS 15 Safari", () => {
  const version = "v=3";
  const admin = fs.readFileSync(path.join(__dirname, "../admin/index.html"), "utf8");
  assert.match(admin, new RegExp("/admin/app\\.css\\?" + version));
  assert.match(admin, new RegExp("/admin/logic\\.js\\?" + version));
  assert.match(admin, new RegExp("/admin/app\\.js\\?" + version));
  assert.match(admin, /getRegistrations/);
  assert.match(admin, /unregister/);
  const home = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
  assert.match(home, new RegExp("admin/logic\\.js\\?" + version));
  assert.match(home, new RegExp("js/app\\.js\\?" + version));
  const advanced = fs.readFileSync(path.join(__dirname, "../admin/advanced/index.html"), "utf8");
  assert.match(advanced, new RegExp("/admin/advanced/admin\\.css\\?" + version));
  assert.match(advanced, new RegExp("/admin/advanced/admin\\.js\\?" + version));

  const toml = fs.readFileSync(path.join(__dirname, "../netlify.toml"), "utf8");
  assert.match(toml, /for = "\/admin\/\*"[\s\S]*?Cache-Control = "no-cache"/);
  assert.equal(fs.existsSync(path.join(__dirname, "../sw.js")), false);
  assert.equal(fs.existsSync(path.join(__dirname, "../service-worker.js")), false);
  const pages = [admin, home, advanced, fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8")];
  pages.forEach(src => assert.doesNotMatch(src, /serviceWorker\.register/));

  const inline = admin.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(inline, "admin page includes the service-worker cleanup");
  const scripts = ["admin/app.js", "admin/logic.js", "admin/advanced/admin.js"];
  [inline[1]].concat(scripts.map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8"))).forEach((src, index) => {
    const filename = index === 0 ? "admin/index.html" : scripts[index - 1];
    new vm.Script(src, { filename: filename });
    assert.doesNotMatch(src, /\?\?=|\|\|=|&&=|\?\.=/);
    assert.doesNotMatch(src, /\.at\s*\(/);
    assert.doesNotMatch(src, /structuredClone/);
    assert.doesNotMatch(src, /\(\?<[=!]/);
    assert.doesNotMatch(src, /serviceWorker\.register/);
  });
});
