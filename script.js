// script.js

let allFilms = [];
let filteredFilms = [];
let container;
let currentSortType = 'year';
let activeGenres = [];
let showOnlyFavorites = false; // флаг для фильтра "Только избранное"

// Ключ для хранения избранных в localStorage
const FAVORITES_STORAGE_KEY = 'filmFavorites';

document.addEventListener('DOMContentLoaded', function () {
    container = document.getElementById('films-container');
    if (!container) {
        console.error('Ошибка: не найден элемент с id="films-container"');
        return;
    }

    fetch('films.json')
        .then(response => {
            if (!response.ok) throw new Error(`Ошибка загрузки: ${response.status}`);
            return response.json();
        })
        .then(films => {
            allFilms = films;
            // Убедимся, что у каждого фильма есть id (если вдруг в JSON нет, добавим)
            allFilms.forEach((film, index) => {
                if (film.id === undefined) {
                    film.id = index; // запасной вариант, если забудешь добавить id
                }
            });
            filteredFilms = [...allFilms];
            console.log('Фильмы загружены:', allFilms);

            populateGenreList();
            applySortAndFilter();
        })
        .catch(error => {
            console.error('Не удалось загрузить фильмы:', error);
            container.innerHTML = '<p style="color: red; text-align: center;">Не удалось загрузить список фильмов. Попробуйте позже.</p>';
        });

    // Сортировка
    const sortButtons = document.querySelectorAll('.filter-btn[data-sort]');
    sortButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentSortType = e.target.dataset.sort;
            applySortAndFilter();
        });
    });

    // Фильтр по жанрам
    const genreFilterBtn = document.querySelector('.genre-filter-btn');
    const genreDropdown = document.querySelector('.genre-dropdown');
    if (genreFilterBtn && genreDropdown) {
        genreFilterBtn.addEventListener('click', () => {
            genreDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', (e) => {
            if (!genreFilterBtn.contains(e.target) && !genreDropdown.contains(e.target)) {
                genreDropdown.classList.add('hidden');
            }
        });
    }

    const genreSearch = document.querySelector('.genre-search');
    if (genreSearch) {
        genreSearch.addEventListener('input', (e) => {
            filterGenreList(e.target.value);
        });
    }

    const genreClear = document.querySelector('.genre-clear');
    if (genreClear) {
        genreClear.addEventListener('click', () => {
            clearGenreFilter();
        });
    }

    // Кнопка "Только избранное"
    const favoritesBtn = document.getElementById('favorites-filter'); // последняя кнопка
    if (favoritesBtn) {
        favoritesBtn.addEventListener('click', () => {
            showOnlyFavorites = !showOnlyFavorites; // переключаем флаг
            favoritesBtn.classList.toggle('active', showOnlyFavorites); // добавим класс для стилей
            applySortAndFilter();
        });
    }
});

// ---------- Функции для работы с избранным ----------
function getFavorites() {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

function toggleFavorite(filmId) {
    let favorites = getFavorites();
    if (favorites.includes(filmId)) {
        favorites = favorites.filter(id => id !== filmId);
    } else {
        favorites.push(filmId);
    }
    saveFavorites(favorites);

    // Перерисовываем карточки, чтобы обновить иконки
    applySortAndFilter();
}

// ---------- Функции фильтрации и сортировки ----------
function applySortAndFilter() {
    // 1. Фильтрация по жанрам (если выбраны)
    if (activeGenres.length > 0) {
        filteredFilms = allFilms.filter(film =>
            film.genres.some(genre => activeGenres.includes(genre))
        );
    } else {
        filteredFilms = [...allFilms];
    }

    // 2. Фильтрация по избранному (если включено)
    if (showOnlyFavorites) {
        const favorites = getFavorites();
        filteredFilms = filteredFilms.filter(film => favorites.includes(film.id));
    }

    // 3. Сортировка
    sortFilteredFilms();

    // 4. Рендер
    renderFilmCards(filteredFilms);
}

function sortFilteredFilms() {
    if (currentSortType === 'year') {
        filteredFilms.sort((a, b) => a.year - b.year);
    } else if (currentSortType === 'title') {
        filteredFilms.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    } else if (currentSortType === 'genre') {
        filteredFilms.sort((a, b) => {
            const genreA = a.genres[0] || '';
            const genreB = b.genres[0] || '';
            return genreA.localeCompare(genreB, 'ru');
        });
    }
}

// ---------- Жанры ----------
function populateGenreList() {
    const genreListContainer = document.querySelector('.genre-list');
    if (!genreListContainer) return;

    const allGenres = new Set();
    allFilms.forEach(film => {
        film.genres.forEach(genre => allGenres.add(genre));
    });
    const sortedGenres = Array.from(allGenres).sort((a, b) => a.localeCompare(b, 'ru'));

    genreListContainer.innerHTML = '';
    sortedGenres.forEach(genre => {
        const genreItem = document.createElement('div');
        genreItem.className = 'genre-item';
        genreItem.dataset.genre = genre;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = genre;
        checkbox.id = `genre-${slugify(genre)}`;
        checkbox.addEventListener('change', (e) => {
            updateActiveGenres();
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = genre;

        genreItem.appendChild(checkbox);
        genreItem.appendChild(label);
        genreListContainer.appendChild(genreItem);
    });
}

function filterGenreList(query) {
    const items = document.querySelectorAll('.genre-item');
    const lowerQuery = query.toLowerCase();
    items.forEach(item => {
        const genre = item.dataset.genre.toLowerCase();
        if (genre.includes(lowerQuery)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function updateActiveGenres() {
    activeGenres = [];
    document.querySelectorAll('.genre-item input:checked').forEach(cb => {
        activeGenres.push(cb.value);
    });
    applySortAndFilter();
}

function clearGenreFilter() {
    document.querySelectorAll('.genre-item input').forEach(cb => {
        cb.checked = false;
    });
    activeGenres = [];
    applySortAndFilter();
}

// ---------- Рендер карточек ----------
function renderFilmCards(films) {
    container.innerHTML = '';
    const favorites = getFavorites(); // получаем текущий список избранных

    films.forEach(film => {
        const cardHtml = createFilmCard(film, favorites.includes(film.id));
        container.insertAdjacentHTML('beforeend', cardHtml);
    });

    // После добавления карточек навешиваем обработчики на кнопки избранного
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();      // отменяет переход по ссылке
            e.stopPropagation();     // предотвращает всплытие события
            const filmId = Number(btn.dataset.filmId);
            toggleFavorite(filmId);
        });
    });
}

// Создание HTML карточки с учётом состояния избранного
function createFilmCard(film, isFavorite) {
    const genresHtml = film.genres.map(genre => {
        const genreClass = slugify(genre);
        return `<span class="film-genre genre-${genreClass}">${escapeHtml(genre)}</span>`;
    }).join('');

    const durationText = film.duration ? film.duration : '—';
    const ratingText = film.rating && film.rating !== '' ? `⭐ ${film.rating}` : '⭐';
    const safeTitle = escapeHtml(film.title);
    const safeDirector = escapeHtml(film.director);
    const year = film.year;

    // Иконка сердечка: заполненное, если в избранном
    const heartIcon = isFavorite ? 'fas fa-heart' : 'far fa-heart';

    return `
    <a href="film.html?id=${film.id}" class="film-card-link" style="text-decoration: none; color: inherit;">
        <div class="film-card">
            <div class="film-poster">
                ${film.poster ? `<img src="${film.poster}" alt="${safeTitle}">` : '<div class="poster-placeholder">Нет постера</div>'}
            </div>
            <div class="film-info">
                <div class="film-header">
                    <h3 class="film-title">${safeTitle}</h3>
                    <span class="film-year film-genre">${year}</span>
                </div>
                <div class="film-director">${safeDirector}</div>
                <div class="film-genres">${genresHtml}</div>
                <div class="film-actions">
                    <div class="film-meta-left">
                        <span class="film-duration film-rating"><i class="far fa-clock"></i> ${durationText}</span>
                        <span class="film-rating">${ratingText}</span>
                    </div>
                    <!-- Кнопка избранного должна быть внутри ссылки, но чтобы клик по ней не переходил по ссылке, добавим обработчик позже -->
                    <button class="favorite-btn" data-film-id="${film.id}" aria-label="Добавить в избранное">
                        <i class="${heartIcon}"></i>
                    </button>
                </div>
            </div>
        </div>
    </a>
    `;
}

// ---------- Утилиты ----------
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function slugify(text) {
    // ... (без изменений, оставь как есть)
    if (!text) return '';
    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E',
        'Ж': 'ZH', 'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M',
        'Н': 'N', 'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U',
        'Ф': 'F', 'Х': 'KH', 'Ц': 'TS', 'Ч': 'CH', 'Ш': 'SH', 'Щ': 'SHCH',
        'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'YU', 'Я': 'YA',
        ' ': '-', ',': '', '.': '', '(': '', ')': '', '!': '', '?': '', ':': '', ';': '', '"': '', "'": ''
    };
    let result = '';
    for (let char of text) {
        result += translitMap[char] !== undefined ? translitMap[char] : char;
    }
    result = result.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    return result.toLowerCase();
}