// Installer UI: welcome -> installing (the orbit draws as progress) -> done.
const $ = (id) => document.getElementById(id);
const api = window.installer;
const body = document.body;
const progressPath = document.querySelector(".orbit-progress");
const star = document.querySelector(".orbit-star");
const STEPS = ["copy", "shortcuts", "register"];
let info = null;
let target = "";
let installedExe = "";

const mb = (bytes) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`);
const setState = (state) => (body.dataset.state = state);

/** Draw the orbit up to `fraction` and park the star at its tip. */
function setOrbit(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  progressPath.style.setProperty("--offset", String(1000 - f * 1000));
  try {
    const total = progressPath.getTotalLength();
    const p = progressPath.getPointAtLength(total * f);
    star.setAttribute("transform", `translate(${p.x} ${p.y})`);
  } catch {}
}

function showLocation(dir) {
  target = dir;
  $("location").textContent = dir;
  $("location").title = dir;
}

async function load() {
  try {
    info = await api.info();
    showLocation(info.dir);
    $("meta").textContent = `เวอร์ชัน ${info.version} · ใช้พื้นที่ ${mb(info.required)}${info.free ? ` · ว่าง ${mb(info.free)}` : ""}`;
    if (info.existing) {
      $("install-label").textContent = "อัปเดตเป็นเวอร์ชันนี้";
      $("welcome-title").innerHTML = "ติดตั้งทับ<br />เวอร์ชันเดิม";
    }
    if (info.free && info.free < info.required * 1.1) $("meta").textContent += " · พื้นที่ไม่พอ";
  } catch (error) {
    fail(error);
  }
}

function markSteps(current) {
  const index = STEPS.indexOf(current);
  document.querySelectorAll(".steps li").forEach((li) => {
    const i = STEPS.indexOf(li.dataset.step);
    li.classList.toggle("done", current === "done" || i < index);
    li.classList.toggle("active", i === index);
  });
}

api.onProgress((p) => {
  if (p.step === "copy" && p.total) {
    // Copying is most of the work: map it to 0-92 %, the last steps fill the rest.
    const pct = Math.floor((p.done / p.total) * 92);
    $("percent").textContent = String(pct);
    setOrbit(pct / 100);
  }
  if (p.step === "shortcuts") { $("percent").textContent = "95"; setOrbit(0.95); }
  if (p.step === "register") { $("percent").textContent = "98"; setOrbit(0.98); }
  if (p.step === "done") { $("percent").textContent = "100"; setOrbit(1); }
  if (p.dir) $("target").textContent = p.dir;
  markSteps(p.step === "prepare" ? "copy" : p.step);
});

function fail(error) {
  const message = String(error?.message || error).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
  $("error").textContent = message;
  setState("error");
}

$("change").addEventListener("click", async () => {
  const dir = await api.pick(target);
  if (dir) showLocation(dir);
});

$("install").addEventListener("click", async () => {
  $("install").disabled = true;
  setOrbit(0);
  markSteps("copy");
  $("percent").textContent = "0";
  setState("installing");
  try {
    const result = await api.install({ dir: target, desktop: $("desktop").checked });
    installedExe = result.exe;
    $("done-version").textContent = info ? `v${info.version}` : "";
    $("done-desktop").hidden = !$("desktop").checked;
    setTimeout(() => {
      setState("done");
      if ($("launch").checked) setTimeout(() => void api.launch(installedExe), 1600);
    }, 500);
  } catch (error) {
    fail(error);
  } finally {
    $("install").disabled = false;
  }
});

$("open").addEventListener("click", () => void api.launch(installedExe));
$("finish").addEventListener("click", () => void api.window("close"));
$("retry").addEventListener("click", () => setState("welcome"));
document.querySelectorAll("[data-window]").forEach((button) =>
  button.addEventListener("click", () => void api.window(button.dataset.window)),
);

setOrbit(0);
void load();
