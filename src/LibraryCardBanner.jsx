import React from 'react';

const benefits = [
  'Read Inquirer',
  'Borrow books, audiobooks, e-books',
  'Access digital magazines via Libby',
  'Borrow musical instruments',
  'Use free Wi-Fi and computers',
  'Borrow unique items (instruments, cake pans)',
  'Reserve from any branch',
  'Free online language learning',
  'Virtual homework help & test prep',
  'Free job search help',
  '100+ research databases',
  'Borrow hobby kits (hiking, birding)',
  'No overdue fines',
  'Borrow audiobooks & eBooks via OverDrive',
  'Listen Classical Music Library',
  'Largest jazz music collection',
  'Listen Smithsonian Global Sound',
  '1,500+ online courses via Universal Class',
  'Learn languages with Mango Languages',
  'LinkedIn Learning access'
];

const LibraryCardBanner = () => {
  return (
    <a
      href="https://catalog.freelibrary.org/MyResearch/register"
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full bg-[#7a1f24] text-white overflow-hidden"
    >
      <div className="flex w-full">
        <div className="whitespace-nowrap flex-shrink-0 px-4 py-2 text-base font-extrabold tracking-wide bg-[#5f171b]">
          LIBRARY CARD BENEFITS
        </div>
        <div className="overflow-hidden relative flex-1">
        <div className="flex animate-marquee items-center whitespace-nowrap text-sm font-medium py-2">
        {[...benefits, ...benefits].map((b, idx) => (
              <span key={idx} className="inline-flex items-center">
                {b}
                <span className="mx-3 text-white text-xl leading-none">•</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </a>
  );
};

export default LibraryCardBanner;



