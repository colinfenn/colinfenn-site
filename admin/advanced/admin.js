/* Keeps Decap's saved files in the shape js/app.js already reads.
   YouTube detection matches ytId() in js/app.js. */
(function (root) {
  'use strict';

  var CATEGORIES = [
    'Pitching',
    'Hitting',
    'Fielding',
    'Workouts/Training',
    'Game Highlights'
  ];

  var YT = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/;
  var VIDEO_EXT = /\.(mp4|webm|mov)(\?|$)/i;

  var HITTING_KEYS = ['season', 'team', 'avg', 'slg', 'ops', 'cpct'];
  var PITCHING_KEYS = ['season', 'team', 'ip', 'so', 'spct', 'bbIp'];

  var STAT_COLUMNS = {
    Hitting: [
      { key: 'season', label: 'Season' },
      { key: 'team', label: 'Team' },
      { key: 'avg', label: 'AVG', title: 'Batting average' },
      { key: 'slg', label: 'SLG', title: 'Slugging percentage' },
      { key: 'ops', label: 'OPS', title: 'On-base plus slugging' },
      { key: 'cpct', label: 'C%', title: 'Contact percentage' }
    ],
    Pitching: [
      { key: 'season', label: 'Season' },
      { key: 'team', label: 'Team' },
      { key: 'ip', label: 'IP', title: 'Innings pitched' },
      { key: 'so', label: 'SO', title: 'Strikeouts' },
      { key: 'spct', label: 'S%', title: 'Strike percentage' },
      { key: 'bbIp', label: 'BB/IP', title: 'Walks per inning' }
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

  function diskVideo(v) {
    v = v || {};
    var url = pickVideoUrl(v.file, v.youtube);
    if (!url && v.url) url = text(v.url);
    var item = {
      title: v.title || '',
      type: inferType(url),
      url: url
    };
    if (text(v.pitch)) item.pitch = text(v.pitch);
    if (text(v.angle)) item.angle = text(v.angle);
    if (text(v.setting)) item.setting = text(v.setting);
    item.date = v.date || '';
    item.caption = v.caption || '';
    item.category = v.category || 'Pitching';
    return item;
  }

  function editorVideo(v) {
    v = v || {};
    var url = text(v.url);
    var isFile = VIDEO_EXT.test(url);
    return {
      title: v.title || '',
      category: v.category || 'Pitching',
      youtube: isFile ? '' : url,
      file: isFile ? url : '',
      pitch: v.pitch || '',
      angle: v.angle || '',
      setting: v.setting || '',
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
    var out = {
      categories: CATEGORIES.slice(),
      videos: ((data && data.videos) || []).map(diskVideo)
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
        statTable('Hitting', data.hittingExample, data.hittingNote, data.hittingRows, HITTING_KEYS),
        statTable('Pitching', data.pitchingExample, data.pitchingNote, data.pitchingRows, PITCHING_KEYS)
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
