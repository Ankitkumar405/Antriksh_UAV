/* Shared small UI behaviors: boot screen, mobile nav toggle + toast messages. */

function initBootScreen() {
  try {
    if (sessionStorage.getItem("antriksh-boot-seen") === "1") return;
    sessionStorage.setItem("antriksh-boot-seen", "1");
  } catch (error) {
    // Continue normally if storage is unavailable in a restricted browser.
  }

  const screen = document.createElement("div");
  screen.className = "boot-screen";
  screen.setAttribute("role", "status");
  screen.setAttribute("aria-label", "Loading Antriksh Ground Control");
  screen.innerHTML = `
    <div class="boot-inner">
      <div class="boot-mark"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2 L20 20 L12 15.5 L4 20 Z" fill="#c9a36a"/></svg></div>
      <div class="boot-kicker">ANTRIKSH / GCS</div>
      <h1 class="boot-title">Establishing flight link</h1>
      <div class="boot-copy" id="bootMessage">Calibrating ground station...</div>
      <div class="boot-meter"><div class="boot-meter-fill" id="bootFill"></div></div>
      <div class="boot-readout"><span id="bootStage">SYSTEM CHECK</span><span id="bootPercent">00%</span></div>
      <button class="boot-enter" type="button" id="bootEnter">Enter ground control</button>
    </div>`;
  document.body.appendChild(screen);

  const fill = screen.querySelector("#bootFill");
  const percent = screen.querySelector("#bootPercent");
  const message = screen.querySelector("#bootMessage");
  const stage = screen.querySelector("#bootStage");
  const messages = ["Calibrating ground station...", "Checking telemetry channel...", "Loading mission systems...", "Flight console ready."];
  let progress = 0;
  let complete = false;

  const finish = () => {
    if (complete) return;
    complete = true;
    fill.style.width = "100%";
    percent.textContent = "100%";
    message.textContent = messages[3];
    stage.textContent = "LINK READY";
    setTimeout(() => screen.classList.add("done"), 160);
    setTimeout(() => screen.remove(), 900);
  };
  const tick = () => {
    if (complete) return;
    progress = Math.min(100, progress + Math.random() * 15 + 5);
    const value = Math.round(progress);
    fill.style.width = `${value}%`;
    percent.textContent = `${String(value).padStart(2, "0")}%`;
    const index = Math.min(messages.length - 2, Math.floor(value / 34));
    message.textContent = messages[index];
    stage.textContent = ["SYSTEM CHECK", "TELEMETRY LINK", "MISSION CORE"][index];
    if (progress >= 100) finish();
    else setTimeout(tick, 180);
  };
  screen.querySelector("#bootEnter").addEventListener("click", finish);
  screen.addEventListener("pointermove", (event) => {
    screen.style.setProperty("--boot-y", `${event.clientY}px`);
  });
  setTimeout(tick, 120);
}

document.addEventListener("DOMContentLoaded", () => {
  initBootScreen();
  const toggle = document.querySelector(".navtoggle");
  const links = document.querySelector(".navlinks");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
    links.querySelectorAll("a").forEach((a) =>
      a.addEventListener("click", () => links.classList.remove("open"))
    );
  }
});

function showToast(msg, ms = 2600) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), ms);
}
