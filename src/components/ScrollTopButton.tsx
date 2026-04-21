import { useEffect, useState } from 'react';
import './ScrollTopButton.css';

export const ScrollTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 340);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button type="button" className="scroll-top-button" onClick={handleClick} aria-label="Наверх">
      ↑ Наверх
    </button>
  );
};
