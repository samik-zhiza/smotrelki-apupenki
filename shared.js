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
let durationFilter = null;           // объект { min, max } в минутах, или null
let excludedFilmIds = new Set();     // set id фильмов, которые не участвуют в колесе

// Для избранного используем window.userFavorites, который обновляется из auth.js

// ---------- Конфигурация TMDB ----------
const TMDB_API_KEY = "c62338407764b89796db0ebc6d3af4ed";
const TMDB_API_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

// Ключи localStorage (используются только когда пользователь не авторизован)
const TMDB_CACHE_KEY = 'tmdb_cache';
const TMDB_GENRES_CACHE_KEY = 'tmdb_genres';
const FAVORITES_STORAGE_KEY = 'filmFavorites';
const FILTER_STATE_KEY = 'filmFilterState';
const EXCLUDED_STORAGE_KEY = 'excludedFilmIds'; // для колеса

// ---------- Сохранение состояния фильтров (всегда в localStorage) ----------
function saveFilterState() {
  const state = {
    sortType: currentSortType,
    sortDirection: sortDirection,
    activeGenres: activeGenres,
    showOnlyFavorites: showOnlyFavorites,
    searchQuery: searchQuery,
    yearFrom: yearFrom,
    yearTo: yearTo,
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

// ---------- Избранное (с учётом Firebase) ----------
function getFavorites() {
  if (window.currentUser) {
    return window.userFavorites || [];
  } else {
    const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  }
}

function saveFavorites(favorites) {
  if (window.currentUser) {
    saveFavoritesToFirebase(favorites); // функция из auth.js
  } else {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  }
}

function toggleFavorite(filmId) {
  let favorites = getFavorites();
  if (favorites.includes(filmId)) {
    favorites = favorites.filter(id => id !== filmId);
  } else {
    favorites.push(filmId);
  }
  saveFavorites(favorites);
  // Не вызываем applySortAndFilter, т.к. это будет делать вызывающий код
}

// ---------- Исключённые (для колеса) ----------
function getExcluded() {
  if (window.currentUser) {
    return window.userExcluded || new Set();
  } else {
    const stored = localStorage.getItem(EXCLUDED_STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  }
}

function saveExcluded(excludedSet) {
  const arr = Array.from(excludedSet);
  if (window.currentUser) {
    saveExcludedToFirebase(arr); // функция из auth.js
  } else {
    localStorage.setItem(EXCLUDED_STORAGE_KEY, JSON.stringify(arr));
  }
}

// ---------- Фильтрация и сортировка (общая) ----------
function applyFilters() {
  let filtered = allFilms;

  if (searchQuery.trim() !== '') {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(film => film.title.toLowerCase().includes(query));
  }

  if (yearFrom !== '') {
    const from = parseInt(yearFrom, 10);
    if (!isNaN(from)) filtered = filtered.filter(film => film.year >= from);
  }
  if (yearTo !== '') {
    const to = parseInt(yearTo, 10);
    if (!isNaN(to)) filtered = filtered.filter(film => film.year <= to);
  }

  if (durationFilter) {
    const { min, max } = durationFilter;
    filtered = filtered.filter(film => {
      const dur = film.durationMinutes;
      if (!dur) return false;
      return dur >= min && dur <= max;
    });
  }

  if (activeGenres.length > 0) {
    filtered = filtered.filter(film =>
      film.genres.some(genre => activeGenres.includes(genre))
    );
  }

  if (showOnlyFavorites) {
    const favorites = getFavorites();
    filtered = filtered.filter(film => favorites.includes(film.id));
  }

  return filtered;
}

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

function updateFilteredFilms(renderCallback) {
  filteredFilms = applyFilters();
  filteredFilms = sortFilms(filteredFilms);
  if (renderCallback) renderCallback();
}

// ---------- Работа с TMDB ----------
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

    // Выбираем фильм с точным годом, если возможно
    let movie = searchData.results[0];
    if (year) {
      const exactYearMatch = searchData.results.find(m => 
        m.release_date && m.release_date.startsWith(String(year))
      );
      if (exactYearMatch) {
        movie = exactYearMatch;
        console.log(`✅ Найден фильм с точным годом ${year}: ${movie.title}`);
      }
    }

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
      durationMinutes: detailData.runtime || null,
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

// ---------- Работа с жанрами (UI) ----------
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
  // Рендер будет вызван снаружи
}

function clearGenreFilter() {
  document.querySelectorAll('.genre-item input').forEach(cb => cb.checked = false);
  activeGenres = [];
  saveFilterState();
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
