
import React from 'react';

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
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
      d="M19.952 12.621a8.25 8.25 0 1 1-1.672-8.312M19.5 2.25v5.25h-5.25"
    />
  </svg>
);

export default RefreshIcon;
