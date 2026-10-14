/* Keeps Decap's saved files in the shape js/app.js already reads.
   YouTube detection matches ytId() in js/app.js. */
(function (root) {
  'use strict';

  var CATEGORIES = [
    'Pitching',
    'Hitting',
    'Fielding',
    'Training/Workouts'
  ];

  var YT = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/;
  var VIDEO_EXT = /\.(mp4|webm|mov)(\?|$)/i;

  var HITTING_KEYS = ['season', 'team', 'avg', 'obp', 'slg', 'ops', 'cpct'];
  var PITCHING_KEYS = ['season', 'team', 'ip', 'so', 'era', 'bbIp', 'spct'];

  var STAT_COLUMNS = {
    Hitting: [
      { key: 'season', label: 'Season' },
      { key: 'team', label: 'Team' },
      { key: 'avg', label: 'AVG', title: 'Batting average' },
      { key: 'obp', label: 'OBP', title: 'On-base percentage' },
      { key: 'slg', label: 'SLG', title: 'Slugging percentage' },
      { key: 'ops', label: 'OPS', title: 'On-base plus slugging' },
      { key: 'cpct', label: 'C%', title: 'Contact percentage' }
    ],
    Pitching: [
      { key: 'season', label: 'Season' },
      { key: 'team', label: 'Team' },
      { key: 'ip', label: 'IP', title: 'Innings pitched' },
      { key: 'so', label: 'SO', title: 'Strikeouts' },
      { key: 'era', label: 'ERA', title: 'Earned run average' },
      { key: 'bbIp', label: 'BB/IP', title: 'Walks per inning' },
      { key: 'spct', label: 'Strike%', title: 'Strike percentage' }
    ]
  };

  function text(value) {
    if (value == null) return '';
    if (Array.isArray(value)) return text(value[0]);
    return String(value).trim();
  }

  function inferType(url) {
    var u = text(url);
    if (YT.test(u)) return 'youtube';
    if (VIDEO_EXT.test(u)) return 'mp4';
    return 'placeholder';
  }

  function pickVideoUrl(file, youtube) {
    var uploaded = text(file);
    var link = text(youtube);
    if (VIDEO_EXT.test(uploaded)) return uploaded;
    if (YT.test(link)) return link;
    if (link) return link;
    if (uploaded) return uploaded;
    return '';
  }

  function normalizeCategory(category) {
    var name = text(category);
    if (name === 'Workouts/Training') return 'Training/Workouts';
    if (name === 'Game Highlights') return 'Pitching';
    if (CATEGORIES.indexOf(name) >= 0) return name;
    return 'Pitching';
  }

  function tagList(v) {
    var raw = [];
    if (Array.isArray(v.tags)) raw = raw.concat(v.tags);
    ['pitch', 'result', 'pitchFaced', 'battedBall', 'play', 'position', 'workout', 'setting'].forEach(function (key) {
      if (text(v[key])) raw.push(text(v[key]));
    });
    var out = [];
    var seen = {};
    raw.forEach(function (item) {
      var tag = text(item).replace(/\s+/g, ' ');
      var key = tag.toLowerCase();
      if (!tag || seen[key]) return;
      seen[key] = true;
      out.push(tag);
    });
    return out;
  }

  function normalizeCategories(list, fallback) {
    var source = [];
    if (Object.prototype.toString.call(list) === '[object Array]') source = list;
    else if (text(list)) source = [list];
    if (!source.length && text(fallback)) source = [fallback];
    var out = [];
    var seen = {};
    CATEGORIES.forEach(function (category) {
      source.forEach(function (item) {
        var name = normalizeCategory(item);
        if (name === category && !seen[name]) {
          seen[name] = true;
          out.push(name);
        }
      });
    });
    return out;
  }

  function shortDate(value) {
    var match = String(value || '').match(/^([A-Za-z]+)\s+(\d{1,2})/);
    if (!match) return '';
    var months = {
      january: 'Jan', february: 'Feb', march: 'Mar', april: 'Apr', may: 'May', june: 'Jun',
      july: 'Jul', august: 'Aug', september: 'Sep', october: 'Oct', november: 'Nov', december: 'Dec'
    };
    var short = months[match[1].toLowerCase()];
    if (!short) return '';
    return short + ' ' + String(Number(match[2]));
  }

  function generatedTitle(v, categories, tags) {
    var head = tags.length ? tags.join(' · ') : (categories[0] || '');
    var when = shortDate(v && v.date);
    if (head && when) return head + ' · ' + when;
    return head;
  }

  function diskVideo(v) {
    v = v || {};
    var url = pickVideoUrl(v.file, v.youtube);
    if (!url && v.url) url = text(v.url);
    var categories = normalizeCategories(v.categories, v.category);
    var category = categories[0] || normalizeCategory(v.category);
    var tags = tagList(v);
    var item = {
      title: text(v.title) || generatedTitle(v, categories, tags),
      type: inferType(url),
      url: url
    };
    if (text(v.thumbnail)) item.thumbnail = text(v.thumbnail);
    if (tags.length) item.tags = tags;
    if (categories.indexOf('Pitching') >= 0 && text(v.velo)) item.velo = text(v.velo);
    if (v.featured === true || v.featured === 'true') item.featured = true;
    item.date = v.date || '';
    item.caption = v.caption || '';
    item.category = category;
    if (categories.length) item.categories = categories;
    return item;
  }

  function editorVideo(v) {
    v = v || {};
    var url = text(v.url);
    var isFile = VIDEO_EXT.test(url);
    var categories = normalizeCategories(v.categories, v.category);
    return {
      title: v.title || '',
      categories: categories,
      youtube: isFile ? '' : url,
      file: isFile ? url : '',
      thumbnail: v.thumbnail || '',
      tags: tagList(v),
      velo: categories.indexOf('Pitching') >= 0 ? (v.velo || '') : '',
      featured: !!v.featured,
      date: v.date || '',
      caption: v.caption || ''
    };
  }

  function videosFromFile(content) {
    var data = JSON.parse(content);
    return {
      videos: (data.videos || []).map(editorVideo)
    };
  }

  function videosToFile(data) {
    var videos = ((data && data.videos) || []).filter(function (v) {
      var label = text(v && v.category);
      if (!label && v && Object.prototype.toString.call(v.categories) === '[object Array]' && v.categories.length === 1) label = text(v.categories[0]);
      return label !== 'Game Highlights' || text(v && v.url);
    }).map(diskVideo);
    var out = {
      categories: CATEGORIES.slice(),
      videos: videos
    };
    return JSON.stringify(out, null, 2) + '\n';
  }

  function findTable(tables, title) {
    return (tables || []).filter(function (t) { return t && t.title === title; })[0] || {};
  }

  function rowsForEditor(rows) {
    return (rows || []).map(function (row) {
      var copy = {};
      Object.keys(row || {}).forEach(function (key) {
        if (row[key] != null) copy[key] = row[key];
      });
      return copy;
    });
  }

  function statsFromFile(content) {
    var data = JSON.parse(content);
    var hitting = findTable(data.tables, 'Hitting');
    var pitching = findTable(data.tables, 'Pitching');
    return {
      hittingExample: !!hitting.example,
      hittingNote: hitting.note || '',
      hittingRows: rowsForEditor(hitting.rows),
      pitchingExample: !!pitching.example,
      pitchingNote: pitching.note || '',
      pitchingRows: rowsForEditor(pitching.rows)
    };
  }

  function cleanRows(rows, keys) {
    return (rows || []).map(function (row) {
      var out = {};
      keys.forEach(function (key) {
        if (row && row[key] != null && String(row[key]) !== '') out[key] = String(row[key]);
      });
      return out;
    });
  }

  function statTable(title, example, note, rows, keys) {
    var table = {
      title: title,
      example: !!example,
      columns: STAT_COLUMNS[title],
      rows: cleanRows(rows, keys)
    };
    if (text(note)) table.note = text(note);
    return table;
  }

  function statsToFile(data) {
    data = data || {};
    var out = {
      tables: [
        statTable('Pitching', data.pitchingExample, data.pitchingNote, data.pitchingRows, PITCHING_KEYS),
        statTable('Hitting', data.hittingExample, data.hittingNote, data.hittingRows, HITTING_KEYS)
      ]
    };
    return JSON.stringify(out, null, 2) + '\n';
  }

  function profileFromFile(content) {
    var data = JSON.parse(content);
    var reel = data.highlightReel || {};
    var url = text(reel.url);
    var isFile = VIDEO_EXT.test(url);
    data.highlightReel = {
      title: reel.title || '',
      youtube: isFile ? '' : url,
      file: isFile ? url : '',
      caption: reel.caption || ''
    };
    return data;
  }

  function profileToFile(data) {
    var copy = JSON.parse(JSON.stringify(data || {}));
    var reel = copy.highlightReel || {};
    var url = pickVideoUrl(reel.file, reel.youtube);
    if (!url && reel.url) url = text(reel.url);
    copy.highlightReel = {
      url: url,
      title: reel.title || '',
      caption: reel.caption || ''
    };
    return JSON.stringify(copy, null, 2) + '\n';
  }

  root.ColinAdmin = {
    CATEGORIES: CATEGORIES,
    inferType: inferType,
    pickVideoUrl: pickVideoUrl,
    videosFromFile: videosFromFile,
    videosToFile: videosToFile,
    statsFromFile: statsFromFile,
    statsToFile: statsToFile,
    profileFromFile: profileFromFile,
    profileToFile: profileToFile
  };

  if (typeof CMS === 'undefined') return;

  CMS.registerCustomFormat('site-videos', 'json', {
    fromFile: videosFromFile,
    toFile: videosToFile
  });
  CMS.registerCustomFormat('site-stats', 'json', {
    fromFile: statsFromFile,
    toFile: statsToFile
  });
  CMS.registerCustomFormat('site-profile', 'json', {
    fromFile: profileFromFile,
    toFile: profileToFile
  });
  CMS.init();
})(typeof window !== 'undefined' ? window : globalThis);
