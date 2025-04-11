import React from 'react';

const benefits = [
  "Read Inquirer",
  "Borrow books, audiobooks, e-books",
  "Access digital magazines via Libby",
  "Borrow musical instruments",
  "Use free Wi-Fi and computers",
  "Borrow unique items (e.g., instruments, cake pans)",
  "Reserve and pick up materials from any branch",
  "Free online language learning resources",
  "Access virtual homework help and test prep",
  "Free job search help",
  "100+ research databases",
  "Borrow hobby kits (e.g., hiking, birding)",
  "No overdue fines",
  "Borrow audiobooks and eBooks via OverDrive",
  "Listen Classical Music Library",
  "Largest jazz music collection",
  "Listen to Smithsonian Global Sound tracks",
  "1,500+ online courses via Universal Class",
  "Learn languages with Mango Languages",
  "LinkedIn Learning for business, creative, and tech skills",
];

const LibraryCardBanner = () => {
  return (
    <a
      href="https://catalog.freelibrary.org/MyResearch/register"
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full bg-[#8B1E3F] text-white"
    >
      <div className="flex items-center w-full h-10">
        <div className="flex-none px-4 font-bold whitespace-nowrap text-sm sm:text-base">
          LIBRARY CARD BENEFITS
        </div>

        <div className="marquee-container flex-1">
          <div className="marquee-content">
            {benefits.concat(benefits).map((benefit, idx) => (
              <span key={idx} className="mx-3 text-sm">
                {benefit}
                <span className="text-white mx-2">&bull;</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </a>
  );
};

export default LibraryCardBanner;





