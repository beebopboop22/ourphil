import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NavbarSearch({
  placeholder = 'Search upcoming events',
  onFocus,
  onSubmitComplete,
  className = '',
  inputClassName = '',
  buttonClassName = '',
}) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = term.trim();
    const target = trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search';
    navigate(target);
    if (typeof onSubmitComplete === 'function') {
      onSubmitComplete();
    }
  };

  return (
    <form
      className={`relative flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 shadow-sm transition focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 ${className}`.trim()}
      onSubmit={handleSubmit}
    >
      <SearchIcon className="h-4 w-4 text-gray-500" aria-hidden="true" />
      <input
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        onFocus={onFocus}
        placeholder={placeholder}
        className={`flex-1 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none ${inputClassName}`.trim()}
        aria-label="Search events"
      />
      <button
        type="submit"
        className={`rounded-full bg-indigo-600 px-4 py-1 text-sm font-semibold text-white transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${buttonClassName}`.trim()}
      >
        Search
      </button>
    </form>
  );
}
