import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function GroupEventForm({ groupId, userId, onSubmitSuccess }) {
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate]     = useState('');
  const [startTime, setStartTime]     = useState('');
  const [posting, setPosting]         = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPosting(true);

    const { error } = await supabase
      .from('group_events')
      .insert([{
        group_id:    groupId,
        user_id:     userId,
        title,
        description,
        start_date:  startDate,
        start_time:  startTime || null,
      }]);

    setPosting(false);
    if (error) {
      console.error('Error posting event:', error);
      alert('Failed to create event.');
    } else {
      // reset fields
      setTitle(''); setDescription(''); setStartDate(''); setStartTime('');
      onSubmitSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-md mb-8">
      <input
        type="text"
        className="w-full border rounded p-2 mb-2"
        placeholder="Event Title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
      />
      <textarea
        className="w-full border rounded p-2 mb-2"
        placeholder="Description (optional)"
        value={description}
        onChange={e => setDescription(e.target.value)}
      />
      <div className="flex space-x-2 mb-2">
        <input
          type="date"
          className="border rounded p-2 flex-1"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
          required
        />
        <input
          type="time"
          className="border rounded p-2 flex-1"
          value={startTime}
          onChange={e => setStartTime(e.target.value)}
        />
      </div>
      <button
        type="submit"
        disabled={posting}
        className="bg-indigo-600 text-white font-bold px-6 py-2 rounded hover:bg-indigo-700 transition"
      >
        {posting ? 'Posting…' : 'Create Event'}
      </button>
    </form>
  );
}

export default GroupEventForm;
