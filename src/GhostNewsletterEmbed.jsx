import React, { useEffect, useRef } from 'react';

const GHOST_SIGNUP_SCRIPT = 'https://cdn.jsdelivr.net/ghost/signup-form@~0.3/umd/signup-form.min.js';

const GhostNewsletterEmbed = ({ className = '', style }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof document === 'undefined') {
      return () => {};
    }

    container.innerHTML = '';

    const script = document.createElement('script');
    script.src = GHOST_SIGNUP_SCRIPT;
    script.async = true;
    script.setAttribute('data-button-color', '#FF1A75');
    script.setAttribute('data-button-text-color', '#FFFFFF');
    script.setAttribute('data-site', 'https://our-philly.ghost.io/');
    script.setAttribute('data-locale', 'en');

    container.appendChild(script);

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        minHeight: '58px',
        maxWidth: '440px',
        margin: '0 auto',
        width: '100%',
        ...style,
      }}
    />
  );
};

export default GhostNewsletterEmbed;
