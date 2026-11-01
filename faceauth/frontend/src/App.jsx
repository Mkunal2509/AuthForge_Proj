import React, { useEffect, useRef, useState } from 'react';

export default function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [recognizedName, setRecognizedName] = useState('Position face in camera');
  const [confidence, setConfidence] = useState(0);
  const [enrollName, setEnrollName] = useState('Kunal Mahajan');
  const [enrollId, setEnrollId] = useState('kunal_01');
  const [status, setStatus] = useState('Ready');

  const isBusyRef = useRef(false);
  const lastCallRef = useRef(0);

  const snapFrame = () => {
    if (!videoRef.current) return null;
    const v = videoRef.current;
    const off = document.createElement('canvas');
    off.width = v.videoWidth || 640;
    off.height = v.videoHeight || 480;
    off.getContext('2d').drawImage(v, 0, 0, off.width, off.height);
    return off.toDataURL('image/jpeg', 0.85);
  };

  const handleEnroll = async () => {
    const frame = snapFrame();
    if (!frame) return;
    setStatus('Enrolling face...');
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/face/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: enrollId, display_name: enrollName, image_base64: frame })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail);
      setStatus(`Enrolled "${data.display_name}" successfully!`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const faceMesh = new window.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    faceMesh.onResults((results) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const pts = results.multiFaceLandmarks[0];
        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
        pts.forEach((p) => {
          const x = p.x * canvas.width;
          const y = p.y * canvas.height;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        });

        // Biometric targeting box
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

        // Throttle backend calls to every 600ms
        const now = performance.now();
        if (now - lastCallRef.current > 600 && !isBusyRef.current) {
          lastCallRef.current = now;
          isBusyRef.current = true;
          const frame = snapFrame();
          if (frame) {
            fetch('http://127.0.0.1:8000/api/v1/face/recognize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image_base64: frame })
            })
              .then((r) => r.json())
              .then((data) => {
                if (data.authenticated) {
                  setRecognizedName(data.name);
                  setConfidence(data.confidence);
                } else if (data.detected) {
                  setRecognizedName('Unknown Person');
                  setConfidence(0);
                }
              })
              .catch(() => {})
              .finally(() => { isBusyRef.current = false; });
          } else {
            isBusyRef.current = false;
          }
        }
      } else {
        setRecognizedName('No Face Detected');
        setConfidence(0);
      }
    });

    const camera = new window.Camera(video, {
      onFrame: async () => { await faceMesh.send({ image: video }); },
      width: 640,
      height: 480
    });
    camera.start();

    return () => {
      camera.stop();
      faceMesh.close();
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#070b14', padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f8fafc', marginBottom: 20 }}>
        AuthForge <span style={{ color: '#00f2fe' }}>Face Authentication</span>
      </h1>

      {/* Video Viewport with HUD */}
      <div style={{ position: 'relative', width: 640, height: 480, borderRadius: 16, overflow: 'hidden', border: '1px solid #1e293b', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
        <video ref={videoRef} playsInline muted style={{ position: 'absolute', top: 0, left: 0, width: 640, height: 480, transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} width={640} height={480} style={{ position: 'absolute', top: 0, left: 0, width: 640, height: 480, transform: 'scaleX(-1)' }} />

        {/* Floating Name Badge */}
        <div style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: recognizedName.includes('Unknown') || recognizedName.includes('No Face')
            ? 'rgba(239, 68, 68, 0.85)'
            : 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #00f2fe',
          padding: '10px 24px',
          borderRadius: 30,
          backdropFilter: 'blur(10px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxShadow: '0 8px 32px rgba(0,242,254,0.25)'
        }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>{recognizedName}</span>
          {confidence > 0 && (
            <span style={{ fontSize: 12, color: '#38bdf8', marginTop: 2 }}>Match Confidence: {confidence}%</span>
          )}
        </div>
      </div>

      {/* Enrollment Drawer */}
      <div style={{ marginTop: 24, display: 'flex', gap: 10, background: '#0f172a', padding: 14, borderRadius: 12, border: '1px solid #1e293b' }}>
        <input
          type="text"
          placeholder="User ID (e.g. kunal_01)"
          value={enrollId}
          onChange={(e) => setEnrollId(e.target.value)}
          style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: 8 }}
        />
        <input
          type="text"
          placeholder="Display Name"
          value={enrollName}
          onChange={(e) => setEnrollName(e.target.value)}
          style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', color: '#fff', borderRadius: 8 }}
        />
        <button
          onClick={handleEnroll}
          style={{ padding: '8px 20px', background: '#00f2fe', color: '#070b14', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
        >
          Enroll Current Face
        </button>
      </div>

      <p style={{ marginTop: 12, fontSize: 13, color: '#94a3b8' }}>Status: {status}</p>
    </div>
  );
}