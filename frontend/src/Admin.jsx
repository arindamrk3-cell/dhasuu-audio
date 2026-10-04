import { useRef, useState } from "react";
import "./Admin.css";

const API = "https://dhasuu-audio.onrender.com";
const CATEGORIES = ["Sad", "Romantic", "Party", "Dance", "80s", "90s", "Bollywood", "Pop", "Rock", "Chill", "Trending"];

const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);

function Admin() {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [category, setCategory] = useState("");
  const [audio, setAudio] = useState(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { type: "ok" | "err", text }
  const fileRef = useRef(null);

  const pickFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setStatus({ type: "err", text: "That isn't an audio file. Choose an MP3, WAV or similar." });
      return;
    }
    setAudio(file);
    setStatus(null);
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  };

  const reset = () => {
    setTitle("");
    setArtist("");
    setCategory("");
    setAudio(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleUpload = (e) => {
    e.preventDefault();
    if (!audio) return setStatus({ type: "err", text: "Choose an audio file to upload." });
    if (!password) return setStatus({ type: "err", text: "Enter the admin password." });

    const formData = new FormData();
    formData.append("title", title);
    formData.append("artist", artist);
    formData.append("audio", audio);
    formData.append("category", category);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/upload`);
    xhr.setRequestHeader("x-admin-key", password);
    xhr.upload.onprogress = (ev) => ev.lengthComputable && setProgress(Math.round((ev.loaded / ev.total) * 100));
    xhr.onload = () => {
      setBusy(false);
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300) {
        setStatus({ type: "ok", text: "Uploaded. Your track is live on the home page." });
        reset();
      } else {
        setStatus({ type: "err", text: data.message || "Upload failed. Check the password and try again." });
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      setStatus({ type: "err", text: "Can't reach the server. Make sure the backend is running." });
    };
    setBusy(true);
    setProgress(0);
    setStatus(null);
    xhr.send(formData);
  };

  return (
    <div className="admin">
      <a href="/" className="admin-back">
        ← Back to music
      </a>

      <form className="admin-card" onSubmit={handleUpload}>
        <h1>Add a track</h1>
        <p className="admin-sub">Upload a song and it appears in the library right away.</p>

        <div
          className={`drop ${drag ? "drag" : ""} ${audio ? "filled" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pickFile(e.dataTransfer.files[0]);
          }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), fileRef.current?.click())}
        >
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => pickFile(e.target.files[0])} />
          <span className="drop-icon">{audio ? "♫" : "↑"}</span>
          {audio ? (
            <>
              <strong>{audio.name}</strong>
              <span>{size(audio.size)} · click to change</span>
            </>
          ) : (
            <>
              <strong>Drop an audio file here</strong>
              <span>or click to browse</span>
            </>
          )}
        </div>

        <label className="field">
          <span>Title</span>
          <input type="text" placeholder="Song name" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="field">
          <span>Artist</span>
          <input type="text" placeholder="Who made it?" value={artist} onChange={(e) => setArtist(e.target.value)} required />
        </label>

        <div className="field">
          <span>Category</span>
          <div className="a-chips">
            {CATEGORIES.map((c) => (
              <button type="button" key={c} className={`chip ${category === c ? "on" : ""}`} onClick={() => setCategory(category === c ? "" : c)} aria-pressed={category === c}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Admin password</span>
          <div className="pw">
            <input type={showPw ? "text" : "password"} placeholder="Required to upload" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"}>
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {busy && (
          <div className="bar" role="progressbar" aria-valuenow={progress} aria-valuemin="0" aria-valuemax="100">
            <i style={{ width: `${progress}%` }} />
          </div>
        )}

        {status && (
          <p className={`notice ${status.type}`} role="status">
            {status.text}
          </p>
        )}

        <button className="btn submit" type="submit" disabled={busy}>
          {busy ? `Uploading ${progress}%` : "Upload track"}
        </button>
      </form>
    </div>
  );
}

export default Admin;