import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Admin from "./Admin";
import "./App.css";

const API = "https://dhasuu-audio.onrender.com";
const CATEGORIES = ["All", "Sad", "Romantic", "Party", "Dance", "80s", "90s", "Bollywood", "Pop", "Rock", "Chill", "Trending"];

const hue = (s = "") => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
const fmt = (t) => (isFinite(t) ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}` : "0:00");

function loadFavs() {
  try {
    return JSON.parse(localStorage.getItem("dhasuu-favs")) || [];
  } catch {
    return [];
  }
}

function Home() {
  const [audios, setAudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [onlyFavs, setOnlyFavs] = useState(false);
  const [favs, setFavs] = useState(loadFavs);
  const [currentId, setCurrentId] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef(null);
  const searchRef = useRef(null);

  const loadAudios = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/audio`)
      .then((res) => {
        if (!res.ok) throw new Error("Could not load audio");
        return res.json();
      })
      .then((data) => {
        setAudios(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAudios();
  }, [loadAudios]);

  useEffect(() => {
    try {
      localStorage.setItem("dhasuu-favs", JSON.stringify(favs));
    } catch {}
  }, [favs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return audios.filter((a) => {
      const text = `${a.title} ${a.artist} ${a.category || ""}`.toLowerCase();
      return text.includes(q) && (category === "All" || a.category === category) && (!onlyFavs || favs.includes(a.id));
    });
  }, [audios, search, category, onlyFavs, favs]);

  const current = audios.find((a) => a.id === currentId);
  const filtersOn = search || category !== "All" || onlyFavs;

  const toggleFav = (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const playTrack = (audio) => {
    const el = audioRef.current;
    if (audio.id === currentId) {
      el.paused ? el.play() : el.pause();
      return;
    }
    setCurrentId(audio.id);
    el.src = audio.url;
    el.play().catch(() => setPlaying(false));
  };

  const step = useCallback(
    (dir) => {
      const list = filtered.length ? filtered : audios;
      if (!list.length) return;
      const i = list.findIndex((a) => a.id === currentId);
      const next = list[(i + dir + list.length) % list.length];
      setCurrentId(next.id);
      audioRef.current.src = next.url;
      audioRef.current.play().catch(() => {});
    },
    [filtered, audios, currentId]
  );

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!current) return;
    el.paused ? el.play() : el.pause();
  }, [current]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.code === "Space" && !typing && document.activeElement?.tagName !== "BUTTON") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape") {
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay]);

  useEffect(() => {
    document.title = current && playing ? `${current.title} · SunteRaho` : "SunteRaho";
    if ("mediaSession" in navigator && current) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: current.title, artist: current.artist });
      navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
      navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
    }
  }, [current, playing, step]);

  const seek = (e) => {
    audioRef.current.currentTime = Number(e.target.value);
    setTime(Number(e.target.value));
  };
  const changeVolume = (e) => {
    const v = Number(e.target.value);
    audioRef.current.volume = v;
    setVolume(v);
  };
  const clearFilters = () => {
    setSearch("");
    setCategory("All");
    setOnlyFavs(false);
  };

  return (
    <div className={`app ${current ? "has-player" : ""}`}>
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onEnded={() => step(1)}
      />

      <header className="topbar">
        <a className="brand" href="/" aria-label="SunteRaho home">
          <span className="brand-mark">SR</span>
          <span className="brand-name">SunteRaho</span>
        </a>
        <a href="/admin" className="add-btn">
          <span aria-hidden="true">＋</span> Add music
        </a>
      </header>

      <main>
        <section className="hero">
          <h1>
            Press play.
            <br />
            <span className="hero-soft">Feel more.</span>
          </h1>
          <p>Free tracks, no sign-up. Pick a mood, hit play, download what you love.</p>

          <label className="search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={searchRef}
              type="search"
              placeholder="Search a song or artist"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tracks and artists"
            />
            <kbd>/</kbd>
          </label>
        </section>

        <section className="library" id="library">
          <div className="chips" role="tablist" aria-label="Moods and genres">
            <button className={`chip fav-chip ${onlyFavs ? "on" : ""}`} onClick={() => setOnlyFavs(!onlyFavs)} aria-pressed={onlyFavs}>
              ♥ Favourites{favs.length ? ` ${favs.length}` : ""}
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} className={`chip ${category === c ? "on" : ""}`} onClick={() => setCategory(c)} role="tab" aria-selected={category === c}>
                {c}
              </button>
            ))}
          </div>

          <div className="count" aria-live="polite">
            {loading ? "Loading tracks…" : `${filtered.length} ${filtered.length === 1 ? "track" : "tracks"}`}
          </div>

          {loading ? (
            <div className="tracks" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div className="row skeleton" key={i}>
                  <div className="cover" />
                  <div className="lines">
                    <i />
                    <i />
                  </div>
                </div>
              ))}
            </div>
          ) : loadError ? (
            <div className="empty">
              <div className="empty-icon">!</div>
              <h3>Can't reach the music server</h3>
              <p>Make sure the backend is running on port 5000, then try again.</p>
              <button className="btn" onClick={loadAudios}>
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">♫</div>
              <h3>{filtersOn ? "Nothing matches yet" : "No tracks yet"}</h3>
              <p>{filtersOn ? "Try a different word, or reset the filters." : "Add the first track and it will show up here."}</p>
              {filtersOn ? (
                <button className="btn" onClick={clearFilters}>
                  Reset filters
                </button>
              ) : (
                <a className="btn" href="/admin">
                  Add music
                </a>
              )}
            </div>
          ) : (
            <div className="tracks">
              {filtered.map((a) => {
                const active = a.id === currentId;
                const h = hue(a.title);
                return (
                  <article className={`row ${active ? "active" : ""}`} key={a.id}>
                    <button
                      className="cover"
                      style={{ "--h": h }}
                      onClick={() => playTrack(a)}
                      aria-label={active && playing ? `Pause ${a.title}` : `Play ${a.title} by ${a.artist}`}
                    >
                      {active && playing ? (
                        <span className="eq" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                      ) : (
                        <svg className="play-ic" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                    <div className="meta" onClick={() => playTrack(a)}>
                      <h3>{a.title}</h3>
                      <p>
                        {a.artist}
                        {a.category && <span className="tag">{a.category}</span>}
                      </p>
                    </div>
                    <button className={`icon-btn heart ${favs.includes(a.id) ? "on" : ""}`} onClick={() => toggleFav(a.id)} aria-pressed={favs.includes(a.id)} aria-label="Favourite">
                      {favs.includes(a.id) ? "♥" : "♡"}
                    </button>
                    <a href={a.downloadUrl} download className="icon-btn" aria-label={`Download ${a.title}`} title="Download">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
                      </svg>
                    </a>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <footer className="foot">Good music should go everywhere. © Dhasuu</footer>
      </main>

      {current && (
        <div className="player" role="region" aria-label="Now playing">
          <div className="p-track">
            <div className="p-cover" style={{ "--h": hue(current.title) }}>
              {playing ? (
                <span className="eq" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                "♫"
              )}
            </div>
            <div className="p-meta">
              <strong>{current.title}</strong>
              <span>{current.artist}</span>
            </div>
          </div>

          <div className="p-center">
            <div className="p-btns">
              <button className="icon-btn" onClick={() => step(-1)} aria-label="Previous track">
                ⏮
              </button>
              <button className="play-big" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
                {playing ? "❚❚" : "▶"}
              </button>
              <button className="icon-btn" onClick={() => step(1)} aria-label="Next track">
                ⏭
              </button>
            </div>
            <div className="p-seek">
              <span>{fmt(time)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={time}
                onChange={seek}
                style={{ "--p": `${duration ? (time / duration) * 100 : 0}%` }}
                aria-label="Seek"
              />
              <span>{fmt(duration)}</span>
            </div>
          </div>

          <div className="p-vol">
            <span aria-hidden="true">{volume === 0 ? "🔇" : "🔊"}</span>
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={changeVolume} style={{ "--p": `${volume * 100}%` }} aria-label="Volume" />
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  if (window.location.pathname === "/admin") return <Admin />;
  return <Home />;
}

export default App;