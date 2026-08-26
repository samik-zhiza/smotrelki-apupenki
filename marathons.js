// marathons.js

// ---------- Глобальные переменные ----------
const marathonsList = document.getElementById("marathons-list");
const createBtn = document.getElementById("create-marathon-btn");
const modal = document.getElementById("create-modal");

let selectedFilms = []; // выбранные фильмы при создании
let allFilmsFromJSON = []; // загруженный список фильмов из films.json

// ---------- Загрузка списка фильмов из JSON ----------
async function loadFilmsJSON() {
  if (allFilmsFromJSON.length) return allFilmsFromJSON;
  try {
    const resp = await fetch("films.json");
    const data = await resp.json();
    allFilmsFromJSON = data;
    return data;
  } catch (e) {
    console.error("Ошибка загрузки films.json:", e);
    return [];
  }
}

// ---------- Отображение выбранных фильмов ----------
function renderSelectedFilms() {
  const container = document.getElementById("marathon-selected-films");
  if (!container) return;
  if (selectedFilms.length === 0) {
    container.innerHTML =
      '<span style="color:#94a3b8; font-size:0.9rem;">Нет выбранных фильмов</span>';
    return;
  }
  container.innerHTML = selectedFilms
    .map(
      (f) => `
    <span style="background:#f1f5f9; padding:4px 10px; border-radius:20px; display:inline-flex; align-items:center; gap:5px;">
      ${escapeHtml(f.title)} (${f.year})
      <span class="remove-selected" data-id="${f.id}" style="cursor:pointer; color:#ef4444; font-weight:bold;">&times;</span>
    </span>
  `,
    )
    .join("");
  // Обработчики удаления из выбранных
  document.querySelectorAll(".remove-selected").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = Number(el.dataset.id);
      selectedFilms = selectedFilms.filter((f) => f.id !== id);
      renderSelectedFilms();
    });
  });
}

// ---------- Загрузка и отображение списка марафонов ----------
async function loadMarathons() {
  try {
    const marathons = await getMarathons();
    if (marathons.length === 0) {
      marathonsList.innerHTML =
        '<p style="text-align:center;color:#64748b;">Нет марафонов. Создайте первый!</p>';
      return;
    }
    marathonsList.innerHTML = marathons
      .map(
        (m) => `
      <a href="marathon.html?id=${m.id}" class="film-card-link" style="text-decoration:none; color:inherit;">
        <div class="film-card" style="padding:20px; position:relative;">
          ${m.coverUrl ? `<div style="height:120px; background-image:url('${escapeHtml(m.coverUrl)}'); background-size:cover; background-position:center; border-radius:8px; margin-bottom:10px;"></div>` : ""}
          <h3 style="margin-top:0;">${escapeHtml(m.name)}</h3>
          <p style="color:#64748b;">${escapeHtml(m.description || "")}</p>
          <p style="color:#94a3b8; font-size:0.9rem;">Фильмов: ${Object.keys(m.films || {}).length}</p>
          <p style="color:#94a3b8; font-size:0.9rem;">Создатель: ${m.createdBy}</p>
        </div>
      </a>
    `,
      )
      .join("");
  } catch (e) {
    console.error(e);
    marathonsList.innerHTML =
      '<p style="color:red;">Ошибка загрузки марафонов</p>';
  }
}

// ---------- Показать модальное окно ----------
createBtn.addEventListener("click", async () => {
  if (!firebase.auth().currentUser) {
    alert("Войдите в аккаунт, чтобы создать марафон");
    return;
  }
  await loadFilmsJSON(); // подгрузить фильмы
  modal.style.display = "flex";
  // Очищаем форму
  document.getElementById("marathon-name").value = "";
  document.getElementById("marathon-cover").value = "";
  document.getElementById("marathon-desc").value = "";
  document.getElementById("editable-all").checked = true;
  document.getElementById("mark-all").checked = true;
  selectedFilms = [];
  renderSelectedFilms();
  document.getElementById("marathon-film-search").value = "";
  // Скрываем подсказки
  const suggestions = document.getElementById("suggestions-list");
  if (suggestions) suggestions.style.display = "none";
});

// ---------- Закрыть модальное окно ----------
document.getElementById("modal-cancel").addEventListener("click", () => {
  modal.style.display = "none";
});

// ---------- Автокомплит при поиске фильмов ----------
const searchInput = document.getElementById("marathon-film-search");
const suggestionsContainer = document.getElementById("suggestions-list");

searchInput.addEventListener("input", function () {
  const query = this.value.trim().toLowerCase();
  if (!query) {
    suggestionsContainer.style.display = "none";
    return;
  }
  const matches = allFilmsFromJSON.filter(
    (f) =>
      f.title.toLowerCase().includes(query) &&
      !selectedFilms.some((s) => s.id === f.id),
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
    <div class="suggestion-item" data-id="${f.id}" style="display:flex; align-items:center; gap:10px; padding:8px 12px; cursor:pointer; border-bottom:1px solid #f1f5f9; transition:background 0.15s;">
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

  // Навешиваем обработчики на каждый вариант
  document.querySelectorAll(".suggestion-item").forEach((el) => {
    el.addEventListener("click", function () {
      const id = Number(this.dataset.id);
      const film = allFilmsFromJSON.find((f) => f.id === id);
      if (film && !selectedFilms.some((s) => s.id === id)) {
        selectedFilms.push({ id: film.id, title: film.title, year: film.year });
        renderSelectedFilms();
        searchInput.value = "";
        suggestionsContainer.style.display = "none";
      }
    });
  });
});

// Скрывать подсказки при потере фокуса (с задержкой)
searchInput.addEventListener("blur", function () {
  setTimeout(() => {
    suggestionsContainer.style.display = "none";
  }, 200);
});

// Enter в поле поиска – выбрать первый вариант
searchInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    const firstSuggestion = document.querySelector(".suggestion-item");
    if (firstSuggestion) {
      firstSuggestion.click();
    }
  }
});

// Кнопка "+" – очищает поле и скрывает подсказки (автокомплит уже сам работает)
document
  .getElementById("marathon-add-film-btn")
  .addEventListener("click", function () {
    searchInput.value = "";
    suggestionsContainer.style.display = "none";
  });

// Закрытие подсказок при клике вне поля
document.addEventListener("click", function (e) {
  if (
    !e.target.closest("#marathon-film-search") &&
    !e.target.closest("#suggestions-list")
  ) {
    suggestionsContainer.style.display = "none";
  }
});

// ---------- Создание марафона ----------
document.getElementById("modal-submit").addEventListener("click", async () => {
  const name = document.getElementById("marathon-name").value.trim();
  const desc = document.getElementById("marathon-desc").value.trim();
  const coverUrl = document.getElementById("marathon-cover").value.trim();
  if (!name) return alert("Введите название");

  const isEditable = document.getElementById("editable-all").checked;
  const canMark = document.getElementById("mark-all").checked;

  try {
    // 1. Создаём марафон
    const id = await createMarathon(name, desc, isEditable, canMark, coverUrl);
    // 2. Добавляем выбранные фильмы
    for (const film of selectedFilms) {
      await addFilmToMarathon(id, film.id);
    }
    modal.style.display = "none";
    // Очищаем форму
    document.getElementById("marathon-name").value = "";
    document.getElementById("marathon-cover").value = "";
    document.getElementById("marathon-desc").value = "";
    selectedFilms = [];
    renderSelectedFilms();
    alert("Марафон создан!");
    loadMarathons(); // обновить список
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
});

// ---------- Реальное время – обновление списка при изменениях в Firebase ----------
firebase
  .database()
  .ref("marathons")
  .on("value", () => {
    loadMarathons();
  });

// ---------- Загрузка списка марафонов при старте ----------
loadMarathons();
