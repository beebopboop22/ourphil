import React, { useState } from 'react';

export default function SubmitEventSection({ onNext, title = 'Submit to community calendar' }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const totalSteps = 5;

  const handleChange = e => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  };

  return (
    <div className="bg-gray-50 py-28">
      <div className="max-w-md mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-[Barrio] text-gray-800 mb-6">
          {title}
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
        <div className="mt-8">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span>Step 1 of {totalSteps}</span>
            <span>{Math.round((1/totalSteps)*100)}%</span>
          </div>
          <div className="w-full bg-gray-200 h-2 rounded">
            <div
              className="h-2 bg-indigo-600 rounded"
              style={{ width: `${(1/totalSteps)*100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
