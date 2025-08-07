import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const logoUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';

const loadImage = src =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function drawSlide(ctx, ev, width, height, username) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  try {
    const logo = await loadImage(logoUrl);
    const logoW = 80;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, width / 2 - logoW / 2, 20, logoW, logoH);
  } catch (e) {
    /* ignore logo load errors */
  }

  ctx.fillStyle = '#000';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(username, width / 2, 110);

  if (ev.image) {
    try {
      const img = await loadImage(ev.image);
      const imgH = height * 0.6;
      ctx.drawImage(img, 0, 120, width, imgH);
    } catch (e) {
      /* ignore image errors */
    }
  }

  ctx.fillStyle = '#000';
  ctx.font = '24px bold sans-serif';
  ctx.fillText(ev.title, width / 2, height - 90);
  ctx.font = '18px sans-serif';
  ctx.fillText(ev.displayDate, width / 2, height - 60);
}

export default function UpcomingPlansVideo() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const profile = state?.profile;
  const events = state?.events || [];
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    if (!profile || events.length === 0) return;

    const width = 600;
    const height = 600;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream();
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    rec.ondataavailable = e => chunks.push(e.data);

    const username = profile.username || profile.slug;

    rec.start();
    (async () => {
      for (const ev of events) {
        await drawSlide(ctx, ev, width, height, username);
        await new Promise(r => setTimeout(r, 2000));
      }
      rec.stop();
    })();

    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    };

    return () => {
      stream.getTracks().forEach(t => t.stop());
    };
  }, [profile, events]);

  if (!profile || events.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        No plans to render.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-gray-500 hover:text-gray-700"
        aria-label="Close"
      >
        ×
      </button>
      {videoUrl ? (
        <>
          <video
            src={videoUrl}
            controls
            autoPlay
            className="w-72 h-72 mb-4 bg-black"
          />
          <a
            href={videoUrl}
            download="plans.webm"
            className="text-sm py-2 px-4 bg-green-600 text-white rounded"
          >
            DOWNLOAD VIDEO
          </a>
        </>
      ) : (
        <div className="text-white">Preparing video…</div>
      )}
    </div>
  );
}
