'use client';

type HomeFeatureBarProps = {
  featureItems: string[];
};

export default function HomeFeatureBar({ featureItems }: HomeFeatureBarProps) {
  return (
    <div className="feature-zone" id="feature-zone">
      <div className="feature-bar" id="feature-bar" aria-label="Key features">
        <div className="container" role="list">
          {featureItems.map((item) => (
            <span className="dot" role="listitem" key={item}>
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

