export default function Banner({ error, message }) {
  if (!error && !message) return null;
  return <div className={`banner ${error ? 'banner-error' : 'banner-ok'}`}>{error || message}</div>;
}
