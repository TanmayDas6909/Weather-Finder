const form = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const chipsEl = document.getElementById("chips");
const matchesEl = document.getElementById("matches");
const locBtn = document.getElementById("locBtn");
const unitBtns = document.querySelectorAll(".unit");

let unit = "C";
let lastView = null;

const weatherCodes = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains", 
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers", 85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail"
};

function getIcon(code, isDay = 1) {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 2) return isDay ? "⛅" : "☁️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 51 && code <= 67) return "🌧️";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "❄️";
  if (code >= 80 && code <= 82) return "🌦️";
  if (code >= 95) return "⛈️";
  return "🌡️";
}

function getTheme(code, isDay) {
  if (code >= 95) return "theme-storm";
  if (!isDay) return "theme-night";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "theme-snow";
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "theme-rainy";
  if (code >= 2) return "theme-cloudy";
  return "theme-sunny";
}

function effectFor(code) {
  if (code >= 95 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  return "none";
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = "status " + type;
}

/* ---------- Rain / snow animation ---------- */
const canvas = document.getElementById("fx");
const ctx = canvas.getContext("2d");
let fxMode = "none";
let fxColor = "255,255,255";
let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

function makeParticle(randomY) {
  const x = Math.random() * canvas.width;
  const y = randomY ? Math.random() * canvas.height : -20;
  if (fxMode === "rain") return { x, y, len: 12 + Math.random() * 12, v: 14 + Math.random() * 8 };
  return { x, y, r: 1.5 + Math.random() * 2.5, v: 0.8 + Math.random() * 1.8, a: Math.random() * 6.28 };
}

function setEffect(mode, color) {
  fxMode = mode;
  fxColor = color;
  const count = mode === "rain" ? 160 : mode === "snow" ? 100 : 0;
  particles = Array.from({ length: count }, () => makeParticle(true));
}

function animate() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (fxMode === "rain") {
    ctx.strokeStyle = `rgba(${fxColor},0.45)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const p of particles) {
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - 2, p.y + p.len);
      p.y += p.v;
      p.x -= 0.8;
      if (p.y > canvas.height) Object.assign(p, makeParticle(false));
    }
    ctx.stroke();
  } else if (fxMode === "snow") {
    ctx.fillStyle = `rgba(${fxColor},0.85)`;
    for (const p of particles) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fill();
      p.y += p.v;
      p.a += 0.02;
      p.x += Math.sin(p.a) * 0.6;
      if (p.y > canvas.height) Object.assign(p, makeParticle(false));
    }
  }
  requestAnimationFrame(animate);
}
animate();

/* ---------- Recent searches + unit ---------- */
function getRecent() {
  try { return JSON.parse(localStorage.getItem("recentCities")) || []; }
  catch (e) { return []; }
}

function saveRecent(name) {
  let list = getRecent().filter((n) => n.toLowerCase() !== name.toLowerCase());
  list.unshift(name);
  list = list.slice(0, 5);
  try { localStorage.setItem("recentCities", JSON.stringify(list)); } catch (e) {}
  renderRecent();
}

function renderRecent() {
  chipsEl.innerHTML = "";
  const list = getRecent();
  if (list.length === 0) return;

  const label = document.createElement("span");
  label.className = "chips-label";
  label.textContent = "Recent";
  chipsEl.appendChild(label);

  list.forEach((city) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = city;
    btn.addEventListener("click", () => {
      cityInput.value = city;
      searchCity(city);
    });
    chipsEl.appendChild(btn);
  });
}

function updateUnitButtons() {
  unitBtns.forEach((b) => b.classList.toggle("active", b.dataset.unit === unit));
}

try {
  const saved = localStorage.getItem("unit");
  if (saved === "C" || saved === "F") unit = saved;
} catch (e) {}
updateUnitButtons();
renderRecent();

unitBtns.forEach((b) => {
  b.addEventListener("click", () => {
    unit = b.dataset.unit;
    try { localStorage.setItem("unit", unit); } catch (e) {}
    updateUnitButtons();
    render();
  });
});

 async function loadWeather(name, country, lat, lon) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code,is_day,pressure_msl` +
    `&hourly=temperature_2m,weather_code` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max` +
    `&forecast_days=5&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Weather request failed");
  const data = await res.json();
  lastView = { name, country, data };
  render();
}

async function findPlaces(query) {
  // 1) OpenStreetMap: gram, shohor, area, jekono jayga
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
      `&format=jsonv2&addressdetails=1&limit=6&accept-language=en`;
    const res = await fetch(url);
    if (res.ok) {
      const list = await res.json();
      if (list.length > 0) {
        const seen = new Set();
        return list
          .map((r) => {
            const a = r.address || {};
            const name = r.name || r.display_name.split(",")[0];
            const area = a.state || a.state_district || a.county || "";
            return {
              label: area && area !== name ? `${name}, ${area}` : name,
              country: a.country || "",
              lat: parseFloat(r.lat),
              lon: parseFloat(r.lon)
            };
          })
          .filter((p) => {
            const key = p.label + "|" + p.country;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
      }
    }
  } catch (e) {
    console.warn("OpenStreetMap search failed, trying fallback", e);
  }

  // 2) Fallback: Open-Meteo geocoding
  const fbUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.split(",")[0].trim())}&count=5`;
  const fbRes = await fetch(fbUrl);
  if (!fbRes.ok) throw new Error("Geocoding failed");
  const data = await fbRes.json();
  return (data.results || []).map((r) => ({
    label: r.admin1 && r.admin1 !== r.name ? `${r.name}, ${r.admin1}` : r.name,
    country: r.country || "",
    lat: r.latitude,
    lon: r.longitude
  }));
}

function showPlace(p) {
  return loadWeather(p.label, p.country, p.lat, p.lon);
}

function renderMatches(list) {
  matchesEl.innerHTML = "";
  if (list.length === 0) return;

  const label = document.createElement("span");
  label.className = "chips-label";
  label.textContent = "Other matches";
  matchesEl.appendChild(label);

  list.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = p.country ? `${p.label}, ${p.country}` : p.label;
    btn.addEventListener("click", async () => {
      setStatus("Loading weather data...", "loading");
      try {
        await showPlace(p);
        setStatus("");
      } catch (error) {
        console.error(error);
        setStatus("Network or API error. Please try again.", "error");
      }
    });
    matchesEl.appendChild(btn);
  });
}

async function searchCity(city) {
  setStatus("Loading weather data...", "loading");
  resultEl.classList.add("hidden");
  matchesEl.innerHTML = "";

  try {
    const places = await findPlaces(city);

    if (places.length === 0) {
      setStatus(`"${city}" not found. Check the spelling.`, "error");
      return;
    }

    await showPlace(places[0]);
    saveRecent(city);
    renderMatches(places.slice(1));
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Network or API error. Please try again.", "error");
  }
}

function useMyLocation() {
  if (!navigator.geolocation) {
    setStatus("Your browser does not support location.", "error");
    return;
  }
  setStatus("Getting your location...", "loading");
  resultEl.classList.add("hidden");

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      let name = "Your location";
      let country = "";

      try {
        const r = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
        );
        if (r.ok) {
          const g = await r.json();
          name = g.city || g.locality || name;
          country = g.countryName || "";
        }
      } catch (e) { /* fallback name is fine */ }

      try {
        await loadWeather(name, country, latitude, longitude);
        setStatus("");
      } catch (error) {
        console.error(error);
        setStatus("Network or API error. Please try again.", "error");
      }
    },
    () => setStatus("Location permission denied. Search a city instead.", "error"),
    { timeout: 10000 }
  );
}

function uvLabel(uv) {
  if (uv < 3) return "Low";
  if (uv < 6) return "Moderate";
  if (uv < 8) return "High";
  if (uv < 11) return "Very high";
  return "Extreme";
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function render() {
  if (!lastView) return;
  const { name, country, data } = lastView;
  const c = data.current;
  const d = data.daily;

  const tmp = (v) => Math.round(unit === "F" ? (v * 9) / 5 + 32 : v);
  const desc = weatherCodes[c.weather_code] || "Unknown";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const theme = getTheme(c.weather_code, c.is_day);
  document.body.className = theme;
  setEffect(effectFor(c.weather_code), theme === "theme-snow" ? "70,110,200" : "255,255,255");

  const nowKey = c.time.slice(0, 13);
  let start = data.hourly.time.findIndex((t) => t.slice(0, 13) === nowKey);
  if (start < 0) start = 0;
  const hours = data.hourly.time
    .slice(start, start + 24)
    .map((t, i) => {
      const idx = start + i;
      const h = new Date(t).getHours();
      const label = i === 0 ? "Now" : new Date(t).toLocaleTimeString("en-US", { hour: "numeric" });
      return `
        <div class="hour">
          <span>${label}</span>
          <span class="ico">${getIcon(data.hourly.weather_code[idx], h >= 6 && h < 18 ? 1 : 0)}</span>
          <b>${tmp(data.hourly.temperature_2m[idx])}°</b>
        </div>`;
    })
    .join("");

  const days = d.time
    .map((t, i) => {
      const day = new Date(t + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" });
      return `
        <div class="day">
          <span class="name">${i === 0 ? "Today" : day}</span>
          <span class="ico">${getIcon(d.weather_code[i])}</span>
          <span class="range">${tmp(d.temperature_2m_max[i])}° <small>${tmp(d.temperature_2m_min[i])}°</small></span>
        </div>`;
    })
    .join("");

  const uv = Math.round(d.uv_index_max[0]);

  resultEl.innerHTML = `
    <div class="now">
      <div class="place">${name}${country ? ", " + country : ""}</div>
      <div class="date">${today}</div>
      <div class="icon">${getIcon(c.weather_code, c.is_day)}</div>
      <div class="temp">${tmp(c.temperature_2m)}<sup>°${unit}</sup></div>
      <div class="desc">${desc}</div>
    </div>
    <div class="side">
      <div class="details">
        <div>Feels like<b>${tmp(c.apparent_temperature)}°${unit}</b></div>
        <div>Humidity<b>${c.relative_humidity_2m}%</b></div>
        <div>Wind<b>${c.wind_speed_10m} km/h</b></div>
      </div>
      <div class="hourly">
        <h3>Hourly forecast</h3>
        <div class="hours">${hours}</div>
      </div>
      <div class="extras">
        <div>Sunrise<b>${fmtTime(d.sunrise[0])}</b></div>
        <div>Sunset<b>${fmtTime(d.sunset[0])}</b></div>
        <div>UV index<b>${uv} ${uvLabel(uv)}</b></div>
        <div>Pressure<b>${Math.round(c.pressure_msl)} hPa</b></div>
      </div>
      <div class="forecast">
        <h3>5-day forecast</h3>
        ${days}
      </div>
    </div>`;
  resultEl.classList.remove("hidden");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const city = cityInput.value.trim();

  if (city === "") {
    setStatus("Please enter a city name.", "error");
    resultEl.classList.add("hidden");
    return;
  }
  searchCity(city);
});
locBtn.addEventListener("click", useMyLocation);