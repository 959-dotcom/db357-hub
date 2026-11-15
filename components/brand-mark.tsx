export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
        <rect x="1" y="1" width="34" height="34" rx="9" fill="#060709" stroke="#D4AF37" />
        <text
          x="18"
          y="15.5"
          textAnchor="middle"
          fill="#E5C158"
          fontSize="7.5"
          fontFamily="ui-sans-serif, sans-serif"
          letterSpacing="1.6"
        >
          DB
        </text>
        <text
          x="18"
          y="26"
          textAnchor="middle"
          fill="#F5F5F7"
          fontSize="8"
          fontFamily="ui-sans-serif, sans-serif"
          letterSpacing="0.8"
        >
          357
        </text>
      </svg>
    </span>
  );
}
