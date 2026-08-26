// marathons.js

const marathonsList = document.getElementById("marathons-list");
const createBtn = document.getElementById("create-marathon-btn");
const modal = document.getElementById("create-modal");

// Показать модальное окно
createBtn.addEventListener("click", () => {
  if (!firebase.auth().currentUser) {
    alert("Войдите в аккаунт, чтобы создать марафон");
    return;
  }
  modal.style.display = "flex";
});

// Скрыть модалку
document.getElementById("modal-cancel").addEventListener("click", () => {
  modal.style.display = "none";
});

// Создание марафона
document.getElementById("modal-submit").addEventListener("click", async () => {
  const name = document.getElementById("marathon-name").value.trim();
  const desc = document.getElementById("marathon-desc").value.trim();
  if (!name) return alert("Введите название");
  const isEditable = document.getElementById("editable-all").checked;
  const canMark = document.getElementById("mark-all").checked;
  try {
    const id = await createMarathon(name, desc, isEditable, canMark);
    modal.style.display = "none";
    // Очистить поля
    document.getElementById("marathon-name").value = "";
    document.getElementById("marathon-desc").value = "";
    alert("Марафон создан!");
    loadMarathons();
  } catch (e) {
    alert("Ошибка: " + e.message);
  }
});

// Загрузка списка марафонов
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
        <div class="film-card" style="padding:20px;">
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

// Подписка на изменения марафонов (обновление в реальном времени)
firebase
  .database()
  .ref("marathons")
  .on("value", () => {
    loadMarathons();
  });

loadMarathons();
