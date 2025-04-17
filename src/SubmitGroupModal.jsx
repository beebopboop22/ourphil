import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const GroupProgressBar = ({ goal = 1000 }) => {
  const [totalGroups, setTotalGroups] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count, error } = await supabase
        .from('groups')
        .select('*', { count: 'exact', head: true });

      if (!error && count !== null) {
        setTotalGroups(count);
      } else {
        console.error('Error fetching group count:', error);
      }
    };

    fetchCount();
  }, []);

  const percent = Math.min((totalGroups / goal) * 100, 100);

  return (
    <div className="w-full bg-neutral-100 py-4 px-4 border-b border-gray-200 mb-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
        <div className="text-sm text-gray-700">
          {totalGroups.toLocaleString()} of {goal.toLocaleString()} Philly groups indexed.
        </div>

        <div className="w-full md:flex-grow md:mx-4 h-2 bg-gray-300 rounded-full overflow-hidden min-w-[100px]">
          <div
            className="h-full bg-indigo-600 transition-all duration-1000 ease-in-out"
            style={{ width: `${percent}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

const SubmitGroupModal = ({ onClose }) => {
  const [form, setForm] = useState({
    Name: '',
    Link: ''
  });
  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const response = await fetch('https://formspree.io/f/mzzelpzb', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) throw new Error('Email sending failed');

      setStatus('success');
      setForm({ Name: '', Link: '' });
      setTimeout(onClose, 2000);
    } catch (err) {
      console.error('Submission error:', err);
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl p-6 relative animate-fade-in">
        <h2 className="text-3xl font-[Barrio] text-center mb-6">Submit a New Group</h2>

        <GroupProgressBar />

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <input
            type="text"
            name="Name"
            placeholder="Group Name"
            value={form.Name}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="url"
            name="Link"
            placeholder="Group Link (URL)"
            value={form.Link}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white px-4 py-3 rounded font-semibold hover:bg-indigo-700 transition"
          >
            Submit
          </button>

          {status === 'loading' && <p className="text-sm text-gray-500">Submitting...</p>}
          {status === 'success' && <p className="text-sm text-green-600">Group submitted!</p>}
          {status === 'error' && <p className="text-sm text-red-600">Error submitting group.</p>}
        </form>

        <button
          onClick={onClose}
          className="absolute top-2 right-3 text-gray-400 hover:text-black text-xl"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

export default SubmitGroupModal;

