(function(){
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isPh=v=>v==null||v===''||/^placeholder$/i.test(String(v));
  const val=v=>isPh(v)?'<span class="ph">Placeholder</span>':esc(v);
  const get=u=>fetch(u,{cache:'no-cache'}).then(r=>{if(!r.ok)throw r;return r.json()});
  $('#yr').textContent=new Date().getFullYear();

  get('data/profile.json').then(p=>{
    document.querySelectorAll('[data-f]').forEach(el=>{const v=p[el.dataset.f];if(!isPh(v))el.textContent=v});
    if(p.photo){const ph=$('#photo');ph.style.backgroundImage=`url("${encodeURI(p.photo)}")`;ph.classList.add('has-img');ph.setAttribute('aria-label',p.name+' photo')}
    const fb=(p.metrics||[]).find(m=>/fastball/i.test(m.label));
    const facts=[['Class',p.gradYear],['Position',p.position],['Height',p.height],['Weight',p.weight],['High School',p.school+(p.schoolLocation?', '+p.schoolLocation:'')],['Travel',p.travelTeam],['FB Velo',fb?fb.value+' '+fb.unit:''],['GPA',p.academics&&p.academics.gpa]];
    $('#facts').innerHTML=facts.map(([k,v])=>`<div><dt>${k}</dt><dd>${val(v)}</dd></div>`).join('');
    $('#metrics').innerHTML=(p.metrics||[]).map(m=>`<div class="metric${m.placeholder?' placeholder':''}"><div class="v">${esc(m.value)}${m.unit?`<small>${esc(m.unit)}</small>`:''}</div><div class="l">${esc(m.label)}</div><div class="n">${esc(m.note||'')}</div></div>`).join('');
    $('#arsenal').innerHTML=(p.arsenal||[]).map(a=>`<li>${esc(a.pitch)}<span>Velo: ${isPh(a.velo)?'Placeholder':esc(a.velo)}${a.note?' · '+esc(a.note):''}</span></li>`).join('');
    const ac=p.academics||{};
    $('#academics-list').innerHTML=[['GPA',isPh(ac.gpa)?ac.gpa:ac.gpa+(ac.gpaScale?' / '+ac.gpaScale:'')],['Test Scores',ac.testScores],['Intended Major',ac.intendedMajor],['Last Updated',ac.updated]].map(([k,v])=>`<div><dt>${k}</dt><dd>${val(v)}</dd></div>`).join('');
    const hon=p.honors||[];
    if(hon.length){$('#honors-list').innerHTML=hon.map(h=>`<li><span class="trophy" aria-hidden="true">🏆</span><div><strong>${esc(h.title)}</strong><div class="m">${esc([h.org,h.season&&h.season+' season'].filter(Boolean).join(' · '))}</div></div></li>`).join('');
      const f=hon.find(h=>h.featured);const aw=$('#award');if(aw){if(f)aw.textContent=`🏆 ${f.title} · ${f.org.replace(' High School',' HS')} · ${f.season}`;else aw.remove()}}
    if(p.glance)$('#glance-list').innerHTML=p.glance.map(g=>`<li${g.highlight?' class="hl"':''}><b>${esc(g.value)}</b><span>${esc(g.label)}</span></li>`).join('');
    const r=p.highlightReel||{};
    if(r.url)$('#reel-media').innerHTML=media(r),$('#reel-media').classList.add('has');
    $('#reel-caption').textContent=r.caption||'';
    const PH='<span class="badge">PLACEHOLDER</span>';
    if(p.note&&p.note.text)$('#note-text').innerHTML=(p.note.placeholder?PH:'')+esc(p.note.text);
    const refs=(p.coaches||[]).filter(c=>c.quote);
    if(refs.length)$('#refs-list').innerHTML=refs.map(c=>`<figure class="ref"><blockquote>${c.placeholder?PH:''}“${esc(c.quote)}”</blockquote><figcaption><strong>${val(c.name)}</strong><span>${esc(c.role)} · ${esc(c.team||'')}</span>${c.email?`<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`:''}${c.phone?`<span>${esc(c.phone)}</span>`:''}</figcaption></figure>`).join('');
    if(p.email){$('#email').href='mailto:'+p.email;$('#email').textContent=p.email}
    $('#coaches').innerHTML=(p.coaches||[]).map(c=>`<div class="coach"><div class="role">${esc(c.role)}</div><div class="nm">${val(c.name)}</div><div>${esc(c.team||'')}</div>${c.email?`<div><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>`:''}${c.phone?`<div>${esc(c.phone)}</div>`:''}</div>`).join('');
  }).catch(e=>console.warn('profile.json not loaded; showing built-in fallback',e));

  get('data/stats.json').then(s=>{
    const tables=s.tables||[];
    $('#stats-tables').innerHTML=tables.map(t=>{
      const cols=t.columns||[];
      const cls=c=>c.key==='team'?' class="col-team"':'';
      const teams=[...new Set((t.rows||[]).map(r=>r.team).filter(Boolean))].join(', ');
      const head=cols.map(c=>`<th scope="col"${cls(c)}${c.title?` title="${esc(c.title)}"`:''}>${c.title?`<abbr title="${esc(c.title)}">${esc(c.label)}</abbr>`:esc(c.label)}</th>`).join('');
      const body=(t.rows||[]).map(r=>`<tr class="${(r.example??t.example)?'example':''}">${cols.map((c,i)=>i?`<td${cls(c)}>${esc(r[c.key]??'—')}</td>`:`<th scope="row">${esc(r[c.key]??'')}</th>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}">Coming soon.</td></tr>`;
      return `<h3>${esc(t.title)}${teams?` <span class="team-sub">· ${esc(teams)}</span>`:''}</h3>${t.example?`<p class="note"><span class="badge">EXAMPLE</span>${esc(t.note||'Example rows only.')}</p>`:''}<div class="table-wrap"><table><caption class="sr">${esc(t.title)} stats by season</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }).join('')||'<p>Stats coming soon.</p>';
  }).catch(()=>{});

  get('data/schedule.json').then(s=>{
    const sc=s.showcases||[];const st=['Upcoming','Past'];let cur='Upcoming';
    const rs=()=>{$('#sc-tabs').innerHTML=st.map(x=>`<button type="button" role="tab" aria-selected="${x===cur}">${x}</button>`).join('');
      const l=sc.filter(e=>e.status===cur);
      $('#sc-list').innerHTML=l.map(e=>`<li><div class="d">${esc(e.date)}</div><div>${e.placeholder?'<span class="badge">PLACEHOLDER</span>':''}<strong>${esc(e.event)}</strong><div class="m">${esc(e.location||'')}</div>${e.results?`<div class="res">Results: ${esc(e.results)}</div>`:''}</div></li>`).join('')||'<li>None yet.</li>';};
    $('#sc-tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b){cur=b.textContent;rs()}});rs();

    if(s.example)$('#schedule-note').innerHTML='<span class="badge">PLACEHOLDER</span>Schedule to be announced.';
    $('#schedule-list').innerHTML=(s.events||[]).map(e=>`<li><div class="d">${esc(e.date)}</div><div><strong>${esc(e.event)}</strong><div class="m">${esc(e.team||'')} · ${esc(e.location||'')}</div></div></li>`).join('')||'<li>Schedule coming soon.</li>';
  }).catch(()=>{});

  function ytId(u){const m=String(u).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);return m&&m[1]}
  function media(v){
    const t=v.type||(ytId(v.url)?'youtube':/\.(mp4|webm|mov)(\?|$)/i.test(v.url||'')?'mp4':'placeholder');
    if(t==='youtube'&&ytId(v.url))return `<iframe src="https://www.youtube-nocookie.com/embed/${ytId(v.url)}" title="${esc(v.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    if(t==='mp4'&&v.url)return `<video controls preload="metadata" playsinline ${v.poster?`poster="${esc(v.poster)}"`:''}><source src="${esc(v.url)}">${esc(v.caption||'')}</video>`;
    return '<span>▶ Video coming soon</span>';
  }
  get('data/videos.json').then(d=>{
    const vids=d.videos||[];
    const cats=d.categories||[...new Set(vids.map(v=>v.category).filter(Boolean))];
    let cat=cats[0],f='All';
    const tabs=$('#vtabs');
    const render=()=>{
      tabs.innerHTML=cats.map(c=>{const n=vids.filter(v=>v.category===c&&v.type!=='placeholder'&&v.url).length;return `<button type="button" role="tab" aria-selected="${c===cat}" tabindex="${c===cat?0:-1}">${esc(c)}${n?` <small>${n}</small>`:''}</button>`}).join('');
      const inCat=vids.filter(v=>v.category===cat);
      const tags=['All',...new Set(inCat.flatMap(v=>[v.pitch,v.angle,v.setting]).filter(Boolean))];
      $('#filters').innerHTML=tags.length>2?tags.map(c=>`<button type="button" aria-pressed="${c===f}">${esc(c)}</button>`).join(''):'';
      const list=inCat.filter(v=>f==='All'||[v.pitch,v.angle,v.setting].includes(f));
      $('#videos').setAttribute('role','tabpanel');
      $('#videos').innerHTML=list.map(card).join('')||'<p>No videos in this category yet.</p>';
    };
    const card=v=>`<article class="vcard"><div class="vmedia">${media(v)}</div><div class="vbody"><h4>${esc(v.title)}</h4><div class="tags">${[v.pitch,v.angle,v.setting,v.date].filter(Boolean).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>${v.caption?`<p>${esc(v.caption)}</p>`:''}</div></article>`;
    tabs.addEventListener('click',e=>{const b=e.target.closest('button');if(b){cat=cats[[...tabs.children].indexOf(b)];f='All';render();tabs.children[cats.indexOf(cat)].focus()}});
    tabs.addEventListener('keydown',e=>{const k={ArrowRight:1,ArrowLeft:-1}[e.key];if(k){cat=cats[(cats.indexOf(cat)+k+cats.length)%cats.length];f='All';render();tabs.children[cats.indexOf(cat)].focus()}});
    $('#filters').addEventListener('click',e=>{const b=e.target.closest('button');if(b){f=b.textContent;render()}});
    render();
  }).catch(()=>{});
})();
