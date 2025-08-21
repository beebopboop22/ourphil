import React, { useEffect, useState, useContext, useRef } from 'react';
import { supabase } from './supabaseClient';
import ProgressBar from './ProgressBar.jsx';
import SavedEventCard from './SavedEventCard.jsx';
import CultureModal from './CultureModal.jsx';
import { AuthContext } from './AuthProvider';
import useProfile from './utils/useProfile';
import useProfileTags from './utils/useProfileTags';
import imageCompression from 'browser-image-compression';
import { Link } from 'react-router-dom';

export default function OnboardingFlow({ onComplete = () => {}, demo = false }) {
  const total = 3;
  const [step, setStep] = useState(1);
  const [finished, setFinished] = useState(false);

  const next = () => setStep(s => Math.min(total, s + 1));
  const back = () => setStep(s => Math.max(1, s - 1));
  const skip = () => next();

  // Step 1: upcoming events
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (step !== 1) return;
    (async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('all_events')
        .select('id,slug,name,start_date,image,venue_id(slug,name)')
        .gte('start_date', today)
        .order('start_date')
        .limit(20);
      setEvents(data || []);
    })();
  }, [step]);

  // Step 2: tags
  const [tags, setTags] = useState([]);
  const [tagSel, setTagSel] = useState(new Set());
  const pillStyles = [
    'bg-red-100 text-red-800',
    'bg-green-100 text-green-800',
    'bg-blue-100 text-blue-800',
    'bg-yellow-100 text-yellow-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-teal-100 text-teal-800',
    'bg-orange-100 text-orange-800',
    'bg-lime-100 text-lime-800',
  ];
  useEffect(() => {
    if (step !== 2) return;
    supabase
      .from('tags')
      .select('id,name')
      .order('name')
      .limit(30)
      .then(({ data }) => setTags(data || []));
  }, [step]);
  const toggleTag = id => {
    setTagSel(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Step 3: profile
  const { user } = useContext(AuthContext);
  const { profile, updateProfile } = useProfile();
  const { tags: existingCultures, saveTags } = useProfileTags('culture');
  const [username, setUsername] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [cultures, setCultures] = useState([]);
  const [showCultures, setShowCultures] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (step === 3 && profile) {
      setUsername(profile.username || profile.slug || '');
      setImageUrl(profile.image_url || '');
      setCultures((existingCultures || []).map(t => t.id));
    }
  }, [step, profile, existingCultures]);

  const handleFile = async e => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await imageCompression(file, { maxWidthOrHeight: 512 });
    const name = `${user.id}-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(name, compressed, { upsert: true });
    if (!uploadError) {
      const { data } = supabase.storage
        .from('profile-images')
        .getPublicUrl(name);
      setImageUrl(data.publicUrl);
    }
  };

  const saveProfile = async () => {
    if (demo) return;
    await updateProfile({ username, image_url: imageUrl });
    await saveTags(cultures);
  };

  // Step 2 save subscriptions
  const saveTagsStep = async () => {
    if (demo || !user) return;
    const rows = Array.from(tagSel).map(tag_id => ({ user_id: user.id, tag_id }));
    await supabase.from('user_subscriptions').delete().eq('user_id', user.id);
    if (rows.length) {
      await supabase.from('user_subscriptions').insert(rows);
    }
  };

  const finish = async () => {
    await saveProfile();
    await saveTagsStep();
    setFinished(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-4">
        {!finished && step === 1 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Add some events to your plans</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {events.map(ev => (
                <div key={ev.id} className="w-64 flex-shrink-0">
                  <SavedEventCard event={{
                    id: ev.id,
                    slug: ev.slug,
                    title: ev.name,
                    image: ev.image,
                    imageUrl: ev.image,
                    start_date: ev.start_date,
                    venues: ev.venue_id,
                    source_table: 'all_events',
                  }} />
                </div>
              ))}
            </div>
          </div>
        )}
        {!finished && step === 2 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Pick tags for your daily email</h2>
            <div className="flex flex-wrap gap-3">
              {tags.map((t, i) => {
                const sel = tagSel.has(t.id);
                const cls = sel ? pillStyles[i % pillStyles.length] : 'bg-gray-200 text-gray-700';
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className={`${cls} px-4 py-2 rounded-full text-sm font-semibold`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!finished && step === 3 && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Customize your profile</h2>
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                {imageUrl ? (
                  <img src={imageUrl} alt="avatar" className="w-24 h-24 rounded-full object-cover" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-300" />
                )}
                <input type="file" ref={fileRef} className="hidden" onChange={handleFile} />
                <button
                  className="absolute bottom-0 right-0 bg-black/60 text-white text-xs px-2 py-1 rounded"
                  onClick={() => fileRef.current?.click()}
                >
                  Change
                </button>
              </div>
              <input
                className="border px-3 py-1 rounded w-full max-w-xs"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
              />
              <button
                onClick={() => setShowCultures(true)}
                className="underline"
              >
                {cultures.length ? `${cultures.length} cultures selected` : 'Select cultures'}
              </button>
            </div>
            {showCultures && (
              <CultureModal
                initial={cultures}
                onSave={ids => {
                  setCultures(ids);
                  setShowCultures(false);
                }}
                onClose={() => setShowCultures(false)}
              />
            )}
          </div>
        )}
        {finished && (
          <div className="space-y-4 text-center">
            <h2 className="text-2xl font-bold">You're all set!</h2>
            <p>Where to next?</p>
            <div className="flex flex-col gap-3">
              <Link to="/today" onClick={onComplete} className="bg-indigo-600 text-white px-4 py-2 rounded">
                Events today
              </Link>
              <Link to="/tomorrow" onClick={onComplete} className="bg-indigo-600 text-white px-4 py-2 rounded">
                Events tomorrow
              </Link>
              <Link to="/weekend" onClick={onComplete} className="bg-indigo-600 text-white px-4 py-2 rounded">
                Events this weekend
              </Link>
              <Link to="/groups" onClick={onComplete} className="bg-indigo-600 text-white px-4 py-2 rounded">
                Explore groups
              </Link>
            </div>
          </div>
        )}

        {!finished && <ProgressBar current={step} total={total} />}

        {!finished && (
          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <button onClick={back} className="text-sm underline">Back</button>
            ) : <span />}
            {step < total ? (
              <div className="space-x-2">
                <button onClick={skip} className="text-sm underline">Skip</button>
                <button onClick={async () => {
                  if (step === 2) await saveTagsStep();
                  if (step === 3) await saveProfile();
                  next();
                }} className="bg-indigo-600 text-white px-4 py-1 rounded">
                  Next
                </button>
              </div>
            ) : (
              <button onClick={finish} className="bg-indigo-600 text-white px-4 py-1 rounded">Finish</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
