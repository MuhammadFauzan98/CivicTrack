// Enhanced Interactive Map Manager for Smart City Dashboard

class SmartCityMap {
    constructor(options = {}) {
        this.defaultOptions = {
            container: 'map',
            center: [20.5937, 78.9629], // Default to India center
            zoom: 12,
            minZoom: 10,
            maxZoom: 18,
            maxBounds: [[6.5, 68], [37, 97]], // India bounds
            tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors',
            heatmapRadius: 20,
            heatmapBlur: 15,
            clusterRadius: 40,
            clusterMaxZoom: 17
        };
        
        this.options = { ...this.defaultOptions, ...options };
        this.map = null;
        this.markers = L.layerGroup();
        this.clusters = null;
        this.heatmap = null;
        this.geolocationMarker = null;
        this.searchControl = null;
        this.layersControl = null;
        this.activeFilters = new Set();
        this.complaintData = [];
        this.selectedCategory = 'all';
        
        this.categoryColors = {
            'potholes': '#e74c3c',
            'garbage': '#27ae60',
            'streetlight': '#f39c12',
            'water': '#3498db',
            'electricity': '#9b59b6',
            'drainage': '#1abc9c',
            'traffic': '#e67e22',
            'other': '#95a5a6'
        };
        
        this.priorityIcons = {
            'Critical': 'fas fa-exclamation-circle',
            'High': 'fas fa-exclamation-triangle',
            'Medium': 'fas fa-exclamation',
            'Low': 'fas fa-info-circle'
        };
        
        this.initialize();
    }
    
    initialize() {
        this.createMap();
        this.addBaseLayers();
        this.addControls();
        this.addEventListeners();
        this.loadComplaintData();
        this.setupGeolocation();
    }
    
    createMap() {
        const container = typeof this.options.container === 'string' 
            ? document.getElementById(this.options.container)
            : this.options.container;
        
        if (!container) {
            console.error('Map container not found');
            return;
        }
        
        this.map = L.map(container, {
            center: this.options.center,
            zoom: this.options.zoom,
            minZoom: this.options.minZoom,
            maxZoom: this.options.maxZoom,
            maxBounds: this.options.maxBounds,
            zoomControl: false, // We'll add custom control
            scrollWheelZoom: true,
            doubleClickZoom: true,
            touchZoom: true,
            boxZoom: true,
            keyboard: true,
            dragging: true,
            inertia: true,
            inertiaDeceleration: 3000,
            inertiaMaxSpeed: 1500,
            easeLinearity: 0.25,
            worldCopyJump: false,
            maxBoundsViscosity: 1.0,
            fadeAnimation: true,
            markerZoomAnimation: true,
            transform3DLimit: 2^23,
            zoomSnap: 0.25,
            zoomDelta: 1
        });
        
        // Add zoom control with custom position
        L.control.zoom({
            position: 'topright'
        }).addTo(this.map);
    }
    
    addBaseLayers() {
        // Default OpenStreetMap layer
        const osmLayer = L.tileLayer(this.options.tileLayer, {
            attribution: this.options.attribution,
            maxZoom: 19,
            subdomains: ['a', 'b', 'c']
        }).addTo(this.map);
        
        // CartoDB Positron (Light theme)
        const cartoLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CartoDB',
            subdomains: 'abcd',
            maxZoom: 19
        });
        
        // CartoDB Dark Matter
        const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap, © CartoDB',
            subdomains: 'abcd',
            maxZoom: 19
        });
        
        // Satellite layer (ESRI)
        const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri, Maxar, Earthstar Geographics',
            maxZoom: 19
        });
        
        // Create layers control
        this.layersControl = L.control.layers({
            "OpenStreetMap": osmLayer,
            "Light Theme": cartoLight,
            "Dark Theme": cartoDark,
            "Satellite": satellite
        }, {}, {
            position: 'topright',
            collapsed: true,
            autoZIndex: true
        }).addTo(this.map);
        
        // Add overlay layers
        this.layersControl.addOverlay(this.markers, "Complaints");
    }
    
    addControls() {
        // Custom search control
        this.searchControl = L.Control.extend({
            options: {
                position: 'topleft',
                placeholder: 'Search location...',
                timeout: 3000
            },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-search');
                container.style.cssText = `
                    background: white;
                    border-radius: 4px;
                    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                    padding: 5px;
                    width: 300px;
                    max-width: 90vw;
                `;
                
                const input = L.DomUtil.create('input', 'search-input', container);
                input.type = 'text';
                input.placeholder = this.options.placeholder;
                input.style.cssText = `
                    width: calc(100% - 40px);
                    padding: 8px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    outline: none;
                    font-size: 14px;
                `;
                
                const button = L.DomUtil.create('button', 'search-button', container);
                button.innerHTML = '<i class="fas fa-search"></i>';
                button.style.cssText = `
                    width: 30px;
                    height: 30px;
                    background: #3498db;
                    color: white;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    margin-left: 5px;
                `;
                
                // Prevent map events when interacting with controls
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                // Search functionality
                const performSearch = () => {
                    const query = input.value.trim();
                    if (!query) return;
                    
                    this.searchLocation(query, map);
                };
                
                L.DomEvent.on(button, 'click', performSearch);
                L.DomEvent.on(input, 'keypress', (e) => {
                    if (e.key === 'Enter') performSearch();
                });
                
                return container;
            },
            
            searchLocation: function(query, map) {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
                
                fetch(url)
                    .then(response => response.json())
                    .then(data => {
                        if (data && data.length > 0) {
                            const result = data[0];
                            const lat = parseFloat(result.lat);
                            const lon = parseFloat(result.lon);
                            
                            map.flyTo([lat, lon], 15, {
                                duration: 1.5,
                                easeLinearity: 0.25
                            });
                            
                            // Add marker at searched location
                            const marker = L.marker([lat, lon], {
                                icon: L.divIcon({
                                    html: '<i class="fas fa-map-pin" style="color: #e74c3c; font-size: 24px;"></i>',
                                    iconSize: [24, 24],
                                    className: 'search-marker'
                                })
                            }).addTo(map);
                            
                            marker.bindPopup(`
                                <div style="padding: 10px;">
                                    <strong>Searched Location</strong><br>
                                    ${result.display_name}<br>
                                    <small>Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}</small>
                                </div>
                            `).openPopup();
                            
                            // Remove marker after timeout
                            setTimeout(() => {
                                if (marker && marker.remove) marker.remove();
                            }, this.options.timeout);
                        }
                    })
                    .catch(error => {
                        console.error('Search error:', error);
                    });
            }
        });
        
        // Add search control
        new this.searchControl().addTo(this.map);
        
        // Add custom legend control
        const legend = L.control({ position: 'bottomright' });
        
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'info legend');
            div.style.cssText = `
                background: white;
                padding: 15px;
                border-radius: 5px;
                box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                font-size: 12px;
                max-width: 200px;
            `;
            
            const categories = Object.keys(this.categoryColors);
            let content = '<h4 style="margin: 0 0 10px 0;">Complaint Categories</h4>';
            
            categories.forEach(category => {
                const color = this.categoryColors[category];
                content += `
                    <div style="display: flex; align-items: center; margin-bottom: 5px;">
                        <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 8px;"></div>
                        <span>${category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    </div>
                `;
            });
            
            content += `
                <hr style="margin: 10px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 5px;">
                    <i class="fas fa-circle" style="color: #3498db; margin-right: 8px;"></i>
                    <span>Your Location</span>
                </div>
            `;
            
            div.innerHTML = content;
            return div;
        };
        
        legend.addTo(this.map);
        
        // Add custom control for view toggles
        this.addViewToggleControls();
    }
    
    addViewToggleControls() {
        const toggleControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-toggle');
                container.style.cssText = `
                    background: white;
                    border-radius: 4px;
                    box-shadow: 0 1px 5px rgba(0,0,0,0.4);
                    padding: 5px;
                    display: flex;
                    gap: 5px;
                `;
                
                const views = [
                    { name: 'markers', icon: 'fa-map-marker-alt', label: 'Markers', active: true },
                    { name: 'clusters', icon: 'fa-layer-group', label: 'Clusters', active: false },
                    { name: 'heatmap', icon: 'fa-fire', label: 'Heatmap', active: false }
                ];
                
                views.forEach(view => {
                    const button = L.DomUtil.create('button', 'view-toggle', container);
                    button.innerHTML = `<i class="fas ${view.icon}"></i>`;
                    button.title = view.label;
                    button.style.cssText = `
                        width: 40px;
                        height: 40px;
                        background: ${view.active ? '#3498db' : 'white'};
                        color: ${view.active ? 'white' : '#333'};
                        border: 1px solid #ddd;
                        border-radius: 3px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.3s;
                    `;
                    
                    L.DomEvent.on(button, 'click', () => {
                        // Update all buttons
                        container.querySelectorAll('button').forEach(btn => {
                            btn.style.background = 'white';
                            btn.style.color = '#333';
                        });
                        
                        // Activate clicked button
                        button.style.background = '#3498db';
                        button.style.color = 'white';
                        
                        // Dispatch custom event
                        const event = new CustomEvent('viewChange', {
                            detail: { view: view.name }
                        });
                        map.getContainer().dispatchEvent(event);
                    });
                });
                
                L.DomEvent.disableClickPropagation(container);
                L.DomEvent.disableScrollPropagation(container);
                
                return container;
            }
        });
        
        new toggleControl().addTo(this.map);
        
        // Listen for view changes
        this.map.getContainer().addEventListener('viewChange', (e) => {
            this.switchView(e.detail.view);
        });
    }
    
    switchView(viewType) {
        // Clear existing layers
        if (this.clusters) {
            this.map.removeLayer(this.clusters);
            this.clusters = null;
        }
        
        if (this.heatmap) {
            this.map.removeLayer(this.heatmap);
            this.heatmap = null;
        }
        
        if (this.markers) {
            this.map.removeLayer(this.markers);
        }
        
        // Re-add markers layer
        this.markers = L.layerGroup().addTo(this.map);
        
        // Apply selected view
        switch(viewType) {
            case 'clusters':
                this.showClusteredMarkers();
                break;
            case 'heatmap':
                this.showHeatmap();
                break;
            case 'markers':
            default:
                this.showIndividualMarkers();
                break;
        }
    }
    
    addEventListeners() {
        // Map click event for adding complaints
        this.map.on('click', (e) => {
            this.onMapClick(e);
        });
        
        // Map move events
        this.map.on('moveend', () => {
            this.updateVisibleMarkers();
        });
        
        // Zoom events
        this.map.on('zoomend', () => {
            this.updateMarkerClustering();
        });
        
        // Custom event for filtering
        document.addEventListener('filterComplaints', (e) => {
            this.filterComplaints(e.detail);
        });
    }
    
    setupGeolocation() {
        if (!navigator.geolocation) {
            console.warn('Geolocation not supported by browser');
            return;
        }
        
        const locateButton = L.control({ position: 'topleft' });
        
        locateButton.onAdd = () => {
            const button = L.DomUtil.create('button', 'leaflet-control-locate');
            button.innerHTML = '<i class="fas fa-location-arrow"></i>';
            button.title = 'Find my location';
            button.style.cssText = `
                width: 40px;
                height: 40px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 3px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                color: #3498db;
                box-shadow: 0 1px 5px rgba(0,0,0,0.1);
            `;
            
            L.DomEvent.on(button, 'click', () => {
                this.locateUser();
            });
            
            return button;
        };
        
        locateButton.addTo(this.map);
    }
    
    locateUser() {
        if (!navigator.geolocation) return;
        
        // Show loading state
        const loadingPopup = L.popup()
            .setLatLng(this.map.getCenter())
            .setContent('<div style="text-align: center;"><i class="fas fa-spinner fa-spin"></i> Finding your location...</div>')
            .openOn(this.map);
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Remove loading popup
                this.map.closePopup();
                
                // Fly to location
                this.map.flyTo([lat, lng], 15, {
                    duration: 1.5,
                    easeLinearity: 0.25
                });
                
                // Add or update geolocation marker
                if (this.geolocationMarker) {
                    this.geolocationMarker.setLatLng([lat, lng]);
                } else {
                    this.geolocationMarker = L.marker([lat, lng], {
                        icon: L.divIcon({
                            html: '<div style="background: rgba(52, 152, 219, 0.3); border: 2px solid #3498db; border-radius: 50%; width: 20px; height: 20px;"></div>',
                            iconSize: [20, 20],
                            className: 'geolocation-marker'
                        }),
                        zIndexOffset: 1000,
                        interactive: false
                    }).addTo(this.map);
                }
                
                // Add accuracy circle
                const accuracyCircle = L.circle([lat, lng], {
                    color: '#3498db',
                    fillColor: '#3498db',
                    fillOpacity: 0.1,
                    radius: position.coords.accuracy
                }).addTo(this.map);
                
                // Remove accuracy circle after 10 seconds
                setTimeout(() => {
                    if (accuracyCircle && accuracyCircle.remove) {
                        accuracyCircle.remove();
                    }
                }, 10000);
                
            },
            (error) => {
                console.error('Geolocation error:', error);
                this.map.closePopup();
                
                L.popup()
                    .setLatLng(this.map.getCenter())
                    .setContent(`
                        <div style="text-align: center;">
                            <i class="fas fa-exclamation-triangle" style="color: #e74c3c;"></i>
                            <p>Unable to get your location. Please check your browser settings.</p>
                        </div>
                    `)
                    .openOn(this.map);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }
    
    async loadComplaintData() {
        try {
            // Show loading overlay
            this.showLoading(true);
            
            const response = await fetch('/api/complaints');
            if (!response.ok) throw new Error('Failed to load complaints');
            
            this.complaintData = await response.json();
            
            // Render initial markers
            this.renderComplaints();
            
            // Update layer control
            this.updateLayerControl();
            
        } catch (error) {
            console.error('Error loading complaint data:', error);
            this.showError('Failed to load complaint data. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    renderComplaints() {
        // Clear existing markers
        this.markers.clearLayers();
        
        // Create markers for each complaint
        this.complaintData.forEach(complaint => {
            if (!complaint.latitude || !complaint.longitude) return;
            
            const marker = this.createComplaintMarker(complaint);
            this.markers.addLayer(marker);
        });
        
        // Fit bounds to show all markers
        if (this.complaintData.length > 0) {
            const bounds = this.markers.getBounds();
            if (bounds.isValid()) {
                this.map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 15,
                    animate: true,
                    duration: 1
                });
            }
        }
    }
    
    createComplaintMarker(complaint) {
        const color = this.categoryColors[complaint.category] || '#95a5a6';
        const priorityIcon = this.priorityIcons[complaint.priority] || 'fas fa-exclamation';
        
        // Create custom marker icon
        const icon = L.divIcon({
            html: `
                <div class="complaint-marker" 
                     style="background: ${color}; 
                            border: 2px solid white;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.3);"
                     data-category="${complaint.category}"
                     data-priority="${complaint.priority}"
                     data-status="${complaint.status}">
                    <i class="${priorityIcon}"></i>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
            className: 'complaint-marker-icon'
        });
        
        // Create marker
        const marker = L.marker([complaint.latitude, complaint.longitude], { icon });
        
        // Create popup content
        const popupContent = this.createPopupContent(complaint);
        marker.bindPopup(popupContent, {
            maxWidth: 300,
            minWidth: 200,
            autoClose: false,
            closeOnClick: false,
            className: 'complaint-popup'
        });
        
        // Add hover effects
        marker.on('mouseover', () => {
            marker.openPopup();
            marker.getElement().style.transform = 'scale(1.2)';
            marker.getElement().style.transition = 'transform 0.2s';
            marker.getElement().style.zIndex = '1000';
        });
        
        marker.on('mouseout', () => {
            marker.closePopup();
            marker.getElement().style.transform = 'scale(1)';
            marker.getElement().style.zIndex = '';
        });
        
        marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            this.onComplaintClick(complaint);
        });
        
        return marker;
    }
    
    createPopupContent(complaint) {
        const date = new Date(complaint.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const statusColor = {
            'Pending': '#f39c12',
            'In Progress': '#3498db',
            'Resolved': '#27ae60',
            'Rejected': '#e74c3c'
        }[complaint.status] || '#95a5a6';
        
        return `
            <div class="complaint-popup-content">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                    <h4 style="margin: 0; color: #2c3e50;">${complaint.title}</h4>
                    <span style="background: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">
                        ${complaint.status}
                    </span>
                </div>
                
                <p style="margin: 0 0 10px 0; color: #7f8c8d; font-size: 14px;">
                    ${complaint.description.substring(0, 100)}${complaint.description.length > 100 ? '...' : ''}
                </p>
                
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span style="background: ${this.categoryColors[complaint.category]}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
                        ${complaint.category.charAt(0).toUpperCase() + complaint.category.slice(1)}
                    </span>
                    <span style="background: #ecf0f1; color: #2c3e50; padding: 2px 8px; border-radius: 12px; font-size: 11px;">
                        ${complaint.priority} Priority
                    </span>
                </div>
                
                <div style="font-size: 12px; color: #95a5a6; margin-bottom: 10px;">
                    <i class="fas fa-map-marker-alt"></i> ${complaint.address.substring(0, 30)}${complaint.address.length > 30 ? '...' : ''}
                </div>
                
                <div style="font-size: 11px; color: #bdc3c7;">
                    <i class="fas fa-clock"></i> ${formattedDate}
                </div>
                
                <hr style="margin: 10px 0;">
                
                <div style="text-align: center;">
                    <button onclick="window.location.href='/complaint/${complaint.id}'" 
                            style="background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        <i class="fas fa-external-link-alt"></i> View Details
                    </button>
                </div>
            </div>
        `;
    }
    
    showClusteredMarkers() {
        if (!this.complaintData.length) return;
        
        const markers = this.complaintData
            .filter(complaint => complaint.latitude && complaint.longitude)
            .map(complaint => {
                const marker = this.createComplaintMarker(complaint);
                return marker;
            });
        
        this.clusters = L.markerClusterGroup({
            maxClusterRadius: this.options.clusterRadius,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: true,
            zoomToBoundsOnClick: true,
            chunkedLoading: true,
            disableClusteringAtZoom: this.options.clusterMaxZoom,
            iconCreateFunction: (cluster) => {
                const childMarkers = cluster.getAllChildMarkers();
                const categories = new Set(childMarkers.map(m => m.options.icon.options.html.match(/data-category="([^"]+)"/)?.[1]));
                const priorities = new Set(childMarkers.map(m => m.options.icon.options.html.match(/data-priority="([^"]+)"/)?.[1]));
                
                let dominantCategory = 'other';
                let maxCount = 0;
                
                categories.forEach(category => {
                    const count = childMarkers.filter(m => 
                        m.options.icon.options.html.includes(`data-category="${category}"`)
                    ).length;
                    
                    if (count > maxCount) {
                        maxCount = count;
                        dominantCategory = category;
                    }
                });
                
                const color = this.categoryColors[dominantCategory] || '#95a5a6';
                const count = childMarkers.length;
                
                return L.divIcon({
                    html: `
                        <div style="background: ${color}; 
                                    color: white;
                                    border: 3px solid white;
                                    border-radius: 50%;
                                    width: 40px;
                                    height: 40px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-weight: bold;
                                    font-size: 14px;
                                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);">
                            ${count}
                        </div>
                    `,
                    iconSize: [40, 40],
                    className: 'cluster-icon'
                });
            }
        });
        
        markers.forEach(marker => this.clusters.addLayer(marker));
        this.map.addLayer(this.clusters);
    }
    
    showHeatmap() {
        if (!this.complaintData.length) return;
        
        const heatmapData = this.complaintData
            .filter(complaint => complaint.latitude && complaint.longitude)
            .map(complaint => {
                let weight = 1;
                if (complaint.priority === 'High') weight = 2;
                if (complaint.priority === 'Critical') weight = 3;
                
                return [complaint.latitude, complaint.longitude, weight];
            });
        
        // Create heatmap layer
        this.heatmap = L.heatLayer(heatmapData, {
            radius: this.options.heatmapRadius,
            blur: this.options.heatmapBlur,
            maxZoom: 17,
            gradient: {
                0.2: 'rgba(0, 255, 255, 0.5)',
                0.4: 'rgba(0, 255, 128, 0.6)',
                0.6: 'rgba(255, 255, 0, 0.7)',
                0.8: 'rgba(255, 128, 0, 0.8)',
                1.0: 'rgba(255, 0, 0, 0.9)'
            }
        }).addTo(this.map);
    }
    
    showIndividualMarkers() {
        // Already shown by default
    }
    
    filterComplaints(filters) {
        this.activeFilters.clear();
        
        if (filters.category && filters.category !== 'all') {
            this.activeFilters.add(`category:${filters.category}`);
            this.selectedCategory = filters.category;
        }
        
        if (filters.status && filters.status !== 'all') {
            this.activeFilters.add(`status:${filters.status}`);
        }
        
        if (filters.priority && filters.priority !== 'all') {
            this.activeFilters.add(`priority:${filters.priority}`);
        }
        
        // Filter markers
        this.markers.eachLayer((marker) => {
            const category = marker.options.icon.options.html.match(/data-category="([^"]+)"/)?.[1];
            const status = marker.options.icon.options.html.match(/data-status="([^"]+)"/)?.[1];
            const priority = marker.options.icon.options.html.match(/data-priority="([^"]+)"/)?.[1];
            
            let shouldShow = true;
            
            if (this.selectedCategory !== 'all' && category !== this.selectedCategory) {
                shouldShow = false;
            }
            
            if (filters.status && filters.status !== 'all' && status !== filters.status) {
                shouldShow = false;
            }
            
            if (filters.priority && filters.priority !== 'all' && priority !== filters.priority) {
                shouldShow = false;
            }
            
            if (shouldShow) {
                marker.addTo(this.map);
                marker.getElement().style.opacity = '1';
                marker.getElement().style.pointerEvents = 'auto';
            } else {
                marker.remove();
                marker.getElement().style.opacity = '0.3';
                marker.getElement().style.pointerEvents = 'none';
            }
        });
        
        // Update stats
        this.updateFilterStats();
    }
    
    updateFilterStats() {
        const visibleCount = this.markers.getLayers().filter(layer => 
            layer.getElement().style.opacity !== '0.3'
        ).length;
        
        const totalCount = this.complaintData.length;
        
        // Update UI with filtered count
        const statsElement = document.getElementById('mapStats');
        if (statsElement) {
            statsElement.innerHTML = `
                Showing ${visibleCount} of ${totalCount} complaints
                ${this.activeFilters.size > 0 ? '<br><small>Filters applied</small>' : ''}
            `;
        }
    }
    
    updateVisibleMarkers() {
        // Could add logic for lazy loading markers based on viewport
    }
    
    updateMarkerClustering() {
        // Update clustering based on zoom level
    }
    
    updateLayerControl() {
        // Update layer control with filtered data
    }
    
    onMapClick(e) {
        // Show popup with option to add complaint at clicked location
        const popup = L.popup()
            .setLatLng(e.latlng)
            .setContent(`
                <div style="text-align: center; padding: 10px;">
                    <h4 style="margin: 0 0 10px 0;">Add Complaint Here</h4>
                    <p style="margin: 0 0 15px 0; color: #7f8c8d;">
                        Latitude: ${e.latlng.lat.toFixed(6)}<br>
                        Longitude: ${e.latlng.lng.toFixed(6)}
                    </p>
                    <button onclick="window.location.href='/complaint/new?lat=${e.latlng.lat}&lng=${e.latlng.lng}'" 
                            style="background: #27ae60; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        <i class="fas fa-plus-circle"></i> Report Issue Here
                    </button>
                </div>
            `)
            .openOn(this.map);
    }
    
    onComplaintClick(complaint) {
        // Dispatch custom event for complaint selection
        const event = new CustomEvent('complaintSelected', {
            detail: { complaint }
        });
        document.dispatchEvent(event);
        
        // Animate marker
        const marker = this.markers.getLayers().find(m => 
            m.getLatLng().lat === complaint.latitude && 
            m.getLatLng().lng === complaint.longitude
        );
        
        if (marker) {
            this.animateMarker(marker);
        }
    }
    
    animateMarker(marker) {
        const element = marker.getElement();
        let scale = 1;
        let direction = 0.1;
        
        const animate = () => {
            scale += direction;
            
            if (scale >= 1.5) direction = -0.1;
            if (scale <= 1) {
                scale = 1;
                element.style.transform = `scale(${scale})`;
                return;
            }
            
            element.style.transform = `scale(${scale})`;
            requestAnimationFrame(animate);
        };
        
        animate();
    }
    
    showLoading(show) {
        const loadingElement = document.getElementById('mapLoading');
        if (!loadingElement) return;
        
        if (show) {
            loadingElement.style.display = 'flex';
            loadingElement.innerHTML = `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p>Loading map data...</p>
                </div>
            `;
        } else {
            loadingElement.style.display = 'none';
        }
    }
    
    showError(message) {
        const errorElement = document.getElementById('mapError');
        if (!errorElement) return;
        
        errorElement.style.display = 'block';
        errorElement.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
                <button onclick="this.parentElement.style.display='none'">Dismiss</button>
            </div>
        `;
    }
    
    // Public methods
    addComplaint(complaint) {
        this.complaintData.push(complaint);
        const marker = this.createComplaintMarker(complaint);
        this.markers.addLayer(marker);
        
        // Fly to new complaint
        this.map.flyTo([complaint.latitude, complaint.longitude], 15, {
            duration: 1
        });
        
        // Open popup
        marker.openPopup();
    }
    
    removeComplaint(complaintId) {
        const index = this.complaintData.findIndex(c => c.id === complaintId);
        if (index > -1) {
            this.complaintData.splice(index, 1);
            
            // Remove corresponding marker
            this.markers.eachLayer((marker) => {
                const markerComplaintId = marker.options.icon.options.html.match(/data-id="([^"]+)"/)?.[1];
                if (markerComplaintId === complaintId.toString()) {
                    this.markers.removeLayer(marker);
                }
            });
        }
    }
    
    updateComplaint(updatedComplaint) {
        const index = this.complaintData.findIndex(c => c.id === updatedComplaint.id);
        if (index > -1) {
            this.complaintData[index] = updatedComplaint;
            
            // Update corresponding marker
            this.markers.eachLayer((marker) => {
                const markerComplaintId = marker.options.icon.options.html.match(/data-id="([^"]+)"/)?.[1];
                if (markerComplaintId === updatedComplaint.id.toString()) {
                    // Remove old marker
                    this.markers.removeLayer(marker);
                    
                    // Add updated marker
                    const newMarker = this.createComplaintMarker(updatedComplaint);
                    this.markers.addLayer(newMarker);
                }
            });
        }
    }
    
    getComplaintsInBounds(bounds) {
        return this.complaintData.filter(complaint => {
            const lat = complaint.latitude;
            const lng = complaint.longitude;
            return bounds.contains([lat, lng]);
        });
    }
    
    exportAsImage() {
        // Capture map as image
        html2canvas(this.map.getContainer()).then(canvas => {
            const link = document.createElement('a');
            link.download = `smart-city-map-${new Date().toISOString().split('T')[0]}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        });
    }
    
    // Utility methods
    addDrawingTools() {
        const drawControl = new L.Control.Draw({
            position: 'topleft',
            draw: {
                polygon: true,
                polyline: false,
                rectangle: true,
                circle: true,
                marker: false,
                circlemarker: false
            },
            edit: {
                featureGroup: this.markers
            }
        });
        
        this.map.addControl(drawControl);
        
        this.map.on(L.Draw.Event.CREATED, (e) => {
            const layer = e.layer;
            const type = e.layerType;
            
            // Handle drawn shapes
            if (type === 'rectangle' || type === 'polygon' || type === 'circle') {
                // Get complaints within drawn area
                const bounds = layer.getBounds();
                const complaintsInArea = this.getComplaintsInBounds(bounds);
                
                // Show popup with count
                const popupContent = `
                    <div style="padding: 10px;">
                        <h4 style="margin: 0 0 10px 0;">Area Analysis</h4>
                        <p>Complaints in selected area: <strong>${complaintsInArea.length}</strong></p>
                        <div style="max-height: 200px; overflow-y: auto;">
                            ${complaintsInArea.map(c => `
                                <div style="border-bottom: 1px solid #eee; padding: 5px 0;">
                                    <strong>${c.title}</strong><br>
                                    <small>${c.category} • ${c.status}</small>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                
                layer.bindPopup(popupContent).openPopup();
                layer.addTo(this.map);
            }
        });
    }
    
    addMeasureTool() {
        const measureControl = L.control.measure({
            position: 'topleft',
            primaryLengthUnit: 'meters',
            secondaryLengthUnit: 'kilometers',
            primaryAreaUnit: 'sqmeters',
            secondaryAreaUnit: 'hectares',
            activeColor: '#3498db',
            completedColor: '#27ae60'
        });
        
        measureControl.addTo(this.map);
    }
}

// Initialize map when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Check if map container exists
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    // Create map instance
    window.smartCityMap = new SmartCityMap({
        container: 'map',
        center: [20.5937, 78.9629],
        zoom: 12
    });
    
    // Add drawing tools (optional)
    // smartCityMap.addDrawingTools();
    // smartCityMap.addMeasureTool();
    
    // Add filter controls
    addFilterControls();
});

// Filter controls
function addFilterControls() {
    const filterContainer = document.createElement('div');
    filterContainer.id = 'mapFilters';
    filterContainer.style.cssText = `
        position: absolute;
        top: 70px;
        left: 10px;
        background: white;
        padding: 15px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 1000;
        min-width: 250px;
        max-width: 300px;
    `;
    
    filterContainer.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: #2c3e50;">
            <i class="fas fa-filter"></i> Filter Complaints
        </h4>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #7f8c8d;">Category</label>
            <select id="categoryFilter" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 14px;">
                <option value="all">All Categories</option>
                <option value="potholes">Potholes</option>
                <option value="garbage">Garbage</option>
                <option value="streetlight">Street Light</option>
                <option value="water">Water</option>
                <option value="electricity">Electricity</option>
                <option value="drainage">Drainage</option>
                <option value="traffic">Traffic</option>
                <option value="other">Other</option>
            </select>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #7f8c8d;">Status</label>
            <select id="statusFilter" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 14px;">
                <option value="all">All Status</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
            </select>
        </div>
        
        <div style="margin-bottom: 15px;">
            <label style="display: block; margin-bottom: 5px; font-size: 12px; color: #7f8c8d;">Priority</label>
            <select id="priorityFilter" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 3px; font-size: 14px;">
                <option value="all">All Priority</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
            </select>
        </div>
        
        <div style="display: flex; gap: 10px;">
            <button id="applyFilters" style="flex: 1; background: #3498db; color: white; border: none; padding: 8px; border-radius: 3px; cursor: pointer;">
                Apply Filters
            </button>
            <button id="clearFilters" style="flex: 1; background: #95a5a6; color: white; border: none; padding: 8px; border-radius: 3px; cursor: pointer;">
                Clear
            </button>
        </div>
        
        <div id="mapStats" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #7f8c8d;">
            Loading complaints...
        </div>
    `;
    
    document.getElementById('map').parentElement.appendChild(filterContainer);
    
    // Add event listeners
    document.getElementById('applyFilters').addEventListener('click', applyMapFilters);
    document.getElementById('clearFilters').addEventListener('click', clearMapFilters);
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            filterContainer.style.display = filterContainer.style.display === 'none' ? 'block' : 'none';
        }
        
        if (e.key === 'Escape') {
            filterContainer.style.display = 'none';
        }
    });
}

function applyMapFilters() {
    const category = document.getElementById('categoryFilter').value;
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    
    const filters = { category, status, priority };
    
    const event = new CustomEvent('filterComplaints', { detail: filters });
    document.dispatchEvent(event);
}

function clearMapFilters() {
    document.getElementById('categoryFilter').value = 'all';
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('priorityFilter').value = 'all';
    
    applyMapFilters();
}

// Export functions for global use
window.applyMapFilters = applyMapFilters;
window.clearMapFilters = clearMapFilters;

// Add CSS styles dynamically
const mapStyles = `
    /* Complaint Marker Styles */
    .complaint-marker {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        animation: pulse 2s infinite;
    }
    
    .complaint-marker:hover {
        transform: scale(1.2);
        box-shadow: 0 3px 15px rgba(0,0,0,0.4) !important;
        z-index: 1000 !important;
    }
    
    .complaint-marker.Pending {
        animation: pulse-warning 2s infinite;
    }
    
    .complaint-marker.Resolved {
        animation: pulse-success 2s infinite;
    }
    
    /* Popup Styles */
    .complaint-popup .leaflet-popup-content-wrapper {
        border-radius: 8px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        border: 2px solid #3498db;
    }
    
    .complaint-popup .leaflet-popup-content {
        margin: 0;
        padding: 0;
    }
    
    .complaint-popup-content {
        padding: 15px;
    }
    
    .complaint-popup .leaflet-popup-tip {
        background: #3498db;
    }
    
    /* Cluster Styles */
    .cluster-icon {
        transition: all 0.3s ease;
    }
    
    .cluster-icon:hover {
        transform: scale(1.1);
        box-shadow: 0 5px 20px rgba(0,0,0,0.3) !important;
    }
    
    /* Animations */
    @keyframes pulse {
        0% {
            box-shadow: 0 0 0 0 rgba(52, 152, 219, 0.7);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(52, 152, 219, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(52, 152, 219, 0);
        }
    }
    
    @keyframes pulse-warning {
        0% {
            box-shadow: 0 0 0 0 rgba(243, 156, 18, 0.7);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(243, 156, 18, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(243, 156, 18, 0);
        }
    }
    
    @keyframes pulse-success {
        0% {
            box-shadow: 0 0 0 0 rgba(39, 174, 96, 0.7);
        }
        70% {
            box-shadow: 0 0 0 10px rgba(39, 174, 96, 0);
        }
        100% {
            box-shadow: 0 0 0 0 rgba(39, 174, 96, 0);
        }
    }
    
    /* Loading Overlay */
    #mapLoading {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: none;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    }
    
    .loading-content {
        text-align: center;
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 5px 20px rgba(0,0,0,0.2);
    }
    
    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #3498db;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 15px auto;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    /* Error Message */
    #mapError {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        background: #e74c3c;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
        display: none;
        z-index: 2000;
        max-width: 80%;
    }
    
    .error-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .error-content button {
        background: white;
        color: #e74c3c;
        border: none;
        padding: 5px 10px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 12px;
        margin-left: 10px;
    }
    
    /* Custom Leaflet Controls */
    .leaflet-control-search .search-input:focus {
        border-color: #3498db;
        box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }
    
    .leaflet-control-locate:hover {
        background: #3498db;
        color: white;
    }
    
    /* Heatmap Legend */
    .heatmap-legend {
        background: white;
        padding: 10px;
        border-radius: 5px;
        box-shadow: 0 1px 5px rgba(0,0,0,0.4);
    }
    
    .heatmap-legend i {
        width: 18px;
        height: 18px;
        float: left;
        margin-right: 8px;
        opacity: 0.7;
    }
`;

// Add styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = mapStyles;
document.head.appendChild(styleSheet);