import { useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const icon = L.icon({ iconUrl: markerIcon, shadowUrl: markerShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
const BOLIVIA_CENTER = [-16.5, -64.7];

async function reverseGeocode(lat, lng) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
  const data = await res.json();
  return data.display_name || '';
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng) });
  return null;
}

function LocateButton({ onLocate, loading }) {
  const map = useMap();
  async function handleClick() {
    onLocate(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.flyTo([pos.coords.latitude, pos.coords.longitude], 16);
        onLocate(false, { lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => onLocate(false),
      { enableHighAccuracy: true }
    );
  }
  return (
    <button type="button" className="btn-locate" onClick={handleClick} disabled={loading}>
      {loading ? 'Ubicando...' : '📍 Mi ubicación'}
    </button>
  );
}

export default function LocationPicker({ lat, lng, onChange }) {
  const position = lat && lng ? [Number(lat), Number(lng)] : null;
  const [locating, setLocating] = useState(false);

  async function handlePick(latlng) {
    const address = await reverseGeocode(latlng.lat, latlng.lng).catch(() => '');
    onChange(latlng.lat, latlng.lng, address);
  }

  return (
    <div className="location-picker">
      <div className="map-wrap">
        <MapContainer center={position || BOLIVIA_CENTER} zoom={position ? 15 : 6} style={{ height: '220px', width: '100%', borderRadius: '8px' }}>
          <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onPick={handlePick} />
          {position && <Marker position={position} icon={icon} />}
          {navigator.geolocation && (
            <LocateButton loading={locating} onLocate={(loading, latlng) => { setLocating(loading); if (latlng) handlePick(latlng); }} />
          )}
        </MapContainer>
      </div>
      <span className="muted small">{position ? `Punto: ${position[0].toFixed(5)}, ${position[1].toFixed(5)}` : 'Haz clic en el mapa para marcar la ubicación'}</span>
    </div>
  );
}
