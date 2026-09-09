const RAD = Math.PI / 180;
export const MIN_DISTANCE = 1.16;
export const MAX_DISTANCE = 5.6;
export const clampDistance = value => Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, value));
export const wrapLongitude = value => ((value + 180) % 360 + 360) % 360 - 180;
export function surfacePoint(lat, lon, radius = 1) {
    const phi = lat * RAD, theta = lon * RAD;
    return [radius * Math.cos(phi) * Math.cos(theta), radius * Math.sin(phi), -radius * Math.cos(phi) * Math.sin(theta)];
}
export function rotateView(view, dx, dy, height) {
    const sensitivity = Math.max(.025, (view.distance - 1) * 36 / Math.max(1, height));
    return { ...view, lon: wrapLongitude(view.lon - dx * sensitivity), lat: Math.max(-80, Math.min(80, view.lat + dy * sensitivity)) };
}
export function zoomDistance(distance, delta) { return clampDistance(distance * Math.exp(Math.max(-1, Math.min(1, delta)))); }
export function approachView(current, target, amount) {
    const t = Math.max(0, Math.min(1, amount));
    return { lat: current.lat + (target.lat - current.lat) * t, lon: wrapLongitude(current.lon + wrapLongitude(target.lon - current.lon) * t), distance: current.distance + (target.distance - current.distance) * t };
}
// The horizon is where the surface normal is perpendicular to the sight line.
export function facesCamera(point, camera) { return point[0] * camera[0] + point[1] * camera[1] + point[2] * camera[2] > 1.01; }
// Separate close markers in screen space without moving their geographic anchors.
export function spreadMarkers(points, gap = 38) {
    const placed = [];
    for (const point of points) {
        let x = point.x, y = point.y, attempt = 0;
        while (placed.some(p => Math.hypot(p.x - x, p.y - y) < gap) && attempt < 80) {
            attempt++;
            const angle = attempt * 2.39996, radius = gap * Math.sqrt(attempt) * .65;
            x = point.x + Math.cos(angle) * radius; y = point.y + Math.sin(angle) * radius;
        }
        placed.push({ ...point, x, y });
    }
    return placed;
}
