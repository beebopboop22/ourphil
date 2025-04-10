// src/SubmitGroupModal.jsx
import React, { useState } from 'react';
import { supabase } from './supabaseClient';

const SubmitGroupModal = ({ onClose }) => {
  const [form, setForm] = useState({
    Name: '',
    Link: '',
    Description: '',
    Type: '',
    Vibes: '',
  });
  const [status, setStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('loading');

    const { error } = await supabase.from('pending_groups').insert([form]);

    if (error) {
      console.error('Submission error:', error);
      setStatus('error');
    } else {
      setStatus('success');
      setForm({ Name: '', Link: '', Description: '', Type: '', Vibes: '' });
      setTimeout(onClose, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl p-6 relative animate-fade-in">
        <h2 className="text-xl font-bold mb-4">Submit a New Group</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <textarea
            name="Description"
            placeholder="Short description of the group"
            value={form.Description}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="text"
            name="Type"
            placeholder="Type (e.g. Book Club, Sports)"
            value={form.Type}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
          <input
            type="text"
            name="Vibes"
            placeholder="Vibes (tags, comma-separated)"
            value={form.Vibes}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded px-3 py-2"
          />

          <button
            type="submit"
            className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 transition"
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