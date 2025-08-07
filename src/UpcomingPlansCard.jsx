import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { RRule } from 'rrule';

const logoUrl = 'https://qdartpzrxmftmaftfdbd.supabase.co/storage/v1/object/public/group-images//logoo.png';

function parseEventsDate(str) {
  if (!str) return null;
  const [first] = str.split(/through|–|-/);
  const [m, d, y] = first.trim().split('/').map(Number);
  return new Date(y, m - 1, d);
}

function parseISODateLocal(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(date, startTime) {
  if (!date) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  let prefix;
  if (diffDays === 0) prefix = 'Today';
  else if (diffDays === 1) prefix = 'Tomorrow';
  else if (diffDays > 1 && diffDays < 7) prefix = `This ${weekday}`;
  else prefix = weekday;
  const datePart = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  let timePart = '';
  if (startTime) {
    const [h = 0, m = 0] = startTime.split(':').map(Number);
    const dt = new Date();
    dt.setHours(h, m);
    timePart = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  return `${prefix}, ${datePart}${timePart ? `, ${timePart}` : ''}`;
}

export default function UpcomingPlansCard() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id,username,slug,image_url')
        .eq('slug', slug)
        .single();
      if (!prof) {
        setLoading(false);
        return;
      }
      setProfile(prof);

      const { data: favs } = await supabase
        .from('event_favorites')
        .select('event_id,event_int_id,event_uuid,source_table')
        .eq('user_id', prof.id);

      const idsByTable = {};
      (favs || []).forEach(r => {
        const tbl = r.source_table;
        let id;
        if (tbl === 'all_events') id = r.event_int_id;
        else if (tbl === 'events') id = r.event_id;
        else id = r.event_uuid;
        if (!id) return;
        idsByTable[tbl] = idsByTable[tbl] || [];
        idsByTable[tbl].push(id);
      });

      const all = [];
      if (idsByTable.all_events?.length) {
        const { data } = await supabase
          .from('all_events')
          .select('id,name,slug,image,start_date,venues:venue_id(name,slug)')
          .in('id', idsByTable.all_events);
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e.name,
            image: e.image,
            start_date: e.start_date,
            source_table: 'all_events',
          });
        });
      }
      if (idsByTable.events?.length) {
        const { data } = await supabase
          .from('events')
          .select('id,slug,"E Name","E Image",Dates')
          .in('id', idsByTable.events);
        data?.forEach(e => {
          all.push({
            id: e.id,
            slug: e.slug,
            title: e['E Name'],
            image: e['E Image'],
            start_date: e.Dates,
            source_table: 'events',
          });
        });
      }
      if (idsByTable.big_board_events?.length) {
        const { data } = await supabase
          .from('big_board_events')
          .select('id,slug,title,start_date,start_time,big_board_posts!big_board_posts_event_id_fkey(image_url)')
          .in('id', idsByTable.big_board_events);
        data?.forEach(ev => {
          let img = '';
          const path = ev.big_board_posts?.[0]?.image_url || '';
          if (path) {
            const { data: { publicUrl } } = supabase.storage
              .from('big-board')
              .getPublicUrl(path);
            img = publicUrl;
          }
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: img,
            source_table: 'big_board_events',
          });
        });
      }
      if (idsByTable.group_events?.length) {
        const { data } = await supabase
          .from('group_events')
          .select('id,slug,title,start_date,start_time,groups(imag,slug)')
          .in('id', idsByTable.group_events);
        data?.forEach(ev => {
          all.push({
            id: ev.id,
            slug: ev.slug,
            title: ev.title,
            start_date: ev.start_date,
            start_time: ev.start_time,
            image: ev.groups?.imag || '',
            source_table: 'group_events',
          });
        });
      }
      if (idsByTable.recurring_events?.length) {
        const { data } = await supabase
          .from('recurring_events')
          .select('id,slug,name,start_date,start_time,end_date,rrule,image_url')
          .in('id', idsByTable.recurring_events);
        data?.forEach(ev => {
          try {
            const opts = RRule.parseString(ev.rrule);
            opts.dtstart = new Date(`${ev.start_date}T${ev.start_time}`);
            if (ev.end_date) opts.until = new Date(`${ev.end_date}T23:59:59`);
            const rule = new RRule(opts);
            const today0 = new Date();
            today0.setHours(0, 0, 0, 0);
            const next = rule.after(today0, true);
            if (next) {
              all.push({
                id: ev.id,
                slug: ev.slug,
                title: ev.name,
                start_date: next.toISOString().slice(0, 10),
                start_time: ev.start_time,
                image: ev.image_url,
                source_table: 'recurring_events',
              });
            }
          } catch (err) {
            console.error('rrule parse', err);
          }
        });
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = all
        .map(ev => {
          const d =
            ev.source_table === 'events'
              ? parseEventsDate(ev.start_date)
              : parseISODateLocal(ev.start_date);
          const display = formatDisplayDate(d, ev.start_time);
          return { ...ev, _date: d, displayDate: display };
        })
        .filter(ev => ev._date && ev._date >= today)
        .sort((a, b) => a._date - b._date)
        .slice(0, 5)
        .map(({ _date, ...rest }) => rest);

      setEvents(upcoming);
      setLoading(false);
    };
    load();
  }, [slug]);

  const embedImages = async node => {
    const imgs = Array.from(node.getElementsByTagName('img'));
    const originals = [];
    await Promise.all(
      imgs.map(async img => {
        if (img.src.startsWith('data:')) return;
        originals.push([img, img.src]);
        try {
          const res = await fetch(img.src, { mode: 'cors' });
          if (!res.ok) {
            throw new Error(`Failed to fetch ${img.src}: ${res.status}`);
          }
          const blob = await res.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise(resolve => {
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
          img.src = dataUrl;
        } catch (e) {
          console.warn('embed image', e);
        }
      })
    );
    return () => {
      originals.forEach(([img, src]) => {
        img.src = src;
      });
    };
  };

  const handleShare = async () => {
    const card = document.getElementById('plans-card');
    if (!card) return;
    try {
      const { toBlob } = await import('https://esm.sh/html-to-image');
      const cleanup = await embedImages(card);
      const blob = await toBlob(card, {
        pixelRatio: 2,
        cacheBust: true,
        // Exclude elements (like the close and share buttons) marked with data-no-export
        filter: node => !(node instanceof HTMLElement && node.dataset.noExport !== undefined),
      });
      cleanup();
      if (!blob) throw new Error('image generation failed');
      const file = new File([blob], 'plans.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Philly plans' });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'plans.png';
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error(err);
      alert('Unable to share image');
    }
  };

  const loadImage = src =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const drawSlide = async (ctx, ev, width, height, username) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    try {
      const logo = await loadImage(logoUrl);
      const logoW = 80;
      const logoH = (logo.height / logo.width) * logoW;
      ctx.drawImage(logo, width / 2 - logoW / 2, 20, logoW, logoH);
    } catch (e) {
      console.warn('logo load', e);
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
        console.warn('event img', e);
      }
    }

    ctx.fillStyle = '#000';
    ctx.font = '24px bold sans-serif';
    ctx.fillText(ev.title, width / 2, height - 90);
    ctx.font = '18px sans-serif';
    ctx.fillText(ev.displayDate, width / 2, height - 60);
  };

  const handleVideoDownload = async () => {
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
    for (const ev of events) {
      await drawSlide(ctx, ev, width, height, username);
      await new Promise(r => setTimeout(r, 2000));
    }
    rec.stop();
    const blob = await new Promise(resolve => {
      rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });
    const url = URL.createObjectURL(blob);
    const win = window.open('');
    if (win) {
      win.document.body.innerHTML = `<video controls autoplay src="${url}" style="width:100%"></video>` +
        `<a href="${url}" download="plans.webm" style="display:block;margin-top:1rem">Download video</a>`;
    } else {
      const link = document.createElement('a');
      link.href = url;
      link.download = 'plans.webm';
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-50 flex items-center justify-center">Loading…</div>;
  }
  if (!profile) {
    return <div className="min-h-screen bg-neutral-50 flex items-center justify-center">Profile not found</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center py-8">
      <div
        id="plans-card"
        className="relative bg-white w-full max-w-sm rounded-lg shadow flex flex-col px-4 pt-6 pb-4"
      >
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
          data-no-export
        >
          ×
        </button>
        <header className="flex items-center justify-center gap-2 mb-3">
          <img src={logoUrl} alt="Our Philly" className="h-8" crossOrigin="anonymous" />
          <span className="text-[10px] text-gray-600">Make your Philly plans at ourphilly.org</span>
        </header>
        <div className="flex flex-col items-center mb-2">
          {profile.image_url && (
            <img
              src={profile.image_url}
              alt="avatar"
              className="w-12 h-12 rounded-full object-cover mb-1"
              crossOrigin="anonymous"
            />
          )}
          <span className="text-sm font-semibold">{profile.username || profile.slug}</span>
        </div>
        {events.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">No upcoming events saved.</div>
        ) : (
          <>
            <div className="text-center text-xs uppercase tracking-wide text-gray-500 border-b pb-1 mb-2">
              Upcoming plans
            </div>
            <ul className="flex-1 divide-y overflow-hidden">
              {events.map(ev => (
                <li key={`${ev.source_table}-${ev.id}`} className="flex items-center gap-4 py-4">
                  {ev.image && (
                    <img
                      src={ev.image}
                      alt=""
                      className="w-24 h-16 object-cover rounded"
                      crossOrigin="anonymous"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-base font-semibold truncate">{ev.title}</div>
                    <div className="text-sm text-gray-600">{ev.displayDate}</div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        <button
          onClick={handleShare}
          className="w-full mt-4 text-sm py-2 bg-indigo-600 text-white rounded"
          data-no-export
        >
          SHARE YOUR PLAN CARD
        </button>
        <button
          onClick={handleVideoDownload}
          className="w-full mt-2 text-sm py-2 bg-green-600 text-white rounded"
          data-no-export
        >
          DOWNLOAD VIDEO POST
        </button>
      </div>
    </div>
  );
}

