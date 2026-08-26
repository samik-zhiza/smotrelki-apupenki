// marathon-detail.js

let marathonId = null;
let marathonData = null;
let allFilmsFromJSON = []; // будем хранить общий список фильмов

// Получить id из URL
const params = new URLSearchParams(window.location.search);
marathonId = params.get("id");
if (!marathonId) {
  document.querySelector(".marathon-detail").innerHTML =
    '<p style="color:red;">Марафон не найден</p>';
  throw new Error("No marathon id");
}

// Загрузить общий список фильмов из JSON
async function loadFilmsJSON() {
  const resp = await fetch("films.json");
  const data = await resp.json();
  allFilmsFromJSON = data;
  // для удобства создадим объект с ключами id
  window.filmsMap = {};
  data.forEach((f) => {
    window.filmsMap[f.id] = f;
  });
}

// Загрузить данные марафона и отрисовать
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

function renderMarathon(data) {
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

  // Рассчитать прогресс для текущего пользователя
  const user = firebase.auth().currentUser;
  let watchedCount = 0;
  const total = filmIds.length;

  // Создаём карточки фильмов
  let html = "";
  filmIds.forEach((filmId) => {
    const filmData = data.films[filmId];
    const filmInfo = window.filmsMap[filmId];
    if (!filmInfo) return; // если фильм не найден в базе

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

  // Навесить обработчики на кнопки отметки
  document.querySelectorAll(".watched-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const filmId = Number(btn.dataset.filmId);
      try {
        await toggleWatched(marathonId, filmId);
        // После успеха перезагрузить марафон
        await loadMarathon();
      } catch (err) {
        alert("Ошибка: " + err.message);
      }
    });
  });

  // Навесить обработчики на кнопки удаления фильма
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

// Добавление фильма по поиску
document.getElementById("add-film-btn").addEventListener("click", async () => {
  const query = document
    .getElementById("film-search")
    .value.trim()
    .toLowerCase();
  if (!query) return alert("Введите название фильма");
  // Ищем в allFilmsFromJSON
  const found = allFilmsFromJSON.find((f) =>
    f.title.toLowerCase().includes(query),
  );
  if (!found) {
    alert("Фильм не найден в базе. Попробуйте другое название.");
    return;
  }
  try {
    await addFilmToMarathon(marathonId, found.id);
    document.getElementById("film-search").value = "";
    await loadMarathon();
  } catch (err) {
    alert("Ошибка: " + err.message);
  }
});

// Удаление марафона
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

// Инициализация
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
