import React, { useEffect, useState } from 'react';

const PetfinderGrid = ({ title = 'Adoptables', location = 'Philadelphia,PA', limit = 9 }) => {
  const [animals, setAnimals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnimals = async () => {
      try {
        const tokenRes = await fetch('https://api.petfinder.com/v2/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: 'uq7lkBZYjY2XRsw2SjZYKR2XO7ZIMgq0PkvGo5caapJ1NSXuGN',
            client_secret: 'DpiTwUmaPw2j4Bmo4wsVR1WOXFfBnFaoEjSpJPnN',
          }),
        });

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;

        const res = await fetch(
          `https://api.petfinder.com/v2/animals?location=19107&distance=10&limit=${limit}&sort=random`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        const data = await res.json();
        setAnimals(data.animals || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching animals:', error);
        setLoading(false);
      }
    };

    fetchAnimals();
  }, [location, limit]);

  return (
    <div className="w-full px-4 py-16 bg-white">
      <div className="max-w-screen-xl mx-auto">
        <h2 className="text-3xl font-bold text-black mb-8">{title}</h2>

        {loading ? (
          <div className="text-gray-500 text-center">Loading pets...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {animals.map((animal) => (
              <a
                key={animal.id}
                href={animal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow hover:shadow-lg transition transform hover:scale-105"
              >
                <img
                  src={animal.photos[0]?.large || 'https://placekitten.com/800/500'}
                  alt={animal.name}
                  className="w-full h-64 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-xl font-semibold text-gray-800 mb-1">{animal.name}</h3>
                  <p className="text-sm text-gray-600">
                    {animal.breeds.primary || animal.type}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PetfinderGrid;


