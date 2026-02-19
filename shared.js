// shared.js
// Общие данные и функции для главной страницы и страницы колеса

// ---------- Глобальные переменные состояния ----------
let allFilms = [];
let filteredFilms = [];
let currentSortType = 'year';
let sortDirection = 'asc';
let activeGenres = [];
let showOnlyFavorites = false;
let searchQuery = '';
let yearFrom = '';
let yearTo = '';
// Для будущего фильтра по длительности (пока пусто)
let durationFilter = null; // объект { min, max } в минутах, или null
// Для исключённых фильмов
let excludedFilmIds = new Set(); // set id фильмов, которые не участвуют в колесе


// ---------- Конфигурация TMDB ----------
const TMDB_API_KEY = "c62338407764b89796db0ebc6d3af4ed";
const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

// Ключи localStorage
const TMDB_CACHE_KEY = 'tmdb_cache';
const TMDB_GENRES_CACHE_KEY = 'tmdb_genres';
const FAVORITES_STORAGE_KEY = 'filmFavorites';
const FILTER_STATE_KEY = 'filmFilterState';

// ---------- Сохранение состояния фильтров ----------
function saveFilterState() {
    const state = {
        sortType: currentSortType,
        sortDirection: sortDirection,
        activeGenres: activeGenres,
        showOnlyFavorites: showOnlyFavorites,
        searchQuery: searchQuery,
        yearFrom: yearFrom,
        yearTo: yearTo,
        // durationFilter и excludedFilmIds пока не сохраняем, они специфичны для колеса
    };
    localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(state));
}

function loadFilterState() {
    const saved = localStorage.getItem(FILTER_STATE_KEY);
    if (saved) {
        try {
            const state = JSON.parse(saved);
            currentSortType = state.sortType || 'year';
            sortDirection = state.sortDirection || 'asc';
            activeGenres = state.activeGenres || [];
            showOnlyFavorites = state.showOnlyFavorites || false;
            searchQuery = state.searchQuery || '';
            yearFrom = state.yearFrom || '';
            yearTo = state.yearTo || '';
        } catch (e) {
            console.warn('Не удалось загрузить состояние фильтров', e);
        }
    }
}

// ---------- Работа с TMDB (жанры, данные фильмов) ----------
async function getGenres() {
    const cached = localStorage.getItem(TMDB_GENRES_CACHE_KEY);
    if (cached) {
        const { genres, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000) {
            return genres;
        }
    }
    try {
        const resp = await fetch(`${TMDB_API_URL}/genre/movie/list?api_key=${TMDB_API_KEY}&language=ru-RU`);
        if (!resp.ok) throw new Error('Ошибка загрузки жанров');
        const data = await resp.json();
        const genresMap = {};
        data.genres.forEach(g => genresMap[g.id] = g.name);
        localStorage.setItem(TMDB_GENRES_CACHE_KEY, JSON.stringify({ genres: genresMap, timestamp: Date.now() }));
        return genresMap;
    } catch (error) {
        console.error('Ошибка получения жанров:', error);
        return {};
    }
}

async function getMovieDataFromTMDB(film) {
    const title = film.title;
    const year = film.year;
    const originalTitle = film.original_title || title;

    const cache = JSON.parse(localStorage.getItem(TMDB_CACHE_KEY) || '{}');
    const cacheKey = `${title}_${year}`;

    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < 7 * 24 * 60 * 60 * 1000)) {
        console.log(`✅ Из кеша: ${title}`);
        return cache[cacheKey].data;
    }

    try {
        console.log(`🔍 Ищем: ${title} (${year})`);
        const searchUrl = `${TMDB_API_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(originalTitle)}&year=${year}&language=ru-RU`;
        const searchResp = await fetch(searchUrl);
        if (!searchResp.ok) throw new Error(`Ошибка поиска: ${searchResp.status}`);
        const searchData = await searchResp.json();

        if (!searchData.results || searchData.results.length === 0) {
            console.warn(`❌ Не найдено фильмов по запросу "${title}"`);
            return null;
        }

        const movie = searchData.results[0];
        const genresMap = await getGenres();
        const genreNames = movie.genre_ids.map(id => genresMap[id] || '').filter(g => g);

        const detailResp = await fetch(`${TMDB_API_URL}/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=ru-RU&append_to_response=credits`);
        if (!detailResp.ok) throw new Error(`Ошибка получения деталей: ${detailResp.status}`);
        const detailData = await detailResp.json();

        let director = '';
        if (detailData.credits && detailData.credits.crew) {
            const directorObj = detailData.credits.crew.find(person => person.job === 'Director');
            director = directorObj ? directorObj.name : '';
        }

        const result = {
            poster: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : '',
            genres: genreNames,
            rating: movie.vote_average ? movie.vote_average.toFixed(1) : '',
            description: movie.overview || '',
            year: movie.release_date ? movie.release_date.split('-')[0] : year,
            director: director,
            duration: detailData.runtime ? `${Math.floor(detailData.runtime / 60)} ч ${detailData.runtime % 60} мин` : '',
            durationMinutes: detailData.runtime || null, // для фильтра по длительности
        };

        cache[cacheKey] = { data: result, timestamp: Date.now() };
        localStorage.setItem(TMDB_CACHE_KEY, JSON.stringify(cache));
        console.log(`💾 Сохранено в кеш: ${title}`);
        return result;
    } catch (error) {
        console.error(`🔥 Ошибка для "${title}":`, error);
        return null;
    }
}

// ---------- Избранное ----------
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
    // не вызываем applySortAndFilter, т.к. это будет делать вызывающий код
}

// ---------- Фильтрация и сортировка (общая) ----------
// Функция применяет все фильтры к массиву allFilms и возвращает отфильтрованный массив
function applyFilters() {
    let filtered = allFilms;

    // Поиск по названию
    if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(film => film.title.toLowerCase().includes(query));
    }

    // Фильтр по годам
    if (yearFrom !== '') {
        const from = parseInt(yearFrom, 10);
        if (!isNaN(from)) {
            filtered = filtered.filter(film => film.year >= from);
        }
    }
    if (yearTo !== '') {
        const to = parseInt(yearTo, 10);
        if (!isNaN(to)) {
            filtered = filtered.filter(film => film.year <= to);
        }
    }

    // Фильтр по длительности
    if (durationFilter) {
        const { min, max } = durationFilter;
        filtered = filtered.filter(film => {
            const dur = film.durationMinutes;
            if (!dur) return false; // фильмы без длительности исключаем
            return dur >= min && dur <= max;
        });
    }

    // Фильтр по жанрам
    if (activeGenres.length > 0) {
        filtered = filtered.filter(film =>
            film.genres.some(genre => activeGenres.includes(genre))
        );
    }

    // Фильтр избранного
    if (showOnlyFavorites) {
        const favorites = getFavorites();
        filtered = filtered.filter(film => favorites.includes(film.id));
    }

    return filtered;
}

// Сортировка
function sortFilms(films) {
    const sorted = [...films];
    if (currentSortType === 'year') {
        sorted.sort((a, b) => sortDirection === 'asc' ? a.year - b.year : b.year - a.year);
    } else if (currentSortType === 'title') {
        sorted.sort((a, b) => {
            const comparison = a.title.localeCompare(b.title, 'ru');
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    } else if (currentSortType === 'genre') {
        sorted.sort((a, b) => {
            const genreA = a.genres[0] || '';
            const genreB = b.genres[0] || '';
            const comparison = genreA.localeCompare(genreB, 'ru');
            return sortDirection === 'asc' ? comparison : -comparison;
        });
    }
    return sorted;
}

// Основная функция обновления filteredFilms и вызова рендера
// renderCallback – функция, которая будет вызвана после обновления filteredFilms
function updateFilteredFilms(renderCallback) {
    filteredFilms = applyFilters();
    filteredFilms = sortFilms(filteredFilms);
    if (renderCallback) renderCallback();
}

// ---------- Работа с жанрами (UI) ----------
// Эти функции работают с DOM-элементами, предполагая, что на странице есть элементы с классами:
// .genre-list, .genre-item, .genre-search и т.д.
// Они будут использоваться как на главной, так и на колесе.

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
        checkbox.addEventListener('change', () => updateActiveGenres());

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
        item.style.display = genre.includes(lowerQuery) ? 'flex' : 'none';
    });
}

function updateActiveGenres() {
    activeGenres = [];
    document.querySelectorAll('.genre-item input:checked').forEach(cb => {
        activeGenres.push(cb.value);
    });
    saveFilterState();
    // Рендер будет вызван там, где используется этот хук
}

function clearGenreFilter() {
    document.querySelectorAll('.genre-item input').forEach(cb => cb.checked = false);
    activeGenres = [];
    saveFilterState();
    // Рендер будет вызван снаружи
}

function syncGenreCheckboxes() {
    document.querySelectorAll('.genre-item input').forEach(cb => {
        cb.checked = activeGenres.includes(cb.value);
    });
}

// ---------- Вспомогательные функции ----------
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
    return text.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '-');
}

// ---------- Экспорт в глобальную область (для работы в старом стиле) ----------
// Так как мы не используем модули, все функции и переменные будут глобальными.
// Просто объявляем их как есть.