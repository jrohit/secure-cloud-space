import React, { useState, useEffect, useCallback, useMemo } from 'react';
import throttle from 'lodash/throttle';

// If using lucide-react, uncomment the next line
// import { ArrowUp } from 'lucide-react';

const VISIBILITY_THRESHOLD = 50; // Temporarily lowered for testing

const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = useCallback(() => {
    console.log('ScrollToTopButton: window.scrollY =', window.scrollY); // Debugging line
    if (window.scrollY > VISIBILITY_THRESHOLD) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []); // VISIBILITY_THRESHOLD is a const, so not needed in deps

  const throttledScrollHandler = useMemo(
    () => throttle(handleScroll, 100), // Throttle to 100ms still, fine for testing scrollY log
    [handleScroll]
  );

  useEffect(() => {
    window.addEventListener('scroll', throttledScrollHandler);
    // Call handler once on mount to set initial state if page is already scrolled
    throttledScrollHandler();
    return () => {
      window.removeEventListener('scroll', throttledScrollHandler);
      throttledScrollHandler.cancel(); // Clean up throttle
    };
  }, [throttledScrollHandler]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  console.log('ScrollToTopButton: isVisible state =', isVisible); // Debugging line

  return (
    <button
      onClick={scrollToTop}
      className="scroll-to-top-button"
      aria-label="Scroll to top"
    >
      {/* If using lucide-react: <ArrowUp size={20} /> */}
      Top
    </button>
  );
};

export default ScrollToTopButton;
