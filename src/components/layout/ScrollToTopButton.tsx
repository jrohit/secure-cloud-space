import throttle from "lodash/throttle";
import { ArrowUp } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

// If using lucide-react, uncomment the next line
// import { ArrowUp } from 'lucide-react';

const VISIBILITY_THRESHOLD = 1; // Show button if scrolled more than 1px

const ScrollToTopButton: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = useCallback(() => {
    // console.log('ScrollToTopButton: window.scrollY =', window.scrollY); // Debugging line removed
    if (window.scrollY > VISIBILITY_THRESHOLD) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, []); // VISIBILITY_THRESHOLD is a const, so not needed in deps

  const throttledScrollHandler = useMemo(
    () => throttle(handleScroll, 100),
    [handleScroll]
  );

  useEffect(() => {
    window.addEventListener("scroll", throttledScrollHandler);
    throttledScrollHandler(); // Initial check on mount
    return () => {
      window.removeEventListener("scroll", throttledScrollHandler);
      throttledScrollHandler.cancel();
    };
  }, [throttledScrollHandler]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // console.log('ScrollToTopButton: isVisible state =', isVisible); // Debugging line removed

  return (
    <button
      onClick={scrollToTop}
      className={`scroll-to-top-button ${
        !isVisible ? "scroll-to-top-button-hidden" : ""
      }`}
      aria-label="Scroll to top"
      aria-hidden={!isVisible}
      tabIndex={isVisible ? 0 : -1}
    >
      {/* If using lucide-react: <ArrowUp size={20} /> */}
      <ArrowUp size={40} />
    </button>
  );
};

export default ScrollToTopButton;
