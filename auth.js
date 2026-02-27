// auth.js

let currentUser = null;

function initAuth() {
    firebase.auth().getRedirectResult().catch(error => {
        console.error('Ошибка редиректа:', error);
    });

    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            document.body.classList.add('user-logged-in');
            updateAuthButton(user);
            updateUserInfo(user);               // <-- добавить
            await loadUserData(user.uid);
        } else {
            currentUser = null;
            document.body.classList.remove('user-logged-in');
            updateAuthButton(null);
            updateUserInfo(null);                // <-- добавить
            clearUserData();
        }
    });
}

function updateAuthButton(user) {
    const btn = document.getElementById('auth-button');
    if (!btn) return;
    if (user) {
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Выйти';
    } else {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
    }
}

// Новая функция для отображения email
function updateUserInfo(user) {
    const span = document.getElementById('user-email');
    if (!span) return;
    if (user && user.email) {
      span.textContent = user.displayName || user.email; // сначала имя, если есть, иначе email
      span.style.display = 'inline-flex'; // показываем
    } else {
      span.style.display = 'none'; // скрываем
    }
  }

// Вход через Google (с выбором popup для localhost, иначе redirect)
function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal) {
        firebase.auth().signInWithPopup(provider)
            .then(result => console.log('Успешный вход через popup', result.user))
            .catch(error => {
                console.error('Ошибка входа через popup:', error);
                alert('Не удалось войти. Возможно, браузер блокирует всплывающие окна.');
            });
    } else {
        firebase.auth().signInWithRedirect(provider);
    }
}

// Выход
function signOut() {
    firebase.auth().signOut();
}

// ---------- Работа с данными пользователя в Firebase ----------

// Загружает данные пользователя (избранное, исключённые) и применяет их к глобальным переменным
async function loadUserData(uid) {
    const userRef = firebase.database().ref(`users/${uid}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val() || {};

    // Устанавливаем глобальные переменные (будут доступны в shared.js)
    window.userFavorites = userData.favorites || [];
    window.userExcluded = new Set(userData.excluded || []);

    // Обновляем глобальные переменные в shared.js (если они там определены)
    if (typeof excludedFilmIds !== 'undefined') {
        excludedFilmIds = window.userExcluded;
    }
    // Для избранного будем использовать window.userFavorites в getFavorites()
}

// Сохраняет избранное в Firebase
function saveFavoritesToFirebase(favoritesArray) {
    if (!currentUser) return;
    firebase.database().ref(`users/${currentUser.uid}/favorites`).set(favoritesArray);
    window.userFavorites = favoritesArray;
}

// Сохраняет исключённые фильмы в Firebase
function saveExcludedToFirebase(excludedArray) {
    if (!currentUser) return;
    firebase.database().ref(`users/${currentUser.uid}/excluded`).set(excludedArray);
    window.userExcluded = new Set(excludedArray);
}

// Сохраняет оценку фильма
function saveRatingToFirebase(filmId, ratingData) {
    if (!currentUser) return;
    firebase.database().ref(`users/${currentUser.uid}/ratings/${filmId}`).set(ratingData);
}

// Загружает оценку фильма (возвращает Promise с данными или null)
async function loadRatingFromFirebase(filmId) {
    if (!currentUser) return null;
    const snapshot = await firebase.database().ref(`users/${currentUser.uid}/ratings/${filmId}`).once('value');
    return snapshot.val();
}

// Очистка глобальных пользовательских данных при выходе
function clearUserData() {
    window.userFavorites = [];
    window.userExcluded = new Set();
    if (typeof excludedFilmIds !== 'undefined') {
        excludedFilmIds = new Set();
    }
}

// ---------- Обработчик клика по кнопке входа ----------
document.addEventListener('click', (e) => {
    if (e.target.closest('#auth-button')) {
        if (currentUser) {
            signOut();
        } else {
            signInWithGoogle();
        }
    }
});

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', initAuth);
