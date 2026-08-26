// marathon-detail.js

let marathonId = null;
let marathonData = null;
let allFilmsFromJSON = [];

// ---------- Получить id из URL ----------
const params = new URLSearchParams(window.location.search);
marathonId = params.get("id");
if (!marathonId) {
  document.querySelector(".marathon-detail").innerHTML =
    '<p style="color:red;">Марафон не найден</p>';
  throw new Error("No marathon id");
}

// ---------- Загрузить список фильмов из films.json ----------
async function loadFilmsJSON() {
  if (allFilmsFromJSON.length) return allFilmsFromJSON;
  try {
    const resp = await fetch("films.json");
    const data = await resp.json();
    allFilmsFromJSON = data;
    // Для удобства создаём карту по id
    window.filmsMap = {};
    data.forEach((f) => {
      window.filmsMap[f.id] = f;
    });
    return data;
  } catch (e) {
    console.error("Ошибка загрузки films.json:", e);
    return [];
  }
}

// ---------- Загрузить данные марафона и отрисовать ----------
async function loadMarathon() {
  try {
    const data = await getMarathon(marathonId);
    if (!data) {
      document.querySelector(".marathon-detail").innerHTML =
        '<p style="color:red;">Марафон не найден</p>';
      return;
    }
    marathonData = data;
    renderMarathon(data);
  } catch (e) {
    console.error(e);
    document.querySelector(".marathon-detail").innerHTML =
      '<p style="color:red;">Ошибка загрузки марафона</p>';
  }
}

// ---------- Отрисовка марафона ----------
function renderMarathon(data) {
  // Обложка
  const coverContainer = document.querySelector(".marathon-cover");
  if (coverContainer) {
    if (data.coverUrl) {
      coverContainer.innerHTML = `<img src="${data.coverUrl}" alt="Обложка марафона" style="width:100%; max-height:300px; object-fit:cover; border-radius:12px;">`;
    } else {
      coverContainer.innerHTML = "";
    }
  }

  // Заголовок и описание
  document.getElementById("marathon-title").textContent = data.name;
  document.getElementById("marathon-desc").textContent = data.description || "";

  // Фильмы
  const container = document.getElementById("marathon-films");
  const filmIds = Object.keys(data.films || {});
  if (filmIds.length === 0) {
    container.innerHTML =
      '<p style="text-align:center;color:#94a3b8;">В этом марафоне пока нет фильмов</p>';
    document.getElementById("marathon-progress").textContent = "0%";
    return;
  }

  const user = firebase.auth().currentUser;
  let watchedCount = 0;
  const total = filmIds.length;

  let html = "";
  filmIds.forEach((filmId) => {
    const filmData = data.films[filmId];
    const filmInfo = window.filmsMap[filmId];
    if (!filmInfo) {
      // Если фильм не найден в базе – пропускаем или показываем заглушку
      return;
    }

    const isWatched =
      user && filmData.watchedBy && filmData.watchedBy[user.uid] === true;
    if (isWatched) watchedCount++;

    html += `
      <div class="film-card" data-film-id="${filmId}" style="position:relative;">
        <div class="film-poster">
          ${filmInfo.poster ? `<img src="${filmInfo.poster}" alt="${escapeHtml(filmInfo.title)}">` : '<div class="poster-placeholder"><i class="fas fa-film"></i></div>'}
        </div>
        <div class="film-info">
          <h3 class="film-title">${escapeHtml(filmInfo.title)} (${filmInfo.year})</h3>
          <div style="display:flex; gap:5px; flex-wrap:wrap; margin:5px 0;">
            ${filmInfo.genres.map((g) => `<span class="film-genre">${escapeHtml(g)}</span>`).join("")}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
            <span style="font-size:0.9rem; color:#64748b;">Добавил: ${filmData.addedBy}</span>
            <button class="watched-btn filter-btn" data-film-id="${filmId}" style="background:${isWatched ? "#22c55e" : "#94a3b8"}; padding:5px 12px; font-size:0.8rem;">
              ${isWatched ? "✅ Просмотрено" : "☐ Отметить"}
            </button>
          </div>
          <button class="remove-film-btn" data-film-id="${filmId}" style="background:none; border:none; color:#ef4444; cursor:pointer; position:absolute; top:5px; right:5px; font-size:1.2rem;" title="Удалить фильм">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Прогресс
  const progress = total > 0 ? Math.round((watchedCount / total) * 100) : 0;
  document.getElementById("marathon-progress").textContent = progress + "%";

  // Обработчики на кнопки отметки просмотра
  document.querySelectorAll(".watched-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const filmId = Number(btn.dataset.filmId);
      try {
        await toggleWatched(marathonId, filmId);
        await loadMarathon(); // перезагрузить данные
      } catch (err) {
        alert("Ошибка: " + err.message);
      }
    });
  });

  // Обработчики на кнопки удаления фильма
  document.querySelectorAll(".remove-film-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const filmId = Number(btn.dataset.filmId);
      if (!confirm("Удалить фильм из марафона?")) return;
      try {
        await removeFilmFromMarathon(marathonId, filmId);
        await loadMarathon();
      } catch (err) {
        alert("Ошибка: " + err.message);
      }
    });
  });
}

// ---------- Автокомплит при поиске фильмов (для добавления) ----------
const filmSearchInput = document.getElementById("film-search");
const suggestionsContainer = document.getElementById("marathon-suggestions");

filmSearchInput.addEventListener("input", function () {
  const query = this.value.trim().toLowerCase();
  if (!query || !marathonData) {
    suggestionsContainer.style.display = "none";
    return;
  }
  // Фильмы уже есть в марафоне
  const existingIds = Object.keys(marathonData.films || {}).map(Number);
  const matches = allFilmsFromJSON.filter(
    (f) => f.title.toLowerCase().includes(query) && !existingIds.includes(f.id),
  );
  if (matches.length === 0) {
    suggestionsContainer.innerHTML =
      '<div style="padding:10px; color:#94a3b8;">Нет совпадений</div>';
    suggestionsContainer.style.display = "block";
    return;
  }
  suggestionsContainer.innerHTML = matches
    .map(
      (f) => `
    <div class="suggestion-item" data-id="${f.id}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9;">
      ${f.poster ? `<img src="${f.poster}" style="width:40px; height:60px; object-fit:cover; border-radius:4px;">` : `<div style="width:40px; height:60px; background:#e2e8f0; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#94a3b8; font-size:0.7rem;">Нет</div>`}
      <div>
        <div style="font-weight:600;">${escapeHtml(f.title)}</div>
        <div style="font-size:0.85rem; color:#64748b;">${f.year}</div>
      </div>
    </div>
  `,
    )
    .join("");
  suggestionsContainer.style.display = "block";

  document
    .querySelectorAll("#marathon-suggestions .suggestion-item")
    .forEach((el) => {
      el.addEventListener("click", function () {
        const id = Number(this.dataset.id);
        const film = allFilmsFromJSON.find((f) => f.id === id);
        if (film && !existingIds.includes(id)) {
          addFilmToMarathon(marathonId, id)
            .then(() => {
              loadMarathon();
              filmSearchInput.value = "";
              suggestionsContainer.style.display = "none";
            })
            .catch((err) => alert("Ошибка: " + err.message));
        }
      });
    });
});

// Скрывать подсказки при потере фокуса
filmSearchInput.addEventListener("blur", function () {
  setTimeout(() => {
    suggestionsContainer.style.display = "none";
  }, 200);
});

// Enter в поле поиска – выбрать первый вариант
filmSearchInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    const firstSuggestion = document.querySelector(
      "#marathon-suggestions .suggestion-item",
    );
    if (firstSuggestion) {
      firstSuggestion.click();
    }
  }
});

// Кнопка "Добавить" – если есть подсказки, кликаем по первой, иначе ищем по тексту
document.getElementById("add-film-btn").addEventListener("click", function () {
  const firstSuggestion = document.querySelector(
    "#marathon-suggestions .suggestion-item",
  );
  if (firstSuggestion) {
    firstSuggestion.click();
    return;
  }
  // Если подсказок нет, ищем по тексту (старый вариант)
  const query = filmSearchInput.value.trim();
  if (!query) return alert("Введите название");
  const found = allFilmsFromJSON.find((f) =>
    f.title.toLowerCase().includes(query.toLowerCase()),
  );
  if (!found) {
    alert("Фильм не найден");
    return;
  }
  const existingIds = Object.keys(marathonData?.films || {}).map(Number);
  if (existingIds.includes(found.id)) {
    alert("Фильм уже в марафоне");
    return;
  }
  addFilmToMarathon(marathonId, found.id)
    .then(() => {
      loadMarathon();
      filmSearchInput.value = "";
    })
    .catch((err) => alert("Ошибка: " + err.message));
});

// ---------- Удаление марафона ----------
document
  .getElementById("delete-marathon")
  .addEventListener("click", async () => {
    if (!confirm("Удалить марафон безвозвратно?")) return;
    try {
      await deleteMarathon(marathonId);
      alert("Марафон удалён");
      window.location.href = "marathons.html";
    } catch (err) {
      alert("Ошибка: " + err.message);
    }
  });

// ---------- Инициализация ----------
async function init() {
  await loadFilmsJSON();
  await loadMarathon();
  // Подписка на обновления в реальном времени
  firebase
    .database()
    .ref(`marathons/${marathonId}`)
    .on("value", () => {
      loadMarathon();
    });
}

init();
