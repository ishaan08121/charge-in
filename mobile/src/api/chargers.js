import client from './client';

export const apiGetNearby = (lat, lng, radius_km = 10, connector_type) =>
  client.get('/chargers/nearby', { params: { lat, lng, radius_km, connector_type } });

export const apiGetCharger = (id) =>
  client.get(`/chargers/${id}`);

export const apiGetReviews = (chargerId) =>
  client.get(`/reviews/charger/${chargerId}`);

export const apiGetMyChargers = () =>
  client.get('/chargers/mine');

export const apiUpdateCharger = (id, updates) =>
  client.put(`/chargers/${id}`, updates);

export const apiDeleteCharger = (id) =>
  client.delete(`/chargers/${id}`);
