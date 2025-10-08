// UIUX/map/SeaDotManager.js
// Lightweight wrapper to ensure a global `window.seaDotManager` is available.
// This file is a safe bridge for incremental refactoring: it does not
// move or duplicate logic from the monolithic `UIUX/script.js` but exposes
// the SeaDotManager class instance when it's defined there.
// This file intentionally does NOT auto-instantiate a SeaDotManager.
// It only exposes a helper that other modules can call to attach a single
// instance when appropriate. This avoids double-instantiation due to
// script load order during the incremental refactor.
// UIUX/map/SeaDotManager.js
// Standalone implementation of the SeaDotManager class extracted from the monolithic
// `UIUX/script.js`. This file registers `window.SeaDotManager` (the class) and
// exposes `window.__attachSeaDotManager()` helper which will instantiate a single
// `window.seaDotManager` when called by application bootstrap code.

(function(){
    class SeaDotManager {
        constructor() {
            this.seaDots = new Map(); // 儲存所有海域監測點
            this.dotIdCounter = 1;
        }

        createSeaDotIcon(dotData, sizes, shadowColor, borderStyle) {
            let shapeStyle = '';
                // prefer canonical helpers when available to resolve display colors
                const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
                // prefer helpers which already resolve display.*; fall back to display.* then legacy fields
                const _getDotColor = helpers && typeof helpers.getDotColor === 'function' ? helpers.getDotColor : (p => ((p && p.display && p.display.dotColor) ? p.display.dotColor : (p && p.dotColor) || null));
                const _getBackgroundColor = helpers && typeof helpers.getBackgroundColor === 'function' ? helpers.getBackgroundColor : (p => ((p && p.display && p.display.backgroundColor) ? p.display.backgroundColor : (p && p.backgroundColor) || (p && p.bgColor) || null));
                // Prefer dotColor first, then backgroundColor. If point.type === 'Future' force yellow.
                let resolvedBackground;
                if (typeof _getDotColor === 'function') resolvedBackground = _getDotColor(dotData) || null;
                if (!resolvedBackground && typeof _getBackgroundColor === 'function') resolvedBackground = _getBackgroundColor(dotData) || null;
                if (!resolvedBackground) {
                    // Future points should be warm yellow
                    resolvedBackground = (dotData && dotData.type === 'Future') ? '#FFD54A' : '#2196F3';
                }
                const resolvedDotColor = resolvedBackground;
            let iconAnchor = sizes.iconAnchor;
            const isTrackPoint = dotData.type === 'History' || dotData.type === 'Current' || dotData.type === 'Future';

            if (isTrackPoint) {
                shapeStyle = `
                    width: 0;
                    height: 0;
                    border-left: ${sizes.width/2}px solid transparent;
                    border-right: ${sizes.width/2}px solid transparent;
                        border-bottom: ${sizes.height}px solid ${resolvedBackground};
                    border-radius: 0;
                    box-shadow: 0 2px 8px ${shadowColor};
                `;
                borderStyle = '';
                iconAnchor = [sizes.iconSize[0]/2, sizes.iconSize[1] - 2];
            } else {
                shapeStyle = `
                        background: ${resolvedBackground}; 
                    ${borderStyle}
                    border-radius: ${dotData.borderRadius}; 
                    width: ${sizes.width}px; 
                    height: ${sizes.height}px; 
                    box-shadow: 0 0 15px ${shadowColor};
                `;
            }

            return L.divIcon({
                html: `<div class="sea-dot-inner" style="
                    ${shapeStyle}
                    opacity: 0.9;
                    cursor: pointer;
                    position: relative;
                    z-index: 1000;
                    pointer-events: auto;
                    transform-origin: center center;
                "></div>`,
                className: 'custom-event-marker-static',
                iconSize: sizes.iconSize,
                iconAnchor: iconAnchor
            });
        }

        // New wrapper: accept a canonical point object and adapt to legacy dotData shape
        createSeaDotFromPoint(point) {
            if (!point) return null;
            const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
            const getSafePointId = helpers ? helpers.getSafePointId : (p => (p && (p.pointId || p.id)) || null);
            const display = point.display || {};
            const lat = point.lat;
            const lon = point.lon;
            const id = getSafePointId(point);
            const status = display.status || point.status || 'unknown';
            // preserve legacy API: call createSeaDot with values
            return this.createSeaDot(lat, lon, id, status);
        }

        createTrackSeaDot(lat, lon, id, status, type, trackPointData, vesselId) {
            // trackPointData may already be canonical; prefer display.* over top-level properties
            const display = (trackPointData && trackPointData.display) ? trackPointData.display : null;
            let backgroundColor, dotColor, borderRadius;
            const isAbnormalSignal = this.checkSignalAbnormality(trackPointData || {});

            // Force any Future-type point to be warm yellow and never allow
            // abnormality logic to overwrite it. This guarantees consistent
            // presentation for planned/future points used in demos.
            if (type === 'Future') {
                backgroundColor = '#FFD54A';
                dotColor = '#FFD54A';
            } else if (display && (display.backgroundColor || display.dotColor)) {
                // prefer display subobject when present
                backgroundColor = display.backgroundColor || display.dotColor || '#2196F3';
                dotColor = display.dotColor || display.backgroundColor || '#2196F3';
            } else if (trackPointData && (trackPointData.backgroundColor || trackPointData.dotColor)) {
                // fallback to legacy top-level props on trackPointData
                backgroundColor = trackPointData.backgroundColor || trackPointData.dotColor || '#2196F3';
                dotColor = trackPointData.dotColor || trackPointData.backgroundColor || '#2196F3';
            } else {
                if (isAbnormalSignal) {
                    backgroundColor = '#ef4444';
                    dotColor = '#ef4444';
                } else {
                    // default to blue for track points (not the green used for some non-track markers)
                    backgroundColor = '#2196F3';
                    dotColor = '#2196F3';
                }
            }

            if (display && display.borderRadius) {
                borderRadius = display.borderRadius;
            } else if (trackPointData && trackPointData.borderRadius) {
                borderRadius = trackPointData.borderRadius;
            } else if (type === 'History') {
                borderRadius = '2px';
            } else {
                borderRadius = '50%';
            }

            const dotData = {
                id: id,
                lat: lat,
                lon: lon,
                status: status,
                type: type,
                backgroundColor: backgroundColor,
                dotColor: dotColor,
                borderRadius: borderRadius,
                trackPointData: trackPointData,
                vesselId: vesselId,
                // expose display consistently for downstream code
                display: display || (trackPointData && trackPointData.display) || { backgroundColor, dotColor, borderRadius, status }
            };

            const marker = this.createTrackMarker(dotData);
            return marker;
        }

        // New wrapper: accept canonical point object and adapt
        createTrackSeaDotFromPoint(point) {
            if (!point) return null;
            const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
            const getSafePointId = helpers ? helpers.getSafePointId : (p => (p && (p.pointId || p.id)) || null);
            // prefer display sub-object for UI/display values
            const disp = point.display || {};
            const lat = point.lat;
            const lon = point.lon;
            const id = getSafePointId(point);
            const status = disp.status || point.status || 'unknown';
            const type = point.type || 'Normal';
            // Provide trackPointData for legacy consumers
            const trackPointData = point.trackPointData || Object.assign({}, point);
            const vesselId = point.vesselId || null;
            return this.createTrackSeaDot(lat, lon, id, status, type, trackPointData, vesselId);
        }

        // 生成單一 RF 信號 ID
        generateSingleRFId() {
            const prefixes = ['SIG'];
            const usedRFIds = new Set();
            
            // 從所有事件中收集已使用的 RF 編號，避免重複
            eventStorage.getAllEvents().forEach(event => {
                if (event.suspiciousVesselCandidates) {
                    event.suspiciousVesselCandidates.forEach(rfId => usedRFIds.add(rfId));
                }
                if (event.rfId) {
                    usedRFIds.add(event.rfId);
                }
            });
            
            // 從所有海域監測點中收集已使用的 RF 編號
            if (typeof seaDotManager !== 'undefined') {
                seaDotManager.getAllDots().forEach(dot => {
                    if (dot.rfId) {
                        usedRFIds.add(dot.rfId);
                    }
                });
            }
            
            let attempts = 0;
            while (attempts < 100) { // 最大嘗試次數
                const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                const randomHex = Math.random().toString(16).toUpperCase().substr(2, 6);
                const rfId = `${prefix}-${randomHex}`;
                
                // 確保不重複
                if (!usedRFIds.has(rfId)) {
                    return rfId;
                }
                attempts++;
            }
            
            // 如果無法生成唯一ID，使用時間戳確保唯一性
            const timestamp = Date.now().toString(16).toUpperCase().substr(-6);
            return `SIG-${timestamp}`;
        }

        createSeaDot(lat, lon, id, status) {
            let backgroundColor, dotColor, borderRadius;

            // 統一使用淺藍色，不依照 AIS 狀態區分顏色
            // AIS 狀態參數仍會保留在 dotData.status 中
            backgroundColor = '#1eb0f9ff';  // 淺藍色
            dotColor = '#1eb0f9ff';         // 淺藍色

            // Always use Normal style
            borderRadius = '50%';

            const dotData = {
                id: id,
                lat: lat,
                lon: lon,
                status: status,
                type: 'Normal',
                backgroundColor: backgroundColor,
                dotColor: dotColor,
                borderRadius: borderRadius,
                area: this.getAreaName(lat, lon),
                createTime: new Date().toISOString(),
                rfId: this.generateSingleRFId(),
                marker: null
            };

            const marker = this.createMarker(dotData);
            dotData.marker = marker;
            this.seaDots.set(id, dotData);
            console.log(`🔵 海域監測點 ${id} 已生成 RF 信號 ID: ${dotData.rfId}, 狀態: ${dotData.status}, 類型: ${dotData.type}`);
            return marker;
        }

        checkSignalAbnormality(trackPointData) {
            if (trackPointData.speed && (trackPointData.speed > 25 || trackPointData.speed < 0.5)) {
                return true;
            }
            if (trackPointData.deviationFromRoute && trackPointData.deviationFromRoute > 5) {
                return true;
            }
            if (trackPointData.signalStrength && trackPointData.signalStrength < -80) {
                return true;
            }
            if (trackPointData.inRestrictedZone) {
                return true;
            }
            if (trackPointData.type === 'Future') {
                return Math.random() < 0.3;
            }
            if (trackPointData.hasTask && Math.random() > 0.85) {
                return true;
            }
            return false;
        }

        createTrackMarker(dotData) {
            let borderStyle = '';
                // resolve dotColor via helpers when available (preserve legacy fallback)
                const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
                const resolvedDotColor = (helpers && typeof helpers.getDotColor === 'function') ? (helpers.getDotColor(dotData) || dotData.dotColor) : dotData.dotColor;
                let shadowColor = this.hexToRgba(resolvedDotColor, 0.6);
                borderStyle = `border: 2px solid ${resolvedDotColor};`;
            const sizes = { width: 14, height: 14, iconSize: [24, 24], iconAnchor: [12, 12] };
            const trackIcon = this.createSeaDotIcon(dotData, sizes, shadowColor, borderStyle);
            const marker = L.marker([dotData.lat, dotData.lon], { icon: trackIcon });
            // Create popup content for track point
            const pointTime = new Date(dotData.trackPointData.timestamp);
            const isPast = pointTime < new Date();
            const taskStatus = isPast ? '已完成' : '已排程';

            // Use popup instead of modal
            if (window.popups && window.popups.createTrackPointPopupContent) {
                const popupContent = window.popups.createTrackPointPopupContent(
                    dotData.trackPointData,
                    taskStatus,
                    dotData.vesselId
                );
                marker.bindPopup(popupContent, {
                    maxWidth: 350,
                    className: 'track-point-popup'
                });
            } else {
                // Fallback to original modal if popup function not available
                marker.on('click', () => {
                    if (typeof showTrackPointDetails === 'function') {
                        showTrackPointDetails(dotData.trackPointData, taskStatus, dotData.vesselId);
                    }
                });
            }
            return marker;
        }

        createMarker(dotData, map = taiwanMap) {
            console.log("createMarker is executed, dotData:", dotData);
            let borderStyle = '';
            let shadowColor = 'rgba(102, 231, 255, 0.6)';
            const sizes = this.calculateSeaDotSize(map, { baseSize: 18, baseZoom: 7, scaleFactor: 1.15, minSize: 12, maxSize: 24 });
            // prefer helper resolution for 'none' checks and color derivation
            const resolveDotColor = (typeof window !== 'undefined' && window.safePointHelpers && typeof window.safePointHelpers.getDotColor === 'function') ? window.safePointHelpers.getDotColor : (p => (p && p.dotColor) || null);
            const effectiveColor = (dotData.display && dotData.display.dotColor) ? dotData.display.dotColor : (resolveDotColor(dotData) || dotData.dotColor);
            if (effectiveColor === 'none') {
                borderStyle = 'border: none;';
                shadowColor = 'rgba(102, 231, 255, 0.6)';
            } else {
                shadowColor = this.hexToRgba(effectiveColor, 0.6);
                borderStyle = `border: 2px solid ${effectiveColor};`;
            }
            // ensure dotData has backgroundColor/dotColor consistent with display (use helpers if available)
            const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
            const getDotColor = helpers ? helpers.getDotColor : (p => (p && p.dotColor) || null);
            const getBackgroundColor = helpers ? helpers.getBackgroundColor : (p => (p && p.backgroundColor) || null);
            dotData.backgroundColor = (dotData.display && dotData.display.backgroundColor) || getBackgroundColor(dotData) || dotData.backgroundColor;
            dotData.dotColor = (dotData.display && dotData.display.dotColor) || getDotColor(dotData) || dotData.dotColor;
            const dotIcon = this.createSeaDotIcon(dotData, sizes, shadowColor, borderStyle);
            const marker = L.marker([dotData.lat, dotData.lon], { icon: dotIcon, interactive: true, riseOnHover: true, riseOffset: 250 });

            if (window.popups && window.popups.createPopupContent) {
                try {
                    const content = window.popups.createPopupContent(dotData);
                    marker.bindPopup(content, { offset: [0, -10], closeButton: true, autoClose: false, closeOnEscapeKey: true, maxWidth: 280 });
                } catch (err) {
                    console.error('Failed to generate popup content from window.popups:', err);
                }
            } else {
                console.warn('window.popups is not available - popups will not be bound for this marker.');
            }

            marker.on('click', function(e) {
                console.log('SeaDot clicked:', dotData.rfId);
                L.DomEvent.stopPropagation(e);
                L.DomEvent.stop(e);
                if (window.popups && window.popups.updatePopupContent) {
                    try { window.popups.updatePopupContent(marker, dotData); } catch (err) { console.error('popups.updatePopupContent failed:', err); }
                } else {
                    console.warn('window.popups.updatePopupContent not available - cannot update/open popup.');
                }
                console.log('Popup should be open now');
            });

            marker.on('mouseover', function(e) { console.log('SeaDot mouseover:', dotData.rfId); });
            return marker;
        }

        changedotColor(dotId, newdotColor) {
            const dotData = this.seaDots.get(dotId);
            if (!dotData) { console.warn(`找不到監測點 ${dotId}`); return false; }
            dotData.dotColor = newdotColor;
            dotData.status = this.getStatusFromColor(newdotColor);
            if (dotData.marker && taiwanMap.hasLayer(dotData.marker)) { taiwanMap.removeLayer(dotData.marker); }
            const newMarker = this.createMarker(dotData);
            dotData.marker = newMarker;
            newMarker.addTo(taiwanMap);
            console.log(`✅ 監測點 ${dotId} 外框顏色已更改為 ${newdotColor}`);
            return true;
        }

        changedotColorBatch(dotIds, newdotColor) {
            let successCount = 0;
            dotIds.forEach(dotId => { if (this.changedotColor(dotId, newdotColor)) successCount++; });
            console.log(`✅ 批量更改完成: ${successCount}/${dotIds.length} 個監測點`);
            return successCount;
        }

        getStatusFromColor(color) {
            switch (color) {
                case '#059669': return 'AIS';
                case '#ef4444': return 'No AIS';
                case '#1eb0f9ff': return 'normal';  // 新增淺藍色的映射
                case '#f59e0b': return 'warning';
                case 'none': return 'unknown';
                default: return 'unknown';
            }
        }

        updateAllSeaDotSizes(map = taiwanMap) {
            if (!map) { console.warn('地圖實例不可用，無法更新 SeaDot 大小'); return; }
            const sizes = this.calculateSeaDotSize(map);
            let updateCount = 0;
            this.seaDots.forEach((dotData, dotId) => { if (dotData.marker) { this.updateSeaDotMarkerSize(dotData.marker, sizes, dotData); updateCount++; } });
            console.log(`✅ 已更新 ${updateCount} 個 SeaDot 的大小 (縮放等級: ${map.getZoom()})`);
            return updateCount;
        }

        getStatusText(status) {
            switch (status) {
                case 'AIS': return '已開啟';
                case 'No AIS': return '未開啟';
                case 'unknown': return '狀態未知';
                case 'normal': return '正常監測';
                case 'alert': return '警報狀態';
                case 'warning': return '警告狀態';
                default: return '監測中';
            }
        }

        getColorName(color) {
            switch (color) {
                case '#059669': return '深綠色';
                case '#ef4444': return '紅色';
                case '#1eb0f9ff': return '淺藍色';  // 新增淺藍色的名稱
                case '#f59e0b': return '橙色';
                case 'none': return '無外框';
                default: return '未知';
            }
        }

        hexToRgba(hex, alpha) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        getAreaName(lat, lon) {
            if (lat >= 22.0 && lat <= 25.5 && lon >= 119.0 && lon <= 119.8) return '台灣海峽西側';
            if (lat >= 22.0 && lat <= 25.5 && lon >= 121.5 && lon <= 122.5) return '台灣東部海域';
            if (lat >= 25.0 && lat <= 26.0 && lon >= 120.0 && lon <= 122.0) return '台灣北部海域';
            if (lat >= 21.5 && lat <= 22.5 && lon >= 120.0 && lon <= 121.5) return '台灣南部海域';
            if (lat >= 20.5 && lat <= 22.0 && lon >= 120.5 && lon <= 121.8) return '巴士海峽';
            if (lat >= 23.5 && lat <= 24.5 && lon >= 119.2 && lon <= 119.9) return '台灣海峽中央';
            return '台灣周邊海域';
        }

        getAllDots() { return Array.from(this.seaDots.values()); }
        getAllRFIds() { return this.getAllDots().map(dot => dot.rfId); }
        getDotByRFId(rfId) { return this.getAllDots().find(dot => dot.rfId === rfId); }
        getRFIdsByArea(areaName) { return this.getAllDots().filter(dot => dot.area === areaName).map(dot => dot.rfId); }
        getDotsBydotColor(dotColor) {
            const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
            const getDotColor = helpers ? helpers.getDotColor : (p => (p && p.dotColor) || null);
            return this.getAllDots().filter(dot => getDotColor(dot) === dotColor);
        }
        getDotsCount() { return this.seaDots.size; }
        clearAllDots() { this.seaDots.forEach(dotData => { if (dotData.marker && taiwanMap.hasLayer(dotData.marker)) { taiwanMap.removeLayer(dotData.marker); } }); this.seaDots.clear(); this.dotIdCounter = 1; console.log('🗑️ 已清除所有海域監測點'); }

        /**
         * 隱藏地圖上的所有信號點
         */
        hideAllSignalPoints() {
            let hiddenCount = 0;

            this.seaDots.forEach((dotData, dotId) => {
                if (dotData.marker && taiwanMap && taiwanMap.hasLayer(dotData.marker)) {
                    taiwanMap.removeLayer(dotData.marker);
                    dotData.isHidden = true;
                    hiddenCount++;
                }
            });

            console.log(`🙈 已隱藏 ${hiddenCount} 個信號點`);
            return hiddenCount;
        }

        /**
         * 顯示指定區域內的異常RF信號點
         * @param {Object} areaEvent - 區域事件資料，包含中心座標和半徑
         */
        showAbnormalSignalsInArea(areaEvent) {
            if (!areaEvent || areaEvent.type !== 'area') {
                console.warn('⚠️ 無效的區域事件資料');
                return 0;
            }

            if (!areaEvent.centerLat || !areaEvent.centerLon || !areaEvent.radius) {
                console.warn('⚠️ 缺少中心座標或半徑資訊');
                return 0;
            }

            const centerLat = areaEvent.centerLatDirection === 'S' ? -areaEvent.centerLat : areaEvent.centerLat;
            const centerLon = areaEvent.centerLonDirection === 'W' ? -areaEvent.centerLon : areaEvent.centerLon;
            const radiusInKm = areaEvent.radiusInKm || areaEvent.radius;

            let shownCount = 0;

            // 只顯示區域內未開啟AIS的信號點
            this.seaDots.forEach((dotData, dotId) => {
                if (dotData.status !== "No AIS") return;

                // 使用 Haversine 公式計算距離
                const R = 6371; // 地球半徑（公里）
                const dLat = (dotData.lat - centerLat) * Math.PI / 180;
                const dLon = (dotData.lon - centerLon) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(centerLat * Math.PI / 180) * Math.cos(dotData.lat * Math.PI / 180) *
                        Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c;

                if (distance <= radiusInKm) {
                    // 如果信號點被隱藏，則重新顯示
                    if (dotData.isHidden && dotData.marker && taiwanMap) {
                        taiwanMap.addLayer(dotData.marker);
                        dotData.isHidden = false;
                        shownCount++;
                    }
                }
            });

            console.log(`👁️ 已顯示 ${shownCount} 個區域內的異常RF信號點`);
            return shownCount;
        }

        /**
         * 高亮顯示區域內的異常RF信號（未開啟AIS）
         * 新增功能：先隱藏所有信號點，再顯示並高亮區域內的異常信號
         * @param {Object} areaEvent - 區域事件資料，包含中心座標和半徑
         * @param {boolean} showNormalSignalsOutsideArea - 是否顯示區域外的正常信號點，預設為false
         */
        highlightAbnormalRFSignalsInArea(areaEvent, showNormalSignalsOutsideArea = false) {
            if (!areaEvent || areaEvent.type !== 'area') {
                console.warn('⚠️ 無效的區域事件資料');
                return 0;
            }

            if (!areaEvent.centerLat || !areaEvent.centerLon || !areaEvent.radius) {
                console.warn('⚠️ 缺少中心座標或半徑資訊');
                return 0;
            }

            // 步驟1：使用類似 clearNonTrackPoints 的機制清除非軌跡點
            this.clearNonTrackPointsForArea();

            const centerLat = areaEvent.centerLatDirection === 'S' ? -areaEvent.centerLat : areaEvent.centerLat;
            const centerLon = areaEvent.centerLonDirection === 'W' ? -areaEvent.centerLon : areaEvent.centerLon;
            const radiusInKm = areaEvent.radiusInKm || areaEvent.radius;

            let highlightedCount = 0;
            let normalSignalsShown = 0;

            // 步驟2：處理所有信號點（注意：此時所有點都已被隱藏）
            this.seaDots.forEach((dotData, dotId) => {
                // 計算距離
                const R = 6371; // 地球半徑（公里）
                const dLat = (dotData.lat - centerLat) * Math.PI / 180;
                const dLon = (dotData.lon - centerLon) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                        Math.cos(centerLat * Math.PI / 180) * Math.cos(dotData.lat * Math.PI / 180) *
                        Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const distance = R * c;

                const isInArea = distance <= radiusInKm;
                const isAbnormal = dotData.status === "No AIS";

                // 處理區域內的異常信號：重新顯示並高亮為紅色或黃色
                if (isInArea && isAbnormal) {
                    // 備份原始顏色（如果還沒有備份）
                    if (!dotData.originalColor) {
                        dotData.originalColor = dotData.dotColor || '#2196F3';
                    }

                    // 檢查此 RF 信號是否已建立船舶追蹤事件
                    let hasVesselEvent = false;
                    if (window.eventStorage && dotData.rfId) {
                        const allEvents = window.eventStorage.getAllEvents ? window.eventStorage.getAllEvents() : [];
                        hasVesselEvent = allEvents.some(event => 
                            event.type === 'vessel' && event.rfId === dotData.rfId
                        );
                    }

                    // 如果已建立船舶追蹤事件，使用黃色；否則使用紅色
                    if (hasVesselEvent) {
                        dotData.dotColor = '#fbbf24'; // 黃色 - 表示正在追蹤
                        dotData.isTracked = true; // 標記為正在追蹤
                        console.log(`🟡 RF 信號 ${dotData.rfId} 已列入船舶追蹤，標記為黃色`);
                    } else {
                        dotData.dotColor = '#ef4444'; // 紅色 - 異常但未追蹤
                        dotData.isTracked = false;
                    }
                    
                    dotData.isHighlighted = true;

                    // 重新顯示這個信號點（因為之前被 clearNonTrackPointsForArea 隱藏了）
                    if (dotData.marker && taiwanMap) {
                        taiwanMap.addLayer(dotData.marker);
                        dotData.isHidden = false;
                        
                        // 更新地圖上的標記顏色
                        this.updateDotMarkerColor(dotData);
                    }

                    highlightedCount++;
                }
                // 處理區域外的正常信號點（如果需要顯示）
                else if (!isInArea && showNormalSignalsOutsideArea) {
                    // 恢復原始顏色（如果之前被高亮過）
                    if (dotData.isHighlighted && dotData.originalColor) {
                        dotData.dotColor = dotData.originalColor;
                        dotData.isHighlighted = false;
                        delete dotData.originalColor;
                    }

                    // 重新顯示區域外的正常信號點
                    if (dotData.marker && taiwanMap) {
                        taiwanMap.addLayer(dotData.marker);
                        dotData.isHidden = false;
                        
                        // 更新標記顏色
                        this.updateDotMarkerColor(dotData);
                        normalSignalsShown++;
                    }
                }
                // 其他情況：保持隱藏狀態
                else {
                    // 如果之前被高亮過，恢復原始顏色（雖然不顯示，但保持數據一致性）
                    if (dotData.isHighlighted && dotData.originalColor) {
                        dotData.dotColor = dotData.originalColor;
                        dotData.isHighlighted = false;
                        delete dotData.originalColor;
                    }
                    
                    // 確保保持隱藏狀態
                    dotData.isHidden = true;
                }
            });

            if (showNormalSignalsOutsideArea && normalSignalsShown > 0) {
                console.log(`👁️ 已顯示 ${normalSignalsShown} 個區域外的正常信號點`);
            }

            console.log(`🔴 已清除非軌跡點並高亮顯示 ${highlightedCount} 個區域內的異常RF信號點`);
            return highlightedCount;
        }

        /**
         * 恢復所有信號點的原始顏色和顯示狀態
         */
        restoreOriginalColors() {
            let restoredCount = 0;
            let shownCount = 0;

            this.seaDots.forEach((dotData, dotId) => {
                // 恢復顏色
                if (dotData.isHighlighted && dotData.originalColor) {
                    // 恢復原始顏色
                    dotData.dotColor = dotData.originalColor;
                    dotData.isHighlighted = false;
                    delete dotData.originalColor;

                    // 更新地圖上的標記
                    if (dotData.marker && taiwanMap) {
                        this.updateDotMarkerColor(dotData);
                    }

                    restoredCount++;
                }

                // 恢復顯示狀態
                if (dotData.isHidden && dotData.marker && taiwanMap) {
                    taiwanMap.addLayer(dotData.marker);
                    dotData.isHidden = false;
                    shownCount++;
                }
            });

            console.log(`🔵 已恢復 ${restoredCount} 個信號點的原始顏色，顯示 ${shownCount} 個隱藏的信號點`);
            return { restoredCount, shownCount };
        }

        /**
         * 更新信號點標記的顏色
         * @param {Object} dotData - 信號點資料
         */
        updateDotMarkerColor(dotData) {
            if (!dotData.marker || !taiwanMap) return;

            try {
                // 計算當前大小
                const sizes = this.calculateSeaDotSize(taiwanMap);
                
                // 計算新的樣式
                let borderStyle = '';
                let shadowColor = 'rgba(102, 231, 255, 0.6)';
                
                const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
                const getDotColor = helpers ? helpers.getDotColor : (p => (p && p.dotColor) || null);
                const udColor = getDotColor(dotData);
                
                if (udColor === 'none') {
                    borderStyle = 'border: none;';
                    shadowColor = 'rgba(102, 231, 255, 0.6)';
                } else {
                    shadowColor = this.hexToRgba(udColor, 0.6);
                    borderStyle = `border: 2px solid ${udColor};`;
                }
                
                // 創建新的圖示
                const newIcon = this.createSeaDotIcon(dotData, sizes, shadowColor, borderStyle);
                
                // 設置新圖示
                dotData.marker.setIcon(newIcon);
                
            } catch (error) {
                console.warn('更新信號點顏色時發生錯誤:', error);
            }
        }

        // === SeaDot 動態縮放系統 ===
        /**
         * 根據地圖縮放等級計算 SeaDot 的動態大小
         * @param {L.Map} map - Leaflet 地圖實例
         * @param {Object} options - 大小配置選項
         * @returns {Object} 包含 width, height, iconSize, iconAnchor 的物件
         */
        calculateSeaDotSize(map, options = {}) {
            if (!map) {
                // 如果沒有地圖實例，返回預設大小
                return {
                    width: 16,
                    height: 16,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10]
                };
            }

            // 配置參數
            const config = {
                baseSize: options.baseSize || 16,           // 基礎大小 (zoom = 7 時的大小)
                baseZoom: options.baseZoom || 7,            // 基準縮放等級
                scaleFactor: options.scaleFactor || 1.1,   // 每級縮放的倍數
                minSize: options.minSize || 12,              // 最小大小
                maxSize: options.maxSize || 20              // 最大大小
            };

            const currentZoom = map.getZoom();
            const zoomDifference = currentZoom - config.baseZoom;
            
            // 計算動態大小：基礎大小 * (縮放係數 ^ 縮放差異)
            let dynamicSize = config.baseSize * Math.pow(config.scaleFactor, zoomDifference);
            
            // 限制在最小和最大範圍內
            dynamicSize = Math.max(config.minSize, Math.min(config.maxSize, dynamicSize));
            dynamicSize = Math.round(dynamicSize);

            // 計算圖示大小（通常比實際圓點大一些）
            const iconSize = dynamicSize + 4;
            const iconAnchor = Math.round(iconSize / 2);

            return {
                width: dynamicSize,
                height: dynamicSize,
                iconSize: [iconSize, iconSize],
                iconAnchor: [iconAnchor, iconAnchor]
            };
        }

        /**
         * 更新現有 SeaDot 標記的大小
         * @param {L.Marker} marker - Leaflet 標記實例  
         * @param {Object} sizes - 新的大小參數
         * @param {Object} dotData - SeaDot 資料
         */
        updateSeaDotMarkerSize(marker, sizes, dotData) {
            if (!marker || !marker.getElement()) return;

            try {
                // 獲取當前圖示選項
                const currentIcon = marker.getIcon();
                let borderStyle = '';
                let shadowColor = 'rgba(102, 231, 255, 0.6)';
                
                // 重新計算樣式
                const helpers = (typeof window !== 'undefined' && window.safePointHelpers) ? window.safePointHelpers : null;
                const getDotColor = helpers ? helpers.getDotColor : (p => (p && p.dotColor) || null);
                const udColor = getDotColor(dotData);
                if (udColor === 'none') {
                    borderStyle = 'border: none;';
                    shadowColor = 'rgba(102, 231, 255, 0.6)';
                } else {
                    shadowColor = this.hexToRgba(udColor, 0.6);
                    borderStyle = `border: 2px solid ${udColor};`;
                }
                
                // 創建新的圖示，使用統一的圖示生成函數
                const newIcon = this.createSeaDotIcon(dotData, sizes, shadowColor, borderStyle);
                
                // 設置新圖示
                marker.setIcon(newIcon);
                
            } catch (error) {
                console.warn('更新 SeaDot 大小時發生錯誤:', error);
            }
        }

        /**
         * 清除地圖上除歷史軌跡點外的所有信號點（區域監控專用版本）
         * 類似於 script.js 中的 clearNonTrackPoints 機制，但針對 SeaDotManager 優化
         */
        clearNonTrackPointsForArea() {
            console.log('🧹 開始清除地圖上除歷史軌跡點外的所有信號點（區域監控專用）...');

            let removedCount = 0;
            let preservedHistoryCount = 0;

            try {
                // 獲取有效的地圖實例
                const mapInstance = (typeof taiwanMap !== 'undefined') ? taiwanMap : null;
                if (!mapInstance) {
                    console.warn('⚠️ 未找到有效的地圖實例，無法執行清除操作');
                    return { removed: 0, preserved: 0, success: false, error: '地圖未初始化' };
                }

                // 獲取需要保留的歷史軌跡圖層
                const historyLayersToPreserve = new Set();
                if (typeof historyTrackManager !== 'undefined' && 
                    historyTrackManager && 
                    historyTrackManager.currentHistoryLayers && 
                    Array.isArray(historyTrackManager.currentHistoryLayers)) {
                    historyTrackManager.currentHistoryLayers.forEach(layer => {
                        historyLayersToPreserve.add(layer);
                    });
                    console.log(`🗺️ 標記 ${historyTrackManager.currentHistoryLayers.length} 個歷史軌跡圖層為保留項目`);
                    preservedHistoryCount += historyTrackManager.currentHistoryLayers.length;
                }

                // 處理 SeaDotManager 管理的所有RF信號點和監測點
                console.log('📍 清除 SeaDotManager 中的信號點...');

                // 儲存被清除的點資料（如果有全局隱藏系統的話）
                if (typeof hiddenSignalPoints !== 'undefined' && hiddenSignalPoints && hiddenSignalPoints.seaDots) {
                    this.seaDots.forEach((dotData, dotId) => {
                        hiddenSignalPoints.seaDots.set(dotId, {
                            ...dotData,
                            wasOnMap: dotData.marker && mapInstance.hasLayer(dotData.marker)
                        });
                    });
                }

                // 遍歷所有 SeaDotManager 管理的點進行清除
                this.seaDots.forEach((dotData, dotId) => {
                    // SeaDotManager 管理的都不是歷史軌跡點，全部清除
                    if (dotData.marker && mapInstance.hasLayer(dotData.marker)) {
                        mapInstance.removeLayer(dotData.marker);
                        dotData.isHidden = true; // 標記為已隱藏
                        removedCount++;
                    }
                });

                // 清除所有非保留的地圖圖層
                console.log('🔍 檢查地圖上的其他圖層...');
                const layersToRemove = [];
                const seaDotsRef = this.seaDots; // 保存 this 的引用
                
                mapInstance.eachLayer(function(layer) {
                    // 跳過基礎地圖瓦片層
                    if (layer instanceof L.TileLayer) {
                        return;
                    }
                    
                    // 跳過調查範圍層（investigationRangeLayer）- 這是最可靠的檢查
                    // 嘗試多種方式獲取 investigationRangeLayer
                    const globalInvestigationLayer = (typeof investigationRangeLayer !== 'undefined') ? investigationRangeLayer : 
                                                   (typeof window !== 'undefined' && window.investigationRangeLayer) ? window.investigationRangeLayer : null;
                    
                    if (globalInvestigationLayer && layer === globalInvestigationLayer) {
                        console.log('🛡️ 保留 investigationRangeLayer (全局變數)');
                        return;
                    }
                    
                    // 跳過 LayerGroup 類型的監控範圍圖層（更精確的檢查）
                    if (layer instanceof L.LayerGroup) {
                        let isMonitoringRange = false;
                        let hasMonitoringCircle = false;
                        let hasMonitoringCenter = false;
                        
                        try {
                            layer.eachLayer(function(subLayer) {
                                // 檢查是否有監控範圍圓圈（必須有特定的半徑和虛線樣式）
                                if (subLayer instanceof L.Circle && 
                                    subLayer.options && 
                                    subLayer.options.color === '#4caf50' &&
                                    subLayer.options.fillColor === '#81c784' &&
                                    subLayer.options.fillOpacity === 0.15 &&
                                    subLayer.options.dashArray === '12, 8' &&
                                    subLayer.options.weight === 3 &&
                                    subLayer.options.opacity === 0.9) {
                                    hasMonitoringCircle = true;
                                    console.log('🔍 發現監控範圍圓圈');
                                }
                                // 檢查是否有監控範圍中心標記（精確匹配所有屬性）
                                if (subLayer instanceof L.CircleMarker && 
                                    subLayer.options && 
                                    subLayer.options.color === '#d32f2f' &&
                                    subLayer.options.fillColor === '#ff5722' &&
                                    subLayer.options.fillOpacity === 0.9 &&
                                    subLayer.options.weight === 2 &&
                                    subLayer.options.opacity === 1.0 &&
                                    subLayer.options.radius === 5 &&
                                    subLayer.options.interactive === false) {
                                    hasMonitoringCenter = true;
                                    console.log('🔍 發現監控範圍中心標記');
                                }
                            });
                        } catch (e) {
                            console.warn('遍歷 LayerGroup 時發生錯誤:', e);
                        }
                        
                        // 只有同時包含精確配置的監控圓圈和中心標記的 LayerGroup 才是監控範圍
                        if (hasMonitoringCircle && hasMonitoringCenter) {
                            console.log('🛡️ 保留 LayerGroup 形式的監控範圍（精確匹配）');
                            isMonitoringRange = true;
                        }
                        
                        if (isMonitoringRange) {
                            return;
                        }
                    }
                    
                    // 跳過歷史軌跡圖層
                    if (historyLayersToPreserve.has(layer)) {
                        return;
                    }
                    
                    // 跳過 SeaDotManager 管理的標記（已在上面處理）
                    let isSeaDotManagerMarker = false;
                    seaDotsRef.forEach((dotData) => {
                        if (dotData.marker === layer) {
                            isSeaDotManagerMarker = true;
                        }
                    });
                    
                    if (!isSeaDotManagerMarker) {
                        // 其他非歷史軌跡圖層都標記為待移除
                        layersToRemove.push(layer);
                    }
                });

                // 批量移除非保留圖層
                console.log(`📋 準備移除 ${layersToRemove.length} 個圖層`);
                layersToRemove.forEach(layer => {
                    try {
                        mapInstance.removeLayer(layer);
                        removedCount++;
                        // 更詳細的日誌記錄
                        const layerType = layer.constructor.name;
                        const layerInfo = layer.options ? JSON.stringify(layer.options) : 'no options';
                        console.log(`✂️ 移除圖層: ${layerType} - ${layerInfo}`);
                    } catch (error) {
                        console.warn('移除圖層時發生錯誤:', error);
                    }
                });

                console.log(`🎉 清除完成！總共移除 ${removedCount} 個非歷史軌跡點，保留 ${preservedHistoryCount} 個歷史軌跡點，標記為移除的圖層數: ${layersToRemove.length}`);

                // 更新隱藏狀態（如果有全局隱藏系統的話）
                if (typeof hiddenSignalPoints !== 'undefined' && hiddenSignalPoints && removedCount > 0) {
                    hiddenSignalPoints.clearTime = new Date().toISOString();
                    hiddenSignalPoints.isCleared = true;
                    console.log('📦 已儲存被清除的信號點資料，可使用 restoreHiddenSignalPoints() 恢復');
                }

                return {
                    removed: removedCount,
                    preserved: preservedHistoryCount,
                    success: true
                };

            } catch (error) {
                console.error('❌ 清除地圖點時發生錯誤:', error);
                return {
                    removed: removedCount,
                    preserved: preservedHistoryCount,
                    success: false,
                    error: error.message
                };
            }
        }

        /**
         * 將指定 RF 信號點標記為正在追蹤（黃色）
         * @param {string} rfId - RF 信號 ID
         * @returns {boolean} 是否成功更新
         */
        markRFSignalAsTracked(rfId) {
            if (!rfId) {
                console.warn('⚠️ 未提供 RF ID');
                return false;
            }

            const dotData = this.getDotByRFId(rfId);
            if (!dotData) {
                console.warn(`⚠️ 找不到 RF ID "${rfId}" 對應的信號點`);
                return false;
            }

            // 如果信號點已經被高亮（紅色），則更新為黃色
            if (dotData.isHighlighted) {
                // 備份原始顏色（如果還沒有備份）
                if (!dotData.originalColor) {
                    dotData.originalColor = dotData.dotColor || '#2196F3';
                }

                // 更改為黃色表示正在追蹤
                dotData.dotColor = '#fbbf24';
                dotData.isTracked = true;

                // 更新地圖上的標記顏色
                if (dotData.marker && taiwanMap) {
                    this.updateDotMarkerColor(dotData);
                    console.log(`🟡 RF 信號 ${rfId} 已標記為正在追蹤（黃色）`);
                    return true;
                }
            }

            return false;
        }

        /**
         * 將指定 RF 信號點從追蹤狀態恢復為異常狀態（紅色）
         * @param {string} rfId - RF 信號 ID
         * @returns {boolean} 是否成功更新
         */
        unmarkRFSignalAsTracked(rfId) {
            if (!rfId) {
                console.warn('⚠️ 未提供 RF ID');
                return false;
            }

            const dotData = this.getDotByRFId(rfId);
            if (!dotData) {
                console.warn(`⚠️ 找不到 RF ID "${rfId}" 對應的信號點`);
                return false;
            }

            // 如果信號點正在被追蹤，則恢復為紅色異常狀態
            if (dotData.isTracked && dotData.isHighlighted) {
                // 更改為紅色表示異常但未追蹤
                dotData.dotColor = '#ef4444';
                dotData.isTracked = false;

                // 更新地圖上的標記顏色
                if (dotData.marker && taiwanMap) {
                    this.updateDotMarkerColor(dotData);
                    console.log(`🔴 RF 信號 ${rfId} 已恢復為異常狀態（紅色）`);
                    return true;
                }
            }

            return false;
        }
    }

    // Export the class
    window.SeaDotManager = SeaDotManager;

    // Helper that will instantiate a single global instance when called.
    function attachIfAvailable() {
        if (window.seaDotManager) return true; // already attached
        if (typeof window.SeaDotManager === 'function') {
            try {
                window.seaDotManager = new window.SeaDotManager();
                console.log('SeaDotManager helper: instantiated and attached window.seaDotManager');
                return true;
            } catch (err) {
                console.warn('SeaDotManager helper: failed to instantiate SeaDotManager', err);
                return false;
            }
        }
        return false; // class not available yet
    }

    window.__attachSeaDotManager = attachIfAvailable;
})();
