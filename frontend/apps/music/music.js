import "./music.css";

import recordArt from "./background.gif?url";

import {
  upload,
  uploadConfigured,
  remoteUrlFor,
  loadToken,
} from "../../api.js";
import {
  get as getSetting,
  set as setSetting,
  on as onSetting,
} from "../../core/settings-store.js";

const LIBRARY_KEY = "valcon.music.library";

const AUDIO_EXTENSIONS = /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)$/i;

const blobs = new Map();
const objectUrls = new Map();

const audio = new Audio();

audio.preload = "metadata";

const state = {
  tracks: [],
  filtered: [],
  currentId: null,
  playing: false,
  search: "",
  seeking: false,
  uploading: false,
};

let root = null;
let listEl = null;
let searchEl = null;
let statusEl = null;

let nowTitleEl = null;
let nowArtistEl = null;

let playButton = null;
let shuffleButton = null;
let repeatButton = null;

let seekEl = null;
let currentTimeEl = null;
let durationEl = null;
let volumeEl = null;

let recordGif = null;
let recordFreeze = null;
let emptyVisual = null;
let libraryCountEl = null;

let audioEventsReady = false;

const volume = () => {
  const stored = getSetting("music.volume");

  return Number.isFinite(stored) ? Math.min(1, Math.max(0, stored)) : 1;
};

const shuffle = () => Boolean(getSetting("music.shuffle"));

const repeat = () => getSetting("music.repeat");

function loadLibrary() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LIBRARY_KEY) || "[]");

    state.tracks = Array.isArray(parsed)
      ? parsed.filter((track) => track && track.id && track.filename)
      : [];
  } catch {
    state.tracks = [];
  }
}

function saveLibrary() {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(state.tracks));

    return true;
  } catch (error) {
    console.error("Could not save the music library:", error);

    setStatus("Library is too large to save locally.");

    return false;
  }
}

function parseName(filename) {
  const withoutExtension = filename.replace(/\.[^/.]+$/, "");
  const parts = withoutExtension.split(" - ");

  if (parts.length >= 2) {
    return {
      artist: parts.shift().trim() || "Unknown",
      title: parts.join(" - ").trim() || withoutExtension,
    };
  }

  return {
    artist: "Unknown",
    title: withoutExtension,
  };
}

function safeName(filename) {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function getTrack(id) {
  return state.tracks.find((track) => track.id === id);
}

function currentIndex() {
  return state.tracks.findIndex((track) => track.id === state.currentId);
}

function srcFor(track) {
  if (!track) {
    return null;
  }

  if (track.remoteUrl) {
    return track.remoteUrl;
  }

  const blob = blobs.get(track.id);

  if (!blob) {
    return null;
  }

  if (!objectUrls.has(track.id)) {
    objectUrls.set(track.id, URL.createObjectURL(blob));
  }

  return objectUrls.get(track.id);
}

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message || "";
  }
}

function showPlayingVisual() {
  if (!recordGif || !recordFreeze || !emptyVisual) {
    return;
  }

  emptyVisual.style.display = "none";
  recordFreeze.classList.remove("visible");
  recordGif.classList.add("playing");
}

function freezePlayingVisual() {
  if (!recordGif || !recordFreeze || !emptyVisual) {
    return;
  }

  if (recordGif.complete && recordGif.naturalWidth > 0) {
    try {
      const canvas = document.createElement("canvas");

      canvas.width = recordGif.naturalWidth;
      canvas.height = recordGif.naturalHeight;

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas context unavailable");
      }

      context.drawImage(recordGif, 0, 0, canvas.width, canvas.height);

      recordFreeze.src = canvas.toDataURL("image/png");

      recordGif.classList.remove("playing");
      recordFreeze.classList.add("visible");
      emptyVisual.style.display = "none";

      return;
    } catch (error) {
      console.warn("Could not freeze record animation:", error);
    }
  }

  recordGif.classList.remove("playing");
  recordFreeze.classList.remove("visible");
  emptyVisual.style.display = "flex";
}

function resetPlayingVisual() {
  if (!recordGif || !recordFreeze || !emptyVisual) {
    return;
  }

  recordGif.classList.remove("playing");
  recordFreeze.classList.remove("visible");
  emptyVisual.style.display = "flex";
}

function applyFilter() {
  const query = state.search.trim().toLowerCase();

  if (!query) {
    state.filtered = [...state.tracks];
    renderList();
    return;
  }

  state.filtered = state.tracks.filter((track) => {
    return (
      String(track.title || "")
        .toLowerCase()
        .includes(query) ||
      String(track.artist || "")
        .toLowerCase()
        .includes(query) ||
      String(track.filename || "")
        .toLowerCase()
        .includes(query)
    );
  });

  renderList();
}

function renderList() {
  if (!listEl) {
    return;
  }

  listEl.innerHTML = "";

  if (libraryCountEl) {
    libraryCountEl.textContent = `${state.filtered.length} ${
      state.filtered.length === 1 ? "track" : "tracks"
    }`;
  }

  if (state.filtered.length === 0) {
    const empty = document.createElement("li");

    empty.className = "music-empty-library";

    const icon = document.createElement("wa-icon");
    icon.name = "music";

    const text = document.createElement("span");

    text.textContent =
      state.tracks.length === 0
        ? "Your library is empty"
        : "No tracks match your search";

    empty.appendChild(icon);
    empty.appendChild(text);

    listEl.appendChild(empty);

    return;
  }

  state.filtered.forEach((track) => {
    const li = document.createElement("li");

    if (track.id === state.currentId) {
      li.classList.add("playing");
    }

    const iconWrap = document.createElement("div");
    iconWrap.className = "music-track-icon";

    const icon = document.createElement("wa-icon");

    icon.name =
      track.id === state.currentId && state.playing ? "volume-high" : "music";

    iconWrap.appendChild(icon);

    const main = document.createElement("div");
    main.className = "music-track-main";

    const title = document.createElement("div");
    title.className = "music-track-title";
    title.textContent = track.title;

    const artist = document.createElement("div");
    artist.className = "music-track-artist";
    artist.textContent = track.artist;

    main.appendChild(title);
    main.appendChild(artist);

    const right = document.createElement("div");
    right.className = "music-track-right";

    const duration = document.createElement("div");
    duration.className = "meta";

    if (track.uploading) {
      duration.textContent = `${track.progress || 0}%`;
    } else if (track.duration) {
      duration.textContent = formatTime(track.duration);
    }

    right.appendChild(duration);

    if (track.remoteUrl) {
      const cloud = document.createElement("div");

      cloud.className = "local cloud";
      cloud.textContent = "cloud";

      right.appendChild(cloud);
    } else if (track.uploading) {
      const uploading = document.createElement("div");

      uploading.className = "local uploading";
      uploading.textContent = "uploading";

      right.appendChild(uploading);
    } else if (blobs.has(track.id)) {
      const local = document.createElement("div");

      local.className = "local";
      local.textContent = "local";

      right.appendChild(local);
    }

    li.appendChild(iconWrap);
    li.appendChild(main);
    li.appendChild(right);

    li.addEventListener("click", () => {
      play(track.id);
    });

    listEl.appendChild(li);
  });
}

function renderPlayer() {
  const track = getTrack(state.currentId);

  updateModeButtons();

  if (!track) {
    nowTitleEl.textContent = "Nothing playing";
    nowArtistEl.textContent = "Choose a track from your library";
    playButton.title = "Play selected track";
    playButton.innerHTML = `<wa-icon name="play"></wa-icon>`;

    resetPlayingVisual();
    renderList();

    return;
  }

  nowTitleEl.textContent = track.title;
  nowArtistEl.textContent = track.artist;

  playButton.title = state.playing ? "Pause" : "Play";

  playButton.innerHTML = state.playing
    ? `<wa-icon name="pause"></wa-icon>`
    : `<wa-icon name="play"></wa-icon>`;

  if (state.playing) {
    showPlayingVisual();
  } else {
    freezePlayingVisual();
  }

  renderList();
}

async function play(id) {
  const track = getTrack(id);

  if (!track) {
    return;
  }

  const source = srcFor(track);

  if (!source) {
    setStatus("This track is unavailable.");
    return;
  }

  state.currentId = id;

  audio.src = source;
  audio.currentTime = 0;
  audio.volume = volume();

  renderPlayer();

  try {
    await audio.play();

    state.playing = true;

    setStatus(track.remoteUrl ? "Playing from cloud." : "Playing local copy.");

    showPlayingVisual();
    renderPlayer();
  } catch (error) {
    console.error("Music playback failed:", error);

    state.playing = false;
    setStatus("Playback failed.");
    renderPlayer();
  }
}

function togglePlay() {
  if (!state.currentId) {
    const first = state.filtered[0] || state.tracks[0];

    if (first) {
      play(first.id);
    }

    return;
  }

  if (audio.paused) {
    audio.play().catch(() => {
      setStatus("Playback failed.");
    });
  } else {
    audio.pause();
  }
}

function pickNext() {
  if (state.tracks.length === 0) {
    return null;
  }

  if (repeat() === "one" && state.currentId) {
    return getTrack(state.currentId);
  }

  if (shuffle() && state.tracks.length > 1) {
    const candidates = state.tracks.filter(
      (track) => track.id !== state.currentId,
    );

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  const index = currentIndex();

  if (index === -1) {
    return state.tracks[0];
  }

  if (index >= state.tracks.length - 1) {
    return repeat() === "all" ? state.tracks[0] : null;
  }

  return state.tracks[index + 1];
}

function next() {
  if (state.tracks.length === 0) {
    setStatus("Your library is empty.");

    return;
  }

  const nextTrack = pickNext();

  if (!nextTrack) {
    state.playing = false;
    setStatus("End of library.");
    renderPlayer();

    return;
  }

  if (nextTrack.id === state.currentId) {
    audio.currentTime = 0;

    void audio.play().catch(() => {
      setStatus("Playback failed.");
    });

    return;
  }

  play(nextTrack.id);
}

function prev() {
  if (state.tracks.length === 0) {
    setStatus("Your library is empty.");
    return;
  }

  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    setStatus("Restarted current track.");
    return;
  }

  const index = currentIndex();

  if (index > 0) {
    play(state.tracks[index - 1].id);
    return;
  }

  if (repeat() === "all") {
    play(state.tracks[state.tracks.length - 1].id);
    return;
  }

  audio.currentTime = 0;

  void audio.play().catch(() => {
    play(state.tracks[0].id);
  });
}

function toggleShuffle() {
  const next = !shuffle();

  setSetting("music.shuffle", next);

  setStatus(next ? "Shuffle enabled." : "Shuffle disabled.");
}

function cycleRepeat() {
  const order = ["off", "all", "one"];

  const next = order[(order.indexOf(repeat()) + 1) % order.length];

  setSetting("music.repeat", next);

  if (next === "off") {
    setStatus("Repeat disabled.");
  } else if (next === "all") {
    setStatus("Repeating all tracks.");
  } else {
    setStatus("Repeating current track.");
  }
}

function updateModeButtons() {
  if (!shuffleButton || !repeatButton) {
    return;
  }

  const isShuffling = shuffle();

  shuffleButton.classList.toggle("music-mode-active", isShuffling);

  shuffleButton.title = isShuffling ? "Shuffle on" : "Shuffle off";

  const mode = repeat();

  repeatButton.classList.remove("music-mode-active", "music-mode-one");

  if (mode === "one") {
    repeatButton.innerHTML = `<span class="repeat-one-icon">1</span>`;

    repeatButton.classList.add("music-mode-one");
    repeatButton.title = "Repeat current track";

    return;
  }

  repeatButton.innerHTML = `<wa-icon name="repeat"></wa-icon>`;

  repeatButton.title = mode === "all" ? "Repeat all tracks" : "Repeat off";

  if (mode === "all") {
    repeatButton.classList.add("music-mode-active");
  }
}

async function importFiles(fileList) {
  const files = Array.from(fileList || []).filter(
    (file) => file.type.startsWith("audio/") || AUDIO_EXTENSIONS.test(file.name),
  );

  if (files.length === 0) {
    setStatus("No supported audio files selected.");

    return;
  }

  const existingNames = new Set(
    state.tracks.map((track) => String(track.filename).toLowerCase()),
  );

  const accepted = [];

  let duplicateCount = 0;

  for (const file of files) {
    const filename = safeName(file.name);
    const key = filename.toLowerCase();

    if (existingNames.has(key)) {
      duplicateCount++;

      continue;
    }

    existingNames.add(key);
    accepted.push({ file, filename });
  }

  if (accepted.length === 0) {
    setStatus(
      duplicateCount === 1
        ? "That track is already in your library."
        : `${duplicateCount} tracks are already in your library.`,
    );

    return;
  }

  const added = accepted.map(({ file, filename }) => {
    const parsed = parseName(filename);
    const track = {
      id: crypto.randomUUID(),
      filename,
      title: parsed.title,
      artist: parsed.artist,
      duration: 0,
      remoteUrl: null,
      uploading: true,
      progress: 0,
      addedAt: Date.now(),
    };

    blobs.set(track.id, file);

    return track;
  });

  state.uploading = true;
  state.tracks.push(...added);

  saveLibrary();
  applyFilter();
  renderPlayer();

  const summary = [`${added.length} imported`];

  if (duplicateCount) {
    summary.push(`${duplicateCount} already existed`);
  }

  if (!uploadConfigured()) {
    state.uploading = false;

    setStatus(summary.join(" · "));

    renderPlayer();

    return;
  }

  let failed = 0;

  for (let index = 0; index < added.length; index++) {
    const track = added[index];
    const { file } = accepted[index];

    setStatus(`Importing ${track.filename}...`);

    const result = await upload(file, track.filename, (progress) => {
      track.progress = progress;
      renderList();
    });

    track.uploading = false;
    track.progress = 100;

    if (result.ok) {
      track.remoteUrl = result.url || remoteUrlFor(track.filename);
    } else {
      failed++;
    }

    saveLibrary();
    applyFilter();
  }

  state.uploading = false;

  if (failed) {
    summary.push(`${failed} kept local`);
  }

  setStatus(summary.join(" · "));

  renderPlayer();
}

function removeTrack(id) {
  const track = getTrack(id);

  if (!track) {
    return;
  }

  if (state.currentId === id) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    state.currentId = null;
    state.playing = false;

    resetPlayingVisual();
  }

  blobs.delete(id);

  const objectUrl = objectUrls.get(id);

  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrls.delete(id);
  }

  state.tracks = state.tracks.filter((item) => item.id !== id);

  saveLibrary();
  applyFilter();
  renderPlayer();

  setStatus(`Removed ${track.filename}.`);
}

function updateTimeUI() {
  if (!audio) {
    return;
  }

  if (!state.seeking) {
    seekEl.value = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  }

  currentTimeEl.textContent = formatTime(audio.currentTime);

  durationEl.textContent = formatTime(audio.duration);
}

function handleAudioError() {
  const track = getTrack(state.currentId);

  if (!track) {
    setStatus("Audio playback error.");
    return;
  }

  if (track.remoteUrl && blobs.has(track.id)) {
    const localSource = srcFor({
      ...track,
      remoteUrl: null,
    });

    if (localSource) {
      setStatus("Cloud playback failed. Using local copy.");

      audio.src = localSource;

      audio.play().catch(() => {
        state.playing = false;
        renderPlayer();
      });

      return;
    }
  }

  state.playing = false;

  setStatus("Playback failed.");
  renderPlayer();
}

function setupAudioEvents() {
  audio.addEventListener("play", () => {
    state.playing = true;

    showPlayingVisual();
    renderPlayer();
  });

  audio.addEventListener("pause", () => {
    state.playing = false;

    freezePlayingVisual();
    renderPlayer();
  });

  audio.addEventListener("loadedmetadata", () => {
    const track = getTrack(state.currentId);

    if (track) {
      track.duration = audio.duration || 0;

      saveLibrary();
      renderList();
    }

    seekEl.max = Number.isFinite(audio.duration) ? audio.duration : 0;

    updateTimeUI();
  });

  audio.addEventListener("timeupdate", () => {
    updateTimeUI();
  });

  audio.addEventListener("ended", () => {
    next();
  });

  audio.addEventListener("error", () => {
    handleAudioError();
  });
}

function bindAudioEvents() {
  if (audioEventsReady) {
    return;
  }

  audioEventsReady = true;

  setupAudioEvents();
}

export function startMusic(win) {
  root = win.matches(".music") ? win : win.querySelector(".music") || win;

  root.innerHTML = `
    <div class="music-toolbar">
        <div class="music-search-wrap">
          <wa-icon name="search"></wa-icon>

          <input
            id="musicSearch"
            type="text"
            placeholder="Search library..."
            aria-label="Search music"
          />
        </div>

        <input
          id="musicFiles"
          class="music-file-input"
          type="file"
          accept="audio/*"
          multiple
        />

        <wa-button
          id="musicImport"
          class="music-import"
          title="Import music"
        >
          <wa-icon name="upload"></wa-icon>
          <span>Import</span>
        </wa-button>

        <button
          id="musicMenuButton"
          class="music-menu-button"
          type="button"
          aria-label="Music options"
          title="More options"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div
          id="musicMenu"
          class="music-menu"
          hidden
        >
          <button
            id="musicMenuImport"
            type="button"
          >
            <wa-icon name="upload"></wa-icon>
            <span>Import music</span>
          </button>

          <button
            id="musicMenuClearSearch"
            type="button"
          >
            <wa-icon name="xmark"></wa-icon>
            <span>Clear search</span>
          </button>
        </div>
      </div>

      <div class="music-visual">
        <div
          id="musicEmptyVisual"
          class="music-empty-visual"
        >
          <wa-icon name="compact-disc"></wa-icon>
          <span>Nothing playing</span>
        </div>

        <img
          id="musicRecord"
          class="music-record"
          src="${recordArt}"
          alt=""
          draggable="false"
        />

        <img
          id="musicRecordFreeze"
          class="music-record-freeze"
          alt=""
          draggable="false"
        />
      </div>

      <div class="music-now">
        <div class="music-now-main">
          <div
            id="musicNowTitle"
            class="music-now-title"
          >
            Nothing playing
          </div>

          <div
            id="musicNowArtist"
            class="music-now-artist"
          >
            Choose a track from your library
          </div>
        </div>

        <wa-icon
          class="music-now-icon"
          name="music"
        ></wa-icon>
      </div>

      <div class="music-seek">
        <span
          id="musicCurrent"
          class="music-time"
        >
          0:00
        </span>

        <input
          id="musicSeek"
          type="range"
          min="0"
          max="0"
          step="0.1"
          value="0"
          aria-label="Seek"
        />

        <span
          id="musicDuration"
          class="music-time"
        >
          0:00
        </span>
      </div>

      <div class="music-controls">
        <wa-button
          id="musicPrev"
          title="Previous track"
          appearance="plain"
          size="small"
        >
          <wa-icon name="backward-step"></wa-icon>
        </wa-button>

        <wa-button
          id="musicPlay"
          class="music-control-main"
          title="Play"
          size="medium"
        >
          <wa-icon name="play"></wa-icon>
        </wa-button>

        <wa-button
          id="musicNext"
          title="Next track"
          appearance="plain"
          size="small"
        >
          <wa-icon name="forward-step"></wa-icon>
        </wa-button>
      </div>

      <div class="music-secondary">
        <div class="music-secondary-left">
          <wa-button
            id="musicShuffle"
            title="Shuffle off"
            appearance="plain"
          >
            <wa-icon name="shuffle"></wa-icon>
          </wa-button>

          <wa-button
            id="musicRepeat"
            title="Repeat off"
            appearance="plain"
          >
            <wa-icon name="repeat"></wa-icon>
          </wa-button>
        </div>

        <div class="music-secondary-right">
          <div class="music-volume">
            <wa-icon name="volume-low"></wa-icon>

            <input
              id="musicVolume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="1"
              aria-label="Volume"
            />

            <wa-icon name="volume-high"></wa-icon>
          </div>
        </div>
      </div>

      <div class="music-library-header">
        <span>Library</span>

        <span id="musicLibraryCount">
          0 tracks
        </span>
      </div>

      <ul
        id="musicList"
        class="music-list"
      ></ul>

      <div id="musicStatus">
        Import music to begin.
      </div>
  `;

  listEl = root.querySelector("#musicList");
  searchEl = root.querySelector("#musicSearch");
  statusEl = root.querySelector("#musicStatus");

  nowTitleEl = root.querySelector("#musicNowTitle");
  nowArtistEl = root.querySelector("#musicNowArtist");

  playButton = root.querySelector("#musicPlay");
  shuffleButton = root.querySelector("#musicShuffle");
  repeatButton = root.querySelector("#musicRepeat");

  seekEl = root.querySelector("#musicSeek");
  currentTimeEl = root.querySelector("#musicCurrent");
  durationEl = root.querySelector("#musicDuration");
  volumeEl = root.querySelector("#musicVolume");

  recordGif = root.querySelector("#musicRecord");
  recordFreeze = root.querySelector("#musicRecordFreeze");
  emptyVisual = root.querySelector("#musicEmptyVisual");

  libraryCountEl = root.querySelector("#musicLibraryCount");

  const importButton = root.querySelector("#musicImport");

  const fileInput = root.querySelector("#musicFiles");

  const previousButton = root.querySelector("#musicPrev");

  const nextButton = root.querySelector("#musicNext");

  const menuButton = root.querySelector("#musicMenuButton");

  const menu = root.querySelector("#musicMenu");

  const menuImport = root.querySelector("#musicMenuImport");

  const menuClearSearch = root.querySelector("#musicMenuClearSearch");

  loadLibrary();

  audio.volume = volume();
  volumeEl.value = String(audio.volume);

  applyFilter();
  renderPlayer();

  importButton.addEventListener("click", () => {
    fileInput.click();
  });

  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  menuImport.addEventListener("click", () => {
    menu.hidden = true;
    fileInput.click();
  });

  menuClearSearch.addEventListener("click", () => {
    searchEl.value = "";
    state.search = "";
    menu.hidden = true;
    applyFilter();
  });

  fileInput.addEventListener("change", () => {
    void importFiles(fileInput.files);
    fileInput.value = "";
  });

  searchEl.addEventListener("input", () => {
    state.search = searchEl.value;
    applyFilter();
  });

  playButton.addEventListener("click", () => {
    togglePlay();
  });

  previousButton.addEventListener("click", () => {
    prev();
  });

  nextButton.addEventListener("click", () => {
    next();
  });

  shuffleButton.addEventListener("click", () => {
    toggleShuffle();
  });

  repeatButton.addEventListener("click", () => {
    cycleRepeat();
  });

  volumeEl.addEventListener("input", () => {
    const next = Number(volumeEl.value);

    audio.volume = Number.isFinite(next) ? next : audio.volume;

    setSetting("music.volume", audio.volume);
  });

  seekEl.addEventListener("input", () => {
    state.seeking = true;
    currentTimeEl.textContent = formatTime(Number(seekEl.value));
  });

  seekEl.addEventListener("change", () => {
    audio.currentTime = Number(seekEl.value);
    state.seeking = false;
  });

  root.addEventListener("click", (event) => {
    if (
      !menu.hidden &&
      !menu.contains(event.target) &&
      event.target !== menuButton &&
      !menuButton.contains(event.target)
    ) {
      menu.hidden = true;
    }
  });

  root.addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLButtonElement ||
      event.target?.isContentEditable
    ) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      togglePlay();

      return;
    }

    if (event.key === "ArrowRight") {
      audio.currentTime = Math.min(
        Number.isFinite(audio.duration) ? audio.duration : 0,
        audio.currentTime + 5,
      );

      updateTimeUI();

      return;
    }

    if (event.key === "ArrowLeft") {
      audio.currentTime = Math.max(0, audio.currentTime - 5);

      updateTimeUI();
    }
  });

  bindAudioEvents();

  onSetting("music.volume", (value) => {
    if (!Number.isFinite(value)) {
      return;
    }

    audio.volume = value;

    volumeEl.value = String(value);
  });

  onSetting("music.shuffle", updateModeButtons);
  onSetting("music.repeat", updateModeButtons);

  void loadToken();

  const localCount = state.tracks.filter((track) => blobs.has(track.id)).length;

  if (localCount > 0) {
    setStatus(
      `${localCount} local ${localCount === 1 ? "track" : "tracks"} available.`,
    );
  }
}
