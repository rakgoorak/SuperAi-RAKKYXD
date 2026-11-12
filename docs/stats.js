// Live numbers for the website: downloads (GitHub release assets) and people using the app
// right now (the anonymous usage counter). Shared by index.html (English) and th.html (Thai).
(function () {
  var RELEASES = 'https://api.github.com/repos/rakgoorak/SuperAi-RAKKYXD-releases/releases?per_page=100';
  var USAGE = 'https://superai-usage.rakgorak.workers.dev/stats';
  var th = document.documentElement.lang === 'th';
  var T = th ? {
    downloads: 'ดาวน์โหลดแล้ว', installs: 'ติดตั้งใหม่ {n} ครั้ง · ไฟล์ ZIP และอัปเดตในแอป {m} ครั้ง',
    online: 'กำลังใช้งานแอปอยู่ตอนนี้', countryNote: 'ประเทศนับจากอุปกรณ์ที่ออนไลน์ใน 15 นาทีล่าสุด',
    noCountry: 'ไม่มีข้อมูลประเทศของอุปกรณ์ที่ออนไลน์ตอนนี้'
  } : {
    downloads: 'downloads', installs: '{n} new installs · {m} ZIP downloads and in-app updates',
    online: 'using the app right now', countryNote: 'Countries reflect devices online in the last 15 minutes',
    noCountry: 'Country information is unavailable for current devices'
  };
  var locale = th ? 'th-TH' : 'en-US';
  var fmt = function (n) { return Number(n || 0).toLocaleString(locale); };
  var $ = function (id) { return document.getElementById(id); };

  // Point the visitor's own platform at the main button.
  var ua = navigator.userAgent;
  var os = /Windows/i.test(ua) ? 'windows' : /Macintosh|Mac OS X/i.test(ua) ? 'mac-arm' : null;
  var mine = os && document.querySelector('.buttons [data-os="' + os + '"]');
  if (mine) {
    document.querySelectorAll('.buttons .btn.primary').forEach(function (b) { b.classList.remove('primary'); });
    mine.classList.add('primary');
  }

  // A click counts at once; the GitHub figure catches up within minutes.
  var KEY = 'superai-dl-pending', apiTotal = 0, pending = null;
  try { pending = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  function total() {
    if (pending && (Date.now() - pending.at > 3600000 || pending.base + pending.n <= apiTotal)) {
      pending = null;
      try { localStorage.removeItem(KEY); } catch (e) {}
    }
    return pending ? pending.base + pending.n : apiTotal;
  }
  function showTotal() { if (apiTotal) $('dl-total').textContent = fmt(total()); }
  document.addEventListener('click', function (e) {
    var link = e.target && e.target.closest ? e.target.closest('a[href*="/releases/latest/download/"]') : null;
    if (!link || !apiTotal) return;
    pending = { base: pending ? pending.base : apiTotal, n: (pending ? pending.n : 0) + 1, at: Date.now() };
    try { localStorage.setItem(KEY, JSON.stringify(pending)); } catch (err) {}
    showTotal();
  });

  function parts(tag) { return String(tag).replace(/^v/, '').split(/[.-]/).map(function (n) { return parseInt(n, 10) || 0; }); }
  function newer(a, b) {
    var x = parts(a.tag_name), y = parts(b.tag_name);
    for (var i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0);
    return 0;
  }

  fetch(RELEASES).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (list) {
    var releases = (Array.isArray(list) ? list : []).filter(function (r) { return r && r.tag_name && !r.draft && !r.prerelease; }).sort(newer);
    if (!releases.length) return;
    var latest = releases[0];
    document.querySelectorAll('[data-latest-version]').forEach(function (el) { el.textContent = latest.tag_name; });
    // Real sizes of the newest files on the buttons.
    (latest.assets || []).forEach(function (asset) {
      document.querySelectorAll('a[href$="/' + asset.name + '"] small').forEach(function (el) {
        el.textContent = '≈' + Math.round(asset.size / 1e6) + ' MB';
      });
    });
    var split = { windows: 0, 'mac-arm': 0, 'mac-intel': 0 }, sum = 0, installs = 0;
    releases.forEach(function (rel) {
      (rel.assets || []).forEach(function (asset) {
        var n = asset.name, c = asset.download_count || 0;
        if (/\.sha256$/.test(n)) return;
        sum += c;
        if (/\.(exe|dmg)$/.test(n)) installs += c;
        if (/Setup\.exe$|windows-x64\.zip$/.test(n)) split.windows += c;
        else if (/macos-arm64\.(dmg|zip)$/.test(n)) split['mac-arm'] += c;
        else if (/macos-x64\.(dmg|zip)$/.test(n)) split['mac-intel'] += c;
      });
    });
    if (!sum) return;
    apiTotal = sum;
    showTotal();
    $('dl-label').textContent = T.downloads;
    var top = Math.max(split.windows, split['mac-arm'], split['mac-intel']) || 1;
    Object.keys(split).forEach(function (key) {
      var row = document.querySelector('[data-split="' + key + '"]');
      if (!row) return;
      row.querySelector('b').textContent = fmt(split[key]);
      row.querySelector('i').style.width = Math.round(split[key] / top * 100) + '%';
    });
    $('dl-note').textContent = T.installs.replace('{n}', fmt(installs)).replace('{m}', fmt(sum - installs));
    $('stats').hidden = false;
  }).catch(function () {});

  function loadLive() {
    if (document.hidden) return;
    fetch(USAGE).then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (s) {
      if (!s || s.online == null) return;
      var online = Number(s.online) || 0;
      $('live-online').textContent = fmt(online);
      $('live-online-label').textContent = T.online;
      var names = null;
      try { names = new Intl.DisplayNames([th ? 'th' : 'en'], { type: 'region' }); } catch (e) {}
      var list = $('live-countries');
      list.textContent = '';
      var countries = Array.isArray(s.onlineCountries) ? s.onlineCountries : null;
      var represented = 0;
      function addCountry(name, count) {
        var li = document.createElement('li'), b = document.createElement('b');
        li.textContent = name;
        b.textContent = fmt(count);
        li.appendChild(b);
        list.appendChild(li);
      }
      if (countries) {
        countries.forEach(function (c) {
          if (!c || !/^[A-Z]{2}$/.test(c.country)) return;
          var count = Number(c.users) || 0;
          if (count <= 0) return;
          var name = c.country;
          try { name = (names && names.of(c.country)) || c.country; } catch (e) {}
          represented += count;
          addCountry(name, count);
        });
        if (represented < online) addCountry(th ? 'ไม่ทราบประเทศ' : 'Location unavailable', online - represented);
        $('live-note').textContent = T.countryNote;
      } else {
        $('live-note').textContent = T.noCountry;
      }
      $('live').hidden = false;
      $('stats').hidden = false;
    }).catch(function () {});
  }
  loadLive();
  setInterval(loadLive, 60000);
  document.addEventListener('visibilitychange', loadLive);
})();
