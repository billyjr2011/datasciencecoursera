// Zone centroids — mirrors the server's ZONE_COORDS (kept in sync with the seeded directory).

export const ZONE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Yaoundé Centre": { lat: 3.8667, lng: 11.5167 }, "Yaoundé Bastos": { lat: 3.879, lng: 11.509 },
  "Yaoundé Melen": { lat: 3.855, lng: 11.52 }, "Yaoundé Ngoa-Ekellé": { lat: 3.86, lng: 11.51 },
  "Yaoundé Cité Verte": { lat: 3.872, lng: 11.53 }, "Yaoundé Omnisports": { lat: 3.865, lng: 11.525 },
  "Yaoundé Mfoundi": { lat: 3.87, lng: 11.515 }, "Yaoundé Nlongkak": { lat: 3.875, lng: 11.52 },
  "Yaoundé Biyem-Assi": { lat: 3.85, lng: 11.505 }, "Yaoundé Essos": { lat: 3.862, lng: 11.533 },
  "Douala Akwa": { lat: 4.0511, lng: 9.7085 }, "Douala Bonapriso": { lat: 4.045, lng: 9.699 },
  "Douala Deido": { lat: 4.06, lng: 9.715 }, "Douala Bonanjo": { lat: 4.048, lng: 9.71 },
  "Douala Makepe": { lat: 4.058, lng: 9.738 }, "Douala Akwa Nord": { lat: 4.053, lng: 9.705 },
  "Douala New Bell": { lat: 4.048, lng: 9.71 }, "Douala Bonaberi": { lat: 4.07, lng: 9.68 },
  "Bafoussam Tamdja": { lat: 5.4737, lng: 10.4196 }, "Bafoussam Centre": { lat: 5.478, lng: 10.422 },
  "Garoua Plateau": { lat: 9.3017, lng: 13.3932 }, "Garoua Nord": { lat: 9.31, lng: 13.398 },
  "Maroua Centre": { lat: 10.59, lng: 14.3159 }, "Maroua Dougoy": { lat: 10.595, lng: 14.32 },
  "Bamenda Mile 4": { lat: 5.9631, lng: 10.1591 }, "Bamenda Up Station": { lat: 5.97, lng: 10.162 },
  "Ebolowa Centre": { lat: 2.9, lng: 11.15 }, "Bertoua Centre": { lat: 4.5766, lng: 13.6845 },
  "Ngaoundéré Centre": { lat: 7.3236, lng: 13.5836 }, "Limbe Town": { lat: 4.0234, lng: 9.2087 },
  "Online / Remote": { lat: 3.848, lng: 11.5021 },
};

export const ZONES = Object.keys(ZONE_COORDS);
