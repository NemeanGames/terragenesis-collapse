export default function VersionBadge() {
  return (
    <div style={{ position: "fixed", right: 8, bottom: 8, opacity: 0.6, fontSize: 12 }}>
      build: {String(__BUILD_ID__).slice(0, 7)}
    </div>
  );
}
