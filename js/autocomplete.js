/* ============================================================
   ADDRESS AUTOCOMPLETE
   Attaches a type-ahead dropdown to any text input. Suggestions
   merge two sources:
     1. Named site locations (depots/drop points) — instant, local
     2. Free-text places via OpenStreetMap Nominatim — debounced

   Usage:
     attachAutocomplete(inputEl, (place) => { ... place.lat/lng/label });
   ============================================================ */

function attachAutocomplete(inputEl, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-wrap";
  inputEl.parentNode.insertBefore(wrap, inputEl);
  wrap.appendChild(inputEl);

  const list = document.createElement("div");
  list.className = "ac-list";
  wrap.appendChild(list);

  let items = [];
  let activeIndex = -1;
  let debounceHandle = null;
  let lastQuery = "";

  function localMatches(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return Object.entries(LOCATION_REGISTRY)
      .filter(([code, loc]) => code.toLowerCase().includes(q) || loc.label.toLowerCase().includes(q))
      .map(([code, loc]) => ({ lat: loc.lat, lng: loc.lng, label: loc.label, code, source: "site" }));
  }

  async function remoteMatches(query) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&addressdetails=1&q=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      return (data || []).map((d) => ({
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        label: d.display_name,
        source: "osm",
      }));
    } catch (e) {
      return [];
    }
  }

  function render() {
    list.innerHTML = "";
    if (!items.length) { list.classList.remove("open"); return; }
    items.forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "ac-item" + (i === activeIndex ? " active" : "");
      row.innerHTML = `
        <span class="ac-icon">${item.source === "site" ? "&#9679;" : "&#128205;"}</span>
        <span class="ac-text">
          <span class="ac-label">${item.code ? item.code + " — " : ""}${escapeHtml(item.label)}</span>
        </span>`;
      row.addEventListener("mousedown", (e) => { e.preventDefault(); select(item); });
      list.appendChild(row);
    });
    list.classList.add("open");
  }

  function select(item) {
    inputEl.value = item.code ? item.code + " — " + item.label : item.label;
    inputEl.dataset.lat = item.lat;
    inputEl.dataset.lng = item.lng;
    items = [];
    render();
    onSelect(item);
  }

  inputEl.addEventListener("input", () => {
    delete inputEl.dataset.lat;
    delete inputEl.dataset.lng;
    const q = inputEl.value;
    lastQuery = q;
    clearTimeout(debounceHandle);

    const local = localMatches(q);
    items = local;
    activeIndex = -1;
    render();

    if (q.trim().length < 3) return;
    debounceHandle = setTimeout(async () => {
      const remote = await remoteMatches(q);
      if (lastQuery !== q) return; // stale response, input changed since
      items = [...local, ...remote].slice(0, 8);
      render();
    }, 380);
  });

  inputEl.addEventListener("keydown", (e) => {
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, items.length - 1); render(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); render(); }
    else if (e.key === "Enter") { if (activeIndex >= 0) { e.preventDefault(); select(items[activeIndex]); } }
    else if (e.key === "Escape") { items = []; render(); }
  });

  inputEl.addEventListener("blur", () => setTimeout(() => { items = []; render(); }, 150));

  return {
    /** Returns {lat,lng,label} if the current value was selected from the list, else null. */
    getSelected() {
      if (inputEl.dataset.lat) return { lat: parseFloat(inputEl.dataset.lat), lng: parseFloat(inputEl.dataset.lng), label: inputEl.value };
      return null;
    },
  };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
