(function () {
  const L = window.ColinUpload;
  const TOKEN_KEY = "colinfenn.githubToken";
  const practice = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  const app = document.getElementById("app");

  const state = {
    screen: "loading",
    step: "video",
    token: "",
    login: "",
    videos: null,
    profile: null,
    error: "",
    notice: "",
    busy: false,
    progress: 0,
    progressLabel: "",
    draft: null,
    editingKey: "",
    deleteKey: "",
    localMedia: new Map(),
    xhr: null,
    reader: null,
    cancelRequested: false,
    beforeDelete: "home"
  };

  let lastFocus = "";
  let lastError = "";

  function $(sel) {
    return app.querySelector(sel);
  }

  function request(method, url, body, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, "https://api.github.com" + url);
      xhr.setRequestHeader("Accept", "application/vnd.github+json");
      xhr.setRequestHeader("Authorization", "Bearer " + state.token);
      xhr.setRequestHeader("X-GitHub-Api-Version", "2022-11-28");
      if (body) xhr.setRequestHeader("Content-Type", "application/json");
      if (onProgress) {
        xhr.upload.onprogress = ev => {
          if (ev.lengthComputable) onProgress(ev.loaded / ev.total);
        };
      }
      xhr.onload = () => {
        let json = null;
        try {
          json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch (err) {
          json = { message: xhr.responseText };
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(json);
        else {
          const error = new Error((json && (json.message || json.error)) || "Save failed");
          error.status = xhr.status;
          reject(error);
        }
      };
      xhr.onerror = () => {
        const error = new Error("network");
        error.status = 0;
        reject(error);
      };
      xhr.onabort = () => {
        const error = new Error("aborted");
        error.message = "aborted";
        error.status = -1;
        reject(error);
      };
      state.xhr = xhr;
      xhr.send(body ? JSON.stringify(body) : null);
    });
  }

  function fileToBase64(file, onProgress) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onprogress = ev => {
        if (onProgress && ev.lengthComputable) onProgress(ev.loaded / ev.total);
      };
      reader.onload = () => {
        const text = String(reader.result || "");
        const comma = text.indexOf(",");
        resolve(comma >= 0 ? text.slice(comma + 1) : text);
      };
      reader.onerror = () => reject(reader.error || new Error("read"));
      reader.onabort = () => reject(Object.assign(new Error("aborted"), { message: "aborted" }));
      state.reader = reader;
      reader.readAsDataURL(file);
    });
  }

  function newDraft() {
    return {
      file: null,
      fileUrl: "",
      youtube: "",
      category: "",
      pitch: "",
      result: "",
      pitchFaced: "",
      battedBall: "",
      play: "",
      position: "",
      workout: "",
      angle: "",
      tags: [],
      tagText: "",
      setting: "",
      velo: "",
      opponent: "",
      featured: false,
      caption: "",
      dateISO: L.todayISO(new Date()),
      dateLabel: "",
      title: "",
      titleDirty: false,
      type: "",
      url: ""
    };
  }

  function clearDraft(keepUrl) {
    if (state.draft && state.draft.fileUrl && !keepUrl) URL.revokeObjectURL(state.draft.fileUrl);
    state.draft = null;
  }

  function syncTitle() {
    if (state.draft && !state.draft.titleDirty) state.draft.title = L.suggestedTitle(state.draft);
  }

  function videoType(video) {
    if (video.type === "youtube" || video.type === "mp4" || video.type === "placeholder") return video.type;
    return L.youtubeId(video.url) ? "youtube" : "mp4";
  }

  function splitVideos() {
    const videos = (state.videos && state.videos.videos) || [];
    return {
      real: videos.filter(L.isReal),
      blanks: videos.filter(video => !L.isReal(video))
    };
  }

  function findVideo(key) {
    return ((state.videos && state.videos.videos) || []).find(video => L.videoKey(video) === key);
  }

  function setError(message) {
    state.error = message || "";
    render();
  }

  function renderProgress() {
    const bar = $("[data-progress]");
    const label = $("[data-progress-label]");
    if (bar) {
      bar.style.width = state.progress + "%";
      const meter = bar.parentElement;
      if (meter) meter.setAttribute("aria-valuenow", String(state.progress));
    }
    if (label) label.textContent = state.progressLabel;
  }

  function loginWithGitHub() {
    const host = location.host.split(":")[0];
    const url = "https://api.netlify.com/auth?provider=github&site_id=" + encodeURIComponent(host) + "&scope=repo";
    const width = 960;
    const height = 600;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    const popup = window.open(url, "Netlify Authorization", "width=" + width + ",height=" + height + ",left=" + left + ",top=" + top);
    if (!popup) return Promise.reject(Object.assign(new Error("popup"), { message: "popup" }));
    return new Promise((resolve, reject) => {
      function cleanup() {
        window.removeEventListener("message", onMessage);
        clearInterval(timer);
      }
      function onMessage(event) {
        if (event.origin !== "https://api.netlify.com") return;
        const data = event.data;
        if (data === "authorizing:github") {
          popup.postMessage(data, event.origin);
          return;
        }
        if (typeof data !== "string") return;
        if (data.indexOf("authorization:github:success:") === 0) {
          cleanup();
          popup.close();
          try {
            const payload = JSON.parse(data.slice("authorization:github:success:".length));
            if (!payload.token) throw new Error("missing token");
            resolve(payload.token);
          } catch (err) {
            reject(Object.assign(new Error("denied"), { message: "denied" }));
          }
        } else if (data.indexOf("authorization:github:error:") === 0) {
          cleanup();
          popup.close();
          reject(Object.assign(new Error("denied"), { message: "denied" }));
        }
      }
      window.addEventListener("message", onMessage);
      const timer = setInterval(() => {
        if (popup.closed) {
          cleanup();
          reject(Object.assign(new Error("closed"), { message: "closed" }));
        }
      }, 400);
    });
  }

  async function loadHome() {
    state.screen = "loading";
    state.error = "";
    render();
    try {
      if (practice) {
        if (!state.videos) {
          const response = await fetch("/data/videos.json", { cache: "no-cache" });
          if (!response.ok) throw Object.assign(new Error("network"), { status: 0 });
          state.videos = await response.json();
        }
        if (!state.profile) {
          const response = await fetch("/data/profile.json", { cache: "no-cache" });
          if (response.ok) state.profile = await response.json();
        }
        state.login = "Colin";
      } else {
        const user = await request("GET", "/user");
        state.login = user.name || user.login || "there";
        state.videos = await L.readVideos(request);
        try {
          const file = await request("GET", "/repos/" + L.REPO + "/contents/data/profile.json?ref=" + L.BRANCH);
          state.profile = JSON.parse(L.base64ToUtf8(file.content));
        } catch (err) {
          if (err.status === 401) throw err;
          state.profile = null;
        }
      }
      state.screen = "home";
    } catch (err) {
      if (err.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        state.token = "";
        state.screen = "login";
        state.error = L.friendlyError(err);
      } else {
        state.screen = state.token ? "home" : "login";
        state.error = L.friendlyError(err);
      }
    }
    render();
  }

  async function onLogin() {
    state.error = "";
    state.busy = true;
    render();
    try {
      if (practice) {
        state.token = "practice";
      } else {
        const token = await loginWithGitHub();
        state.token = token;
        localStorage.setItem(TOKEN_KEY, token);
      }
      state.busy = false;
      await loadHome();
    } catch (err) {
      state.busy = false;
      state.screen = "login";
      state.error = L.friendlyError(err);
      render();
    }
  }

  function logout() {
    if (state.xhr) state.xhr.abort();
    state.token = "";
    state.login = "";
    state.videos = null;
    state.profile = null;
    state.notice = "";
    state.error = "";
    localStorage.removeItem(TOKEN_KEY);
    clearDraft(false);
    state.screen = "login";
    render();
  }

  function videoProblem() {
    const draft = state.draft;
    if (draft.file) return "";
    if (!draft.youtube.trim()) return "Choose a video or paste a YouTube link.";
    if (!L.youtubeId(draft.youtube)) return "That doesn't look like a YouTube link. Open the video and copy the address.";
    return "";
  }

  function goNext() {
    if (state.step === "video") {
      const problem = videoProblem();
      if (problem) return setError(problem);
    }
    if (state.step === "category" && !state.draft.category) return setError("Pick a category.");
    if (state.step === "details") {
      syncTitle();
      if (!String(state.draft.title || "").trim()) return setError("Add a title.");
      if (!L.formatISODate(state.draft.dateISO)) state.draft.dateISO = L.todayISO(new Date());
    }
    syncTitle();
    const steps = L.stepsFor(state.draft.category);
    const index = Math.max(0, steps.indexOf(state.step));
    state.step = steps[Math.min(index + 1, steps.length - 1)];
    state.error = "";
    render();
  }

  function goBack() {
    if (state.screen === "delete") {
      state.screen = state.beforeDelete === "edit" ? "edit" : "home";
      state.error = "";
      if (state.screen === "home") clearDraft(false);
      render();
      return;
    }
    if (state.screen === "edit" || state.screen === "success") {
      state.screen = "home";
      state.error = "";
      clearDraft(false);
      render();
      return;
    }
    const steps = L.stepsFor(state.draft.category);
    const index = steps.indexOf(state.step);
    state.error = "";
    if (index <= 0) {
      state.screen = "home";
      clearDraft(false);
    } else {
      state.step = steps[index - 1];
    }
    render();
  }

  function takeFile(file) {
    if (!file) return;
    if (state.draft.fileUrl) URL.revokeObjectURL(state.draft.fileUrl);
    if (L.tooBig(file.size)) {
      state.draft.file = null;
      state.draft.fileUrl = "";
      state.error = L.friendlyError({ message: "too-big" });
      render();
      const box = $("#youtube");
      if (box) box.focus();
      return;
    }
    state.draft.file = file;
    state.draft.fileUrl = URL.createObjectURL(file);
    state.error = "";
    render();
  }

  function entryForSave() {
    const draft = state.draft;
    if (state.screen === "edit") {
      return L.buildEntry({
        title: draft.title,
        type: draft.type,
        url: draft.url,
        category: draft.category,
        pitch: draft.pitch,
        result: draft.result,
        pitchFaced: draft.pitchFaced,
        battedBall: draft.battedBall,
        play: draft.play,
        position: draft.position,
        workout: draft.workout,
        angle: draft.angle,
        tags: draft.tags,
        setting: draft.setting,
        velo: draft.velo,
        opponent: draft.opponent,
        featured: draft.featured,
        date: draft.dateLabel,
        caption: draft.caption
      });
    }
    const useFile = !!draft.file;
    return L.buildEntry({
      title: draft.title,
      type: useFile ? "mp4" : "youtube",
      url: useFile ? draft.url : draft.youtube.trim(),
      category: draft.category,
      pitch: draft.pitch,
      result: draft.result,
      pitchFaced: draft.pitchFaced,
      battedBall: draft.battedBall,
      play: draft.play,
      position: draft.position,
      workout: draft.workout,
      angle: draft.angle,
      tags: draft.tags,
      setting: draft.setting,
      velo: draft.velo,
      opponent: draft.opponent,
      featured: draft.featured,
      date: L.formatISODate(draft.dateISO),
      caption: draft.caption
    });
  }

  async function persist(action, file) {
    if (state.busy) return;
    state.busy = true;
    state.cancelRequested = false;
    state.error = "";
    state.progress = file ? 3 : 15;
    state.progressLabel = file ? "Getting your video ready…" : "Saving…";
    render();
    let mediaPath = "";
    let mediaBase64 = "";
    let keepUrl = false;
    try {
      if (file) {
        mediaPath = L.mediaRepoPath(action.entry.title, file.name, file.type, new Date());
        action.entry.url = L.publicUrl(mediaPath);
        const problem = L.validateEntry(action.entry);
        if (problem) throw Object.assign(new Error(problem), { friendly: problem });
        if (practice) {
          state.localMedia.set(action.entry.url, state.draft.fileUrl);
          keepUrl = true;
          state.progress = 100;
          renderProgress();
        } else {
          mediaBase64 = await fileToBase64(file, portion => {
            state.progress = Math.max(3, Math.round(portion * 35));
            state.progressLabel = "Getting your video ready…";
            renderProgress();
          });
        }
      }
      if (state.cancelRequested) throw Object.assign(new Error("aborted"), { message: "aborted" });
      const once = async () => {
        if (state.cancelRequested) throw Object.assign(new Error("aborted"), { message: "aborted" });
        const data = practice ? state.videos : await L.readVideos(request);
        const plan = L.prepareSave(data, action);
        if (!plan.ok) throw Object.assign(new Error(plan.error), { friendly: plan.error });
        const reel = state.profile && L.featuredReel(state.profile, plan.data, plan.removedUrl);
        if (reel) plan.profileJson = L.profileWithReel(state.profile, reel);
        plan.reel = reel;
        if (!practice) {
          state.progressLabel = file ? "Sending it… don't close this page." : "Saving…";
          renderProgress();
          await L.commitChanges(request, plan, {
            mediaPath: mediaPath,
            mediaBase64: mediaBase64,
            onProgress: portion => {
              state.progress = 35 + Math.round(portion * 60);
              renderProgress();
            }
          });
        }
        state.progress = 100;
        state.progressLabel = "Finishing…";
        renderProgress();
        return plan;
      };
      let plan;
      try {
        plan = await once();
      } catch (err) {
        if (err.conflict && !practice) plan = await once();
        else throw err;
      }
      state.videos = plan.data;
      if (plan.reel && state.profile) state.profile.highlightReel = plan.reel;
      state.busy = false;
      state.progress = 0;
      state.xhr = null;
      if (action.kind === "add") {
        state.screen = "success";
        state.notice = action.entry.title;
        clearDraft(keepUrl);
      } else if (action.kind === "delete") {
        state.screen = "home";
        state.deleteKey = "";
        clearDraft(false);
        state.notice = "Deleted. It will leave your site in a minute or two.";
      } else {
        state.screen = "home";
        clearDraft(false);
        state.notice = "Saved. Your site will update in a minute or two.";
      }
      if (practice && action.kind !== "add") state.notice = "Practice mode. That change stayed on this computer.";
      if (practice && action.kind === "add") state.notice = action.entry.title;
      render();
    } catch (err) {
      state.busy = false;
      state.progress = 0;
      state.xhr = null;
      if (err.status === 401 && !practice) {
        localStorage.removeItem(TOKEN_KEY);
        state.token = "";
        state.screen = "login";
      }
      state.error = err.friendly || L.friendlyError(err);
      render();
    }
  }

  function post() {
    syncTitle();
    const problem = videoProblem();
    if (problem) return setError(problem);
    if (!state.draft.category) return setError("Pick a category.");
    if (!String(state.draft.title || "").trim()) return setError("Add a title.");
    const entry = entryForSave();
    if (state.draft.file) entry.url = "/media/videos/pending.mp4";
    const invalid = L.validateEntry(entry);
    if (invalid) return setError(invalid);
    if (state.draft.file) entry.url = "";
    persist({ kind: "add", entry: entry }, state.draft.file);
  }

  function saveEdit() {
    syncTitle();
    const entry = entryForSave();
    const invalid = L.validateEntry(entry);
    if (invalid) return setError(invalid);
    persist({ kind: "update", key: state.editingKey, entry: entry }, null);
  }

  function confirmDelete() {
    const video = findVideo(state.deleteKey);
    if (!video) return setError("That video isn't in the list anymore. Go back and check My Videos.");
    persist({ kind: "delete", key: state.deleteKey }, null);
  }

  function startEdit(key) {
    const video = findVideo(key);
    if (!video) return setError("That video isn't in the list anymore.");
    state.editingKey = key;
    state.screen = "edit";
    state.error = "";
    state.draft = {
      file: null,
      fileUrl: "",
      youtube: "",
      category: video.category || "",
      pitch: video.pitch || "",
      result: video.result || "",
      pitchFaced: video.pitchFaced || "",
      battedBall: video.battedBall || "",
      play: video.play || "",
      position: video.position || "",
      workout: video.workout || "",
      angle: video.angle || "",
      tags: L.normalizeTags(video.tags),
      tagText: "",
      setting: video.setting || "",
      velo: video.velo || "",
      opponent: video.opponent || "",
      featured: !!video.featured,
      caption: video.caption || "",
      dateISO: "",
      dateLabel: video.date || "",
      title: video.title || "",
      titleDirty: true,
      type: videoType(video),
      url: video.url
    };
    render();
  }

  function clipHtml() {
    const draft = state.draft;
    if (!draft) return "";
    if (draft.fileUrl) {
      return '<div class="clip"><video controls playsinline src="' + L.esc(draft.fileUrl) + '"></video><p class="fine">' + L.esc(L.formatBytes(draft.file.size)) + " · this can go on the site</p></div>";
    }
    const id = L.youtubeId(draft.youtube);
    if (id) return '<div class="clip"><img alt="" src="https://i.ytimg.com/vi/' + L.esc(id) + '/hqdefault.jpg"><p class="fine">YouTube link</p></div>';
    if (draft.url) {
      const src = state.localMedia.get(draft.url) || draft.url;
      if (draft.type === "youtube" && L.youtubeId(draft.url)) {
        const thumb = L.youtubeId(draft.url);
        return '<div class="clip"><img alt="" src="https://i.ytimg.com/vi/' + L.esc(thumb) + '/hqdefault.jpg"></div>';
      }
      return '<div class="clip"><video controls playsinline preload="metadata" src="' + L.esc(src) + '"></video></div>';
    }
    return "";
  }

  function chips(group, label, options, selected) {
    const buttons = options.map(value => {
      const on = value === selected;
      return '<button type="button" class="chip" data-action="pick" data-group="' + group + '" data-value="' + L.esc(value) + '" aria-pressed="' + (on ? "true" : "false") + '">' + L.esc(value) + "</button>";
    }).join("");
    const wide = group === "category" ? " chips-wide" : "";
    return '<fieldset><legend>' + label + '</legend><div class="chips' + wide + '">' + buttons + "</div></fieldset>";
  }

  function customTagHtml() {
    const tags = state.draft.tags || [];
    const chosen = tags.map((tag, i) => '<button type="button" class="chip chip-custom" data-action="remove-tag" data-index="' + i + '" aria-pressed="true" aria-label="Remove tag ' + L.esc(tag) + '">' + L.esc(tag) + ' <span aria-hidden="true">×</span></button>').join("");
    return '<fieldset class="custom-tags"><legend>Add your own tag <span class="optional">optional</span></legend>' +
      (chosen ? '<div class="chips">' + chosen + "</div>" : "") +
      '<div class="tag-add"><input id="tag-text" type="text" maxlength="' + L.MAX_CUSTOM_TAG + '" autocomplete="off" enterkeyhint="done" placeholder="Walk-off, vs. lefty, 1st inning…" aria-label="Your own tag" value="' + L.esc(state.draft.tagText || "") + '"><button type="button" class="btn btn-secondary btn-small" data-action="add-tag">Add</button></div>' +
      '<p class="fine">Tap a tag to remove it.</p></fieldset>';
  }

  function addTagFromInput() {
    const input = $("#tag-text");
    const text = input ? input.value : state.draft.tagText;
    state.draft.tags = L.addCustomTag(state.draft.tags, text);
    state.draft.tagText = "";
    render();
    const again = $("#tag-text");
    if (again) again.focus();
  }

  function tagFields() {
    const tags = L.tagsFor(state.draft.category);
    return Object.keys(tags).map(key => chips(key, L.TAG_LABELS[key] || key, tags[key], state.draft[key])).join("");
  }

  function extraFields() {
    const draft = state.draft;
    const opponent = L.showOpponent(draft)
      ? '<label class="field" for="opponent">Opponent <span class="optional">optional</span><input id="opponent" type="text" maxlength="80" autocomplete="off" placeholder="Marin Catholic" value="' + L.esc(draft.opponent) + '"></label>'
      : "";
    return '<label class="field" for="velo">Speed <span class="optional">optional</span><input id="velo" type="text" maxlength="40" autocomplete="off" placeholder="75 mph" value="' + L.esc(draft.velo) + '"></label>' +
      opponent +
      '<label class="toggle" for="featured"><input id="featured" type="checkbox"' + (draft.featured ? " checked" : "") + '><span>Feature this</span></label>' +
      '<p class="fine">Puts this clip at the top of your site. Only one clip can be the highlight reel.</p>';
  }

  function alertHtml() {
    if (!state.error) return "";
    return '<p class="alert" role="alert" tabindex="-1">' + L.esc(state.error) + "</p>";
  }

  function practiceHtml() {
    if (!practice || state.screen === "login") return "";
    return '<p class="practice">Practice mode. Nothing is saved to the live site.</p>';
  }

  function busyHtml() {
    if (!state.busy) return "";
    return '<div class="busy"><p data-progress-label>' + L.esc(state.progressLabel || "Working…") + '</p><div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + state.progress + '" aria-label="Saving"><span data-progress style="width:' + state.progress + '%"></span></div><button type="button" class="text-btn light" data-action="cancel">Cancel</button></div>';
  }

  function dock(label, action) {
    return '<div class="dock"><button type="submit" class="btn btn-primary" data-action="' + action + '">' + label + "</button></div>";
  }

  function stepLabel() {
    const steps = L.stepsFor(state.draft && state.draft.category);
    const index = Math.max(0, steps.indexOf(state.step));
    return "Step " + (index + 1) + " of " + steps.length;
  }

  function shell(title, body, dockHtml) {
    document.title = title + " — Colin Fenn";
    const kicker = state.screen === "new" ? '<p class="step-label">' + stepLabel() + "</p>" : "";
    return '<section class="screen" id="main">' + practiceHtml() +
      '<form novalidate>' +
      '<header class="bar"><button type="button" class="icon-btn" data-action="back" aria-label="Back">Back</button><div class="bar-title">' + kicker + '<h1 tabindex="-1">' + L.esc(title) + "</h1></div><span></span></header>" +
      '<div class="content">' + alertHtml() + body + "</div>" +
      (dockHtml || "") +
      "</form>" + busyHtml() + "</section>";
  }

  function loginScreen() {
    document.title = "Post a video — Colin Fenn";
    return '<section class="screen screen-login" id="main"><div class="login-in">' +
      '<p class="eyebrow">Colin Fenn</p><h1 tabindex="-1">Post a video</h1>' +
      "<p>A few taps, like posting a story. It shows up on your recruiting site.</p>" +
      alertHtml() +
      '<button type="button" class="btn btn-light" data-action="login"' + (state.busy ? " disabled" : "") + ">Log in with GitHub</button>" +
      '<p class="fine light">A window will open so GitHub can confirm it\'s you. If nothing opens, allow pop-ups for this site.</p>' +
      '<p class="fine light">To keep this on your phone, add this page to your home screen.</p>' +
      '<p class="fine light"><a href="/admin/advanced/">Edit stats, GPA, or the schedule</a></p>' +
      "</div></section>";
  }

  function homeScreen() {
    document.title = "My videos — Colin Fenn";
    const parts = splitVideos();
    const rows = parts.real.map(rowHtml).join("");
    const blanks = parts.blanks.length ? '<details class="blanks"><summary>Blank cards still on the site (' + parts.blanks.length + ')</summary><p class="fine">These say “Video coming soon.” Delete one after you replace it.</p>' + parts.blanks.map(blankHtml).join("") + "</details>" : "";
    const list = rows || '<div class="empty"><p>No videos yet.</p><p class="fine">Tap Add Video. Pick a clip, tap a few buttons, and post it.</p></div>';
    const notice = state.notice ? '<p class="notice" role="status">' + L.esc(state.notice) + "</p>" : "";
    return '<section class="screen" id="main">' + practiceHtml() +
      '<header class="bar"><div><p class="eyebrow">Colin Fenn</p><h1 tabindex="-1">My videos</h1></div><button type="button" class="text-btn light" data-action="logout">Log out</button></header>' +
      '<div class="content">' + alertHtml() + notice +
      '<p class="hello">Hi, ' + L.esc(state.login || "there") + ". Post a clip and it shows up on your recruiting site.</p>" +
      list + blanks +
      '<p class="fine install">To keep this on your phone, add this page to your home screen. <a href="/admin/advanced/">Stats and GPA</a> are in the full editor.</p>' +
      "</div>" +
      '<div class="dock"><button type="button" class="btn btn-primary" data-action="add">Add Video</button></div></section>';
  }

  function rowHtml(video) {
    const key = L.esc(L.videoKey(video));
    const featured = video.featured ? '<p class="reel-flag">At the top of your site</p>' : "";
    return '<article class="row"><div class="thumb">' + thumbHtml(video) + '</div><div class="row-copy"><h2>' + L.esc(video.title || "Video") + "</h2><p>" + L.esc(video.category || "") + "</p>" + featured + (video.caption ? "<p class=\"cap\">" + L.esc(video.caption) + "</p>" : "") + '</div><div class="row-actions"><button type="button" data-action="edit" data-key="' + key + '">Edit</button><button type="button" class="danger" data-action="ask-delete" data-key="' + key + '">Delete</button></div></article>';
  }

  function blankHtml(video) {
    const key = L.esc(L.videoKey(video));
    return '<article class="row row-blank"><div class="thumb"><span class="film" aria-hidden="true"></span></div><div class="row-copy"><h2>' + L.esc(video.title || "Blank card") + '</h2><p>' + L.esc(video.category || "") + '</p></div><div class="row-actions"><button type="button" class="danger" data-action="ask-delete" data-key="' + key + '">Delete</button></div></article>';
  }

  function thumbHtml(video) {
    const id = L.youtubeId(video.url);
    if (id && video.type !== "mp4") return '<img alt="" src="https://i.ytimg.com/vi/' + L.esc(id) + '/hqdefault.jpg">';
    const src = state.localMedia.get(video.url) || video.url;
    if (src) return '<video muted playsinline preload="metadata" src="' + L.esc(src) + '#t=0.1"></video>';
    return '<span class="film" aria-hidden="true"></span>';
  }

  function videoStep() {
    const draft = state.draft;
    const chosen = draft.file ? '<div class="picked"><p><strong>' + L.esc(draft.file.name || "Video") + "</strong> · " + L.esc(L.formatBytes(draft.file.size)) + '</p><button type="button" class="text-btn" data-action="clear-file">Choose a different video</button></div>' + clipHtml() : "";
    return shell("Add a video",
      '<p class="lead">Choose a clip from your camera roll, record one, or paste a YouTube link.</p>' +
      chosen +
      '<div class="stack">' +
      '<button type="button" class="btn btn-secondary" data-action="browse">Choose from camera roll</button>' +
      '<button type="button" class="btn btn-secondary" data-action="record">Record a video</button>' +
      "</div>" +
      '<input id="roll" class="sr" type="file" accept="video/*" aria-label="Choose a video from the camera roll">' +
      '<input id="cam" class="sr" type="file" accept="video/*" capture="environment" aria-label="Record a video">' +
      '<label class="field" for="youtube">Or paste a YouTube link<input id="youtube" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" placeholder="https://youtu.be/…" value="' + L.esc(draft.youtube) + '"></label>' +
      (draft.file && draft.youtube.trim() ? '<p class="fine">The phone video is the one that will post. Clear it to use the YouTube link.</p>' : "") +
      '<p class="fine">Videos over 50 MB need a YouTube link. Unlisted is fine. Wi-Fi is easier than cell data.</p>',
      dock("Next", "next"));
  }

  function categoryStep() {
    return shell("What kind?",
      clipHtml() + chips("category", "Category", L.CATEGORIES, state.draft.category),
      dock("Next", "next"));
  }

  function tagsStep() {
    const fields = tagFields();
    const lead = fields
      ? '<p class="lead">Tap any that fit. You can skip some.</p>' + fields
      : '<p class="lead">No set tags for a highlight. Add your own below if you want. Speed and an opponent are on the next screen.</p>';
    return shell("Tag it", clipHtml() + lead + customTagHtml(), dock("Next", "next"));
  }

  function detailsStep() {
    const hint = L.CAPTION_HINTS[state.draft.category] || "What happened in the clip.";
    const suggest = state.draft.titleDirty ? '<button type="button" class="text-btn" data-action="suggest">Fill in a title from my picks</button>' : '<p class="fine">Filled in from what you tapped. You can change it.</p>';
    return shell("Details",
      '<label class="field" for="title">Title<input id="title" type="text" maxlength="120" autocomplete="off" value="' + L.esc(state.draft.title) + '"></label>' +
      suggest +
      '<label class="field" for="caption">Caption<textarea id="caption" rows="3" placeholder="' + L.esc(hint) + '">' + L.esc(state.draft.caption) + "</textarea></label>" +
      '<p class="fine">Example: ' + L.esc(hint) + "</p>" +
      '<label class="field" for="date">Date<input id="date" type="date" value="' + L.esc(state.draft.dateISO) + '"></label>' +
      '<p class="fine" id="date-label">' + L.esc(L.formatISODate(state.draft.dateISO) || "Today") + "</p>" +
      extraFields(),
      dock("See preview", "next"));
  }

  function previewStep() {
    return shell("Preview",
      '<p class="lead">This is the card people will see on your site.</p><iframe id="preview" title="How this video will look on your site"></iframe>',
      dock("Post it", "post"));
  }

  function editScreen() {
    const hint = L.CAPTION_HINTS[state.draft.category] || "What happened in the clip.";
    const tags = tagFields();
    return shell("Edit video",
      clipHtml() +
      '<label class="field" for="title">Title<input id="title" type="text" maxlength="120" autocomplete="off" value="' + L.esc(state.draft.title) + '"></label>' +
      '<button type="button" class="text-btn" data-action="suggest">Fill in a title from my picks</button>' +
      chips("category", "Category", L.CATEGORIES, state.draft.category) +
      (tags || '<p class="fine">No set tags for a highlight.</p>') + customTagHtml() +
      '<label class="field" for="caption">Caption<textarea id="caption" rows="3" placeholder="' + L.esc(hint) + '">' + L.esc(state.draft.caption) + "</textarea></label>" +
      '<p class="fine">Example: ' + L.esc(hint) + "</p>" +
      (state.draft.dateLabel ? '<p class="fine">Date: ' + L.esc(state.draft.dateLabel) + "</p>" : "") +
      extraFields() +
      '<button type="button" class="text-btn danger" data-action="ask-delete" data-key="' + L.esc(state.editingKey) + '">Delete this video</button>',
      dock("Save changes", "save"));
  }

  function deleteScreen() {
    const video = findVideo(state.deleteKey);
    const title = video ? video.title : "this video";
    return shell("Delete video",
      '<p class="lead">Delete <strong>' + L.esc(title) + "</strong>?</p><p>This takes it off your site. You can't undo it.</p>" +
      '<div class="stack"><button type="button" class="btn btn-danger" data-action="confirm-delete">Delete</button><button type="button" class="btn btn-secondary" data-action="back">Keep it</button></div>',
      "");
  }

  function successScreen() {
    const where = practice
      ? "Practice post. It stayed on this computer, not the live site."
      : "It'll show on your site in a minute or two.";
    return shell("Posted",
      '<div class="success"><p class="check" aria-hidden="true">✓</p><p class="lead">' + L.esc(state.notice || "Your video") + "</p><p>" + where + "</p></div>" +
      '<div class="stack"><button type="button" class="btn btn-secondary" data-action="add">Add another</button><button type="button" class="btn btn-secondary" data-action="home">My videos</button></div>',
      "");
  }

  function loadingScreen() {
    document.title = "My videos — Colin Fenn";
    return '<section class="screen" id="main"><header class="bar"><h1 tabindex="-1">My videos</h1></header><div class="content"><p class="lead">Loading your videos…</p></div></section>';
  }

  function mountPreview() {
    const frame = $("#preview");
    if (!frame || !state.draft) return;
    const draft = state.draft;
    const useFile = !!draft.fileUrl;
    const entry = L.buildEntry({
      title: draft.title || "Video",
      type: useFile ? "mp4" : "youtube",
      url: useFile ? draft.fileUrl : draft.youtube.trim(),
      category: draft.category,
      pitch: draft.pitch,
      result: draft.result,
      pitchFaced: draft.pitchFaced,
      battedBall: draft.battedBall,
      play: draft.play,
      position: draft.position,
      workout: draft.workout,
      angle: draft.angle,
      tags: draft.tags,
      setting: draft.setting,
      velo: draft.velo,
      opponent: draft.opponent,
      featured: draft.featured,
      date: L.formatISODate(draft.dateISO),
      caption: draft.caption
    });
    entry.mediaHtml = L.mediaHtml(entry);
    frame.srcdoc = L.previewDocument(entry);
    frame.addEventListener("load", () => {
      try {
        frame.style.height = Math.max(320, frame.contentDocument.body.scrollHeight) + "px";
      } catch (err) {
        frame.style.height = "420px";
      }
    });
  }

  function bindFields() {
    const title = $("#title");
    if (title) title.addEventListener("input", () => {
      state.draft.title = title.value;
      state.draft.titleDirty = true;
    });
    const caption = $("#caption");
    if (caption) caption.addEventListener("input", () => {
      state.draft.caption = caption.value;
    });
    const youtube = $("#youtube");
    if (youtube) youtube.addEventListener("input", () => {
      state.draft.youtube = youtube.value;
    });
    const date = $("#date");
    if (date) date.addEventListener("change", () => {
      state.draft.dateISO = date.value;
      const label = $("#date-label");
      if (label) label.textContent = L.formatISODate(date.value) || "Pick a date";
    });
    const velo = $("#velo");
    if (velo) velo.addEventListener("input", () => { state.draft.velo = velo.value; });
    const opponent = $("#opponent");
    if (opponent) opponent.addEventListener("input", () => { state.draft.opponent = opponent.value; });
    const featured = $("#featured");
    if (featured) featured.addEventListener("change", () => { state.draft.featured = featured.checked; });
    const tagText = $("#tag-text");
    if (tagText) {
      tagText.addEventListener("input", () => { state.draft.tagText = tagText.value; });
      tagText.addEventListener("keydown", event => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        if (tagText.value.trim()) addTagFromInput();
      });
    }
    const roll = $("#roll");
    if (roll) roll.addEventListener("change", () => takeFile(roll.files && roll.files[0]));
    const cam = $("#cam");
    if (cam) cam.addEventListener("change", () => takeFile(cam.files && cam.files[0]));
  }

  function render() {
    const screen = state.screen;
    let html = "";
    if (screen === "loading") html = loadingScreen();
    else if (screen === "login") html = loginScreen();
    else if (screen === "home") html = homeScreen();
    else if (screen === "success") html = successScreen();
    else if (screen === "delete") html = deleteScreen();
    else if (screen === "edit") html = editScreen();
    else if (state.step === "category") html = categoryStep();
    else if (state.step === "tags") html = tagsStep();
    else if (state.step === "details") html = detailsStep();
    else if (state.step === "preview") html = previewStep();
    else html = videoStep();
    app.innerHTML = html;
    app.setAttribute("aria-busy", state.busy ? "true" : "false");
    bindFields();
    mountPreview();
    const focusNow = screen + ":" + (screen === "new" ? state.step : "") + ":" + state.error;
    if (state.error && state.error !== lastError) {
      lastError = state.error;
      const alert = $("[role=alert]");
      if (alert) alert.focus();
    } else if (focusNow !== lastFocus) {
      lastFocus = focusNow;
      lastError = state.error;
      const heading = $("#main h1");
      if (heading) heading.focus();
    }
    const live = document.getElementById("live");
    if (live) live.textContent = state.notice || state.progressLabel || "";
  }

  app.addEventListener("click", event => {
    const control = event.target.closest("[data-action]");
    if (!control) return;
    const action = control.dataset.action;
    if (state.busy && action !== "cancel") return;
    if (action === "login") onLogin();
    else if (action === "logout") logout();
    else if (action === "add") {
      clearDraft(false);
      state.draft = newDraft();
      state.screen = "new";
      state.step = "video";
      state.error = "";
      state.notice = "";
      render();
    } else if (action === "browse") {
      const input = $("#roll");
      if (input) input.click();
    } else if (action === "record") {
      const input = $("#cam");
      if (input) input.click();
    }     else if (action === "next" || action === "post" || action === "save") return;
    else if (action === "back" || action === "home") goBack();
    else if (action === "pick") {
      const group = control.dataset.group;
      const value = control.dataset.value;
      if (group === "category") {
        state.draft.category = value;
        const allowed = L.tagsFor(value);
        Object.keys(L.TAG_LABELS).forEach(key => {
          if (!allowed[key]) state.draft[key] = "";
        });
      } else {
        state.draft[group] = state.draft[group] === value ? "" : value;
      }
      if (!L.showOpponent(state.draft)) state.draft.opponent = "";
      syncTitle();
      state.error = "";
      render();
      const again = app.querySelector('[data-group="' + group + '"][data-value="' + CSS.escape(value) + '"]');
      if (again) again.focus();
    } else if (action === "add-tag") addTagFromInput();
    else if (action === "remove-tag") {
      const index = Number(control.dataset.index);
      state.draft.tags = (state.draft.tags || []).filter((_, i) => i !== index);
      render();
      const input = $("#tag-text");
      if (input) input.focus();
    } else if (action === "suggest") {
      state.draft.titleDirty = false;
      syncTitle();
      render();
      const title = $("#title");
      if (title) title.focus();
    } else if (action === "clear-file") {
      if (state.draft.fileUrl) URL.revokeObjectURL(state.draft.fileUrl);
      state.draft.file = null;
      state.draft.fileUrl = "";
      render();
    } else if (action === "post") post();
    else if (action === "save") saveEdit();
    else if (action === "edit") startEdit(control.dataset.key);
    else if (action === "ask-delete") {
      state.beforeDelete = state.screen === "edit" ? "edit" : "home";
      state.deleteKey = control.dataset.key;
      state.screen = "delete";
      state.error = "";
      render();
    } else if (action === "confirm-delete") confirmDelete();
    else if (action === "cancel") {
      state.cancelRequested = true;
      if (state.reader) state.reader.abort();
      if (state.xhr) state.xhr.abort();
      state.busy = false;
      state.progress = 0;
      state.error = "Canceled. Nothing was saved.";
      render();
    }
  });

  app.addEventListener("submit", event => {
    event.preventDefault();
    if (state.busy) return;
    if (state.screen === "edit") saveEdit();
    else if (state.screen === "new" && state.step === "preview") post();
    else if (state.screen === "new") goNext();
  });

  async function boot() {
    if (practice) {
      state.screen = "login";
      render();
      return;
    }
    const saved = localStorage.getItem(TOKEN_KEY);
    if (!saved) {
      state.screen = "login";
      render();
      return;
    }
    state.token = saved;
    await loadHome();
  }

  boot();
})();
