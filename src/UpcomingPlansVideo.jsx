import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// logo shown at the top of each slide
const logoUrl =
  'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';

// helper to load an image with CORS support
const loadImage = src =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

// draw an image so that it covers the given rect (like object-fit: cover)
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = img.width * scale;
  const sh = img.height * scale;
  const dx = x + (w - sw) / 2;
  const dy = y + (h - sh) / 2;
  ctx.drawImage(img, dx, dy, sw, sh);
}

// wrap long text in the center of the canvas
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + ' ';
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      lines.push(line.trim());
      line = words[i] + ' ';
    } else {
      line = test;
    }
  }
  lines.push(line.trim());
  lines.forEach((ln, idx) => ctx.fillText(ln, x, y + idx * lineHeight));
  return y + lines.length * lineHeight;
}

async function drawSlide(ctx, ev, width, height, username, logo) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  // event image
  if (ev.image) {
    try {
      const img = await loadImage(ev.image);
      drawCover(ctx, img, 0, 0, width, height);
    } catch (e) {
      // ignore image errors
    }
  }

  // gradient overlay for text readability
  const grad = ctx.createLinearGradient(0, height * 0.55, 0, height);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.8)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, height * 0.55, width, height * 0.45);

  // logo at the top
  try {
    const logoW = 180;
    const logoH = (logo.height / logo.width) * logoW;
    ctx.drawImage(logo, width / 2 - logoW / 2, 60, logoW, logoH);
  } catch (e) {
    // ignore logo errors
  }

  // username under logo
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = '64px "Barrio", sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 8;
  ctx.fillText(username, width / 2, 60 + 180 + 20);
  ctx.shadowBlur = 0;

  // event title
  await document.fonts.load('100px "Barrio"');
  ctx.font = '96px "Barrio", sans-serif';
  const endY = wrapText(ctx, ev.title, width / 2, height - 360, width - 160, 110);

  // event date
  ctx.font = '48px sans-serif';
  ctx.fillText(ev.displayDate, width / 2, endY + 20);

  ctx.restore();
}

export default function UpcomingPlansVideo() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const profile = state?.profile;
  const events = state?.events || [];
  const [videoUrl, setVideoUrl] = useState('');

  useEffect(() => {
    if (!profile || events.length === 0) return;

    const width = 1080;
    const height = 1920; // 9:16 aspect ratio for reels/TikTok
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30); // 30fps
    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
    rec.ondataavailable = e => chunks.push(e.data);

    const username = profile.username || profile.slug;

    (async () => {
      // ensure fonts are loaded before drawing
      await document.fonts.load('64px "Barrio"');
      const logo = await loadImage(logoUrl);
      rec.start();
      for (const ev of events) {
        await drawSlide(ctx, ev, width, height, username, logo);
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
            className="w-[270px] h-[480px] mb-4 bg-black"
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

