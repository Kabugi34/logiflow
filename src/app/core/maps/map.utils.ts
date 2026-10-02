import * as L from 'leaflet';

export const MAPBOX_ACCESS_TOKEN = '';
export const KENYA_MAP_CENTER: L.LatLngTuple = [-1.286389, 36.817223];

export function addMapBaseLayer(map: L.Map): void {
  if (MAPBOX_ACCESS_TOKEN) {
    L.tileLayer(
      `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}?access_token=${MAPBOX_ACCESS_TOKEN}`,
      {
        maxZoom: 20,
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    ).addTo(map);
    return;
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
}

export function addCurrentLocationControl(map: L.Map): void {
  let locationMarker: L.CircleMarker | undefined;
  let accuracyCircle: L.Circle | undefined;
  let locateButton: HTMLButtonElement | undefined;

  const locate = (): void => {
    map.locate({ setView: true, maxZoom: 14, enableHighAccuracy: true, timeout: 10000 });
  };

  const control = new L.Control({ position: 'topleft' });
  control.onAdd = () => {
    const container = L.DomUtil.create('div', 'leaflet-bar');
    locateButton = L.DomUtil.create('button', '', container);
    locateButton.type = 'button';
    locateButton.textContent = '⌖';
    locateButton.title = 'Show my current location';
    locateButton.setAttribute('aria-label', 'Show my current location');
    locateButton.style.cssText = 'width:34px;height:34px;border:0;background:#fff;color:#1e293b;font-size:22px;line-height:1;cursor:pointer';
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(locateButton, 'click', (event: Event) => {
      L.DomEvent.preventDefault(event);
      locate();
    });
    return container;
  };
  control.addTo(map);

  map.on('locationfound', (event: L.LocationEvent) => {
    const markerStyle = { radius: 7, color: '#ffffff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 };
    if (locationMarker) {
      locationMarker.setLatLng(event.latlng);
    } else {
      locationMarker = L.circleMarker(event.latlng, markerStyle).bindTooltip('Your location').addTo(map);
    }

    if (accuracyCircle) {
      accuracyCircle.setLatLng(event.latlng).setRadius(event.accuracy);
    } else {
      accuracyCircle = L.circle(event.latlng, {
        radius: event.accuracy,
        color: '#2563eb',
        weight: 1,
        fillColor: '#3b82f6',
        fillOpacity: 0.12
      }).addTo(map);
    }
    if (locateButton) locateButton.title = 'Update my current location';
  });

  map.on('locationerror', () => {
    if (locateButton) locateButton.title = 'Location unavailable. Allow location access, then try again.';
  });

  locate();
}