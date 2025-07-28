import React, { useState } from 'react';

export default function SubmitEventSection({ onNext }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');

  const handleChange = e => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  return (
    <div className="max-w-md mx-auto text-center py-12">
      <h2 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-6">
        Submit an Event
      </h2>
      <input
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="mx-auto"
      />
      {preview && (
        <img
          src={preview}
          alt="Preview"
          className="mt-4 w-full h-48 object-cover rounded"
        />
      )}
      <button
        onClick={() => onNext(file)}
        disabled={!file}
        className="mt-4 bg-indigo-600 text-white px-6 py-3 rounded-full disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
