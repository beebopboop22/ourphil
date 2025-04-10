// src/SeptaAlertBanner.jsx
import React, { useEffect, useState } from 'react';

const SeptaAlertBanner = () => {
  const [alerts, setAlerts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const response = await fetch('https://www3.septa.org/api/Alerts/get_alert_data.php');
        const data = await response.json();
        const alertMessages = Object.values(data)
          .filter(item => item.message)
          .map(item => item.message);

        if (alertMessages.length === 0) {
          alertMessages.push("✅ No current SEPTA alerts. Enjoy the ride!");
        }

        setAlerts(alertMessages);
      } catch (error) {
        console.error('Error fetching SEPTA alerts:', error);
        setAlerts(["⚠️ Unable to load SEPTA alerts. Please try again later."]);
      }
    };

    fetchAlerts();

    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % alerts.length);
    }, 8000); // Rotate every 8 seconds

    return () => clearInterval(interval);
  }, [alerts.length]);

  if (!alerts.length) return null;

  return (
    <div className="w-full bg-yellow-100 text-yellow-900 text-sm py-2 px-4 border-b border-yellow-300 shadow-sm font-medium text-center animate-pulse">
    🚧 {alerts[currentIndex]}
  </div>
  );
};

export default SeptaAlertBanner;
