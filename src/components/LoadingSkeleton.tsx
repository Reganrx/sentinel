import "./LoadingSkeleton.css";

export default function LoadingSkeleton({ lines = 4 }: { lines?: number }) {
  return <div className="sentinel-skeleton" aria-label="Loading live Sentinel data">{Array.from({ length: lines }, (_, index) => <i key={index} />)}</div>;
}
