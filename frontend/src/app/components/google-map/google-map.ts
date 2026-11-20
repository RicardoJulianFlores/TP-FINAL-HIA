import { Component, Input, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';

// Reemplazo de Google Maps por Leaflet + OpenStreetMap + OpenRouteService.
// Mantiene los mismos @Input que el componente original (lat, lng, zoom, titulo, altura)
// para no tener que tocar contacto.html ni nosotros.html.

@Component({
  selector: 'app-google-map',
  imports: [CommonModule],
  templateUrl: './google-map.html',
  styleUrl: './google-map.css'
})
export class GoogleMap implements OnInit, AfterViewInit, OnDestroy {

  @Input() lat: number = -24.1858;       // San Salvador de Jujuy por defecto
  @Input() lng: number = -65.2995;
  @Input() zoom: number = 16;
  @Input() titulo: string = 'Joyería Lumière';
  @Input() altura: string = '350px';

  // Clave gratuita de openrouteservice.org (registrate con mail, sin tarjeta).
  // No es sensible como para preocuparse mucho, pero mejor moverla a environment.ts.
  private readonly orsApiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6IjhhMDczYWM2ZTJhYzQwYTM5MWY5OWE2MWEyNzBmMDJiIiwiaCI6Im11cm11cjY0In0=';

  @ViewChild('mapContainer') mapContainer!: ElementRef;

  private map!: L.Map;
  private tiendaMarker!: L.Marker;
  private userMarker?: L.Marker;
  private routeLayer?: L.GeoJSON;

  cargando = true;
  error = false;
  distanciaKm: string | null = null;
  duracionMin: string | null = null;
  permisoUbicacionDenegado = false;

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    // Pequeño delay para asegurar que el contenedor ya tiene tamaño en el DOM
    setTimeout(() => this.inicializarMapa(), 0);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private inicializarMapa(): void {
    try {
      this.map = L.map(this.mapContainer.nativeElement).setView([this.lat, this.lng], this.zoom);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(this.map);

      // Icono default de Leaflet a veces no carga bien con bundlers; lo seteamos explícito
      const iconoTienda = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      });

      this.tiendaMarker = L.marker([this.lat, this.lng], { icon: iconoTienda })
        .addTo(this.map)
        .bindPopup(`<strong>${this.titulo}</strong><br><small>Jujuy, Argentina</small>`)
        .openPopup();

      this.cargando = false;
      this.cdr.detectChanges(); // sin Zone.js, hay que avisarle a Angular manualmente

      // Leaflet a veces calcula mal el tamaño del contenedor si el layout
      // (Bootstrap/flex) todavía se está acomodando en el momento de crear el mapa.
      // invalidateSize() le fuerza a recalcular y pedir las tiles que le faltan.
      setTimeout(() => this.map.invalidateSize(), 150);
      window.addEventListener('resize', () => this.map?.invalidateSize());

      // Una vez que el mapa base está listo, intentamos geolocalizar al usuario
      this.detectarUbicacionYTrazarRuta();
    } catch {
      this.error = true;
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private detectarUbicacionYTrazarRuta(): void {
    if (!('geolocation' in navigator)) {
      return; // Navegador sin soporte; el mapa igual queda visible con el marcador de la tienda
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;

        const iconoUsuario = L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          className: 'marcador-usuario'
        });

        this.userMarker = L.marker([userLat, userLng], { icon: iconoUsuario })
          .addTo(this.map)
          .bindPopup('Tu ubicación');

        this.trazarRuta(userLat, userLng);
      },
      () => {
        // Usuario rechazó el permiso o falló la geolocalización; no es un error del mapa
        this.permisoUbicacionDenegado = true;
        this.cdr.detectChanges();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  private trazarRuta(userLat: number, userLng: number): void {
    const url = 'https://api.openrouteservice.org/v2/directions/driving-car/geojson';
    const body = {
      // OpenRouteService espera [longitud, latitud], al revés que Google Maps
      coordinates: [
        [userLng, userLat],
        [this.lng, this.lat]
      ]
    };

    this.http.post(url, body, {
      headers: {
        Authorization: this.orsApiKey,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (geojson: any) => {
        this.routeLayer = L.geoJSON(geojson, {
          style: { color: '#8b5e34', weight: 4 }
        }).addTo(this.map);

        this.map.invalidateSize();
        this.map.fitBounds(this.routeLayer.getBounds(), { padding: [30, 30] });

        const props = geojson?.features?.[0]?.properties?.summary;
        if (props) {
          this.distanciaKm = (props.distance / 1000).toFixed(1);
          this.duracionMin = Math.round(props.duration / 60).toString();
        }
        this.cdr.detectChanges();
      },
      error: () => {
        // Si falla el ruteo (ej. sin API key configurada aún), el mapa sigue funcionando igual,
        // solo no se traza la ruta ni se muestran distancia/duración.
      }
    });
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}
}
