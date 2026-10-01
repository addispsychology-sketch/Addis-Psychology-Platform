export default function BrandMark({ size = 9 }: { size?: number }) {
  return <span className="brand-symbol" aria-hidden="true" style={{ width: size * 4, height: size * 4 }}>AP</span>;
}
