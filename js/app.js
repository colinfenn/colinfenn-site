(function () {
  const L = window.ColinUpload;
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isPh = v => v == null || v === "" || /^placeholder$/i.test(String(v));
  const val = v => isPh(v) ? '<span class="ph">Placeholder</span>' : esc(v);
  const get = u => fetch(u, { cache: "no-cache" }).then(r => { if (!r.ok) throw r; return r.json(); });
  $("#yr").textContent = new Date().getFullYear();

  function schoolShort(school) {
    return String(school || "").replace(/\s+High School\b/i, " HS").replace(/\s+/g, " ").trim();
  }

  function weightLabel(weight) {
    const match = String(weight || "").match(/\d+(?:\.\d+)?/);
    return match ? match[0] : "";
  }

  function paintReel(r) {
    const el = $("#reel-media");
    if (!el || !r) return;
    if (r.url) {
      const id = L.youtubeId(r.url);
      el.innerHTML = id
        ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(r.title || "Highlight reel")}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
        : `<video controls preload="metadata" playsinline src="${esc(r.url)}"></video>`;
      el.classList.add("has");
    }
    const cap = $("#reel-caption");
    if (cap) cap.textContent = r.caption || "";
  }

  function paintAbout(url) {
    const el = $("#about-media");
    if (!el) return;
    if (!url) {
      el.classList.remove("has");
      el.innerHTML = "<span>About Me video coming soon</span>";
      return;
    }
    const id = L.youtubeId(url);
    el.classList.add("has");
    el.innerHTML = id
      ? `<iframe src="https://www.youtube-nocookie.com/embed/${id}" title="About Me" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
      : `<video controls preload="metadata" playsinline src="${esc(url)}"></video>`;
  }

  let reelLocked = false;
  get("data/profile.json").then(p => {
    const idLine = [p.name, p.position, p.gradYear ? "Class of " + p.gradYear : "", schoolShort(p.school), p.travelTeam].filter(Boolean).join(", ");
    const id = $("#id-line");
    if (id && idLine) id.textContent = idLine;
    if (p.photo) {
      const ph = $("#photo");
      ph.style.backgroundImage = `url("${encodeURI(p.photo)}")`;
      ph.classList.add("has-img");
      ph.setAttribute("aria-label", p.name + " photo");
    }
    const gpa = p.academics && p.academics.gpa;
    const bt = !isPh(p.bats) && !isPh(p.throws) ? p.bats + "/" + p.throws : "";
    const facts = [["Height", p.height], ["Weight", weightLabel(p.weight) || p.weight], ["GPA", gpa], ["B/T", bt]];
    $("#keynums").innerHTML = facts.map(([k, v]) => `<li><b>${isPh(v) ? "—" : esc(v)}</b><span>${esc(k)}</span></li>`).join("");
    const hon = p.honors || [];
    const featured = hon.find(h => h.featured) || hon[0];
    const award = $("#award");
    if (award && featured) {
      const org = String(featured.org || "").replace(/\s+High School\b/i, " HS");
      award.textContent = `🏆 ${featured.title} · ${org} · ${featured.season}`;
    }
    const rest = hon.filter(h => h !== featured);
    const list = $("#honors-list");
    if (list) {
      if (rest.length) {
        list.hidden = false;
        list.innerHTML = rest.map(h => `<li><span class="trophy" aria-hidden="true">🏆</span><div><strong>${esc(h.title)}</strong><div class="m">${esc([h.org, h.season && h.season + " season"].filter(Boolean).join(" · "))}</div></div></li>`).join("");
      } else list.remove();
    }
    if (!reelLocked) paintReel(p.highlightReel || {});
    paintAbout(p.about && p.about.url);
    if (p.email) {
      $("#email").href = "mailto:" + p.email;
      $("#email").textContent = p.email;
    }
    $("#coaches").innerHTML = (p.coaches || []).map(c => `<div class="coach"><div class="role">${esc(c.role)}</div><div class="nm">${val(c.name)}</div><div>${esc(c.team || "")}</div>${c.email ? `<div><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : ""}${c.phone ? `<div>${esc(c.phone)}</div>` : ""}</div>`).join("");
  }).catch(e => console.warn("profile.json not loaded; showing built-in fallback", e));

  function freshmanBlock(table) {
    const row = (table.rows || []).find(r => /freshman/i.test(r.team || "")) || (table.rows || [])[0];
    if (!row) return "";
    const cells = (table.columns || []).filter(c => c.key !== "season" && c.key !== "team" && row[c.key]);
    return `<div class="fresh"><h3>${esc(table.title)}</h3><ul class="fresh-nums">${cells.map(c => `<li><b>${esc(row[c.key])}</b><span>${esc(c.label)}</span></li>`).join("")}</ul></div>`;
  }

  get("data/stats.json").then(s => {
    const tables = s.tables || [];
    $("#stats-tables").innerHTML = tables.map(t => {
      const cols = t.columns || [];
      const cls = c => c.key === "team" ? ' class="col-team"' : "";
      const teams = [...new Set((t.rows || []).map(r => r.team).filter(Boolean))].join(", ");
      const head = cols.map(c => `<th scope="col"${cls(c)}${c.title ? ` title="${esc(c.title)}"` : ""}>${c.title ? `<abbr title="${esc(c.title)}">${esc(c.label)}</abbr>` : esc(c.label)}</th>`).join("");
      const body = (t.rows || []).map(r => `<tr class="${(r.example ?? t.example) ? "example" : ""}">${cols.map((c, i) => i ? `<td${cls(c)}>${esc(r[c.key] ?? "—")}</td>` : `<th scope="row">${esc(r[c.key] ?? "")}</th>`).join("")}</tr>`).join("") || `<tr><td colspan="${cols.length}">Coming soon.</td></tr>`;
      return `<h3>${esc(t.title)}${teams ? ` <span class="team-sub">· ${esc(teams)}</span>` : ""}</h3>${t.example ? `<p class="note"><span class="badge">EXAMPLE</span>${esc(t.note || "Example rows only.")}</p>` : ""}<div class="table-wrap"><table><caption class="sr">${esc(t.title)} stats by season</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }).join("") || "<p>Stats coming soon.</p>";
    const honors = $("#honors-stats");
    if (honors) honors.innerHTML = '<p class="fresh-kicker">2026 freshman season · San Marin HS</p>' + tables.map(freshmanBlock).join("");
  }).catch(() => {});

  get("data/pitches.json").then(data => {
    const root = $("#pitch-list");
    if (!root) return;
    const pitches = data.pitches || [];
    root.innerHTML = pitches.map((pitch, i) => {
      const hist = L.historyNewestFirst(pitch.history || []);
      const latest = hist[0];
      const summary = latest ? latest.mph + " mph · " + L.monthLabel(latest.date) : "No reading yet";
      const rows = hist.map(item => `<li><span>${esc(item.mph)} mph</span><span>${esc(L.monthLabel(item.date))}</span></li>`).join("");
      return `<li class="pitch"><button type="button" class="pitch-btn" aria-expanded="false" aria-controls="pitch-panel-${i}"><span class="pitch-name">${esc(pitch.name)}</span><span class="pitch-now">${esc(summary)}</span></button><div class="pitch-panel" id="pitch-panel-${i}" hidden><ul class="pitch-log">${rows}</ul>${L.trendSvg(hist)}</div></li>`;
    }).join("");
    root.addEventListener("click", event => {
      const btn = event.target.closest(".pitch-btn");
      if (!btn) return;
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      if (panel) panel.hidden = open;
    });
  }).catch(() => {});

  function filterChoices(category, videos) {
    const preset = L.tagsFor(category);
    const extra = [];
    videos.forEach(video => {
      (video.tags || []).forEach(tag => {
        const key = String(tag).toLowerCase();
        if (!key) return;
        if (preset.some(item => item.toLowerCase() === key)) return;
        if (extra.some(item => item.toLowerCase() === key)) return;
        extra.push(tag);
      });
    });
    return preset.concat(extra);
  }

  get("data/videos.json").then(d => {
    const vids = d.videos || [];
    const featured = vids.find(v => v.featured && v.url && v.type !== "placeholder");
    if (featured) {
      reelLocked = true;
      paintReel(featured);
    }
    const cats = (d.categories && d.categories.length ? d.categories : L.CATEGORIES).slice();
    let cat = cats[0] || "Pitching";
    let selected = [];
    const tabs = $("#vtabs");
    const render = () => {
      tabs.innerHTML = cats.map(c => {
        const n = vids.filter(v => v.category === c && L.isReal(v)).length;
        return `<button type="button" role="tab" data-cat="${esc(c)}" aria-selected="${c === cat}" tabindex="${c === cat ? 0 : -1}">${esc(c)}${n ? ` <small>${n}</small>` : ""}</button>`;
      }).join("");
      const inCat = vids.filter(v => v.category === cat);
      const options = filterChoices(cat, inCat);
      $("#filters").innerHTML = options.map(tag => {
        const on = selected.some(item => item.toLowerCase() === tag.toLowerCase());
        return `<button type="button" data-tag="${esc(tag)}" aria-pressed="${on ? "true" : "false"}">${esc(tag)}</button>`;
      }).join("");
      const list = L.sortByDate(inCat.filter(v => L.matchesAllTags(v, selected)));
      const box = $("#video-list");
      box.setAttribute("role", "tabpanel");
      const empty = vids.length ? "<p>No videos in this category yet.</p>" : "<p>Videos coming soon.</p>";
      box.innerHTML = list.map(v => L.cardHtml(Object.assign({}, v, { mediaHtml: L.mediaHtml(v) }))).join("") || empty;
    };
    tabs.addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      cat = button.dataset.cat;
      selected = [];
      render();
      const next = tabs.querySelector('[data-cat="' + CSS.escape(cat) + '"]');
      if (next) next.focus();
    });
    tabs.addEventListener("keydown", event => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      cat = cats[(cats.indexOf(cat) + step + cats.length) % cats.length];
      selected = [];
      render();
      const next = tabs.querySelector('[data-cat="' + CSS.escape(cat) + '"]');
      if (next) next.focus();
    });
    $("#filters").addEventListener("click", event => {
      const button = event.target.closest("button");
      if (!button) return;
      const tag = button.dataset.tag;
      const index = selected.findIndex(item => item.toLowerCase() === tag.toLowerCase());
      selected = index >= 0 ? selected.filter((_, i) => i !== index) : selected.concat([tag]);
      render();
    });
    $("#video-list").addEventListener("click", event => {
      const button = event.target.closest("[data-play]");
      if (!button) return;
      const box = button.parentElement;
      if (!box) return;
      if (button.dataset.play === "youtube") {
        box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(button.dataset.id)}?autoplay=1" title="Video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
      } else if (button.dataset.play === "file") {
        box.innerHTML = `<video controls autoplay playsinline src="${esc(button.dataset.src)}"></video>`;
      }
    });
    render();
  }).catch(() => {});
})();
