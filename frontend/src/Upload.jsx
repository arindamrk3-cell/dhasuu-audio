import { useState } from "react";

const API = "http://localhost:5000";

function Upload() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [audio, setAudio] = useState(null);
  const [message, setMessage] = useState("");

  const handleUpload = async (e) => {
    e.preventDefault();

    if (!audio) {
      setMessage("Please select an audio file.");
      return;
    }

    const formData = new FormData();

    formData.append("title", title);
    formData.append("artist", artist);
    formData.append("audio", audio);

    try {
      const response = await fetch(`${API}/api/upload`, {
        method: "POST",
        headers: {
          "x-admin-key": "my-secret-key"
        },
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Audio uploaded successfully!");
        setTitle("");
        setArtist("");
        setAudio(null);
        e.target.reset();
      } else {
        setMessage(data.message || "Upload failed");
      }
    } catch (error) {
      setMessage("Server error");
    }
  };

  return (
    <div className="upload-box">
      <h2>Upload Audio</h2>

      <form onSubmit={handleUpload}>
        <input
          type="text"
          placeholder="Audio title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="text"
          placeholder="Artist"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />

        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setAudio(e.target.files[0])}
        />

        <button type="submit">
          Upload
        </button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}

export default Upload;