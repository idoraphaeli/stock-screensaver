import './ScreenIndicator.css';

interface ScreenIndicatorProps {
  total: number;
  activeIndex: number;
  intervalMs: number;
  onSelect: (index: number) => void;
}

function ScreenIndicator({ total, activeIndex, intervalMs, onSelect }: ScreenIndicatorProps) {
  return (
    <div className="screen-indicator">
      {Array.from({ length: total }).map((_, index) => (
        <button
          key={index}
          className="indicator-track"
          onClick={() => onSelect(index)}
          aria-label={`עבור למסך ${index + 1}`}
        >
          {index === activeIndex ? (
            <span
              className="indicator-progress"
              // Remounting the element (via key) restarts the CSS animation
              // every time this becomes the active slide.
              key={activeIndex}
              style={{ animationDuration: `${intervalMs}ms` }}
            />
          ) : (
            <span className="indicator-fill" />
          )}
        </button>
      ))}
    </div>
  );
}

export default ScreenIndicator;
