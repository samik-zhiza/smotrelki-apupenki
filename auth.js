// auth.js
let currentUser = null;

function initAuth() {
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      currentUser = user;
      document.body.classList.add('user-logged-in');
      updateAuthButton(user);
      loadUserData(user.uid);
    } else {
      currentUser = null;
      document.body.classList.remove('user-logged-in');
      updateAuthButton(null);
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

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider)
    .catch(error => console.error('Ошибка входа:', error));
}

function signOut() {
  firebase.auth().signOut();
}

// Загрузить данные пользователя из базы (пока заглушка)
function loadUserData(uid) {
  console.log('Загрузка данных для пользователя', uid);
  // Здесь будем подгружать оценки и избранное
}

// Обработчик клика по кнопке входа/выхода
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
