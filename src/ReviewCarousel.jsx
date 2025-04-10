// src/ReviewCarousel.jsx
import React, { useState } from 'react';

const reviews = [
  {
    name: 'Ashley',
    location: 'Dallas - Fort Worth',
    reviews: '2 reviews',
    daysAgo: 'Dined 1 day ago',
    text: 'I loved the love!!! phenomenal people and food. loved the cozy ambiance. everything felt like a warm hug.',
    restaurant: 'The Love',
    price: '$$$$',
    category: 'American',
    neighborhood: 'Rittenhouse Square',
    rating: 4.9
  },
  {
    name: 'Scott',
    location: 'Los Angeles',
    reviews: '3 reviews',
    daysAgo: 'Dined 1 day ago',
    text: 'This was just as good as any steakhouse in Chicago LA or NY. Our server was quite possibly the best server I have ever had. Overall amazing experience.',
    restaurant: 'Barclay Prime',
    price: '$$$$',
    category: 'Steakhouse',
    neighborhood: 'Rittenhouse Square',
    rating: 4.8
  },
  {
    name: 'Mariana',
    location: 'Chicago / Illinois',
    reviews: '4 reviews',
    daysAgo: 'Dined 2 days ago',
    text: 'Delicious food , pretty place and good service. I totally recommend it!',
    restaurant: 'Parc',
    price: '$$$$',
    category: 'French',
    neighborhood: 'Rittenhouse Square',
    rating: 4.8
  },
  {
    name: 'Katie',
    location: 'Orlando / Central Florida East',
    reviews: '1 review',
    daysAgo: 'Dined 3 days ago',
    text: 'Excellent and fun atmosphere. Fantastic service and delicious food',
    restaurant: 'Continental Midtown',
    price: '$$$$',
    category: 'American',
    neighborhood: 'Center City',
    rating: 4.7
  }
];

const ReviewCarousel = () => {
  const [startIndex, setStartIndex] = useState(0);

  const handlePrev = () => {
    setStartIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const handleNext = () => {
    setStartIndex((prev) => (prev + 1) % reviews.length);
  };

  const visibleReviews = [
    reviews[startIndex],
    reviews[(startIndex + 1) % reviews.length],
    reviews[(startIndex + 2) % reviews.length],
  ];

  return (
    <div className="w-full bg-gray-100 py-12">
      <div className="max-w-screen-xl mx-auto px-4">

        <div className="flex items-center justify-center gap-4">
          <button onClick={handlePrev} className="p-2">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex gap-6">
            {visibleReviews.map((review, idx) => (
              <div
                key={idx}
                className="bg-white rounded-xl shadow-md p-5 w-80 hover:shadow-xl transition-transform hover:scale-105"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-gray-300 w-8 h-8 rounded-full flex items-center justify-center font-bold text-indigo-700">
                    {review.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-black">{review.name}</p>
                    <p className="text-xs text-gray-600">{review.location} • {review.reviews}</p>
                    <p className="text-xs text-gray-600">{review.daysAgo}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-800 mb-4">{review.text}</p>
                <hr className="my-2" />
                <div className="text-base text-black font-semibold mb-1">{review.restaurant}</div>
                <div className="text-xs text-gray-700">
                  {review.price} • {review.category} • {review.neighborhood}
                </div>
                <div className="mt-2 text-yellow-500 text-sm">
                  {'⭐'.repeat(Math.floor(review.rating))}
                  <span className="text-gray-600 text-xs ml-1">{review.rating}</span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleNext} className="p-2">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewCarousel;
