
import React from 'react';

const CalendarDaysIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M3.75 12h16.5m-16.5 3.75h16.5M5.25 19.5h13.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6.75v10.5A2.25 2.25 0 005.25 19.5z"
    />
  </svg>
);

export default CalendarDaysIcon;
