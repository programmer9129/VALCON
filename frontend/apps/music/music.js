import "./music.css";

import { upload, remoteUrlFor, loadToken } from "../../api.js";

const LIBRARY_KEY = "valcon.music.library";
const PREFS_KEY = "valcon.music.prefs";

const blobs = new Map();
const objectUrls = new Map();

const audio = new Audio();

const state = {
  tracks: [],
  filtered: [],
  currentId: null,
  playing: false,
  shuffle: false,
  repeat: "off",
  search: "",
  volume: 1,
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

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);

    if (!raw) {
      return;
    }

    const prefs = JSON.parse(raw);

    state.volume =
      typeof prefs.volume === "number"
        ? Math.max(0, Math.min(1, prefs.volume))
        : 1;

    state.shuffle = Boolean(prefs.shuffle);

    state.repeat =
      prefs.repeat === "one" || prefs.repeat === "all" ? prefs.repeat : "off";
  } catch {
    state.volume = 1;
    state.shuffle = false;
    state.repeat = "off";
  }
}

function savePrefs() {
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({
      volume: state.volume,
      shuffle: state.shuffle,
      repeat: state.repeat,
    }),
  );
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);

    if (!raw) {
      state.tracks = [];
      return;
    }

    const parsed = JSON.parse(raw);

    state.tracks = Array.isArray(parsed) ? parsed : [];
  } catch {
    state.tracks = [];
  }
}

function saveLibrary() {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(state.tracks));
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

function applyFilter() {
  const query = state.search.trim().toLowerCase();

  if (!query) {
    state.filtered = [...state.tracks];
    renderList();
    return;
  }

  state.filtered = state.tracks.filter((track) => {
    return (
      track.title.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.filename.toLowerCase().includes(query)
    );
  });

  renderList();
}

function renderList() {
  if (!listEl) {
    return;
  }

  listEl.innerHTML = "";

  if (state.filtered.length === 0) {
    const empty = document.createElement("li");

    empty.textContent =
      state.tracks.length === 0
        ? "No music imported."
        : "No tracks match your search.";

    empty.style.opacity = "0.6";
    empty.style.cursor = "default";

    listEl.appendChild(empty);

    return;
  }

  state.filtered.forEach((track) => {
    const li = document.createElement("li");

    if (track.id === state.currentId) {
      li.classList.add("playing");
    }

    const main = document.createElement("div");

    const title = document.createElement("div");
    title.textContent = track.title;

    const artist = document.createElement("div");
    artist.className = "meta";
    artist.textContent = track.artist;

    main.appendChild(title);
    main.appendChild(artist);

    const right = document.createElement("div");

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
      cloud.className = "local";
      cloud.textContent = "cloud";
      right.appendChild(cloud);
    } else if (blobs.has(track.id)) {
      const local = document.createElement("div");
      local.className = "local";
      local.textContent = "local";
      right.appendChild(local);
    }

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

  if (!track) {
    nowTitleEl.textContent = "Nothing playing";
    nowArtistEl.textContent = "";
    playButton.textContent = "Play";
    return;
  }

  nowTitleEl.textContent = track.title;
  nowArtistEl.textContent = track.artist;

  playButton.textContent = state.playing ? "Pause" : "Play";

  shuffleButton.textContent = state.shuffle ? "Shuffle: On" : "Shuffle: Off";

  repeatButton.textContent = `Repeat: ${
    state.repeat === "off" ? "Off" : state.repeat === "one" ? "One" : "All"
  }`;

  renderList();
}

async function play(id) {
  const track = getTrack(id);

  if (!track) {
    return;
  }

  const source = srcFor(track);

  if (!source) {
    setStatus(
      "This track is unavailable locally and has no usable server URL.",
    );

    return;
  }

  state.currentId = id;

  audio.src = source;
  audio.currentTime = 0;
  audio.volume = state.volume;

  renderPlayer();

  try {
    await audio.play();

    state.playing = true;

    setStatus(track.remoteUrl ? "Playing from server." : "Playing local copy.");

    renderPlayer();
  } catch (error) {
    console.error("Music playback failed:", error);

    setStatus("Playback failed.");

    state.playing = false;

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

  if (state.shuffle && state.tracks.length > 1) {
    const candidates = state.tracks.filter(
      (track) => track.id !== state.currentId,
    );

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  const index = currentIndex();

  if (index < 0) {
    return state.tracks[0];
  }

  if (index >= state.tracks.length - 1) {
    return state.repeat === "all" ? state.tracks[0] : null;
  }

  return state.tracks[index + 1];
}

function next() {
  if (state.tracks.length === 0) {
    return;
  }

  if (state.repeat === "one") {
    audio.currentTime = 0;

    if (state.currentId) {
      play(state.currentId);
    }

    return;
  }

  const nextTrack = pickNext();

  if (!nextTrack) {
    state.playing = false;
    renderPlayer();
    return;
  }

  play(nextTrack.id);
}

function prev() {
  if (state.tracks.length === 0) {
    return;
  }

  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }

  const index = currentIndex();

  if (index <= 0) {
    const last =
      state.repeat === "all"
        ? state.tracks[state.tracks.length - 1]
        : state.tracks[0];

    play(last.id);
    return;
  }

  play(state.tracks[index - 1].id);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;

  savePrefs();
  renderPlayer();
}

function cycleRepeat() {
  if (state.repeat === "off") {
    state.repeat = "all";
  } else if (state.repeat === "all") {
    state.repeat = "one";
  } else {
    state.repeat = "off";
  }

  savePrefs();
  renderPlayer();
}

async function importFiles(fileList) {
  const files = Array.from(fileList || []);

  if (files.length === 0) {
    return;
  }

  const audioFiles = files.filter((file) => {
    return (
      file.type.startsWith("audio/") ||
      /\.(mp3|wav|ogg|oga|m4a|aac|flac|webm)$/i.test(file.name)
    );
  });

  if (audioFiles.length === 0) {
    setStatus("No supported audio files selected.");
    return;
  }

  const newTracks = audioFiles.map((file) => {
    const parsed = parseName(file.name);

    return {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,

      filename: safeName(file.name),

      title: parsed.title,

      artist: parsed.artist,

      duration: 0,

      remoteUrl: null,

      uploading: true,

      progress: 0,

      addedAt: Date.now(),
    };
  });

  newTracks.forEach((track, index) => {
    blobs.set(track.id, audioFiles[index]);
    state.tracks.push(track);
  });

  saveLibrary();
  applyFilter();
  renderPlayer();

  setStatus(
    `${newTracks.length} track${
      newTracks.length === 1 ? "" : "s"
    } added locally.`,
  );

  for (let i = 0; i < newTracks.length; i++) {
    const track = newTracks[i];
    const file = audioFiles[i];

    state.uploading = true;

    setStatus(`Uploading ${i + 1}/${newTracks.length}: ${track.filename}`);

    const result = await upload(file, track.filename, (progress) => {
      track.progress = progress;
      renderList();
    });

    track.uploading = false;
    track.progress = 100;

    if (result.ok) {
      track.remoteUrl = result.url || remoteUrlFor(track.filename);

      if (track.remoteUrl) {
        setStatus(`${track.filename} uploaded successfully.`);
      } else {
        setStatus(
          `${track.filename} uploaded, but no playback URL was returned. Local copy kept.`,
        );
      }
    } else {
      setStatus(
        `${track.filename} kept locally. Upload failed: ${result.reason}`,
      );
    }

    saveLibrary();
    renderList();
  }

  state.uploading = false;
}

async function retryUpload(track) {
  if (!track) {
    return;
  }

  const file = blobs.get(track.id);

  if (!file) {
    setStatus("The original local file is no longer available.");

    return;
  }

  track.uploading = true;
  track.progress = 0;

  renderList();

  const result = await upload(file, track.filename, (progress) => {
    track.progress = progress;
    renderList();
  });

  track.uploading = false;

  if (result.ok) {
    track.remoteUrl = result.url || remoteUrlFor(track.filename);

    setStatus(
      track.remoteUrl
        ? `${track.filename} uploaded successfully.`
        : "Upload succeeded, but no remote URL was returned.",
    );
  } else {
    setStatus(`Retry failed: ${result.reason}`);
  }

  saveLibrary();
  renderList();
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
      setStatus("Server playback failed. Falling back to local copy.");

      track.remoteUrl = null;

      saveLibrary();

      audio.src = localSource;

      audio.play().catch(() => {
        state.playing = false;
        renderPlayer();
      });

      return;
    }
  }

  state.playing = false;

  setStatus("Playback failed and no local fallback is available.");

  renderPlayer();
}

function setupAudioEvents() {
  audio.addEventListener("play", () => {
    state.playing = true;
    renderPlayer();
  });

  audio.addEventListener("pause", () => {
    state.playing = false;
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
    if (state.repeat === "one") {
      audio.currentTime = 0;

      audio.play().catch(() => {
        state.playing = false;
        renderPlayer();
      });

      return;
    }

    next();
  });

  audio.addEventListener("error", () => {
    handleAudioError();
  });
}

export function startMusic(win) {
  root = win;

  root.innerHTML = `
    <div class="music">
      <div class="music-toolbar">
        <input
          id="musicSearch"
          type="text"
          placeholder="Search music..."
        />

        <input
          id="musicFiles"
          type="file"
          accept="audio/*"
          multiple
          hidden
        />

        <wa-button id="musicImport">
          Import
        </wa-button>
      </div>

      <ul
        id="musicList"
        class="music-list"
      ></ul>

      <div class="music-player">
        <div class="music-now">
          <span id="musicNowTitle">
            Nothing playing
          </span>

          <span id="musicNowArtist"></span>
        </div>

        <div class="music-seek">
          <span id="musicCurrent">
            0:00
          </span>

          <input
            id="musicSeek"
            type="range"
            min="0"
            max="0"
            step="0.1"
            value="0"
          />

          <span id="musicDuration">
            0:00
          </span>
        </div>

        <div class="music-controls">
          <wa-button id="musicPrev">
            Prev
          </wa-button>

          <wa-button id="musicPlay">
            Play
          </wa-button>

          <wa-button id="musicNext">
            Next
          </wa-button>

          <wa-button id="musicShuffle">
            Shuffle: Off
          </wa-button>

          <wa-button id="musicRepeat">
            Repeat: Off
          </wa-button>

          <label>
            Volume
            <input
              id="musicVolume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="1"
            />
          </label>
        </div>

        <div id="musicStatus"></div>
      </div>
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

  const importButton = root.querySelector("#musicImport");

  const fileInput = root.querySelector("#musicFiles");

  const previousButton = root.querySelector("#musicPrev");

  const nextButton = root.querySelector("#musicNext");

  loadPrefs();
  loadLibrary();

  audio.volume = state.volume;

  volumeEl.value = state.volume;

  applyFilter();
  renderPlayer();

  importButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    importFiles(fileInput.files);

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
    state.volume = Number(volumeEl.value);

    audio.volume = state.volume;

    savePrefs();
  });

  seekEl.addEventListener("input", () => {
    state.seeking = true;

    currentTimeEl.textContent = formatTime(Number(seekEl.value));
  });

  seekEl.addEventListener("change", () => {
    audio.currentTime = Number(seekEl.value);
    state.seeking = false;
  });

  root.addEventListener("keydown", (event) => {
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      togglePlay();
    }

    if (event.key === "ArrowRight") {
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
    }

    if (event.key === "ArrowLeft") {
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    }
  });

  setupAudioEvents();

  void loadToken();

  const localCount = state.tracks.filter((track) => blobs.has(track.id)).length;

  if (localCount > 0) {
    setStatus(
      `${localCount} local track${localCount === 1 ? "" : "s"} available.`,
    );
  } else {
    setStatus("Import an audio file to begin.");
  }
}
