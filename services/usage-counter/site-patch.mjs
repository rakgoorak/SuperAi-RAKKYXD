// Adds the current-device usage block to the download page (public releases repo).
// Usage: node site-patch.mjs <path to index.html> <https://superai-usage.ACCOUNT.workers.dev>
import fs from "node:fs";
const [file, url = ""] = process.argv.slice(2);
let h = fs.readFileSync(file, "utf8");
const eol = h.includes("\r\n") ? "\r\n" : "\n";
const rep = (a0, b) => { const a = a0.split("\n").join(eol); if (!h.includes(a)) throw new Error("missing: " + a.slice(0, 50)); h = h.replace(a, () => b.split("\n").join(eol)); };
rep(`  @media (max-width: 520px) { .dl-stats { grid-template-columns: 1fr; } }`,
`  @media (max-width: 520px) { .dl-stats { grid-template-columns: 1fr; } }
  /* Devices using the app right now (anonymous count sent by the app itself). */
  .live { max-width: 560px; margin: 22px auto 0; padding: 16px 18px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; text-align: left; }
  .live-top { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .live-top strong { font-size: 38px; line-height: 1; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .live-top span { color: var(--text-muted); font-size: 14px; }
  .live-dot { width: 9px; height: 9px; border-radius: 50%; background: #34d399; align-self: center; box-shadow: 0 0 0 0 rgba(52, 211, 153, .6); animation: live-pulse 2s infinite; }
  @keyframes live-pulse { 70% { box-shadow: 0 0 0 9px rgba(52, 211, 153, 0); } 100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); } }
  .live-sub { margin: 10px 0 0; color: var(--dim); font-size: 13px; }
  .live-countries { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0 0; padding: 0; list-style: none; }
  .live-countries li { padding: 3px 10px; border: 1px solid var(--border); border-radius: 999px; font-size: 12px; color: var(--text-muted); }
  .live-countries li b { color: var(--text); font-weight: 600; margin-left: 4px; }
  @media (prefers-reduced-motion: reduce) { .live-dot { animation: none; } }`);
rep(`    <p class="hint" id="hint" hidden></p>`,
`    <div class="live" id="live" hidden>
      <div class="live-top"><i class="live-dot" aria-hidden="true"></i><strong id="live-online">0</strong><span>กำลังใช้งานแอปอยู่ตอนนี้</span></div>
      <p class="live-sub" id="live-note">ประเทศนับจากอุปกรณ์ที่ออนไลน์ใน 15 นาทีล่าสุด</p>
      <ul class="live-countries" id="live-countries" aria-label="จำนวนอุปกรณ์ออนไลน์แยกตามประเทศ"></ul>
    </div>
    <p class="hint" id="hint" hidden></p>`);
rep(`  load();
  // Coming back to the tab`,
`  load();
  // Live users: counted by the app itself (anonymous, opt-out), served by services/usage-counter.
  var USAGE_URL = ${JSON.stringify(url)};
  function loadLive() {
    if (!USAGE_URL || document.hidden) return;
    fetch(USAGE_URL + "/stats").then(function (r) { return r.ok ? r.json() : Promise.reject(); }).then(function (s) {
      if (!s || s.online == null) return;
      var set = function (id, n) { document.getElementById(id).textContent = Number(n || 0).toLocaleString(); };
      set("live-online", s.online);
      var names = null;
      try { names = new Intl.DisplayNames(["th"], { type: "region" }); } catch (e) {}
      var list = document.getElementById("live-countries");
      list.textContent = "";
      var countries = Array.isArray(s.onlineCountries) ? s.onlineCountries : null;
      var represented = 0;
      function addCountry(name, count) {
        var li = document.createElement("li"), b = document.createElement("b");
        li.textContent = name;
        b.textContent = Number(count || 0).toLocaleString("th-TH");
        li.appendChild(b);
        list.appendChild(li);
      }
      if (countries) {
        countries.forEach(function (c) {
          if (!c || !/^[A-Z]{2}$/.test(c.country)) return;
          var count = Number(c.users || 0);
          if (count <= 0) return;
          var name = c.country;
          try { name = (names && names.of(c.country)) || c.country; } catch (e) {}
          represented += count;
          addCountry(name, count);
        });
        if (represented < Number(s.online || 0)) addCountry("ไม่ทราบประเทศ", Number(s.online || 0) - represented);
        document.getElementById("live-note").textContent = "ประเทศนับจากอุปกรณ์ที่ออนไลน์ใน 15 นาทีล่าสุด";
      } else {
        document.getElementById("live-note").textContent = "ข้อมูลประเทศยังไม่พร้อม";
      }
      document.getElementById("live").hidden = false;
    }).catch(function () {});
  }
  loadLive();
  setInterval(loadLive, 60000);
  document.addEventListener("visibilitychange", loadLive);
  // Coming back to the tab`);
fs.writeFileSync(file, h);
console.log("ok");
