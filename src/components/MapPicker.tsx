import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type MapPickerProps = {
  lat: number | null;
  lng: number | null;
  radius: number;
  onPick: (lat: number, lng: number) => void;
};

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom());
  }, [lat, lng, map]);
  return null;
}

export default function MapPicker({ lat, lng, radius, onPick }: MapPickerProps) {
  const hasCoords = lat !== null && lng !== null;
  const center: [number, number] = hasCoords ? [lat, lng] : [31.7683, 35.2137];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-300">
      <MapContainer center={center} zoom={13} style={{ height: '280px', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap'
        />
        <ClickHandler onPick={onPick} />
        {hasCoords && (
          <>
            <Marker position={[lat, lng]} />
            <Recenter lat={lat} lng={lng} />
            <Circle radius={radius} center={[lat, lng]} />
          </>
        )}
      </MapContainer>
      <div className="bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
        {hasCoords ? `נבחר: ${lat.toFixed(5)}, ${lng.toFixed(5)} · רדיוס ${radius}מ'` : 'לחצו על המפה לבחירת מיקום'}
      </div>
    </div>
  );
}

function Circle({ center, radius }: { center: [number, number]; radius: number }) {
  const map = useMap();
  useEffect(() => {
    const circle = L.circle(center, { radius, color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.12, weight: 2 });
    circle.addTo(map);
    return () => {
      circle.remove();
    };
  }, [center, radius, map]);
  return null;
}
