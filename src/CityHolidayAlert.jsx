import React, { useState, useEffect } from 'react';

// CityHolidayAlert.jsx
// Displays a city holiday alert for any observance week, plus a test holiday for today
export default function CityHolidayAlert() {
  const [activeHoliday, setActiveHoliday] = useState(null);

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const pad2 = n => String(n).padStart(2, '0');
    const toKey = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const todayKey = toKey(today);

    const holidays = {
      // 2025 Holidays
      '2025-01-01': "New Year's Day",
      '2025-01-20': "Martin Luther King, Jr. Day",
      '2025-02-17': "Presidents' Day",
      '2025-04-18': "Good Friday",
      '2025-05-26': "Memorial Day",
      '2025-06-19': "Juneteenth",
      '2025-07-04': "Independence Day",
      '2025-09-01': "Labor Day",
      '2025-10-13': "Indigenous Peoples' Day",
      '2025-11-11': "Veterans Day",
      '2025-11-27': "Thanksgiving",
      '2025-11-28': "Thanksgiving Friday",
      '2025-12-25': "Christmas Day",
      // 2026 Holidays
      '2026-01-01': "New Year's Day",
      '2026-01-19': "Martin Luther King, Jr. Day",
      '2026-02-16': "Presidents' Day",
      '2026-04-03': "Good Friday",
      '2026-05-25': "Memorial Day",
      '2026-06-19': "Juneteenth",
      '2026-07-04': "Independence Day",
      '2026-09-07': "Labor Day",
      '2026-10-12': "Indigenous Peoples' Day",
      '2026-11-11': "Veterans Day",
      '2026-11-26': "Thanksgiving",
      '2026-11-27': "Thanksgiving Friday",
      '2026-12-25': "Christmas Day",
    };

    Object.entries(holidays).some(([dateKey, name]) => {
      const [y, m, d] = dateKey.split('-').map(Number);
      const holidayDate = new Date(y, m - 1, d);
      holidayDate.setHours(0, 0, 0, 0);

      // Holiday week: day before through six days after
      const start = new Date(holidayDate);
      start.setDate(start.getDate() - 1);
      const end = new Date(holidayDate);
      end.setDate(end.getDate() + 4);

      if (today >= start && today <= end) {
        setActiveHoliday({
          name,
          date: holidayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          end: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        });
        return true;
      }
      return false;
    });
  }, []);

  if (!activeHoliday) return null;

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded text-center">
      🗑️ {`${activeHoliday.name} on ${activeHoliday.date}: Trash & recycling collection delayed by one day the week of.`}
    </div>
  );
}
