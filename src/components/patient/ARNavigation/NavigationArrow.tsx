import React from 'react';

interface NavigationArrowProps {
  relativeBearing: number;
}

const NavigationArrow: React.FC<NavigationArrowProps> = ({ relativeBearing }) => {
  return (
    <div
      className="transition-transform duration-500 ease-in-out will-change-transform"
      style={{ transform: `rotate(${relativeBearing}deg)` }}
    >
      <svg
        width="180"
        height="180"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg"
        style={{ filter: 'url(#arrow-glow)' }}
      >
        <defs>
          <filter id="arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M12 2L12 22M12 2L5 9M12 2L19 9"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default NavigationArrow;