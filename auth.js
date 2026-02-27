// auth.js
let currentUser = null;

function initAuth() {
  // Обработка редиректа (если возвращаемся после входа)
  firebase.auth().getRedirectResult().catch(error => {
    console.error('Ошибка при редиректе:', error);
  });

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
  firebase.auth().signInWithRedirect(provider);
}

function signOut() {
  firebase.auth().signOut();
}

function loadUserData(uid) {
  console.log('Загрузка данных для пользователя', uid);
  // TODO: загружать оценки и избранное из Firebase
}

document.addEventListener('click', (e) => {
  if (e.target.closest('#auth-button')) {
    if (currentUser) {
      signOut();
    } else {
      signInWithGoogle();
    }
  }
});

document.addEventListener('DOMContentLoaded', initAuth);
