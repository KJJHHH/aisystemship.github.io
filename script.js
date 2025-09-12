let currentEventId = 'area-001';
let selectedEventType = null;
let selectedAction = null;
let eventCounter = 4;
let missionCounter = 3;
let creatingEventIds = new Set(); // 追蹤正在創建中的事件ID

// 禁用/啟用特定事件卡的視覺狀態
function setEventCardDisabled(eventId, disabled) {
    const eventCards = document.querySelectorAll('.event-card');
    eventCards.forEach(card => {
        // 檢查事件卡是否對應指定的事件ID
        const cardEventId = getEventIdFromCard(card);
        if (cardEventId === eventId) {
            if (disabled) {
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';
                card.style.filter = 'grayscale(50%)';
            } else {
                card.style.opacity = '';
                card.style.pointerEvents = '';
                card.style.filter = '';
            }
        }
    });
}

// 從事件卡獲取事件ID的輔助函數
function getEventIdFromCard(card) {
    const eventIdElement = card.querySelector('.event-id');
    if (eventIdElement) {
        return eventIdElement.textContent.toLowerCase();
    }
    return null;
}

// Action options
const actionNames = {
        'track': '持續追蹤',
        'satellite': '衛星重拍',
        'notify': '通知單位',
        'uav': 'UAV 派遣'
    };
    
const actionIcons = {
        'track': '🎯',
        'satellite': '🛰️',
        'notify': '📞',
        'uav': '🚁'
    };

// 事件資料儲存結構
class EventDataStorage {
    constructor() {
        this.events = new Map();
        this.initializeDefaultEvents();
    }

    // 初始化預設事件資料
    initializeDefaultEvents() {
        // 為 area-001 事件生成基本區域資訊
        const areaRange = generateRandomSeaAreaRange();
        const latRange = areaRange.latRange;
        const lonRange = areaRange.lonRange;

        // 獲取當前時間作為 createTime
        const currentTime = new Date();
        const createTimeStr = currentTime.toLocaleTimeString('zh-TW', {
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit'
        });

        // 計算監控結束時間（當前時間 + 8 小時）
        const endTime = new Date(currentTime.getTime() + 8 * 60 * 60 * 1000);
        const endTimeStr = endTime.toLocaleTimeString('zh-TW', {
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit'
        });

        this.events.set('area-001', {
            id: 'area-001',
            type: 'area',
            aoiName: '台海北部海域',
            latRange: latRange,
            lonRange: lonRange,
            monitorHours: '8',
            createTime: createTimeStr,
            monitorTimeRange: `${createTimeStr} - ${endTimeStr}`,
            status: 'investigating'
            // 不包含 rfCandidates 和 rfCandidatesData，將在 getAreaEventDetailsFromStorage 中動態生成
        });

        // 初始化 RF 事件，等待 SeaDotManager 可用後再填入具體資訊
        let rfEventData = {
            id: 'rf-002',
            type: 'rf',
            detectionTime: '13:45',
            createTime: '13:45',
            status: 'analyzed',
            notes: '未知信號源，無 AIS 對應',
            // 暫時使用預設值，稍後會被重新初始化
            rfId: 'SIG-4A7B2C',
            frequency: '162.025 MHz',
            strength: '-47 dBm',
            coordinates: generateSeaCoordinateForEvents()
        };

        this.events.set('rf-002', rfEventData);

        this.events.set('vessel-003', {
            id: 'vessel-003',
            type: 'vessel',
            mmsi: '416123456',
            coordinates: '等待初始化...', // 將通過 reinitializeVesselEvents 設定
            vesselName: '未知船舶',
            riskScore: 85,
            createTime: '12:30',
            status: 'investigating',
            investigationReason: 'AIS 異常關閉，偏離正常航道',
            trackPoints: null // 儲存固定的軌跡點，初次生成後不再變動
        });

        // this.events.set('vessel-004', {
        //     id: 'vessel-004',
        //     type: 'vessel',
        //     mmsi: '416789012',
        //     coordinates: generateSeaCoordinateForEvents(),
        //     vesselName: '漁船阿勇號',
        //     riskScore: 28,
        //     createTime: '10:15',
        //     status: 'completed',
        //     investigationReason: '定期巡查',
        //     completedTime: '12:45'
        // });
    }

    // 儲存事件資料
    saveEvent(eventId, eventData) {
        this.events.set(eventId, {
            id: eventId,
            ...eventData,
            updateTime: new Date().toLocaleTimeString('zh-TW', {hour12: false, hour: '2-digit', minute: '2-digit'})
        });
        console.log(`事件 ${eventId} 已儲存:`, this.events.get(eventId));
    }

    // 取得事件資料
    getEvent(eventId) {
        return this.events.get(eventId) || null;
    }

    // 更新事件資料
    updateEvent(eventId, updates) {
        const existingEvent = this.events.get(eventId);
        if (existingEvent) {
            this.events.set(eventId, {
                ...existingEvent,
                ...updates,
                updateTime: new Date().toLocaleTimeString('zh-TW', {hour12: false, hour: '2-digit', minute: '2-digit'})
            });
            console.log(`事件 ${eventId} 已更新:`, this.events.get(eventId));
            return true;
        }
        return false;
    }

    // 刪除事件資料
    deleteEvent(eventId) {
        return this.events.delete(eventId);
    }

    // 重新初始化 RF 事件（在 SeaDotManager 可用後調用）
    reinitializeRFEvents() {
        if (typeof window.seaDotManager === 'undefined' || window.seaDotManager.getAllDots().length === 0) {
            console.warn('⚠️ SeaDotManager 仍不可用，跳過 RF 事件重新初始化');
            return;
        }

        // 重新初始化 rf-002 事件
        const existingRfEvent = this.events.get('rf-002');
        if (existingRfEvent) {
            // 從所有 sea dots 中隨機選擇一個
            const allDots = window.seaDotManager.getAllDots();
            const randomDot = allDots[Math.floor(Math.random() * allDots.length)];
            
            // 根據 sea dot 的 borderColor 決定 AIS 狀態
            let aisStatus = '未知';
            if (randomDot.borderColor === '#ef4444' || randomDot.borderColor === 'red') {
                aisStatus = '未開啟';
            } else if (randomDot.borderColor === '#059669' || randomDot.borderColor === 'green') {
                aisStatus = '已開啟';
            }

            // 更新事件資料
            const updatedEventData = {
                ...existingRfEvent,
                rfId: randomDot.rfId,
                coordinates: `${randomDot.lat.toFixed(3)}°N, ${randomDot.lon.toFixed(3)}°E`,
                frequency: '162.025 MHz',
                strength: '-47 dBm',
                aisStatus: aisStatus,
                sourceSeaDot: {
                    id: randomDot.id,
                    status: randomDot.status,
                    borderColor: randomDot.borderColor,
                    area: randomDot.area
                }
            };
            
            this.events.set('rf-002', updatedEventData);
            console.log(`✅ RF 事件 rf-002 已重新初始化，使用 sea dot ${randomDot.id}，RF ID: ${randomDot.rfId}，AIS 狀態: ${aisStatus}`);
            
            // 更新事件卡顯示
            this.updateEventCardDisplay('rf-002', updatedEventData);
        }
    }

    // 重新初始化 Vessel 事件（在 SeaDotManager 可用後調用）
    reinitializeVesselEvents() {
        if (typeof window.seaDotManager === 'undefined' || window.seaDotManager.getAllDots().length === 0) {
            console.warn('⚠️ SeaDotManager 仍不可用，跳過 Vessel 事件重新初始化');
            return;
        }

        // 重新初始化 vessel-003 事件
        const existingVesselEvent = this.events.get('vessel-003');
        if (existingVesselEvent) {
            // 從所有 sea dots 中隨機選擇一個
            const allDots = window.seaDotManager.getAllDots();
            const randomDot = allDots[Math.floor(Math.random() * allDots.length)];
            
            // 根據 sea dot 的 borderColor 決定 AIS 狀態
            let aisStatus = '未知';
            if (randomDot.borderColor === '#ef4444' || randomDot.borderColor === 'red') {
                aisStatus = '未開啟';
            } else if (randomDot.borderColor === '#059669' || randomDot.borderColor === 'green') {
                aisStatus = '已開啟';
            }
            
            // 根據 sea dot 的 borderColor 決定船舶的風險評估和狀態
            let riskScore = existingVesselEvent.riskScore || 85;
            let investigationReason = existingVesselEvent.investigationReason || 'AIS 異常關閉，偏離正常航道';
            
            // 根據 sea dot 狀態調整風險分數和調查原因
            if (randomDot.borderColor === '#ef4444' || randomDot.borderColor === 'red') {
                riskScore = Math.floor(Math.random() * 20) + 80; // 80-99 高風險
                investigationReason = 'AIS 信號異常關閉，船舶行為可疑';
            } else if (randomDot.borderColor === '#059669' || randomDot.borderColor === 'green') {
                riskScore = Math.floor(Math.random() * 30) + 60; // 60-89 中等風險
                investigationReason = '定期監控，船舶位置異常';
            }

            // 更新事件資料
            const updatedEventData = {
                ...existingVesselEvent,
                coordinates: `${randomDot.lat.toFixed(3)}°N, ${randomDot.lon.toFixed(3)}°E`,
                riskScore: riskScore,
                investigationReason: investigationReason,
                aisStatus: aisStatus,
                sourceSeaDot: {
                    id: randomDot.id,
                    status: randomDot.status,
                    borderColor: randomDot.borderColor,
                    area: randomDot.area
                }
            };
            
            // 只在沒有軌跡點時才生成新的軌跡點，否則保留現有的
            if (!existingVesselEvent.trackPoints || existingVesselEvent.trackPoints.length === 0) {
                updatedEventData.trackPoints = this.generateFixedTrackPoints(randomDot.lat, randomDot.lon);
                console.log(`✅ 為重新初始化的船舶事件 vessel-003 生成了新的固定軌跡點`);
            } else {
                // 保留現有軌跡點，但需要基於新座標重新生成
                updatedEventData.trackPoints = this.generateFixedTrackPoints(randomDot.lat, randomDot.lon);
                console.log(`🔄 為重新初始化的船舶事件 vessel-003 重新生成了固定軌跡點（基於新座標）`);
            }
            
            this.events.set('vessel-003', updatedEventData);
            console.log(`✅ Vessel 事件 vessel-003 已重新初始化，使用 sea dot ${randomDot.id}，風險分數: ${riskScore}，AIS 狀態: ${aisStatus}，座標: ${updatedEventData.coordinates}`);
            
            // 更新事件卡顯示
            this.updateEventCardDisplay('vessel-003', updatedEventData);
        }
    }

    // 重新初始化 Area 事件（更新監控時間為當前時間）
    reinitializeAreaEvents() {
        // 重新初始化 area-001 事件的時間
        const areaEvent = this.events.get('area-001');
        if (areaEvent) {
            const areaCard = document.querySelector('[onclick*="area-001"]');
            if (areaCard) {
                const eventInfo = areaCard.querySelector('.event-info');
                if (eventInfo) {
                    eventInfo.innerHTML = `
                        監控區域：${areaEvent.aoiName || '台海北部海域'}<br>
                        監控時間: ${areaEvent.monitorTimeRange || '計算中'}<br>
                    `;
                    console.log('✅ 已更新 area-001 事件卡顯示內容');
                }
            }
        }
    }

    // 更新事件卡的顯示內容
    updateEventCardDisplay(eventId, eventData) {
        // 尋找對應的事件卡
        const eventCards = document.querySelectorAll('.event-card');
        let targetCard = null;
        
        eventCards.forEach(card => {
            const cardEventId = this.getEventIdFromCard(card);
            if (cardEventId === eventId) {
                targetCard = card;
            }
        });
        
        if (!targetCard) {
            console.warn(`找不到事件卡: ${eventId}`);
            return;
        }

        // 根據事件類型更新顯示內容
        if (eventData.type === 'rf') {
            const eventInfoElement = targetCard.querySelector('.event-info');
            if (eventInfoElement) {
                eventInfoElement.innerHTML = `
                    RF 信號 ID: ${eventData.rfId}<br>
                    座標: ${eventData.coordinates}<br>
                `;
                console.log(`✅ 已更新 ${eventId} 事件卡顯示內容`);
            }
        } else if (eventData.type === 'vessel') {
            const eventInfoElement = targetCard.querySelector('.event-info');
            if (eventInfoElement) {
                eventInfoElement.innerHTML = `
                    風險分數: ${eventData.riskScore}<br>
                    座標: ${eventData.coordinates}<br>
                    AIS 狀態: ${eventData.aisStatus || '未知'}
                `;
                console.log(`✅ 已更新 ${eventId} 事件卡顯示內容`);
            }
        }
    }

    // 從事件卡獲取事件ID的輔助方法
    getEventIdFromCard(card) {
        const eventIdElement = card.querySelector('.event-id');
        if (eventIdElement) {
            return eventIdElement.textContent.toLowerCase();
        }
        return null;
    }

    // 取得所有事件
    getAllEvents() {
        return Array.from(this.events.values());
    }

    // 依類型篩選事件
    getEventsByType(type) {
        return Array.from(this.events.values()).filter(event => event.type === type);
    }

    // 檢查事件是否存在
    hasEvent(eventId) {
        return this.events.has(eventId);
    }

    // 取得事件數量
    getEventCount() {
        return this.events.size;
    }
    
    // 檢查vessel事件的軌跡點狀態 (debug用)
    checkVesselTrackPoints(eventId) {
        const event = this.getEvent(eventId);
        if (event && event.type === 'vessel') {
            console.log(`🔍 船舶事件 ${eventId} 的軌跡點狀態:`);
            console.log(`  - 事件類型: ${event.type}`);
            console.log(`  - 座標: ${event.coordinates}`);
            console.log(`  - 軌跡點數量: ${event.trackPoints ? event.trackPoints.length : '未設定'}`);
            if (event.trackPoints && event.trackPoints.length > 0) {
                console.log(`  - 前3個軌跡點:`, event.trackPoints.slice(0, 3));
            }
            return event.trackPoints;
        } else {
            console.warn(`⚠️ 事件 ${eventId} 不存在或不是vessel類型`);
            return null;
        }
    }

    // 匯出事件資料為 JSON
    exportToJSON() {
        return JSON.stringify(Array.from(this.events.entries()), null, 2);
    }

    // 生成固定的軌跡點（用於vessel事件，只生成一次）
    generateFixedTrackPoints(endLat, endLon) {
        const totalPoints = 12; // 要繪製的歷史點數量
        
        // 定義點之間的距離（單位：度）
        const normalDistance = 0.015; // 正常距離
        const longDistance = 0.03;   // 黃色接白色時的較長距離

        let trackPoints = []; // 用於儲存12個歷史點
        let lastColor = null;
        let previousPoint = { lat: endLat, lon: endLon }; // 從目標點開始反向計算

        // 反向生成12個歷史點
        for (let i = 0; i < totalPoints; i++) {
            const currentColor = this.getNextTrackColor(lastColor);
            
            // 決定此點與前一個點的距離
            const distance = (currentColor === 'yellow' && lastColor === 'white') ? longDistance : normalDistance;
            
            // 計算方向，大致朝著遠離目標的方向，並加入隨機性
            const angleAwayFromTarget = Math.atan2(previousPoint.lat - endLat, previousPoint.lon - endLon);
            const randomAngleOffset = (Math.random() - 0.5) * (Math.PI / 3); // 正負30度之間
            const finalAngle = angleAwayFromTarget + randomAngleOffset;

            // 計算新點的座標
            const newLat = previousPoint.lat + distance * Math.sin(finalAngle);
            const newLon = previousPoint.lon + distance * Math.cos(finalAngle);

            const newPoint = { lat: newLat, lon: newLon, color: currentColor };
            trackPoints.unshift(newPoint); // 從頭部插入，保持時間順序
            
            previousPoint = newPoint;
            lastColor = currentColor;
        }

        console.log(`✅ 為船舶事件生成了固定的軌跡點 (${totalPoints}個點)`);
        return trackPoints;
    }

    // 根據顏色規則獲取下一個顏色（反向邏輯）
    getNextTrackColor(colorOfPointAhead) {
        // 我們正在從目標點反向生成軌跡，所以 colorOfPointAhead 是時間上較晚的點的顏色。
        // 我們需要決定時間上較早的點（即當前要生成的點）的顏色。
        
        if (colorOfPointAhead === null) {
            // 這是軌跡中的第一個點（離目標最遠），它可以是任何顏色。
            return ['white', 'yellow', 'black'][Math.floor(Math.random() * 3)];
        }

        let possibleColors = [];

        // 反向應用顏色規則
        switch (colorOfPointAhead) {
            case 'white':
                // 任何顏色的點後面都可以跟一個白點。
                possibleColors = ['white', 'yellow', 'black'];
                break;
            case 'yellow':
                // 任何顏色的點後面都可以跟一個黃點。
                possibleColors = ['white', 'yellow', 'black'];
                break;
            case 'black':
                // 只有白點後面可以跟一個黑點。
                // 所以，如果前面的點是黑色，我們現在生成的這個點必須是白色。
                possibleColors = ['white'];
                break;
        }
        
        return possibleColors[Math.floor(Math.random() * possibleColors.length)];
    }

    // 從 JSON 匯入事件資料
    importFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.events = new Map(data);
            return true;
        } catch (error) {
            console.error('匯入事件資料失敗:', error);
            return false;
        }
    }
}

// 建立全域事件資料儲存實例
const eventStorage = new EventDataStorage();

// 全域測試函數 - 檢查vessel事件的軌跡點 (開發/測試用)
window.checkVesselTracks = function(eventId) {
    if (eventId) {
        return eventStorage.checkVesselTrackPoints(eventId);
    } else {
        // 如果沒有指定ID，檢查所有vessel事件
        console.log('🔍 檢查所有vessel事件的軌跡點狀態：');
        const vesselEvents = eventStorage.getEventsByType('vessel');
        vesselEvents.forEach(event => {
            console.log(`  - ${event.id}: ${event.trackPoints ? event.trackPoints.length : '未設定'} 個軌跡點`);
        });
        return vesselEvents.map(event => ({
            id: event.id,
            trackPointsCount: event.trackPoints ? event.trackPoints.length : 0
        }));
    }
};

// 全域測試函數 - 強制為vessel事件重新生成軌跡點 (開發/測試用)
window.regenerateVesselTracks = function(eventId) {
    const event = eventStorage.getEvent(eventId);
    if (event && event.type === 'vessel' && event.coordinates) {
        try {
            const coords = parsePointCoordinates(event.coordinates);
            if (coords) {
                const newTrackPoints = eventStorage.generateFixedTrackPoints(coords.lat, coords.lon);
                eventStorage.updateEvent(eventId, { trackPoints: newTrackPoints });
                console.log(`✅ 已為船舶事件 ${eventId} 重新生成了 ${newTrackPoints.length} 個軌跡點`);
                return newTrackPoints;
            }
        } catch (error) {
            console.error(`❌ 重新生成軌跡點時發生錯誤:`, error);
        }
    } else {
        console.warn(`⚠️ 事件 ${eventId} 不存在、不是vessel類型或缺少座標`);
    }
    return null;
};

// 全域海域座標生成函數（避開台灣本島）
function generateSeaCoordinateForEvents() {
    // 定義台灣本島的大致範圍（避免在陸地上放置事件）
    const taiwanLandAreas = [
        // 台灣本島主要區域
        { latMin: 21.9, latMax: 25.3, lonMin: 120.0, lonMax: 122.0 },
    ];
    
    // 定義海域範圍（台灣周圍海域）
    const seaAreas = [
        // 台灣海峽西側
        { latMin: 22.0, latMax: 25.5, lonMin: 119.0, lonMax: 119.8, name: '台灣海峽西側' },
        // 東部海域
        { latMin: 22.0, latMax: 25.5, lonMin: 121.5, lonMax: 122.5, name: '台灣東部海域' },
        // 北部海域
        { latMin: 25.0, latMax: 26.0, lonMin: 120.0, lonMax: 122.0, name: '台灣北部海域' },
        // 南部海域
        { latMin: 21.5, latMax: 22.5, lonMin: 120.0, lonMax: 121.5, name: '台灣南部海域' },
        // 巴士海峽
        { latMin: 20.5, latMax: 22.0, lonMin: 120.5, lonMax: 121.8, name: '巴士海峽' },
        // 台灣海峽中央
        { latMin: 23.5, latMax: 24.5, lonMin: 119.2, lonMax: 119.9, name: '台灣海峽中央' }
    ];
    
    // 檢查座標是否在台灣陸地範圍內
    function isOnLand(lat, lon) {
        return taiwanLandAreas.some(area => 
            lat >= area.latMin && lat <= area.latMax && 
            lon >= area.lonMin && lon <= area.lonMax
        );
    }
    
    const maxAttempts = 20;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        // 隨機選擇一個海域
        const seaArea = seaAreas[Math.floor(Math.random() * seaAreas.length)];
        
        // 在該海域內生成隨機座標
        const lat = seaArea.latMin + Math.random() * (seaArea.latMax - seaArea.latMin);
        const lon = seaArea.lonMin + Math.random() * (seaArea.lonMax - seaArea.lonMin);
        
        // 檢查是否在陸地上
        if (!isOnLand(lat, lon)) {
            // 格式化為度分格式字串
            const latStr = `${lat.toFixed(3)}°N`;
            const lonStr = `${lon.toFixed(3)}°E`;
            return `${latStr}, ${lonStr}`;
        }
        
        attempts++;
    }
    
    // 如果多次嘗試都失敗，使用預設的海域座標
    return '24.000°N, 119.500°E';
}

// 隨機生成經緯度座標函數（已更新為使用海域座標生成）
function generateRandomCoordinates(options = {}) {
    // 如果有指定範圍選項，使用指定範圍（但仍避開陸地）
    if (options.latMin !== undefined && options.latMax !== undefined && 
        options.lonMin !== undefined && options.lonMax !== undefined) {
        
        // 台灣本島範圍定義
        const taiwanLandAreas = [
            { latMin: 21.9, latMax: 25.3, lonMin: 120.0, lonMax: 122.0 },
        ];
        
        // 檢查座標是否在台灣陸地範圍內
        function isOnLand(lat, lon) {
            return taiwanLandAreas.some(area => 
                lat >= area.latMin && lat <= area.latMax && 
                lon >= area.lonMin && lon <= area.lonMax
            );
        }
        
        const maxAttempts = 30;
        let attempts = 0;
        const precision = options.precision || 3;
        
        while (attempts < maxAttempts) {
            const latitude = (options.latMin + Math.random() * (options.latMax - options.latMin));
            const longitude = (options.lonMin + Math.random() * (options.lonMax - options.lonMin));
            
            // 檢查是否在陸地上
            if (!isOnLand(latitude, longitude)) {
                return `${latitude.toFixed(precision)}°N, ${longitude.toFixed(precision)}°E`;
            }
            
            attempts++;
        }
        
        // 如果指定範圍內都是陸地，使用預設海域座標
        console.warn('指定範圍內無法生成海域座標，使用預設海域座標');
    }
    
    // 默認情況下使用海域座標生成函數
    return generateSeaCoordinateForEvents();
}

// 隨機生成台灣周遭海域的座標範圍
function generateRandomSeaAreaRange() {
    // 定義台灣周遭各個海域的基本範圍
    const seaRegions = [
        {
            name: '台灣海峽西側',
            latBase: { min: 22.0, max: 25.5 },
            lonBase: { min: 119.0, max: 119.8 },
            sizeRange: { min: 0.3, max: 1.2 } // 範圍大小（度數）
        },
        {
            name: '台灣東部海域',
            latBase: { min: 22.0, max: 25.5 },
            lonBase: { min: 121.5, max: 122.5 },
            sizeRange: { min: 0.4, max: 1.0 }
        },
        {
            name: '台灣北部海域',
            latBase: { min: 25.0, max: 26.0 },
            lonBase: { min: 120.0, max: 122.0 },
            sizeRange: { min: 0.3, max: 0.8 }
        },
        {
            name: '台灣南部海域',
            latBase: { min: 21.5, max: 22.5 },
            lonBase: { min: 120.0, max: 121.5 },
            sizeRange: { min: 0.4, max: 0.9 }
        },
        {
            name: '巴士海峽',
            latBase: { min: 20.5, max: 22.0 },
            lonBase: { min: 120.5, max: 121.8 },
            sizeRange: { min: 0.5, max: 1.1 }
        },
        {
            name: '台灣海峽中央',
            latBase: { min: 23.5, max: 24.5 },
            lonBase: { min: 119.2, max: 119.9 },
            sizeRange: { min: 0.3, max: 0.7 }
        }
    ];

    // 隨機選擇一個海域
    const selectedRegion = seaRegions[Math.floor(Math.random() * seaRegions.length)];
    
    // 生成範圍大小
    const latSize = selectedRegion.sizeRange.min + Math.random() * (selectedRegion.sizeRange.max - selectedRegion.sizeRange.min);
    const lonSize = selectedRegion.sizeRange.min + Math.random() * (selectedRegion.sizeRange.max - selectedRegion.sizeRange.min);
    
    // 在選定海域內隨機選擇一個起始點，確保範圍不會超出海域邊界
    const maxLatStart = selectedRegion.latBase.max - latSize;
    const maxLonStart = selectedRegion.lonBase.max - lonSize;
    
    const latStart = selectedRegion.latBase.min + Math.random() * (maxLatStart - selectedRegion.latBase.min);
    const lonStart = selectedRegion.lonBase.min + Math.random() * (maxLonStart - selectedRegion.lonBase.min);
    
    // 計算範圍終點
    const latEnd = latStart + latSize;
    const lonEnd = lonStart + lonSize;
    
    // 格式化範圍字串
    const latRange = `${latStart.toFixed(1)}°N - ${latEnd.toFixed(1)}°N`;
    const lonRange = `${lonStart.toFixed(1)}°E - ${lonEnd.toFixed(1)}°E`;
    
    console.log(`🌊 生成 ${selectedRegion.name} 座標範圍: ${latRange}, ${lonRange}`);
    
    return {
        latRange: latRange,
        lonRange: lonRange,
        areaName: selectedRegion.name,
        centerLat: (latStart + latEnd) / 2,
        centerLon: (lonStart + lonEnd) / 2,
        size: Math.max(latSize, lonSize)
    };
}

// 簡化版：只返回座標範圍字串
function generateRandomSeaRanges() {
    const rangeData = generateRandomSeaAreaRange();
    return {
        latRange: rangeData.latRange,
        lonRange: rangeData.lonRange,
        areaName: rangeData.areaName
    };
}

// 從座標範圍內生成隨機座標（兼容舊函數調用）
function generateCoordinatesInRange(latRange, lonRange) {
    try {
        // 如果沒有提供參數，使用新的隨機海域範圍生成
        if (!latRange || !lonRange) {
            const randomRange = generateRandomSeaAreaRange();
            latRange = randomRange.latRange;
            lonRange = randomRange.lonRange;
        }
        
        // 解析緯度範圍 (例: "24.2°N - 24.8°N")
        const latMatch = latRange.match(/(\d+\.?\d*)°N\s*-\s*(\d+\.?\d*)°N/);
        const lonMatch = lonRange.match(/(\d+\.?\d*)°E\s*-\s*(\d+\.?\d*)°E/);
        
        if (latMatch && lonMatch) {
            const latMin = parseFloat(latMatch[1]);
            const latMax = parseFloat(latMatch[2]);
            const lonMin = parseFloat(lonMatch[1]);
            const lonMax = parseFloat(lonMatch[2]);
            
            // 台灣本島範圍定義
            const taiwanLandAreas = [
                { latMin: 21.9, latMax: 25.3, lonMin: 120.0, lonMax: 122.0 },
            ];
            
            // 檢查座標是否在台灣陸地範圍內
            function isOnLand(lat, lon) {
                return taiwanLandAreas.some(area => 
                    lat >= area.latMin && lat <= area.latMax && 
                    lon >= area.lonMin && lon <= area.lonMax
                );
            }
            
            const maxAttempts = 30;
            let attempts = 0;
            
            while (attempts < maxAttempts) {
                // 在指定範圍內生成隨機座標
                const lat = latMin + Math.random() * (latMax - latMin);
                const lon = lonMin + Math.random() * (lonMax - lonMin);
                
                // 檢查是否在陸地上
                if (!isOnLand(lat, lon)) {
                    // 格式化為度分格式字串
                    const latStr = `${lat.toFixed(3)}°N`;
                    const lonStr = `${lon.toFixed(3)}°E`;
                    return `${latStr}, ${lonStr}`;
                }
                
                attempts++;
            }
            
            // 如果多次嘗試都失敗，使用範圍邊界的海域座標
            const edgeLat = Math.random() < 0.5 ? latMin : latMax;
            const edgeLon = Math.random() < 0.5 ? lonMin : lonMax;
            return `${edgeLat.toFixed(3)}°N, ${edgeLon.toFixed(3)}°E`;
            
        } else {
            // 如果解析失敗，使用海域座標生成函數
            console.warn('無法解析座標範圍，使用海域座標生成');
            return generateSeaCoordinateForEvents();
        }
    } catch (error) {
        console.error('生成座標時發生錯誤:', error);
        return generateSeaCoordinateForEvents();
    }
}

// 計算監控時間範圍的輔助函數
function calculateMonitorTimeRange(createTime, monitorHours) {
    if (!createTime || !monitorHours) return '未設定';
    
    try {
        // 解析建立時間 (格式: HH:MM)
        const [hours, minutes] = createTime.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(hours, minutes, 0, 0);
        
        // 計算結束時間
        const endTime = new Date(startTime);
        endTime.setHours(startTime.getHours() + parseInt(monitorHours));
        
        // 格式化時間範圍
        const formatTime = (date) => {
            return date.toLocaleTimeString('zh-TW', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });
        };
        
        return `${formatTime(startTime)} - ${formatTime(endTime)}`;
    } catch (error) {
        console.warn('計算監控時間範圍時發生錯誤:', error);
        return `${createTime} - (${monitorHours || '未設定'})`;
    }
}

// 取得無 AIS 的 RF 信號資料 - 使用 SeaDotManager 整合
function getRFSignalsWithoutAIS(areaEvent) {
    try {
        console.log('🔍 開始查詢無 AIS 的 RF 信號', areaEvent);
        
        if (!areaEvent || areaEvent.type !== 'area') {
            console.warn('⚠️ 無效的區域事件資料');
            return null;
        }
        
        // 檢查 seaDotManager 是否可用
        if (!window.seaDotManager) {
            console.warn('⚠️ SeaDotManager 未初始化，使用預設資料');
        }
        
        // 從區域事件中獲取座標範圍
        const latRange = areaEvent.latRange;
        const lonRange = areaEvent.lonRange;
        
        if (!latRange || !lonRange) {
            console.warn('⚠️ 缺少座標範圍資訊，使用預設資料');
        }
        
        console.log(`📍 查詢範圍: 緯度 ${latRange}, 經度 ${lonRange}`);
        
        // 使用 SeaDotManager 查詢範圍內狀態為 "No AIS" 的監測點
        const noAISDots = window.seaDotManager.getDotsInRangeByStatus(latRange, lonRange, "No AIS");
        
        console.log(`🎯 找到 ${noAISDots.length} 個無 AIS 監測點:`, noAISDots);
        
        // 將監測點轉換為 RF 信號資料格式
        const rfSignalsWithoutAIS = noAISDots.map((dot, index) => {
            // 生成隨機頻率和信號強度（保持現有的變化性）
            const frequency = (Math.random() * (470 - 430) + 430).toFixed(1); // 430-470 MHz
            const strength = Math.floor(Math.random() * 50 + 30); // 30-80 dBm
            
            // 將座標轉換為度分秒格式字串
            const coordinatesString = `${dot.lat.toFixed(3)}°N, ${dot.lon.toFixed(3)}°E`;
            
            return {
                rfId: dot.rfId || `rf_${dot.id}_${index}`,
                coordinates: coordinatesString,
                frequency: `${frequency} MHz`,
                strength: `${strength} dBm`,
                aisStatus: '未開啟', // 明確設定AIS狀態
                detection_time: new Date().toLocaleString('zh-TW'),
                // 保留完整的原始監測點資訊
                sourceSeaDot: {
                    id: dot.id,
                    status: dot.status,
                    borderColor: dot.borderColor,
                    area: dot.area,
                    lat: dot.lat,
                    lon: dot.lon
                }
            };
        });
        
        // 如果沒有找到無 AIS 監測點，返回預設資料
        if (rfSignalsWithoutAIS.length === 0) {
            console.log('📝 範圍內無無 AIS 監測點，生成預設 RF 信號');
        }
        
        console.log(`✅ 成功生成 ${rfSignalsWithoutAIS.length} 個 RF 信號資料`);
        
        // 回傳結果物件
        return {
            areaId: areaEvent.id,
            areaName: areaEvent.aoiName,
            totalRFSignals: rfSignalsWithoutAIS.length,
            rfSignalsWithoutAIS: rfSignalsWithoutAIS,
            rfIdsWithoutAIS: rfSignalsWithoutAIS.map(signal => signal.rfId)
        };
        
    } catch (error) {
        console.error('❌ 查詢無 AIS RF 信號時發生錯誤:', error);
    }
}

// 事件卡選擇
function selectEvent(element, eventId) {
    // 如果該事件正在創建中，阻止選擇
    if (creatingEventIds.has(eventId)) {
        console.log(`事件 ${eventId} 正在創建中，無法選擇`);
        return;
    }
    
    // 移除其他卡片的 active 狀態
    document.querySelectorAll('.event-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // 激活選中的卡片
    element.classList.add('active');
    currentEventId = eventId;
    
    // 檢查是否為RF事件，如果是則自動創建船隻調查事件
    const eventData = eventStorage.getEvent(eventId);
    if (eventData && eventData.type === 'rf') {
        console.log(`🔍 RF事件 ${eventId} 被選中，自動創建船隻調查事件`);
        createVesselFromRF();
    }
    
    // 更新詳情面板
    updateDetailsPanel(eventId);

    // 根據事件類型調整地圖視圖
    adjustMapViewForEvent(eventId);
}

// 用於存儲調查範圍圖層的全域變數
let investigationRangeLayer = null;
// 用於存儲歷史軌跡動畫的全域變數
let historyTrackAnimation = null;
// 用於追蹤當前顯示歷史軌跡的船舶事件ID
let currentTrackingVesselId = null;

// 根據事件調整地圖視圖
function adjustMapViewForEvent(eventId) {
    console.log("adjusting map view for event:", eventId);
    if (!taiwanMap) return;
    
    // 清除先前的調查範圍顯示
    clearInvestigationRange();

    // 獲取當前事件資料
    const storedEvent = eventStorage.getEvent(eventId);
    if (!storedEvent) return;

    // 如果是船舶事件且是重複點擊同一個船舶，不清除現有軌跡
    if (storedEvent.type === 'vessel' && 
        currentTrackingVesselId === eventId && 
        historyTrackAnimation) {
        console.log(`🔄 重複點擊船舶事件 ${eventId}，保留現有歷史軌跡動畫`);
        // 仍然需要調整地圖視圖，但不清除軌跡
        if (storedEvent.coordinates) {
            try {
                const coords = parsePointCoordinates(storedEvent.coordinates);
                if (coords) {
                    const zoomLevel = 12;
                    taiwanMap.setView([coords.lat, coords.lon], zoomLevel, {
                        animate: true,
                        duration: 1.5,
                        easeLinearity: 0.25
                    });
                    showTemporaryMessage(`地圖已聚焦至船舶位置`);
                }
            } catch (error) {
                console.warn(`⚠️ 無法解析事件 ${eventId} 的座標:`, error);
            }
        }
        return; // 提前返回，不繼續執行後面的清除邏輯
    }

    // 清除先前的歷史軌跡動畫（只在非重複點擊時清除）
    if (historyTrackAnimation) {
        if (historyTrackAnimation.timeout) {
            clearTimeout(historyTrackAnimation.timeout);
        }
        if (historyTrackAnimation.layers) {
            historyTrackAnimation.layers.forEach(layer => taiwanMap.removeLayer(layer));
        }
        historyTrackAnimation = null;
        currentTrackingVesselId = null;
        console.log('🛑 已停止並清除舊的歷史軌跡動畫。');
    }
    if (!storedEvent) return;
    
    if (storedEvent.type === 'area' && storedEvent.latRange && storedEvent.lonRange) {
        // 區域監控事件：先畫出調查範圍，再放大地圖
        try {
            // 解析經緯度範圍
            const latRange = parseCoordinateRange(storedEvent.latRange);
            const lonRange = parseCoordinateRange(storedEvent.lonRange);
            
            if (latRange && lonRange) {
                
                // 短暫延遲後放大到該區域
                setTimeout(() => {
                    // 計算中心點
                    const centerLat = (latRange.min + latRange.max) / 2;
                    const centerLon = (lonRange.min + lonRange.max) / 2;
                    
                    // 計算適當的縮放等級（根據範圍大小）
                    const latSpan = latRange.max - latRange.min;
                    const lonSpan = lonRange.max - lonRange.min;
                    const maxSpan = Math.max(latSpan, lonSpan);
                    
                    let zoomLevel = 7; // 預設縮放等級
                    if (maxSpan <= 0.5) zoomLevel = 11;      // 很小的區域
                    else if (maxSpan <= 1.0) zoomLevel = 10; // 小區域
                    else if (maxSpan <= 2.0) zoomLevel = 9;  // 中等區域
                    else if (maxSpan <= 4.0) zoomLevel = 8;  // 大區域
                    
                    // 先繪製調查範圍矩形
                    drawInvestigationRange(latRange, lonRange, storedEvent.aoiName || eventId.toUpperCase());
                    
                    // 平滑地調整地圖視圖到目標區域
                    taiwanMap.setView([centerLat, centerLon], zoomLevel, {
                        animate: true,
                        duration: 1.5,
                        easeLinearity: 0.25
                    });
                    
                    console.log(`🎯 地圖已調整至 ${storedEvent.aoiName || eventId.toUpperCase()} 區域 (中心: ${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}, 縮放: ${zoomLevel})`);
                    
                    // 顯示調整反饋
                    showTemporaryMessage(`地圖已聚焦至 ${storedEvent.aoiName || '監控區域'}`);
                }, 500); // 500ms 延遲讓使用者看到範圍繪製過程
                
            }
        } catch (error) {
            console.warn(`⚠️ 無法解析事件 ${eventId} 的座標範圍:`, error);
        }
    } else if ((storedEvent.type === 'rf' || storedEvent.type === 'vessel') && storedEvent.coordinates) {
        // RF事件和船舶事件：使用單點座標
        try {
            const coords = parsePointCoordinates(storedEvent.coordinates);
            if (coords) {
                const zoomLevel = 12; // 單點事件使用較高的縮放等級
                
                // 平滑地調整地圖視圖到目標點
                taiwanMap.setView([coords.lat, coords.lon], zoomLevel, {
                    animate: true,
                    duration: 1.5,
                    easeLinearity: 0.25
                });
                
                const eventTypeName = storedEvent.type === 'rf' ? 'RF信號' : '船舶';
                console.log(`🎯 地圖已調整至 ${eventId.toUpperCase()} ${eventTypeName}位置 (${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)})`);
                
                // 顯示調整反饋
                showTemporaryMessage(`地圖已聚焦至 ${eventTypeName} 位置`);

                // 如果是船舶事件，則顯示歷史軌跡（但排除重複點擊的情況）
                if (storedEvent.type === 'vessel') {
                    // 檢查是否為重複點擊同一個船舶事件
                    if (currentTrackingVesselId !== eventId || !historyTrackAnimation) {
                        displayHistoryTrack(storedEvent);
                    } else {
                        console.log(`🔄 船舶事件 ${eventId} 的歷史軌跡已在顯示中，不重複創建`);
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️ 無法解析事件 ${eventId} 的座標:`, error);
        }
    }
}

// 顯示船舶歷史軌跡（重構後）
function displayHistoryTrack(vesselEvent) {
    if (!vesselEvent || !vesselEvent.coordinates) {
        console.warn("⚠️ 無效的船舶事件或缺少座標資訊");
        return;
    }

    // 如果有正在運行的其他船舶軌跡動畫，先停止並清除
    if (historyTrackAnimation && currentTrackingVesselId !== vesselEvent.id) {
        if (historyTrackAnimation.timeout) {
            clearTimeout(historyTrackAnimation.timeout);
        }
        if (historyTrackAnimation.layers) {
            historyTrackAnimation.layers.forEach(layer => taiwanMap.removeLayer(layer));
        }
        console.log(`🛑 已停止船舶 ${currentTrackingVesselId} 的歷史軌跡動畫，準備顯示 ${vesselEvent.id} 的軌跡`);
    }

    // 設定當前追蹤的船舶事件ID
    currentTrackingVesselId = vesselEvent.id;

    // 使用船舶事件的座標作為目標點
    let endLat, endLon;
    try {
        const coords = parsePointCoordinates(vesselEvent.coordinates);
        if (!coords) {
            console.warn("⚠️ 無法解析船舶事件的座標");
            return;
        }
        endLat = coords.lat;
        endLon = coords.lon;
    } catch (error) {
        console.warn("⚠️ 解析船舶座標時發生錯誤:", error);
        return;
    }

    console.log(`🗺️ 準備為船舶事件 ${vesselEvent.id} 在座標 (${endLat.toFixed(3)}, ${endLon.toFixed(3)}) 顯示歷史軌跡動畫...`);

    // 檢查事件是否已有固定的軌跡點
    let trackPoints = vesselEvent.trackPoints;
    if (!trackPoints || trackPoints.length === 0) {
        console.log(`🔄 船舶事件 ${vesselEvent.id} 尚無固定軌跡點，重新生成並儲存...`);
        trackPoints = eventStorage.generateFixedTrackPoints(endLat, endLon);
        // 更新事件資料，儲存固定軌跡點
        eventStorage.updateEvent(vesselEvent.id, { trackPoints: trackPoints });
        // 重新獲取更新後的事件資料以確保同步
        vesselEvent = eventStorage.getEvent(vesselEvent.id) || vesselEvent;
    } else {
        console.log(`✅ 使用船舶事件 ${vesselEvent.id} 的固定軌跡點 (${trackPoints.length}個點)`);
    }

    const totalPoints = trackPoints.length;
    const animationSpeed = 300; // ms, 動畫速度
    let trackLayers = []; // [marker, polyline, ...]
    
    // 啟動動畫
    function startAnimation() {
        const loopDelay = 2000; // 輪播間隔時間 (ms)
        let currentPointIndex = 0;

        // 如果有正在運行的動畫，先清除
        if (historyTrackAnimation) {
            clearTimeout(historyTrackAnimation.timeout);
            if (historyTrackAnimation.layers) {
                historyTrackAnimation.layers.forEach(layer => taiwanMap.removeLayer(layer));
            }
        }

        historyTrackAnimation = {
            timeout: null,
            layers: trackLayers,
            vesselId: vesselEvent.id
        };

        function animateStep() {
            // 清除上一次的圖層
            trackLayers.forEach(layer => taiwanMap.removeLayer(layer));
            trackLayers = [];

            // 繪製到當前索引的所有點和線
            for (let i = 0; i <= currentPointIndex; i++) {
                const point = trackPoints[i];
                
                let markerOptions;

                switch (point.color) {
                    case 'white':
                        markerOptions = {
                            icon: L.divIcon({
                                className: 'sea-dot-marker',
                                html: `<div style="background:cyan;border:2px solid #059669 ;width:16px;height:16px;border-radius:50%"></div>`,
                                iconSize: [16, 16],
                                iconAnchor: [8, 8]
                            })
                        };
                        break;
                    case 'black':
                        markerOptions = {
                            icon: L.divIcon({
                                className: 'sea-dot-marker',
                                html: `<div style="background:cyan;border:2px solid #ef4444 ;width:16px;height:16px;border-radius:50%"></div>`,
                                iconSize: [16, 16],
                                iconAnchor: [8, 8]
                            })
                        };
                        break;
                    case 'yellow':
                        // 黃色點維持獨立樣式
                        markerOptions = {
                            icon: L.divIcon({
                                className: 'history-dot-marker',
                                html: `<div style="background:yellow;border:1px solid grey;width:12px;height:12px;border-radius:50%"></div>`,
                                iconSize: [12, 12],
                                iconAnchor: [6, 6]
                            })
                        };
                        break;
                }

                // 繪製歷史點
                const marker = L.marker([point.lat, point.lon], markerOptions).addTo(taiwanMap);
                trackLayers.push(marker);

                // 繪製連線
                if (i > 0) {
                    const prevPoint = trackPoints[i - 1];
                    const polyline = L.polyline([[prevPoint.lat, prevPoint.lon], [point.lat, point.lon]], {
                        color: 'grey',
                        weight: 1,
                        dashArray: '5, 5'
                    }).addTo(taiwanMap);
                    trackLayers.push(polyline);
                }
            }
            
            // 當所有歷史點都畫出後，畫最後一條連接到目標點的線
            if (currentPointIndex === totalPoints - 1) {
                const lastTrackPoint = trackPoints[currentPointIndex];
                const finalLine = L.polyline([[lastTrackPoint.lat, lastTrackPoint.lon], [endLat, endLon]], {
                    color: 'grey',
                    weight: 1,
                    dashArray: '5, 5'
                }).addTo(taiwanMap);
                trackLayers.push(finalLine);
            }

            currentPointIndex++;

            if (currentPointIndex < totalPoints) {
                // 繼續下一幀
                historyTrackAnimation.timeout = setTimeout(animateStep, animationSpeed);
            } else {
                // 動畫完成一輪，準備下一次輪播
                console.log(`🔄 軌跡動畫輪播結束，等待 ${loopDelay}ms 後開始下一輪...`);
                historyTrackAnimation.timeout = setTimeout(() => {
                    currentPointIndex = 0;
                    animateStep();
                }, loopDelay);
            }
        }

        console.log('▶️ 新的歷史軌跡動畫已啟動。');
        animateStep(); // 首次啟動
    }

    startAnimation();
}

// 清除船舶歷史軌跡的輔助函數
function clearHistoryTrack() {
    if (historyTrackAnimation) {
        if (historyTrackAnimation.timeout) {
            clearTimeout(historyTrackAnimation.timeout);
        }
        if (historyTrackAnimation.layers) {
            historyTrackAnimation.layers.forEach(layer => taiwanMap.removeLayer(layer));
        }
        console.log(`🛑 已清除船舶 ${currentTrackingVesselId} 的歷史軌跡動畫`);
        historyTrackAnimation = null;
        currentTrackingVesselId = null;
    }
}

// 跳轉到歷史軌跡點的函數
function jumpToHistoryPoint(hoursBack) {
    // 添加按鈕點擊效果
    const clickedButton = event.target;
    clickedButton.classList.add('clicked');
    setTimeout(() => {
        clickedButton.classList.remove('clicked');
    }, 600);
    
    // 首先檢查是否有當前追蹤的船舶
    let targetVesselId = currentTrackingVesselId;
    
    // 如果沒有當前追蹤的船舶，嘗試從正在運行的歷史軌跡動畫中獲取
    if (!targetVesselId && historyTrackAnimation && historyTrackAnimation.vesselId) {
        targetVesselId = historyTrackAnimation.vesselId;
        console.log(`🔄 使用正在顯示歷史軌跡的船舶: ${targetVesselId}`);
    }
    
    if (!targetVesselId) {
        console.warn('⚠️ 目前沒有選中的船舶事件，無法跳轉到歷史軌跡點');
        // 顯示用戶友好的提示
        showUserMessage('請先選擇一個船舶事件來查看歷史軌跡', 'warning');
        return;
    }
    
    // 獲取當前船舶事件
    const vesselEvent = eventStorage.getEvent(targetVesselId);
    if (!vesselEvent || !vesselEvent.trackPoints || vesselEvent.trackPoints.length === 0) {
        console.warn('⚠️ 船舶事件沒有歷史軌跡點資料');
        showUserMessage('該船舶事件沒有可用的歷史軌跡資料', 'warning');
        return;
    }
    
    console.log(`🎯 準備跳轉到船舶 ${targetVesselId} 的前${hoursBack}小時位置...`);
    
    // 獲取當前船舶位置
    const currentPosition = getCurrentVesselPosition(vesselEvent);
    if (!currentPosition) {
        console.warn('⚠️ 無法獲取當前船舶位置');
        showUserMessage('無法獲取船舶當前位置', 'error');
        return;
    }
    
    // 根據指定的小時數找到對應的歷史軌跡點
    const targetPoint = findHistoryPointByHours(vesselEvent.trackPoints, hoursBack);
    if (!targetPoint) {
        console.warn(`⚠️ 找不到前${hoursBack}小時的歷史軌跡點`);
        showUserMessage(`找不到前${hoursBack}小時的歷史軌跡點`, 'warning');
        return;
    }
    
    console.log(`📍 找到前${hoursBack}小時的位置: (${targetPoint.lat.toFixed(4)}, ${targetPoint.lon.toFixed(4)})`);
    
    // 自動定位到該點
    focusOnHistoryPoint(targetPoint, hoursBack);
    
    // 顯示成功提示
    showUserMessage(`已定位到前${hoursBack}小時的位置`, 'success');
}

// 獲取當前船舶位置
function getCurrentVesselPosition(vesselEvent) {
    try {
        if (vesselEvent.coordinates) {
            const coords = parsePointCoordinates(vesselEvent.coordinates);
            return coords;
        }
        return null;
    } catch (error) {
        console.warn('⚠️ 解析船舶座標時發生錯誤:', error);
        return null;
    }
}

// 根據小時數找到對應的歷史軌跡點
function findHistoryPointByHours(trackPoints, hoursBack) {
    // trackPoints 陣列是按時間順序排列的，索引0是最早的，索引最大是最晚的
    // 計算更精確的索引位置
    
    const totalPoints = trackPoints.length;
    if (totalPoints === 0) return null;
    
    // 計算每個點代表的時間間隔（假設總時長為12小時）
    const totalHours = 12;
    const hoursPerPoint = totalHours / totalPoints;
    
    // 計算目標點的索引（從最新點往前推算）
    const pointsBack = Math.round((hoursBack-1) / hoursPerPoint);
    let targetIndex = totalPoints - 1 - pointsBack;
    
    // 確保索引在有效範圍內
    targetIndex = Math.max(0, Math.min(targetIndex, totalPoints - 1));
    
    const selectedPoint = trackPoints[targetIndex];
    
    console.log(`📊 軌跡點選擇詳情:
        - 總點數: ${totalPoints}
        - 每點時間間隔: ${(hoursPerPoint * 60).toFixed(1)}分鐘
        - 要求前${hoursBack}小時 → 往前${pointsBack}個點
        - 選中索引: ${targetIndex}
        - 選中點座標: (${selectedPoint.lat.toFixed(4)}, ${selectedPoint.lon.toFixed(4)})`);
    
    return selectedPoint;
}

// 聚焦到歷史軌跡點
function focusOnHistoryPoint(targetPoint, hoursBack) {
    if (!taiwanMap) {
        console.warn('⚠️ 地圖未初始化');
        return;
    }
    
    // 設定合適的縮放級別
    const zoomLevel = 12;
    
    // 平滑移動到目標點
    taiwanMap.setView([targetPoint.lat, targetPoint.lon], zoomLevel, {
        animate: true,
        duration: 1.5 // 動畫持續時間（秒）
    });
    
    // 在目標點顯示一個臨時標記
    showTemporaryMarker(targetPoint, hoursBack);
    
    // 突出顯示該時間段的軌跡
    highlightHistorySegment(hoursBack);
    
    console.log(`🗺️ 地圖已定位到前${hoursBack}小時的位置: (${targetPoint.lat.toFixed(4)}, ${targetPoint.lon.toFixed(4)})`);
}

// 突出顯示歷史軌跡段
function highlightHistorySegment(hoursBack) {
    if (!currentTrackingVesselId || !historyTrackAnimation || !historyTrackAnimation.layers) {
        return;
    }
    
    // 獲取船舶事件和軌跡點
    const vesselEvent = eventStorage.getEvent(currentTrackingVesselId);
    if (!vesselEvent || !vesselEvent.trackPoints) {
        return;
    }
    
    const trackPoints = vesselEvent.trackPoints;
    const totalPoints = trackPoints.length;
    
    // 計算要突出顯示的軌跡段範圍
    const totalHours = 2;
    const hoursPerPoint = totalHours / totalPoints;
    const pointsBack = Math.round(hoursBack / hoursPerPoint);
    const targetIndex = Math.max(0, totalPoints - 1 - pointsBack);
    
    // 突出顯示該段軌跡的標記
    historyTrackAnimation.layers.forEach((layer, index) => {
        if (layer.setStyle) { // 是線段
            if (index <= targetIndex * 2 + 1) { // 線段索引計算
                layer.setStyle({
                    color: '#ff6b6b',
                    weight: 3,
                    opacity: 0.9
                });
            } else {
                layer.setStyle({
                    color: 'grey',
                    weight: 1,
                    opacity: 0.5
                });
            }
        }
    });
    
    // 2秒後恢復原來的樣式
    setTimeout(() => {
        if (historyTrackAnimation && historyTrackAnimation.layers) {
            historyTrackAnimation.layers.forEach(layer => {
                if (layer.setStyle) {
                    layer.setStyle({
                        color: 'grey',
                        weight: 1,
                        opacity: 1,
                        dashArray: '5, 5'
                    });
                }
            });
        }
    }, 2000);
}

// 顯示臨時標記
function showTemporaryMarker(point, hoursBack) {
    // 創建一個臨時標記來標示目標點
    const tempMarker = L.marker([point.lat, point.lon], {
        icon: L.divIcon({
            className: 'temp-history-marker',
            html: `<div style="
                background: #ff6b6b;
                border: 3px solid white;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                box-shadow: 0 0 10px rgba(255, 107, 107, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: white;
            ">${hoursBack}h</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).addTo(taiwanMap);
    
    // 添加彈出提示
    tempMarker.bindPopup(`
        <div style="text-align: center;">
            <strong>📍 前${hoursBack}小時位置</strong><br>
            <span style="font-size: 12px; color: #666;">
                座標: ${point.lat.toFixed(4)}°N, ${point.lon.toFixed(4)}°E
            </span>
        </div>
    `).openPopup();
    
    // 3秒後自動移除標記
    setTimeout(() => {
        taiwanMap.removeLayer(tempMarker);
        console.log(`🗑️ 已移除前${hoursBack}小時位置的臨時標記`);
    }, 3000);
}

// 顯示用戶訊息的函數
function showUserMessage(message, type = 'info') {
    // 創建訊息元素
    const messageDiv = document.createElement('div');
    messageDiv.className = `user-message user-message-${type}`;
    messageDiv.textContent = message;
    
    // 設定樣式
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: slideDown 0.3s ease-out;
    `;
    
    // 添加到頁面
    document.body.appendChild(messageDiv);
    
    // 3秒後自動移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.style.animation = 'slideUp 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(messageDiv);
            }, 300);
        }
    }, 3000);
}

// 繪製調查範圍矩形
function drawInvestigationRange(latRange, lonRange, areaName) {
    if (!taiwanMap) return;
    
    // 清除先前的調查範圍
    clearInvestigationRange();
    
    // 定義矩形邊界
    const bounds = [
        [latRange.min, lonRange.min], // 西南角
        [latRange.max, lonRange.max]  // 東北角
    ];
    
    // 創建調查範圍矩形
    const rectangle = L.rectangle(bounds, {
        color: '#9e9e0fff',        // 邊框顏色
        fillColor: '#9e9e0fff',    // 填充顏色
        fillOpacity: 0.2,        // 填充透明度
        weight: 2,               // 邊框粗細
        opacity: 0.8,            // 邊框透明度
        dashArray: '5, 10'       // 虛線樣式
    });
    
    // 加入到地圖並設置彈出資訊
    rectangle.addTo(taiwanMap)
    
    // 儲存到全域變數以便後續清除
    investigationRangeLayer = rectangle;
    
    console.log(`📍 已繪製調查範圍：${areaName} (${latRange.min.toFixed(3)}-${latRange.max.toFixed(3)}°N, ${lonRange.min.toFixed(3)}-${lonRange.max.toFixed(3)}°E)`);
}

// 清除調查範圍顯示
function clearInvestigationRange() {
    if (investigationRangeLayer && taiwanMap) {
        taiwanMap.removeLayer(investigationRangeLayer);
        investigationRangeLayer = null;
        console.log('🗑️ 已清除先前的調查範圍顯示');
    }
}

// 解析座標範圍字串 (例如: "24.2°N - 24.8°N" 或 "120.5°E - 121.2°E")
function parseCoordinateRange(rangeStr) {
    try {
        // 移除度數符號和方位字母，提取數字部分
        const cleanRange = rangeStr.replace(/[°NSEW\s]/g, '');
        const parts = cleanRange.split('-');
        
        if (parts.length === 2) {
            const min = parseFloat(parts[0]);
            const max = parseFloat(parts[1]);
            
            if (!isNaN(min) && !isNaN(max)) {
                return { min, max };
            }
        }
        return null;
    } catch (error) {
        console.warn('座標範圍解析失敗:', rangeStr, error);
        return null;
    }
}

// 解析單點座標字串 (例如: "24.456°N, 120.789°E" 或 "24.123°N, 121.045°E")
function parsePointCoordinates(coordStr) {
    try {
        // 移除度數符號和方位字母
        const cleanCoord = coordStr.replace(/[°NSEW\s]/g, '');
        const parts = cleanCoord.split(',');
        
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            
            if (!isNaN(lat) && !isNaN(lon)) {
                return { lat, lon };
            }
        }
        return null;
    } catch (error) {
        console.warn('單點座標解析失敗:', coordStr, error);
        return null;
    }
}

// 更新詳情面板內容
function updateDetailsPanel(eventId) {
    const detailsTitle = document.getElementById('detailsTitle');
    const detailsSubtitle = document.getElementById('detailsSubtitle');
    const detailsContent = document.getElementById('detailsContent');

    // 從儲存中取得事件資料
    const storedEvent = eventStorage.getEvent(eventId);

    let data;
    if (storedEvent) {
        // 使用儲存的資料生成詳情
        const eventIdUpper = eventId.toUpperCase();
        
        switch (storedEvent.type) {
            case 'area':
                data = {
                    title: `${eventIdUpper} 事件詳情`,
                    subtitle: `區域監控事件`,
                    content: getAreaEventDetailsFromStorage(storedEvent)
                };
                break;
            case 'rf':
                data = {
                    title: `${eventIdUpper} 事件詳情`,
                    subtitle: `RF 監控事件`,
                    content: getRFEventDetailsFromStorage(storedEvent)
                };
                break;
            case 'vessel':
                data = {
                    title: `${eventIdUpper} 事件詳情`,
                    subtitle: `船舶監控事件${storedEvent.status === 'completed' ? ' | 已結束' : ''}`,
                    content: getVesselEventDetailsFromStorage(storedEvent)
                };
                break;
        }
    } 

    // 在現有的 eventData 物件後面，新增這段程式碼：

    // TODO 修改為從 eventStorage 動態生成船舶事件
    // 檢查是否為動態生成的船舶事件
    // if (eventId.startsWith('vessel-') && !eventData[eventId]) {
    //     // 獲取隨機風險分數用於展示
    //     const riskScore = Math.floor(Math.random() * 40) + 50; // 50-90之間的風險分數
    //     eventData[eventId] = {
    //         title: `${eventId.toUpperCase()} 事件詳情`,
    //         subtitle: '船舶監控事件 | 來自RF異常',
    //         content: getVesselEventDetails(riskScore)
    //     };
    // }
    
    // const data = eventData[eventId];
    detailsTitle.textContent = data.title;
    detailsSubtitle.textContent = data.subtitle;
    detailsContent.innerHTML = data.content;
}

// 從儲存資料生成區域監控事件詳情
function getAreaEventDetailsFromStorage(eventData) {
    console.log('getAreaEventDetailsFromStorage called for:', eventData.id);

    // 檢查是否需要動態生成 RF 候選資訊
    if (!eventData.rfCandidates && !eventData.rfCandidatesData) {
        console.log(`🔄 為事件 ${eventData.id} 統一使用 getRFSignalsWithoutAIS 動態生成 RF 候選清單...`);
        
        // 統一使用 getRFSignalsWithoutAIS 函數動態建立未開啟AIS的RF信號點
        const rfSignalsInfo = getRFSignalsWithoutAIS(eventData);
        console.log('getRFSignalsWithoutAIS result:', rfSignalsInfo);
        
        if (rfSignalsInfo && rfSignalsInfo.rfSignalsWithoutAIS) {
            // 建立 rfCandidates 清單
            eventData.rfCandidates = rfSignalsInfo.rfIdsWithoutAIS;
            
            // 建立 rfCandidatesData 詳細資料
            eventData.rfCandidatesData = rfSignalsInfo.rfSignalsWithoutAIS.map((signal, index) => {
                return {
                    rfId: signal.rfId,
                    frequency: signal.frequency,
                    strength: signal.strength,
                    coordinates: signal.coordinates,
                    index: index,
                    aisStatus: signal.aisStatus
                };
            });
            
            // 更新儲存的事件資料
            eventStorage.updateEvent(eventData.id, { 
                rfCandidates: eventData.rfCandidates,
                rfCandidatesData: eventData.rfCandidatesData 
            });
            
            console.log(`✅ 已為事件 ${eventData.id} 透過 getRFSignalsWithoutAIS 動態生成並儲存 RF 候選資訊:`, {
                rfCandidates: eventData.rfCandidates,
                rfCandidatesData: eventData.rfCandidatesData
            });
        } else {
            console.warn(`⚠️  getRFSignalsWithoutAIS 無法為事件 ${eventData.id} 生成RF信號點資訊`);
        }
    }
    
    // // 取得監控時間範圍 - 優先使用儲存的資料，否則重新計算
    // let monitorTimeRange = eventData.monitorTimeRange || '未設定';
    // if (!eventData.monitorTimeRange && eventData.createTime && eventData.monitorHours) {
    //     monitorTimeRange = calculateMonitorTimeRange(eventData.createTime, eventData.monitorHours);
    //     // 將計算結果儲存到事件資料中
    //     eventStorage.updateEvent(eventData.id, { monitorTimeRange: monitorTimeRange });
    // }

    // 使用已儲存的數據生成 HTML
    const rfCandidatesHtml = eventData.rfCandidatesData && eventData.rfCandidatesData.length > 0 
        ? eventData.rfCandidatesData.map((candidateData) => {
            return `
                <div class="evidence-item">
                    <div class="evidence-title">${candidateData.rfId}</div>
                    <div class="evidence-desc">
                        📡 頻率: ${candidateData.frequency} | 強度: ${candidateData.strength}<br>
                        📍 座標: ${candidateData.coordinates}<br>
                        🚨 特徵: 待分析
                    </div>
                    <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                        <button class="create-rf-btn" onclick="createRFEventfromArea('${candidateData.rfId}')" 
                                style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: bold; cursor: pointer; transition: all 0.3s ease;">
                            建立RF監控事件
                        </button>
                    </div>
                </div>
            `;
        }).join('')
        : '<div style="color: #b8c5d1; text-align: center; padding: 20px;">暫無異常候選</div>';

    return `
        <div class="summary-section">
            <div class="section-title">事件簡介</div>
            <div style="font-size: 13px; line-height: 1.5; color: #b8c5d1;">
                <strong>監控區域：</strong>${eventData.aoiName || '未設定'}<br>
                <strong>緯度範圍：</strong>${eventData.latRange || '未設定'}<br>
                <strong>經度範圍：</strong>${eventData.lonRange || '未設定'}<br>
                <strong>建立時間：</strong>${eventData.createTime}<br>
                <strong>監控時間：</strong>${eventData.monitorTimeRange}<br>
            </div>
        </div>

        <div class="evidence-section">
            <div class="section-title">📊 RF 信號異常列表</div>
            ${rfCandidatesHtml}
        </div>

        <div class="action-section">
            <div class="section-title">⚡ 可用操作</div>
            <div class="action-grid">
                <div class="action-btn" onclick="refreshAOI()">🔄<br>重新掃描</div>
                <div class="action-btn" onclick="expandAOI()">📏<br>擴大 AOI</div>
                <div class="action-btn" onclick="exportData()">📊<br>匯出資料</div>
                <div class="action-btn" onclick="closeEvent()">✅<br>結束事件</div>
            </div>
        </div>
    `;
}

// 從儲存資料生成 RF 監控事件詳情
function getRFEventDetailsFromStorage(eventData) {
    // 使用AIS狀態一致性管理函數確保狀態正確
    eventData = ensureAISStatusConsistency(eventData);
    
    // 生成船隻信息內容
    let shipInfoSection = '';
    if (eventData.aisStatus === '已開啟') {
        // AIS開啟 - 顯示該船的簡單信息
        const shipInfo = generateShipInfo(eventData);
        shipInfoSection = `
        <div class="evidence-section">
            <div class="section-title">🚢 船隻資訊</div>
            <div class="ship-info-card ais-enabled">
                <div class="ship-header">
                    <span class="ship-name">${shipInfo.name}</span>
                    <span class="ship-status status-ais">AIS已開啟</span>
                </div>
                <div class="ship-details">
                    <div class="detail-row"><span>MMSI:</span><span>${shipInfo.mmsi}</span></div>
                </div>
                <button class="investigate-btn" onclick="showShipDetails('${shipInfo.mmsi}')">
                    📋 顯示詳細資訊
                </button>
            </div>
        </div>`;
    } else {
        // AIS未開啟 - 顯示可疑船隻候選列表
        const candidates = generateSuspiciousCandidates(eventData);
        let candidateHtml = '';
        
        candidates.forEach(candidate => {
            candidateHtml += `
            <div class="candidate-item">
                <div class="candidate-header">
                    <span class="candidate-name">${candidate.name}</span>
                    <span class="probability">${(candidate.probability * 100).toFixed(0)}%</span>
                </div>
                <div class="candidate-details">
                    <div>類型: ${candidate.type} | 長度: ${candidate.length}m</div>
                    <div>最後出現: ${candidate.lastSeen}</div>
                </div>
                <button class="investigate-btn-small" onclick="showCandidateDetails('${candidate.id}')">
                    📋 顯示詳情
                </button>
            </div>`;
        });
        
        shipInfoSection = `
        <div class="evidence-section">
            <div class="section-title">🚢 船隻資訊</div>
            <div class="ship-info-card no-ais">
                <div class="ship-header">
                    <span class="ship-name">未知RF信號</span>
                    <span class="ship-status status-no-ais">無AIS</span>
                </div>
                <div class="candidate-list">
                    <h4 style="margin: 10px 0; color: #333;">可疑船隻候選列表</h4>
                    ${candidateHtml}
                </div>
            </div>
        </div>`;
    }
    
    return `
        <div class="summary-section">
            <div class="section-title">事件簡介</div>
            <div style="font-size: 13px; line-height: 1.5; color: #b8c5d1;">
                <strong>RF 信號 ID：</strong>${eventData.rfId || '未知'}<br>
                <strong>座標：</strong>${eventData.coordinates || '定位中'}<br>
                <strong>AIS狀態：</strong><span style="color: ${eventData.aisStatus === '已開啟' ? '#10b981' : '#ef4444'};">${eventData.aisStatus || '未知'}</span><br>
                <strong>建立時間：</strong>${eventData.createTime}<br>
                ${eventData.notes ? `<strong>備註：</strong>${eventData.notes}<br>` : ''}
            </div>
        </div>
        
        ${shipInfoSection}

        <div class="evidence-section">
            <div class="section-title">📊 RF 監控資訊</div>
            
            <div class="evidence-item">
                <div class="evidence-title">信號特徵</div>
                <div class="evidence-desc">
                    📡 頻率: ${eventData.frequency || '檢測中'}<br>
                    📊 強度: ${eventData.strength || '檢測中'}<br>
                    🔍 調變: GMSK<br>
                    ⏰ 持續時間: 檢測中
                </div>
            </div>
            
            <div class="evidence-item">
                <div class="evidence-title">位置資訊</div>
                <div class="evidence-desc">
                    📍 座標: ${eventData.coordinates || '定位中'}<br>
                    🗺️ 區域: 台海海域<br>
                    📏 精度: ±500m<br>
                    🧭 移動方向: 未檢測到明顯移動
                </div>
            </div>
        </div>

        <div class="action-section">
            <div class="section-title">⚡ 可用操作</div>
            <div class="action-grid">
                <div class="action-btn primary" onclick="createVesselFromRF()">🚢<br>建立船舶監控</div>
            </div>
        </div>
    `;            
    // Other actions: 
    //     <div class="action-btn" onclick="analyzeRF()">🔍<br>深度分析</div>
    //     <div class="action-btn" onclick="exportRFData()">📊<br>匯出資料</div>
    //     <div class="action-btn" onclick="closeEvent()">✅<br>結束事件</div>
}

// 生成船隻資訊（AIS開啟時使用）
function generateShipInfo(eventData) {
    const shipTypes = ['貨船', '集裝箱船', '油輪', '散裝貨船', '漁船', '客船', '渡輪', '拖船'];
    const shipNamePrefixes = ['MV', 'SS', 'MT', 'FV'];
    const shipNameSuffixes = ['Navigator', 'Explorer', 'Pioneer', 'Guardian', 'Voyager', 'Mariner', 'Ocean Star', 'Sea Wind'];
    const destinations = ['高雄港', '基隆港', '台中港', '花蓮港', '台南港', '馬公港', '金門港'];
    
    // 根據eventData生成一致的船隻資訊
    const rfId = eventData.rfId || 'SIG-DEFAULT';
    const seed = rfId.split('-')[1] || '000';
    const numSeed = parseInt(seed.replace(/[^0-9]/g, ''), 16) || 123;
    
    return {
        name: `${shipNamePrefixes[numSeed % shipNamePrefixes.length]} ${seed} ${shipNameSuffixes[numSeed % shipNameSuffixes.length]}`,
        mmsi: `416${(numSeed % 1000000).toString().padStart(6, '0')}`,
        type: shipTypes[numSeed % shipTypes.length],
        length: 80 + (numSeed % 270),
        beam: 12 + (numSeed % 35),
        destination: destinations[numSeed % destinations.length],
        speed: 8 + (numSeed % 15),
        course: numSeed % 360
    };
}

// 生成可疑船隻候選列表（AIS未開啟時使用）  
function generateSuspiciousCandidates(eventData) {
    const vesselTypes = ['漁船', '貨船', '客船', '油輪', '軍艦', '研究船', '遊艇', '拖船'];
    const vesselNames = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'];
    
    const rfId = eventData.rfId || 'SIG-DEFAULT';
    const seed = rfId.split('-')[1] || '000';
    const numSeed = parseInt(seed.replace(/[^0-9]/g, ''), 16) || 123;
    
    const numCandidates = 2 + (numSeed % 4); // 2-5個候選
    const candidates = [];
    
    for (let i = 0; i < numCandidates; i++) {
        const candidateSeed = numSeed + i * 17; // 為每個候選生成不同種子
        const probability = 0.30 + (candidateSeed % 55) / 100; // 0.30-0.85
        const hoursAgo = 1 + (candidateSeed % 12); // 1-12小時前
        const vesselType = vesselTypes[candidateSeed % vesselTypes.length];
        const nameSuffix = vesselNames[candidateSeed % vesselNames.length];
        const length = 50 + (candidateSeed % 250); // 50-300米
        
        const lastSeenDate = new Date();
        lastSeenDate.setHours(lastSeenDate.getHours() - hoursAgo);
        
        candidates.push({
            id: `CAND_${rfId}_${i+1}`,
            name: `未知${vesselType} ${nameSuffix}`,
            probability: probability,
            lastSeen: lastSeenDate.toLocaleString('zh-TW', { 
                month: '2-digit', 
                day: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            type: vesselType,
            length: length
        });
    }
    
    // 按機率排序
    return candidates.sort((a, b) => b.probability - a.probability);
}

// 顯示船舶詳細資訊 - 切換到對應的船舶監控事件卡
function showShipDetails(shipId) {
    console.log(`📋 切換到船舶詳情: ${shipId}`);
    
    // 查找由當前RF事件創建的船舶監控事件
    const vesselEventId = findVesselEventBySourceRF(currentEventId);
    console.log(`🔍 查找到的船舶事件ID: ${vesselEventId}`);
    
    if (vesselEventId) {
        // 直接通過事件ID查找對應的事件卡
        const eventCards = document.querySelectorAll('.event-card');
        let vesselCard = null;
        
        // 更可靠的查找方式：檢查事件卡內的事件ID文本
        eventCards.forEach(card => {
            const eventIdElement = card.querySelector('.event-id');
            if (eventIdElement && eventIdElement.textContent.toLowerCase() === vesselEventId) {
                vesselCard = card;
                console.log(`🎯 找到匹配的船舶事件卡: ${vesselEventId}`);
            }
        });
        
        if (vesselCard) {
            // 直接調用selectEvent來切換事件
            selectEventDirectly(vesselCard, vesselEventId);
            console.log(`✅ 已切換到船舶監控事件詳情: ${vesselEventId}`);
        } else {
            console.warn(`未找到對應的船舶監控事件卡: ${vesselEventId}`);
            // 作為備用，嘗試原來的方法
            eventCards.forEach(card => {
                if (card.onclick && card.onclick.toString().includes(vesselEventId)) {
                    selectEventDirectly(card, vesselEventId);
                    console.log(`✅ 通過備用方法切換到船舶監控事件: ${vesselEventId}`);
                }
            });
        }
    } else {
        console.warn('未找到對應的船舶監控事件');
    }
}

// 顯示候選船隻詳細資訊 - 切換到對應的船舶監控事件卡
function showCandidateDetails(candidateId) {
    console.log(`📋 切換到候選船隻詳情: ${candidateId}`);
    
    // 同樣切換到船舶監控事件卡
    showShipDetails(candidateId);
}

// 根據來源RF事件查找對應的船舶監控事件
function findVesselEventBySourceRF(rfEventId) {
    console.log(`🔍 查找RF事件 ${rfEventId} 對應的船舶事件`);
    const allEvents = eventStorage.getAllEvents();
    console.log(`📋 總共有 ${allEvents.length} 個事件`);
    
    for (const eventData of allEvents) {
        console.log(`📋 檢查事件: ${eventData.id}, 類型: ${eventData.type}, sourceRFEvent: ${eventData.sourceRFEvent}`);
        if (eventData.type === 'vessel' && eventData.sourceRFEvent === rfEventId) {
            console.log(`✅ 找到匹配的船舶事件: ${eventData.id}`);
            return eventData.id.toLowerCase();
        }
    }
    console.log(`❌ 未找到RF事件 ${rfEventId} 對應的船舶事件`);
    return null;
}

// 直接選擇事件（不觸發RF自動創建船舶事件的邏輯）
function selectEventDirectly(element, eventId) {
    // 移除其他卡片的 active 狀態
    document.querySelectorAll('.event-card').forEach(card => {
        card.classList.remove('active');
    });
    
    // 激活選中的卡片
    element.classList.add('active');
    currentEventId = eventId;
    
    // 更新詳情面板（但不執行RF自動創建邏輯）
    updateDetailsPanel(eventId);

    // 根據事件類型調整地圖視圖
    adjustMapViewForEvent(eventId);
    
    console.log(`✅ 已直接切換到事件: ${eventId}`);
}

// 船舶調查函數（保留備用）
function investigateShip(shipId) {
    console.log(`🔍 開始調查船舶: ${shipId}`);
    
    // 顯示調查確認對話框
    const confirmed = confirm(`確定要開始調查船舶 ${shipId} 嗎？\n\n這將會建立一個新的船舶監控事件並派遣相關資源進行深度調查。`);
    
    if (confirmed) {
        // 創建船舶監控事件
        createVesselFromRF();
        
        // 顯示調查開始通知
        alert(`✅ 已開始調查船舶 ${shipId}\n\n調查任務已加入任務時間軸，預計需要2-4小時完成。`);
    }
}

// 從儲存資料生成船舶監控事件詳情
function getVesselEventDetailsFromStorage(eventData) {
    // 隨機生成AIS狀態（如果尚未設置）
    if (!eventData.aisStatus) {
        const aisStates = ['已開啟', '未開啟'];
        eventData.aisStatus = aisStates[Math.floor(Math.random() * aisStates.length)];
        
        // 將AIS狀態儲存回事件資料中
        if (eventData.id && eventStorage) {
            eventStorage.updateEvent(eventData.id, { aisStatus: eventData.aisStatus });
        }
        
        console.log(`🚢 為事件 ${eventData.id || '船舶事件'} 隨機生成AIS狀態: ${eventData.aisStatus}`);
    }
    
    const riskScore = eventData.riskScore || 0;
    const riskColor = riskScore >= 70 ? '#ef4444' : riskScore >= 40 ? '#f59e0b' : '#10b981';
    const riskLevel = riskScore >= 70 ? '高風險' : riskScore >= 40 ? '中風險' : '低風險';
    const isCompleted = eventData.status === 'completed';
                
    let actionSection = '';
    
    if (!isCompleted) {
        // 生成決策建議內容
        const recommendations = getVesselDecisionRecommendation(riskScore, eventData);
        
        actionSection = `
            <div class="action-section">
                <!-- 1. 決策建議 -->
                <div class="section-title">⚡ 決策建議</div>
                <div class="decision-recommendation">
                    <div class="recommendation-content">
                        <div class="recommendation-title">建議行動：${recommendations.primaryAction}</div>
                        <div class="recommendation-analysis">
                            <strong>分析：</strong>${recommendations.analysis}
                        </div>
                        <div class="recommendation-evidence">
                            <strong>主要證據：</strong>${recommendations.evidence}
                        </div>
                        <div class="recommendation-priority" style="color: ${recommendations.priorityColor};">
                            優先級：${recommendations.priority}
                        </div>
                    </div>
                </div>
                
                <!-- 2. 四個行動選項按鈕 (可多選) -->
                <div class="action-section">
                    <div class="section-title">⚡ 行動選項</div>    
                    <!-- Action Button -->
                    <div class="action-grid">
                        <div class="action-btn" onclick="selectAction('track', this)">🎯<br>持續追蹤</div>
                        <div class="action-btn" onclick="selectAction('satellite', this)">🛰️<br>衛星重拍</div>
                        <div class="action-btn" onclick="selectAction('notify', this)">📞<br>通知單位</div>
                        <div class="action-btn" onclick="selectAction('uav', this)">🚁<br>派遣載具</div>
                    </div>
                </div>                
            </div>
        `;
    } else {
        actionSection = `
            <div class="action-section">
                <div class="section-title">✅ 事件已結束</div>
                <div style="color: #10b981; font-size: 13px; text-align: center; padding: 15px;">
                    調查結果: 確認為正常漁船作業<br>
                    結案時間: ${eventData.completedTime || '未記錄'}
                </div>
            </div>
        `;
    }
    
    return `
        <div class="risk-score-container">
            <div class="risk-score" style="color: ${riskColor};">${riskScore}</div>
            <div class="risk-level" style="color: ${riskColor};">${riskLevel}</div>
        </div>

        <div class="summary-section">
            <div class="section-title">事件簡介</div>
            <div style="font-size: 13px; line-height: 1.5; color: #b8c5d1;">
                <strong>MMSI：</strong>${eventData.mmsi || '未知'}<br>
                <strong>座標：</strong>${eventData.coordinates || '待定位'}<br>
                <strong>AIS狀態：</strong>
                <span style="color: ${eventData.aisStatus === '已開啟' ? '#10b981' : '#ef4444'}; font-weight: bold;">
                    ${eventData.aisStatus || '未知'}
                </span><br>
                <strong>建立時間：</strong>${eventData.createTime}<br>
                ${eventData.investigationReason ? `<strong>調查原因：</strong>${eventData.investigationReason}<br>` : ''}
            </div>
        </div>

        <div class="evidence-section">
            <div class="section-title">🔍 風險因子分析</div>
            
            <div class="evidence-item">
                <div class="evidence-title">AIS 異常 (權重: 30%)</div>
                <div class="evidence-desc">
                    長時間關閉 AIS 轉發器，疑似故意隱匿行蹤
                </div>
                <div style="background: rgba(255, 255, 255, 0.1); height: 4px; border-radius: 2px; margin-top: 5px;">
                    <div style="background: #ef4444; height: 100%; width: 90%; border-radius: 2px;"></div>
                </div>
            </div>
            
            <div class="evidence-item">
                <div class="evidence-title">航線偏離 (權重: 25%)</div>
                <div class="evidence-desc">
                    偏離正常商船航道 2.3 公里，進入敏感海域
                </div>
                <div style="background: rgba(255, 255, 255, 0.1); height: 4px; border-radius: 2px; margin-top: 5px;">
                    <div style="background: #f59e0b; height: 100%; width: 75%; border-radius: 2px;"></div>
                </div>
            </div>
            
            <div class="evidence-item">
                <div class="evidence-title">RF 行為 (權重: 20%)</div>
                <div class="evidence-desc">
                    RF 訊號採用非標準加密，疑似規避監控
                </div>
                <div style="background: rgba(255, 255, 255, 0.1); height: 4px; border-radius: 2px; margin-top: 5px;">
                    <div style="background: #ef4444; height: 100%; width: 85%; border-radius: 2px;"></div>
                </div>
            </div>
        </div>

        <div class="history-track-section">
            <div class="section-title">⏳ 歷史軌跡檢視</div>
            <div class="history-track-buttons">
                <button class="history-track-btn" onclick="jumpToHistoryPoint(1)">前一小時</button>
                <button class="history-track-btn" onclick="jumpToHistoryPoint(2)">前兩小時</button>
                <button class="history-track-btn" onclick="jumpToHistoryPoint(3)">前三小時</button>
            </div>
        </div>

        ${actionSection}
        
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="rejectAction()">取消</button>
            <button class="btn btn-primary" onclick="executeAction()" id="executeActionBtn">執行行動</button>
        </div>
    `;
}

// (deprecated) 更新地圖覆蓋層
function updateMapOverlay(eventId) {
    const overlay = document.getElementById('mapOverlay');
    
    const overlayData = {
        'area-001': {
            title: '📍 AREA-001 - 台海北部海域',
            info: 'AOI 範圍: 24.2°N-24.8°N, 120.5°E-121.2°E<br>監控狀態: 主動偵測中<br>RF 異常候選: 3 個待調查<br>最後更新: 2025-09-04 14:35'
        },
        'rf-002': {
            title: '📡 RF-002 - RF 異常信號',
            info: 'RF ID: SIG-4A7B2C<br>座標: 24.456°N, 120.789°E<br>頻率: 162.025 MHz<br>建立時間: 13:45'
        },
        'vessel-003': {
            title: '🚢 VESSEL-003 - 高風險船舶',
            info: 'MMSI: 416123456<br>座標: 24.123°N, 121.045°E<br>風險分數: 85/100<br>狀態: 等待決策'
        },
        // 'vessel-004': {
        //     title: '🚢 VESSEL-004 - 已結案',
        //     info: 'MMSI: 416789012<br>座標: 24.789°N, 120.234°E<br>風險分數: 28/100<br>結果: 確認為漁船'
        // }
    };
    
    // 檢查是否有預定義資料，如果沒有則動態生成
    let data = overlayData[eventId];
    
    if (!data) {
        // 動態生成新事件的地圖覆蓋資料
        const eventType = eventId.split('-')[0];
        const eventNumber = eventId.split('-')[1];
        const eventIdUpper = eventId.toUpperCase();
        const currentTime = new Date().toLocaleString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        
        switch (eventType) {
            case 'area':
                data = {
                    title: `📍 ${eventIdUpper} - 新監控區域`,
                    info: `AOI 範圍: 自定義區域<br>監控狀態: 初始化中<br>RF 異常候選: 掃描中<br>建立時間: ${currentTime}`
                };
                break;
            case 'rf':
                data = {
                    title: `📡 ${eventIdUpper} - RF 異常信號`,
                    info: `RF ID: 分析中<br>座標: 定位中<br>頻率: 檢測中<br>建立時間: ${currentTime}`
                };
                break;
            case 'vessel':
                data = {
                    title: `🚢 ${eventIdUpper} - 船舶監控`,
                    info: `MMSI: 識別中<br>座標: 追蹤中<br>風險分數: 分析中<br>建立時間: ${currentTime}`
                };
                break;
            default:
                // 預設資料
                data = {
                    title: `❓ ${eventIdUpper} - 未知事件`,
                    info: `事件類型: 未識別<br>狀態: 處理中<br>建立時間: ${currentTime}`
                };
        }
    }

    overlay.innerHTML = `
        <div class="overlay-title">${data.title}</div>
        <div class="overlay-info">${data.info}</div>
    `;
}

// 顯示新增事件彈窗
function showNewEventModal() {
    document.getElementById('newEventModal').style.display = 'flex';
    resetEventForm();
}

// 選擇事件類型
function selectEventType(type) {
    selectedEventType = type;
    
    // 更新選中狀態
    document.querySelectorAll('.type-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelector(`[data-type="${type}"]`).classList.add('selected');
    
    // 顯示對應表單
    document.querySelectorAll('.form-section').forEach(form => {
        form.style.display = 'none';
    });
    document.getElementById(`${type}Form`).style.display = 'block';
    
    // 顯示按鈕區域並啟用建立按鈕
    document.getElementById('modalActions').style.display = 'flex';
    document.getElementById('createEventBtn').disabled = false;
}

// 生成單一 RF 信號 ID
function generateSingleRFId() {
    const prefixes = ['SIG'];
    const usedRFIds = new Set();
    
    // 從所有事件中收集已使用的 RF 編號，避免重複
    eventStorage.getAllEvents().forEach(event => {
        if (event.rfCandidates) {
            event.rfCandidates.forEach(rfId => usedRFIds.add(rfId));
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

// 修改 RF 候選編號生成器
function generateRandomRFCandidates(count = 3) {
    const candidates = [];
    
    while (candidates.length < count) {
        const candidate = generateSingleRFId();
        if (!candidates.includes(candidate)) {
            candidates.push(candidate);
        }
    }
    
    return candidates;
}

// 為新建立的區域監控事件生成完整的 RF 候選詳細數據
function generateRFCandidatesWithDetails(count, latRange, lonRange) {
    const rfCandidates = generateRandomRFCandidates(count);
    const rfCandidatesData = rfCandidates.map((rfId, index) => {
        let coordinates = '定位中';
        
        if (latRange && lonRange) {
            try {
                coordinates = generateCoordinatesInRange(latRange, lonRange);
            } catch (error) {
                console.warn(`無法為 ${rfId} 生成座標，使用預設範圍:`, error);
                coordinates = generateRandomCoordinates();
            }
        } else {
            coordinates = generateRandomCoordinates();
        }
        
        const frequency = (150 + Math.random() * 20).toFixed(3);
        const strength = (-60 + Math.random() * 20).toFixed(1);
        
        return {
            rfId: rfId,
            frequency: `${frequency} MHz`,
            strength: `${strength} dBm`,
            coordinates: coordinates,
            index: index
        };
    });
    
    return { rfCandidates, rfCandidatesData };
}

// 建立事件
// 24.1°N - 24.7°N
// 120.3°E - 121.1°E
function createNewEvent() {
    const eventId = `${selectedEventType.toUpperCase()}-${String(++eventCounter).padStart(3, '0')}`;
    const eventIdLowerCase = eventId.toLowerCase();
    
    // 將該事件ID添加到創建中的集合，並禁用該事件卡
    creatingEventIds.add(eventIdLowerCase);
    
    let eventInfo = '';
    let typeClass = '';
    let typeName = '';
    let eventData = {
        type: selectedEventType,
        createTime: new Date().toLocaleTimeString('zh-TW', {hour12: false, hour: '2-digit', minute: '2-digit'}),
        status: 'creating'
    };
    
    if (selectedEventType === 'area') {
        const aoiName = document.getElementById('aoiName').value || '未命名區域';
        
        // 使用新的海域範圍生成函數，優先使用表單輸入，否則隨機生成海域範圍
        let latRange = document.getElementById('latRange').value;
        let lonRange = document.getElementById('lonRange').value;
        
        if (!latRange || !lonRange) {
            const randomSeaArea = generateRandomSeaAreaRange();
            latRange = randomSeaArea.latRange;
            lonRange = randomSeaArea.lonRange;
            
            // 更新表單顯示值
            document.getElementById('latRange').value = latRange;
            document.getElementById('lonRange').value = lonRange;
            
            console.log(`為區域監控事件生成隨機海域範圍 - 區域: ${randomSeaArea.area}, 經度: ${lonRange}, 緯度: ${latRange}`);
        }
        
        const monitorHours = document.getElementById('monitorHours').value || '24';

        // 計算監控時間範圍
        const monitorTimeRange = calculateMonitorTimeRange(eventData.createTime, monitorHours);                
        
        // 生成完整的 RF 候選數據
        const candidateCount = Math.floor(Math.random() * 4) + 2;
        const { rfCandidates, rfCandidatesData } = generateRFCandidatesWithDetails(candidateCount, latRange, lonRange);
        
        eventData = {
            ...eventData,
            aoiName: aoiName,
            latRange: latRange,
            lonRange: lonRange,
            monitorHours: monitorHours,
            monitorTimeRange: monitorTimeRange,
            rfCandidates: rfCandidates,
            rfCandidatesData: rfCandidatesData
        };
        
        eventInfo = `監控區域: ${aoiName}<br>監控時間: ${monitorHours} 小時`;
        typeClass = 'type-area';
        typeName = '區域監控';
        
        console.log(`已為新區域事件 ${eventId} 生成完整的 RF 候選數據:`, rfCandidatesData);
    } else if (selectedEventType === 'rf') {
        const userRfId = document.getElementById('rfId').value;
        const detectionTime = document.getElementById('detectionTime').value || '';
        const rfNotes = document.getElementById('rfNotes').value || '';

        // 嘗試根據 userRfId 找到對應的 sea dot
        let rfId, coordinates, frequency, strength, aisStatus, sourceSeaDot = null;
        
        if (typeof window.seaDotManager !== 'undefined' && window.seaDotManager.getAllDots().length > 0) {
            let targetDot = null;
            
            if (userRfId && userRfId.trim() !== '') {
                // 如果用戶有輸入 RF ID，嘗試找到對應的 sea dot
                targetDot = window.seaDotManager.getDotByRFId(userRfId);
                
                if (!targetDot) {
                    console.warn(`⚠️ 找不到 RF ID "${userRfId}" 對應的 sea dot，將使用隨機選擇`);
                    // 如果找不到對應的 sea dot，隨機選擇一個
                    const allDots = window.seaDotManager.getAllDots();
                    targetDot = allDots[Math.floor(Math.random() * allDots.length)];
                }
            } else {
                // 如果用戶沒有輸入 RF ID，隨機選擇一個 sea dot
                const allDots = window.seaDotManager.getAllDots();
                targetDot = allDots[Math.floor(Math.random() * allDots.length)];
            }
            
            // 使用選中的 sea dot 資訊
            rfId = userRfId || targetDot.rfId; // 如果用戶有輸入 RF ID，優先使用用戶輸入
            coordinates = `${targetDot.lat.toFixed(3)}°N, ${targetDot.lon.toFixed(3)}°E`;
            frequency = (Math.random() * (470 - 430) + 430).toFixed(1) + ' MHz'; // 隨機生成頻率
            strength = Math.floor(Math.random() * 50 + 30) + ' dBm'; // 隨機生成信號強度
            
            // 根據 sea dot 的 borderColor 設定 AIS 狀態
            if (targetDot.borderColor === '#ef4444' || targetDot.borderColor === 'red') {
                aisStatus = '未開啟';
            } else if (targetDot.borderColor === '#059669' || targetDot.borderColor === 'green') {
                aisStatus = '已開啟';
            } else {
                aisStatus = '未知';
            }
            
            sourceSeaDot = {
                id: targetDot.id,
                status: targetDot.status,
                borderColor: targetDot.borderColor,
                area: targetDot.area,
                lat: targetDot.lat,
                lon: targetDot.lon
            };
            
            if (userRfId && targetDot.rfId === userRfId) {
                console.log(`✅ RF 事件已從對應的 sea dot ${targetDot.id} 初始化，RF ID: ${rfId}`);
            } else {
                console.log(`✅ RF 事件已從 sea dot ${targetDot.id} 初始化，RF ID: ${rfId} (隨機選擇或用戶輸入)`);
            }
        } else {
            // 如果沒有 seaDotManager 或沒有 sea dots，使用原有的隨機生成方式
            rfId = userRfId || '未知信號';
            coordinates = generateRandomCoordinates();
            frequency = '待檢測';
            strength = '待檢測';
            aisStatus = '未知';
            
            console.warn('⚠️ SeaDotManager 不可用，RF 事件使用預設值創建');
        }

        eventData = {
            ...eventData,
            rfId: rfId,
            detectionTime: detectionTime || eventData.createTime,
            notes: rfNotes,
            frequency: frequency,
            strength: strength,
            coordinates: coordinates,
            aisStatus: aisStatus
        };

        // 如果有來源 sea dot，添加到事件資料中
        if (sourceSeaDot) {
            eventData.sourceSeaDot = sourceSeaDot;
        }

        eventInfo = `RF 信號 ID: ${rfId}<br>座標: ${eventData.coordinates}`;
        typeClass = 'type-rf';
        typeName = 'RF 監控';
    } else if (selectedEventType === 'vessel') {
        const mmsi = document.getElementById('vesselMMSI').value || '未知';
        const coordsInput = document.getElementById('vesselCoords').value;
        const coords = coordsInput && coordsInput.trim() !== '' ? coordsInput : generateSeaCoordinateForEvents();
        const vesselName = document.getElementById('vesselName').value || '未知船舶';
        const investigationReason = document.getElementById('investigationReason').value || '';
        
        eventData = {
            ...eventData,
            mmsi: mmsi,
            coordinates: coords,
            vesselName: vesselName,
            investigationReason: investigationReason,
            riskScore: 30,
            trackPoints: null // 稍後生成固定軌跡點
        };
        
        // 為vessel event生成固定的track points
        try {
            const parsedCoords = parsePointCoordinates(coords);
            if (parsedCoords) {
                eventData.trackPoints = eventStorage.generateFixedTrackPoints(parsedCoords.lat, parsedCoords.lon);
                console.log(`✅ 為新建船舶事件 ${eventId} 生成了固定軌跡點`);
            }
        } catch (error) {
            console.warn(`⚠️ 為船舶事件 ${eventId} 生成軌跡點時發生錯誤:`, error);
        }
        
        eventInfo = `MMSI: ${mmsi}<br>座標: ${coords}<br>風險分數: ${eventData.riskScore}`;
        typeClass = 'type-vessel';
        typeName = '船舶監控';
    }

    // 儲存事件資料
    eventStorage.saveEvent(eventId.toLowerCase(), eventData);
    
    // 創建新事件卡
    const eventsContainer = document.querySelector('.events-container');
    const newCard = document.createElement('div');
    newCard.className = 'event-card';
    newCard.onclick = () => selectEvent(newCard, eventId.toLowerCase());
    
    newCard.innerHTML = `
        <div class="event-card-header">
            <span class="event-id">${eventId}</span>
            <span class="event-type-badge ${typeClass}">${typeName}</span>
        </div>
        <div class="event-info">${eventInfo}</div>
        <div class="event-status">
            <div class="status-dot status-creating"></div>
            <span>建立中</span>
        </div>
    `;
    
    eventsContainer.insertBefore(newCard, eventsContainer.firstChild);
    
    // 立即設置該事件卡為禁用狀態
    setTimeout(() => {
        setEventCardDisabled(eventIdLowerCase, true);
    }, 10);
    
    closeEventModal();
    
    // 模擬建立完成 - 針對RF事件使用新狀態
    setTimeout(() => {
        const statusDot = newCard.querySelector('.status-dot');
        const statusText = newCard.querySelector('.event-status span');
        
        if (selectedEventType === 'rf') {
            statusDot.className = 'status-dot status-analyzed';
            statusText.textContent = '已獲取RF資訊';
            eventStorage.updateEvent(eventIdLowerCase, { status: 'analyzed' });
        } else {
            statusDot.className = 'status-dot status-investigating';
            statusText.textContent = '調查中';
            eventStorage.updateEvent(eventIdLowerCase, { status: 'investigating' });
        }
        
        // 模擬完成後，從創建中的集合移除該事件ID並恢復該事件卡功能
        creatingEventIds.delete(eventIdLowerCase);
        setEventCardDisabled(eventIdLowerCase, false);
    }, 2000);
}

// 重置事件表單
function resetEventForm() {
    selectedEventType = null;
    document.querySelectorAll('.type-option').forEach(option => {
        option.classList.remove('selected');
    });
    document.querySelectorAll('.form-section').forEach(form => {
        form.style.display = 'none';
    });
    // 隱藏按鈕區域並禁用建立按鈕
    document.getElementById('modalActions').style.display = 'none';
    document.getElementById('createEventBtn').disabled = true;
    
    // 清空所有表單欄位
    document.querySelectorAll('.form-input, .form-textarea').forEach(input => {
        input.value = '';
    });
}

// 關閉事件彈窗
function closeEventModal() {
    document.getElementById('newEventModal').style.display = 'none';
}

// 顯示行動決策彈窗
function showActionModal() {
    document.getElementById('actionModal').style.display = 'flex';
    selectedAction = null;
    document.getElementById('executeActionBtn').disabled = true;
    
    // 重置選擇狀態
    document.querySelectorAll('#actionModal .type-option').forEach(option => {
        option.classList.remove('selected');
    });
}

// (deprecated) 關閉行動彈窗
function closeActionModal() {
    document.getElementById('actionModal').style.display = 'none';
}

// (deprecated) 選擇行動 -> Random select action
function randomSelectAction() {
    const availableActions = ['track', 'satellite', 'notify', 'uav'];
    const randomIndex = Math.floor(Math.random() * availableActions.length);
    const selectedAction = availableActions[randomIndex];
    return selectedAction;

    // 自動選擇並執行
    //selectAction(selectedAction);
    //executeAction();
}

// 生成船舶監控決策建議
function getVesselDecisionRecommendation(riskScore, eventData) {
    let recommendation = {};
    
    // 根據風險分數決定主要建議行動
    if (riskScore >= 80) {
        recommendation = {
            primaryAction: '立即派遣載具調查',
            analysis: '高風險船舶，存在多項異常行為，需要立即進行近距離調查以確認威脅性質。',
            evidence: 'AIS長時間關閉、航線嚴重偏離、RF訊號加密異常',
            priority: '緊急',
            priorityColor: '#ef4444'
        };
    } else if (riskScore >= 60) {
        recommendation = {
            primaryAction: '衛星重拍 + 持續追蹤',
            analysis: '中高風險船舶，建議先透過衛星獲取更多資訊，同時加強追蹤頻率。',
            evidence: '部分異常指標超標，需要更多資料進行評估',
            priority: '高',
            priorityColor: '#f59e0b'
        };
    } else if (riskScore >= 40) {
        recommendation = {
            primaryAction: '持續追蹤監控',
            analysis: '中等風險船舶，保持例行監控即可，定期檢查其行為模式變化。',
            evidence: '風險指標在可控範圍內，但需要持續觀察',
            priority: '中等',
            priorityColor: '#f59e0b'
        };
    } else {
        recommendation = {
            primaryAction: '通知相關單位記錄',
            analysis: '低風險船舶，建議通知相關單位記錄備案即可，無需特殊處理。',
            evidence: '各項指標正常，符合常規航行模式',
            priority: '低',
            priorityColor: '#10b981'
        };
    }
    
    return recommendation;
}

// 儲存已選擇的行動選項
let selectedVesselActions = new Set();

// (deprecated) 切換行動選項選擇狀態
function toggleActionOption(element) {
    const action = element.dataset.action;
    
    if (element.classList.contains('selected')) {
        element.classList.remove('selected');
        selectedVesselActions.delete(action);
    } else {
        element.classList.add('selected');
        selectedVesselActions.add(action);
    }
    
    // 更新執行按鈕狀態
    const executeBtn = document.getElementById('executeVesselActionBtn');
    if (executeBtn) {
        executeBtn.disabled = selectedVesselActions.size === 0;
    }
}

// 取消船舶行動
function cancelVesselActions() {
    // 清除所有選擇
    selectedVesselActions.clear();
    
    // 移除所有選擇狀態
    const actionOptions = document.querySelectorAll('.action-option');
    actionOptions.forEach(option => {
        option.classList.remove('selected');
    });
    
    // 禁用執行按鈕
    const executeBtn = document.getElementById('executeVesselActionBtn');
    if (executeBtn) {
        executeBtn.disabled = true;
    }
    
    console.log('已取消所有船舶行動選擇');
}

// 執行選擇的船舶行動
function executeVesselActions() {
    if (selectedVesselActions.size === 0) {
        alert('請先選擇要執行的行動');
        return;
    }
    
    const actionsArray = Array.from(selectedVesselActions);
    const actionNames = actionsArray.map(action => {
        switch(action) {
            case 'track': return '持續追蹤';
            case 'satellite': return '衛星重拍';
            case 'notify': return '通知單位';
            case 'uav': return '派遣載具';
            default: return action;
        }
    });
    
    const confirmed = confirm(`確定要執行以下行動嗎？\n\n${actionNames.join('、')}\n\n這些行動將立即開始執行。`);
    
    if (confirmed) {
        console.log(`🚢 執行船舶監控行動: ${actionNames.join('、')}`);
        
        // 創建任務並顯示成功消息
        actionsArray.forEach(action => {
            createMissionFromAction(action, currentEventId);
        });
        
        // 顯示船舶圖片
        showShipPicture();
        
        alert(`✅ 行動已啟動：${actionNames.join('、')}\n\n相關任務已添加到任務時間軸中，請查看底部任務區域。`);
        
        // 清除選擇狀態
        cancelVesselActions();
    }
}

// 選擇行動 -> Confirm Button
function selectAction(action, element) {
    selectedAction = action;
    
    // Check if this is from action modal or vessel details
    if (element && element.classList.contains('action-btn')) {
        // This is from vessel details - handle action-btn
        const parentContainer = element.closest('.action-grid');
        if (parentContainer) {
            // Clear all action-btn selections in this container
            parentContainer.querySelectorAll('.action-btn').forEach(btn => {
                btn.classList.remove('selected');
            });
            // Select the clicked button
            element.classList.add('selected');
        }
    } else {
        // This is from action modal - handle type-option
        document.querySelectorAll('#actionModal .type-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        const targetElement = element || event.target.closest('.type-option');
        if (targetElement) {
            targetElement.classList.add('selected');
        }
    }
    
    // 啟用執行按鈕
    const executeBtn = document.getElementById('executeActionBtn');
    if (executeBtn) {
        executeBtn.disabled = false;
    }
}

// 執行行動
function executeAction() {
    if (!selectedAction) return;            
    
    // 執行行動不需要禁用事件卡，因為這不是創建事件
    
    // 創建新任務卡
    const missionTimeline = document.querySelector('.mission-timeline');
    const newMission = document.createElement('div');
    newMission.className = 'mission-card';
    
    const missionId = `MISSION-${++missionCounter}`;
    
    newMission.innerHTML = `
        <div class="mission-card-header">
            <span class="mission-type">${actionIcons[selectedAction]} ${actionNames[selectedAction]}</span>
            <span class="mission-status status-queued">QUEUED</span>
        </div>
        <div class="mission-details">
            事件: ${currentEventId.toUpperCase()}<br>
            目標: MMSI-416123456<br>
            ${selectedAction === 'track' ? '持續時間: 4 小時' : selectedAction === 'satellite' ? '類型: 光學影像' : selectedAction === 'uav' ? '酬載: EO/IR 感測器' : '通知對象: 海巡署'}<br>
            建立時間: ${new Date().toLocaleTimeString('zh-TW', {hour12: false})}
        </div>
        <div class="mission-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%;"></div>
            </div>
            <div class="progress-text">等待執行</div>
        </div>
    `;
    
    missionTimeline.insertBefore(newMission, missionTimeline.firstChild);
    
    // 顯示船舶圖片
    showShipPicture();
    
    // 更新任務統計
    const stats = document.querySelector('.mission-stats');
    const currentActive = parseInt(stats.textContent.match(/進行中: (\d+)/)[1]) + 1;
    const currentTotal = parseInt(stats.textContent.match(/總計: (\d+)/)[1]) + 1;
    stats.textContent = `進行中: ${currentActive} | 已完成: 1 | 總計: ${currentTotal}`;
    
    // 模擬任務進度
    setTimeout(() => {
        const statusBadge = newMission.querySelector('.mission-status');
        const progressFill = newMission.querySelector('.progress-fill');
        const progressText = newMission.querySelector('.progress-text');
        
        statusBadge.className = 'mission-status status-sensing';
        statusBadge.textContent = 'SENSING';
        
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress > 100) progress = 100;
            
            progressFill.style.width = progress + '%';
            progressText.textContent = `進度: ${Math.round(progress)}%`;
            
            if (progress >= 100) {
                clearInterval(interval);
                statusBadge.className = 'mission-status status-done';
                statusBadge.textContent = 'DONE';
                progressText.textContent = '已完成';
                
                // 執行行動完成，不需要恢復事件卡狀態（因為沒有禁用）
                
                // 更新統計
                const newStats = document.querySelector('.mission-stats');
                const activeCount = parseInt(newStats.textContent.match(/進行中: (\d+)/)[1]) - 1;
                const completedCount = parseInt(newStats.textContent.match(/已完成: (\d+)/)[1]) + 1;
                const totalCount = parseInt(newStats.textContent.match(/總計: (\d+)/)[1]);
                newStats.textContent = `進行中: ${activeCount} | 已完成: ${completedCount} | 總計: ${totalCount}`;
            }
        }, 1000);
    }, 3000);
    
    // closeActionModal();
}

// 拒絕行動
function rejectAction() {
    return 'reject';
}

// 從 AreaEventDetails 中提取指定 RF 候選的數據
function extractRFCandidateData(rfId) {
    // 獲取來源區域事件的資料
    const sourceAreaEvent = eventStorage.getEvent(currentEventId);
    
    // 優先從儲存的 rfCandidatesData 中提取數據
    if (sourceAreaEvent && sourceAreaEvent.rfCandidatesData) {
        const candidateData = sourceAreaEvent.rfCandidatesData.find(data => data.rfId === rfId);
        if (candidateData) {
            console.log(`從儲存數據提取的 RF 數據 (${rfId}):`, candidateData);
            return {
                frequency: candidateData.frequency,
                strength: candidateData.strength,
                coordinates: candidateData.coordinates
            };
        }
    }
    
    const detailsContent = document.getElementById('detailsContent');
    const evidenceItems = detailsContent.querySelectorAll('.evidence-item');
    
    let extractedData = {
        frequency: '待檢測',
        strength: '待檢測', 
        coordinates: '定位中'
    };
    
    // 遍歷所有證據項目，尋找匹配的 RF ID
    evidenceItems.forEach(item => {
        const titleElement = item.querySelector('.evidence-title');
        const descElement = item.querySelector('.evidence-desc');
        
        if (titleElement && titleElement.textContent.includes(rfId)) {
            const descText = descElement.textContent;
            
            // 提取頻率資訊
            const frequencyMatch = descText.match(/📡 頻率:\s*([^\|]+)/);
            if (frequencyMatch) {
                extractedData.frequency = frequencyMatch[1].trim();
            }
            
            // 提取強度資訊
            const strengthMatch = descText.match(/強度:\s*([^\n]+)/);
            if (strengthMatch) {
                extractedData.strength = strengthMatch[1].trim();
            }
            
            // 提取座標資訊
            const coordinatesMatch = descText.match(/📍 座標:\s*([^\n]+)/);
            if (coordinatesMatch) {
                extractedData.coordinates = coordinatesMatch[1].trim();
            }
        }
    });
    
    console.log(`提取的 RF 數據 (${rfId}):`, extractedData);
    return extractedData;
}

// 從區域監控建立 RF 事件（從 AreaEventDetails 提取數據）
function createRFEventfromArea(rfId) {
    // 禁用對應的按鈕，防止重複點擊
    const buttons = document.querySelectorAll('.create-rf-btn');

    const eventId = `RF-${String(++eventCounter).padStart(3, '0')}`;
    const eventIdLowerCase = eventId.toLowerCase();
    
    // 將該事件ID添加到創建中的集合
    creatingEventIds.add(eventIdLowerCase);
    
    // 獲取來源區域事件的資料
    const sourceAreaEvent = eventStorage.getEvent(currentEventId);
    
    // 從當前詳情面板中提取對應 RF 候選的數據
    let rfCandidateData = extractRFCandidateData(rfId);
    
    // 嘗試從來源區域事件的 rfCandidatesData 中取得完整資訊
    let aisStatus = '未知';
    let sourceSeaDot = null;
    
    if (sourceAreaEvent && sourceAreaEvent.rfCandidatesData) {
        const candidateDetail = sourceAreaEvent.rfCandidatesData.find(data => data.rfId === rfId);
        if (candidateDetail && candidateDetail.aisStatus) {
            aisStatus = candidateDetail.aisStatus;
        }
        if (candidateDetail && candidateDetail.sourceSeaDot) {
            sourceSeaDot = candidateDetail.sourceSeaDot;
        }
    }
    
    // 如果仍然沒有AIS狀態，嘗試從seaDotManager獲取
    if (aisStatus === '未知' && typeof window.seaDotManager !== 'undefined') {
        const dot = window.seaDotManager.getDotByRFId(rfId);
        if (dot) {
            if (dot.borderColor === '#ef4444' || dot.borderColor === 'red') {
                aisStatus = '未開啟';
            } else if (dot.borderColor === '#059669' || dot.borderColor === 'green') {
                aisStatus = '已開啟';
            }
            sourceSeaDot = {
                id: dot.id,
                status: dot.status,
                borderColor: dot.borderColor,
                area: dot.area,
                lat: dot.lat,
                lon: dot.lon
            };
        }
    }
    
    // 建立 RF 事件資料，確保AIS狀態一致
    let eventData = {
        type: 'rf',
        rfId: rfId,
        createTime: new Date().toLocaleTimeString('zh-TW', {hour12: false, hour: '2-digit', minute: '2-digit'}),
        detectionTime: new Date().toLocaleTimeString('zh-TW', {hour12: false, hour: '2-digit', minute: '2-digit'}),
        status: 'creating',
        frequency: rfCandidateData.frequency,
        strength: rfCandidateData.strength,
        coordinates: rfCandidateData.coordinates,
        aisStatus: aisStatus, // 確保使用一致的AIS狀態
        notes: `從 ${currentEventId.toUpperCase()} 區域監控事件建立的 RF 異常調查`
    };
    
    // 如果有來源sea dot資訊，加入事件資料
    if (sourceSeaDot) {
        eventData.sourceSeaDot = sourceSeaDot;
    }
    
    // 如果有來源區域事件，添加關聯資訊
    if (sourceAreaEvent && sourceAreaEvent.type === 'area') {
        eventData.sourceAreaEvent = sourceAreaEvent.id;
        eventData.aoiName = sourceAreaEvent.aoiName;
    }
    
    // 儲存 RF 事件資料到 eventStorage
    eventStorage.saveEvent(eventId.toLowerCase(), eventData);
    
    // 建立新事件卡
    const eventsContainer = document.querySelector('.events-container');
    const newCard = document.createElement('div');
    newCard.className = 'event-card';
    newCard.onclick = () => selectEvent(newCard, eventId.toLowerCase());
    
    // 使用提取的數據顯示事件卡資訊
    const eventInfo = `RF 信號 ID: ${rfId}<br>座標: ${eventData.coordinates}`;
    
    newCard.innerHTML = `
        <div class="event-card-header">
            <span class="event-id">${eventId}</span>
            <span class="event-type-badge type-rf">RF 監控</span>
        </div>
        <div class="event-info">${eventInfo}</div>
        <div class="event-status">
            <div class="status-dot status-creating"></div>
            <span>獲取RF資訊中</span>
        </div>
    `;
    
    eventsContainer.insertBefore(newCard, eventsContainer.firstChild);

    // 立即設置該事件卡為禁用狀態
    setTimeout(() => {
        setEventCardDisabled(eventIdLowerCase, true);
    }, 10);

    // 模擬事件進行 
    setTimeout(() => {
        // 模擬獲取RF資訊完成狀態更新
        setTimeout(() => {
            const statusDot = newCard.querySelector('.status-dot');
            const statusText = newCard.querySelector('.event-status span');
            statusDot.className = 'status-dot status-analyzed'; // 新增狀態類別
            statusText.textContent = '已獲取RF資訊';
            
            // 更新儲存的事件狀態
            eventStorage.updateEvent(eventIdLowerCase, { status: 'analyzed' });
            
            // 模擬完成後，從創建中的集合移除該事件ID並恢復該事件卡功能
            creatingEventIds.delete(eventIdLowerCase);
            setEventCardDisabled(eventIdLowerCase, false);
        }, 1500);
    }, 100);
    
    // 從來源區域事件中移除已建立的 RF 候選（如果存在）
    if (sourceAreaEvent && sourceAreaEvent.rfCandidates) {
        const updatedCandidates = sourceAreaEvent.rfCandidates.filter(candidate => candidate !== rfId);
        const updatedCandidatesData = sourceAreaEvent.rfCandidatesData.filter(data => data.rfId !== rfId);
        
        eventStorage.updateEvent(currentEventId, { 
            rfCandidates: updatedCandidates,
            rfCandidatesData: updatedCandidatesData
        });
        
        // 更新區域事件的詳情面板
        setTimeout(() => {
            if (currentEventId === sourceAreaEvent.id) {
                updateDetailsPanel(currentEventId);
            }
        }, 2000);
    }
    
    console.log(`RF 事件 ${eventId} 已從區域事件 ${currentEventId.toUpperCase()} 建立完成`);
}

// 從 RF 事件建立船舶監控
function createVesselFromRF() {
    const eventId = `VESSEL-${String(++eventCounter).padStart(3, '0')}`;
    const eventIdLowerCase = eventId.toLowerCase();
    
    // 將該事件ID添加到創建中的集合
    creatingEventIds.add(eventIdLowerCase);
    
    // 獲取當前 RF 事件的資料
    const currentRFEvent = eventStorage.getEvent(currentEventId);
    if (!currentRFEvent || currentRFEvent.type !== 'rf') {
        console.error('無法從非 RF 事件建立船舶監控');
        return;
    }
    
    // 從當前 RF 事件提取數據來建立船舶監控
    const currentTime = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const mmsi = `416${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    
    let eventData = {
        id: eventId,
        type: 'vessel',
        mmsi: mmsi,
        coordinates: currentRFEvent.coordinates,
        vesselName: '未知船舶',
        riskScore: Math.floor(Math.random() * 20) + 70, // 70-89
        createTime: currentTime,
        status: 'investigating',
        investigationReason: 'RF 信號異常，疑似 AIS 關閉或偽造',
        sourceRFEvent: currentRFEvent.id,
        frequency: currentRFEvent.frequency,
        signalStrength: currentRFEvent.strength,
        trackPoints: null // 稍後生成固定軌跡點
    };
    
    // 為vessel event生成固定的track points
    try {
        const coords = parsePointCoordinates(currentRFEvent.coordinates);
        if (coords) {
            eventData.trackPoints = eventStorage.generateFixedTrackPoints(coords.lat, coords.lon);
            console.log(`✅ 為新建船舶事件 ${eventId} 生成了固定軌跡點`);
        }
    } catch (error) {
        console.warn(`⚠️ 為船舶事件 ${eventId} 生成軌跡點時發生錯誤:`, error);
    }
    
    // 如果 RF 事件有來源區域事件，繼承關聯資訊
    if (currentRFEvent.sourceAreaEvent) {
        eventData.sourceAreaEvent = currentRFEvent.sourceAreaEvent;
        eventData.aoiName = currentRFEvent.aoiName;
    }
    
    // 儲存船舶監控事件資料到 eventStorage
    eventStorage.saveEvent(eventId.toLowerCase(), eventData);
    
    // 建立新事件卡
    const eventsContainer = document.querySelector('.events-container');
    const newCard = document.createElement('div');
    newCard.className = 'event-card';
    newCard.onclick = () => selectEvent(newCard, eventId.toLowerCase());
    
    newCard.innerHTML = `
        <div class="event-card-header">
            <span class="event-id">${eventId}</span>
            <span class="event-type-badge type-vessel">船舶監控</span>
        </div>
        <div class="event-info">
            MMSI: ${eventData.mmsi}<br>
            座標: ${currentRFEvent.coordinates}<br>
            風險分數: 分析中
        </div>
        <div class="event-status">
            <div class="status-dot status-creating"></div>
            <span>風險分析中</span>
        </div>
    `;
    
    eventsContainer.insertBefore(newCard, eventsContainer.firstChild);
    
    // 立即設置該事件卡為禁用狀態
    setTimeout(() => {
        setEventCardDisabled(eventIdLowerCase, true);
    }, 10);
    
    setTimeout(() => {        
        // 模擬風險分析完成
        setTimeout(() => {
            const statusDot = newCard.querySelector('.status-dot');
            const statusText = newCard.querySelector('.event-status span');
            const riskInfo = newCard.querySelector('.event-info');
            
            statusDot.className = 'status-dot status-investigating';
            statusText.textContent = '等待決策';
            riskInfo.innerHTML = `MMSI: ${eventData.mmsi}<br>座標: ${eventData.coordinates}<br>風險分數: ${eventData.riskScore}/100`;
            
            // 模擬完成後，從創建中的集合移除該事件ID並恢復該事件卡功能
            creatingEventIds.delete(eventIdLowerCase);
            setEventCardDisabled(eventIdLowerCase, false);
        }, 3000);
    }, 100);
    
    console.log(`船舶監控事件 ${eventId} 已從 RF 事件 ${currentRFEvent.id} 建立完成`);
}

// 其他操作函數
function refreshAOI() {
    alert('🔄 重新掃描 AOI 區域...\n正在更新 RF 異常候選清單');
}

function expandAOI() {
    alert('📏 擴大 AOI 範圍...\n監控區域已增加 20%');
}

function exportData() {
    alert('📊 匯出資料...\n事件資料已匯出為 CSV 檔案');
}

function analyzeRF() {
    alert('🔍 深度分析 RF 信號...\n正在進行頻譜分析與模式比對');
}

function exportRFData() {
    alert('📊 匯出 RF 資料...\n信號資料已匯出為技術報告');
}

function closeEvent() {
    if (confirm('確定要結束此事件嗎？\n結束後事件將移至歷史資料庫')) {
        const activeCard = document.querySelector('.event-card.active');
        if (activeCard) {
            const statusDot = activeCard.querySelector('.status-dot');
            const statusText = activeCard.querySelector('.event-status span');
            statusDot.className = 'status-dot status-completed';
            statusText.textContent = '已結束';
            
            alert('✅ 事件已結束並封存至歷史資料庫');
        }
    }
}

// (deprecated)台灣地圖
// function initializeTaiwanMap() {
//     // 在 DOMContentLoaded 事件中加入
//     // 台灣中心座標
//     const taiwanCenter = [23.8, 121.0];
    
//     // 建立地圖
//     const map = L.map('taiwanMap', {
//         center: taiwanCenter,
//         zoom: 7,
//         minZoom: 6,
//         maxZoom: 18
//     });
    
//     // 加入 OpenStreetMap 圖層
//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//         attribution: '© OpenStreetMap contributors'
//     }).addTo(map);
    
//     // 限制地圖範圍到台灣周圍海域
//     const taiwanBounds = [
//         [20.0, 118.0], // 西南角
//         [26.5, 124.0]  // 東北角
//     ];
//     map.setMaxBounds(taiwanBounds);
    
//     return map;
// }

// 台灣地圖
// ✅ 在這裡加入地圖相關變數和函數
let taiwanMap = null;

// 海域監測點管理系統
class SeaDotManager {
    constructor() {
        this.seaDots = new Map(); // 儲存所有海域監測點
        this.dotIdCounter = 1;
    }

    // 創建海域監測點物件
    createSeaDot(lat, lon, id, borderColor = 'none') {
        // 根據邊框顏色決定狀態
        let status = 'normal'; // 預設狀態
        if (borderColor === '#ef4444' || borderColor === 'red') {
            status = 'No AIS'; // 紅色邊框代表沒有 AIS 信號
        } else if (borderColor === '#059669' || borderColor === 'green') {
            status = 'AIS'; // 綠色邊框代表有 AIS 信號
        } else if (borderColor === 'none') {
            status = 'unknown'; // 無邊框代表未知狀態
        }

        const dotData = {
            id: id,
            lat: lat,
            lon: lon,
            borderColor: borderColor,
            backgroundColor: '#66e7ff', // 更淺的藍色
            status: status, // 根據邊框顏色決定的狀態
            area: this.getAreaName(lat, lon),
            createTime: new Date().toISOString(),
            rfId: generateSingleRFId(), // 為每個海域監測點生成隨機 RF 信號 ID
            marker: null
        };

        // 創建地圖標記
        const marker = this.createMarker(dotData);
        dotData.marker = marker;

        // 儲存到管理系統
        this.seaDots.set(id, dotData);
        
        console.log(`🔵 海域監測點 ${id} 已生成 RF 信號 ID: ${dotData.rfId}, 狀態: ${dotData.status}`);
        
        return marker;
    }

    // 創建地圖標記
    createMarker(dotData) {
        let borderStyle = '';
        let shadowColor = 'rgba(102, 231, 255, 0.6)'; // 更淺藍色的陰影
        
        if (dotData.borderColor === 'none') {
            // 無外框樣式
            borderStyle = 'border: none;';
            shadowColor = 'rgba(102, 231, 255, 0.6)'; // 更淺藍色的陰影
        } else {
            // 有外框樣式
            const borderColorRgba = this.hexToRgba(dotData.borderColor, 0.8);
            shadowColor = this.hexToRgba(dotData.borderColor, 0.6);
            borderStyle = `border: 2px solid ${dotData.borderColor};`;
        }
        
        const dotIcon = L.divIcon({
            html: `<div class="sea-dot-inner" style="
                background: ${dotData.backgroundColor}; 
                ${borderStyle}
                border-radius: 50%; 
                width: 16px; 
                height: 16px; 
                box-shadow: 0 0 15px ${shadowColor};
                animation: pulse-dot 3s infinite;
                opacity: 0.9;
            "></div>`,
            className: `sea-dot-marker dot-${dotData.id}`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });
        
        const marker = L.marker([dotData.lat, dotData.lon], { icon: dotIcon });
        
        // 綁定彈出視窗
        marker.bindPopup(this.createPopupContent(dotData));
        
        return marker;
    }

    // 創建彈出視窗內容
    createPopupContent(dotData) {
        const statusText = this.getStatusText(dotData.status);
        
        return `
            <div style="color: #333; font-size: 12px; min-width: 220px;">
                <!-- 座標和狀態區塊 -->
                <div style="margin-bottom: 12px;">
                    <strong>座標:</strong> ${dotData.lat.toFixed(3)}°N, ${dotData.lon.toFixed(3)}°E<br>
                    <strong>狀態:</strong> <span style="color: ${dotData.borderColor === 'none' ? '#66e7ff' : dotData.borderColor};">${statusText}</span><br>
                </div>
                
                <!-- RF ID 突出顯示區塊 -->
                <div style="background: linear-gradient(135deg, #fef3c7, #fed7aa); padding: 8px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #f59e0b;">
                    <div style="text-align: center;">
                        <div style="font-size: 10px; color: #92400e; margin-bottom: 2px;">RF 信號 ID</div>
                        <div style="font-size: 16px; font-weight: bold; color: #92400e; font-family: 'Courier New', monospace;">
                            ${dotData.rfId}
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 10px;">
                    <button onclick="navigator.clipboard.writeText('${dotData.rfId}'); alert('RF ID 已複製到剪貼簿: ${dotData.rfId}')" 
                            style="background: #f59e0b; color: white; border: none; padding: 4px 8px; margin: 2px; border-radius: 4px; cursor: pointer; font-size: 10px; width: 100%; margin-bottom: 4px;">
                        複製 RF 信號 ID
                    </button>
                </div>
            </div>
        `;
    }

    // 改變邊框顏色
    changeBorderColor(dotId, newBorderColor) {
        const dotData = this.seaDots.get(dotId);
        if (!dotData) {
            console.warn(`找不到監測點 ${dotId}`);
            return false;
        }

        // 更新資料
        dotData.borderColor = newBorderColor;
        dotData.status = this.getStatusFromColor(newBorderColor);

        // 移除舊標記
        if (dotData.marker && taiwanMap.hasLayer(dotData.marker)) {
            taiwanMap.removeLayer(dotData.marker);
        }

        // 創建新標記
        const newMarker = this.createMarker(dotData);
        dotData.marker = newMarker;
        newMarker.addTo(taiwanMap);

        console.log(`✅ 監測點 ${dotId} 外框顏色已更改為 ${newBorderColor}`);
        return true;
    }

    // 批量改變邊框顏色
    changeBorderColorBatch(dotIds, newBorderColor) {
        let successCount = 0;
        dotIds.forEach(dotId => {
            if (this.changeBorderColor(dotId, newBorderColor)) {
                successCount++;
            }
        });
        console.log(`✅ 批量更改完成: ${successCount}/${dotIds.length} 個監測點`);
        return successCount;
    }

    // 根據顏色獲取狀態
    getStatusFromColor(color) {
        switch (color) {
            case '#059669': return 'AIS'; // 綠色邊框 = 有 AIS 信號
            case '#ef4444': return 'No AIS'; // 紅色邊框 = 無 AIS 信號
            case '#f59e0b': return 'warning'; // 橙色邊框 = 警告狀態（保留原有邏輯）
            case 'none': return 'unknown'; // 無邊框 = 狀態未知
            default: return 'unknown';
        }
    }

    // 獲取狀態文字
    getStatusText(status) {
        switch (status) {
            case 'AIS': return '🟢 AIS 已開啟';
            case 'No AIS': return '🔴 AIS 未開啟';
            case 'unknown': return '⚫ 狀態未知';
            case 'normal': return '正常監測';
            case 'alert': return '警報狀態';
            case 'warning': return '警告狀態';
            default: return '監測中';
        }
    }

    // 獲取顏色名稱
    getColorName(color) {
        switch (color) {
            case '#059669': return '深綠色';
            case '#ef4444': return '紅色';
            case '#f59e0b': return '橙色';
            case 'none': return '無外框';
            default: return '未知';
        }
    }

    // 將十六進制顏色轉換為 RGBA
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // 根據座標獲取區域名稱
    getAreaName(lat, lon) {
        if (lat >= 22.0 && lat <= 25.5 && lon >= 119.0 && lon <= 119.8) return '台灣海峽西側';
        if (lat >= 22.0 && lat <= 25.5 && lon >= 121.5 && lon <= 122.5) return '台灣東部海域';
        if (lat >= 25.0 && lat <= 26.0 && lon >= 120.0 && lon <= 122.0) return '台灣北部海域';
        if (lat >= 21.5 && lat <= 22.5 && lon >= 120.0 && lon <= 121.5) return '台灣南部海域';
        if (lat >= 20.5 && lat <= 22.0 && lon >= 120.5 && lon <= 121.8) return '巴士海峽';
        if (lat >= 23.5 && lat <= 24.5 && lon >= 119.2 && lon <= 119.9) return '台灣海峽中央';
        return '台灣周邊海域';
    }

    // 獲取所有監測點
    getAllDots() {
        return Array.from(this.seaDots.values());
    }

    // 獲取所有 RF 信號 ID
    getAllRFIds() {
        return this.getAllDots().map(dot => dot.rfId);
    }

    // 根據 RF 信號 ID 獲取監測點
    getDotByRFId(rfId) {
        return this.getAllDots().find(dot => dot.rfId === rfId);
    }

    // 獲取特定區域的所有 RF 信號 ID
    getRFIdsByArea(areaName) {
        return this.getAllDots()
            .filter(dot => dot.area === areaName)
            .map(dot => dot.rfId);
    }

    // 獲取特定顏色的監測點
    getDotsByBorderColor(borderColor) {
        return this.getAllDots().filter(dot => dot.borderColor === borderColor);
    }

    // 根據座標範圍查詢區域內的監測點
    getDotsInRange(latRange, lonRange) {
        try {
            // 解析座標範圍字串 (例: "24.2°N - 24.8°N")
            const latMatch = latRange.match(/(\d+\.?\d*)°N\s*-\s*(\d+\.?\d*)°N/);
            const lonMatch = lonRange.match(/(\d+\.?\d*)°E\s*-\s*(\d+\.?\d*)°E/);
            
            if (!latMatch || !lonMatch) {
                console.warn('無法解析座標範圍:', { latRange, lonRange });
                return [];
            }
            
            const latMin = parseFloat(latMatch[1]);
            const latMax = parseFloat(latMatch[2]);
            const lonMin = parseFloat(lonMatch[1]);
            const lonMax = parseFloat(lonMatch[2]);
            
            // 篩選在指定範圍內的監測點
            const dotsInRange = this.getAllDots().filter(dot => {
                return dot.lat >= latMin && dot.lat <= latMax &&
                       dot.lon >= lonMin && dot.lon <= lonMax;
            });
            
            console.log(`📍 在範圍 [${latRange}, ${lonRange}] 內找到 ${dotsInRange.length} 個監測點`);
            return dotsInRange;
            
        } catch (error) {
            console.error('查詢範圍內監測點時發生錯誤:', error);
            return [];
        }
    }

    // 根據座標範圍和狀態查詢監測點
    getDotsInRangeByStatus(latRange, lonRange, status) {
        const dotsInRange = this.getDotsInRange(latRange, lonRange);
        return dotsInRange.filter(dot => dot.status === status);
    }

    // 獲取監測點總數
    getDotsCount() {
        return this.seaDots.size;
    }

    // 清除所有監測點
    clearAllDots() {
        this.seaDots.forEach(dotData => {
            if (dotData.marker && taiwanMap.hasLayer(dotData.marker)) {
                taiwanMap.removeLayer(dotData.marker);
            }
        });
        this.seaDots.clear();
        this.dotIdCounter = 1;
        console.log('🗑️ 已清除所有海域監測點');
    }
}

// 建立全域海域監測點管理器
const seaDotManager = new SeaDotManager();
window.seaDotManager = seaDotManager; // 設置為全域變數，供其他函數使用

// 地圖初始化函數
function initializeTaiwanMap() {
    try {
        // 台灣中心座標
        const taiwanCenter = [23.8, 121.0];
        
        // 建立地圖
        taiwanMap = L.map('taiwanMap', {
            center: taiwanCenter,
            zoom: 7,
            minZoom: 6,
            maxZoom: 18,
            zoomControl: true
        });
        
        // 加入地圖圖層（深色主題）
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© CARTO © OpenStreetMap contributors',
            maxZoom: 18
        }).addTo(taiwanMap);
        
        // 限制地圖範圍到台灣周圍
        const taiwanBounds = [
            [20.0, 118.0], // 西南角
            [26.5, 124.0]  // 東北角
        ];
        taiwanMap.setMaxBounds(taiwanBounds);
        
        console.log('✅ 台灣地圖初始化成功');
        
        // 加入事件標記
        addEventMarkers();
        
        // 加入隨機藍色圓點
        addRandomSeaDots();
        
    } catch (error) {
        console.error('❌ 地圖初始化失敗:', error);
    }
}

// 在地圖上加入事件標記
function addEventMarkers() {
    if (!taiwanMap) return;
    
    // 事件位置資料
    const eventLocations = {
        // 'area-001': {
        //     coords: [24.5, 120.9],
        //     type: 'area',
        //     title: 'AREA-001 台海北部海域',
        //     icon: '🗺️',
        //     color: '#4f46e5'
        // },
        // 'rf-002': {
        //     coords: [24.456, 120.789],
        //     type: 'rf', 
        //     title: 'RF-002 異常信號',
        //     icon: '📡',
        //     color: '#f59e0b'
        // },
        // 'vessel-003': {
        //     coords: [24.123, 121.045],
        //     type: 'vessel',
        //     title: 'VESSEL-003 高風險船舶',
        //     icon: '🚢',
        //     color: '#ef4444'
        // },
        // 'vessel-004': {
        //     coords: [24.789, 120.234],
        //     type: 'vessel',
        //     title: 'VESSEL-004 已結案船舶',
        //     icon: '🚢',
        //     color: '#10b981'
        // }
    };

    // 為每個事件創建標記
    Object.entries(eventLocations).forEach(([eventId, data]) => {
        const marker = createEventMarker(data);
        marker.addTo(taiwanMap);
        
        // 點擊標記時選擇對應事件
        marker.on('click', () => {
            selectEventFromMap(eventId);
        });
    });
}

// 創建事件標記
function createEventMarker(eventData) {
    const customIcon = L.divIcon({
        html: `<div style="
            background: ${eventData.color}; 
            border: 2px solid white;
            border-radius: 50%; 
            width: 30px; 
            height: 30px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 16px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            animation: pulse-marker 2s infinite;
        ">${eventData.icon}</div>`,
        className: 'custom-event-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
    
    return L.marker(eventData.coords, { icon: customIcon })
            .bindPopup(`<strong>${eventData.title}</strong><br>點擊查看詳細資訊`);
}

// 從地圖選擇事件
function selectEventFromMap(eventId) {
    // 如果該事件正在創建中，阻止從地圖選擇
    if (creatingEventIds.has(eventId)) {
        console.log(`事件 ${eventId} 正在創建中，無法從地圖選擇`);
        return;
    }
    
    // 找到對應的事件卡
    const eventCards = document.querySelectorAll('.event-card');
    eventCards.forEach(card => {
        if (card.onclick.toString().includes(eventId)) {
            card.click();
        }
    });
}

// 生成隨機藍色海域圓點
function addRandomSeaDots() {
    if (!taiwanMap) return;
    
    // 定義台灣本島的大致範圍（避免在陸地上放置圓點）
    const taiwanLandAreas = [
        // 台灣本島主要區域
        { latMin: 21.9, latMax: 25.3, lonMin: 120.0, lonMax: 122.0 },
    ];
    
    // 定義海域範圍（台灣周圍海域）
    const seaAreas = [
        // 台灣海峽西側
        { latMin: 22.0, latMax: 25.5, lonMin: 119.0, lonMax: 119.8, name: '台灣海峽西側' },
        // 東部海域
        { latMin: 22.0, latMax: 25.5, lonMin: 121.5, lonMax: 122.5, name: '台灣東部海域' },
        // 北部海域
        { latMin: 25.0, latMax: 26.0, lonMin: 120.0, lonMax: 122.0, name: '台灣北部海域' },
        // 南部海域
        { latMin: 21.5, latMax: 22.5, lonMin: 120.0, lonMax: 121.5, name: '台灣南部海域' },
        // 巴士海峽
        { latMin: 20.5, latMax: 22.0, lonMin: 120.5, lonMax: 121.8, name: '巴士海峽' },
        // 台灣海峽中央
        { latMin: 23.5, latMax: 24.5, lonMin: 119.2, lonMax: 119.9, name: '台灣海峽中央' }
    ];
    
    // 檢查座標是否在台灣陸地範圍內
    function isOnLand(lat, lon) {
        return taiwanLandAreas.some(area => 
            lat >= area.latMin && lat <= area.latMax && 
            lon >= area.lonMin && lon <= area.lonMax
        );
    }
    
    // 生成隨機海域座標
    function generateSeaCoordinate() {
        const maxAttempts = 20;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            // 隨機選擇一個海域
            const seaArea = seaAreas[Math.floor(Math.random() * seaAreas.length)];
            
            // 在該海域內生成隨機座標
            const lat = seaArea.latMin + Math.random() * (seaArea.latMax - seaArea.latMin);
            const lon = seaArea.lonMin + Math.random() * (seaArea.lonMax - seaArea.lonMin);
            
            // 檢查是否在陸地上
            if (!isOnLand(lat, lon)) {
                return { lat, lon, area: seaArea.name };
            }
            
            attempts++;
        }
        
        // 如果多次嘗試都失敗，使用預設的海域座標
        return { lat: 24.0, lon: 119.5, area: '台灣海峽' };
    }

    // 生成 90-110 個隨機藍色圓點（70%深綠色外框，30%紅色外框）
    const dotCount = 90 + Math.floor(Math.random() * 21);
    console.log(`🔵 生成 ${dotCount} 個海域監測點`);
    
    // 計算邊框顏色分配
    const greenBorderCount = Math.floor(dotCount * 0.7); // 70% 深綠色
    const redBorderCount = dotCount - greenBorderCount;  // 30% 紅色
    
    // 建立邊框顏色陣列
    const borderColors = [];
    for (let i = 0; i < greenBorderCount; i++) {
        borderColors.push('#059669'); // 深綠色
    }
    for (let i = 0; i < redBorderCount; i++) {
        borderColors.push('#ef4444'); // 紅色
    }
    
    // 隨機打亂邊框顏色順序
    for (let i = borderColors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [borderColors[i], borderColors[j]] = [borderColors[j], borderColors[i]];
    }
    
    for (let i = 1; i <= dotCount; i++) {
        const coord = generateSeaCoordinate();
        const dotId = `SD-${String(i).padStart(3, '0')}`;
        const borderColor = borderColors[i - 1]; // 使用預設分配的邊框顏色
        
        // 創建帶有指定邊框顏色的圓點
        const marker = seaDotManager.createSeaDot(coord.lat, coord.lon, dotId, borderColor);
        marker.addTo(taiwanMap);
    }
    
    console.log(`✅ 海域監測點生成完成，共 ${seaDotManager.getDotsCount()} 個`);
    console.log(`📊 監測點分配: ${greenBorderCount} 個深綠色外框 (${(greenBorderCount/dotCount*100).toFixed(1)}%), ${redBorderCount} 個紅色外框 (${(redBorderCount/dotCount*100).toFixed(1)}%)`);
    
    // 在 sea dots 生成完成後，重新初始化 RF 和 Vessel 事件
    eventStorage.reinitializeRFEvents();
    eventStorage.reinitializeVesselEvents();
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // ✅ 最先重新初始化區域事件的監控時間
    eventStorage.reinitializeAreaEvents();
    
    // ✅ 加入這行 - 初始化地圖
    setTimeout(initializeTaiwanMap, 500);

    // 不再預設選中任何事件，讓使用者手動選擇
    
    // 模擬實時任務進度更新
    setInterval(() => {
        const progressBars = document.querySelectorAll('.mission-card .progress-fill');
        progressBars.forEach(bar => {
            const currentWidth = parseFloat(bar.style.width) || 0;
            if (currentWidth < 100 && bar.closest('.mission-card').querySelector('.mission-status').textContent === 'SENSING') {
                const newWidth = Math.min(100, currentWidth + Math.random() * 5);
                bar.style.width = newWidth + '%';
                
                const progressText = bar.parentElement.nextElementSibling;
                progressText.textContent = `進度: ${Math.round(newWidth)}%`;
            }
        });
    }, 5000);
    
    // 模擬實時狀態更新
    setInterval(() => {
        const timestamp = new Date().toLocaleTimeString('zh-TW', {hour12: false});
        const overlayInfo = document.querySelector('.overlay-info');
        if (overlayInfo && overlayInfo.textContent.includes('最後更新')) {
            const currentText = overlayInfo.innerHTML;
            overlayInfo.innerHTML = currentText.replace(/最後更新: \d{2}:\d{2}:\d{2}/, `最後更新: ${timestamp}`);
        }
    }, 30000);
});

// 縮放重置功能
function resetMapZoom() {
    if (taiwanMap) {
        // 清除調查範圍顯示
        clearInvestigationRange();
        
        // 回復到預設的台灣中心座標和縮放層級
        const defaultCenter = [23.8, 121.0];
        const defaultZoom = 7;
        
        // 平滑動畫回復到預設視圖
        taiwanMap.setView(defaultCenter, defaultZoom, {
            animate: true,
            duration: 1.0,
            easeLinearity: 0.25
        });
        
        console.log('🎯 地圖已重置到預設大小');
        
        // 可選：顯示簡短的反饋
        showTemporaryMessage('地圖已重置到預設大小');
    }
}

// 顯示臨時訊息的輔助函數
function showTemporaryMessage(message, duration = 1500) {
    // 建立訊息元素
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: #66e7ff;
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        border: 1px solid rgba(102, 231, 255, 0.3);
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        transition: opacity 0.3s ease;
        pointer-events: none;
    `;
    
    // 找到地圖容器並添加到其中
    const mapContainer = document.querySelector('.map-container');
    if (mapContainer) {
        // 確保地圖容器有相對定位
        if (getComputedStyle(mapContainer).position === 'static') {
            mapContainer.style.position = 'relative';
        }
        mapContainer.appendChild(messageElement);
    } else {
        // 如果找不到地圖容器，則使用 body
        document.body.appendChild(messageElement);
    }
    
    // 延遲移除
    setTimeout(() => {
        messageElement.style.opacity = '0';
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 300);
    }, duration - 300);
}
// 船舶圖片測試資料庫
const shipPictureDatabase = [
    {
        id: 'SHIP-001',
        name: '漁船阿勇號',
        type: '漁船',
        mmsi: '416123456',
        image: './test-database-ship-picture/R.jpg',
        description: '台灣籍漁船，從事近海漁業作業'
    },
    {
        id: 'SHIP-002', 
        name: '貨輪海天號',
        type: '貨輪',
        mmsi: '416234567',
        image: './test-database-ship-picture/EYNKapcXsAA11xH.jpg',
        description: '國際貨運船舶，載運集裝箱'
    },
    {
        id: 'SHIP-003',
        name: '巡邏艇守護者',
        type: '巡邏艇',
        mmsi: '416345678',
        image: './test-database-ship-picture/nordkapp-class-opv-ramsund-2019.jpg',
        description: '海巡署巡邏船，執行海域巡護任務'
    },
    {
        id: 'SHIP-004',
        name: '研究船探索號',
        type: '研究船',
        mmsi: '416456789',
        image: './test-database-ship-picture/batral-brest-2018.jpg',
        description: '海洋研究船，進行科學調查'
    },
    {
        id: 'SHIP-005',
        name: '油輪星光號',
        type: '油輪',
        mmsi: '416567890',
        image: './test-database-ship-picture/castle-class-corvette-chattogram-2017.jpg',
        description: '石油運輸船，載運原油或成品油'
    }
];

// 顯示船舶圖片
function showShipPicture() {
    // 選擇特定船舶 (選擇第一艘 - 漁船阿勇號)
    const selectedShip = shipPictureDatabase[0];
    
    // 創建船舶圖片覆蓋層
    const shipOverlay = document.createElement('div');
    shipOverlay.id = 'shipPictureOverlay';
    shipOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    // 創建船舶圖片容器
    const shipContainer = document.createElement('div');
    shipContainer.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 20px;
        max-width: 500px;
        max-height: 90%;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        transform: scale(0.8);
        transition: transform 0.3s ease;
    `;
    
    // 創建標題
    const title = document.createElement('h3');
    title.textContent = '🚢 目標船舶影像';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #1e40af;
        font-size: 18px;
    `;
    
    // 創建船舶圖片
    const shipImage = document.createElement('img');
    shipImage.src = selectedShip.image;
    shipImage.alt = selectedShip.name;
    shipImage.style.cssText = `
        width: 100%;
        max-width: 400px;
        height: 250px;
        object-fit: cover;
        border-radius: 8px;
        margin-bottom: 15px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    // 錯誤處理 - 如果圖片載入失敗，顯示預設的船舶 SVG
    shipImage.onerror = () => {
        const fallbackContainer = document.createElement('div');
        fallbackContainer.style.cssText = `
            width: 100%;
            max-width: 400px;
            height: 250px;
            background: linear-gradient(to bottom, #87ceeb 0%, #4682b4 100%);
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 15px;
        `;
        
        fallbackContainer.innerHTML = `
            <svg width="200" height="120" viewBox="0 0 200 120" style="filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3));">
                <ellipse cx="100" cy="80" rx="90" ry="25" fill="#2d3748"/>
                <rect x="60" y="50" width="80" height="30" rx="5" fill="#4a5568"/>
                <rect x="85" y="35" width="8" height="20" fill="#e53e3e"/>
                <rect x="105" y="35" width="8" height="20" fill="#e53e3e"/>
                <circle cx="100" cy="40" r="3" fill="#38b2ac"/>
                <path d="M 10 80 Q 30 60 50 75 L 50 85 Q 30 100 10 80" fill="#1a202c"/>
                <path d="M 0 90 Q 50 85 100 90 T 200 90 L 200 120 L 0 120 Z" fill="rgba(255,255,255,0.2)"/>
            </svg>
        `;
        
        shipImage.parentNode.replaceChild(fallbackContainer, shipImage);
    };
    
    // 創建資訊文字
    const infoText = document.createElement('p');
    infoText.innerHTML = `
        <strong>船舶識別:</strong> ${selectedShip.mmsi}<br>
        <strong>船舶名稱:</strong> ${selectedShip.name}<br>
        <strong>船舶類型:</strong> ${selectedShip.type}<br>
        <strong>拍攝時間:</strong> ${new Date().toLocaleString('zh-TW')}<br>
        <strong>拍攝來源:</strong> 衛星/無人機<br>
        <strong>描述:</strong> ${selectedShip.description}
    `;
    infoText.style.cssText = `
        color: #4a5568;
        font-size: 14px;
        line-height: 1.6;
        margin: 15px 0;
        text-align: left;
        background: #f7fafc;
        padding: 12px;
        border-radius: 6px;
        border-left: 4px solid #3182ce;
    `;
    
    // 創建關閉按鈕
    const closeButton = document.createElement('button');
    closeButton.textContent = '關閉';
    closeButton.style.cssText = `
        background: #3182ce;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background 0.2s ease;
        margin-top: 15px;
    `;
    
    closeButton.onmouseover = () => closeButton.style.background = '#2c5282';
    closeButton.onmouseout = () => closeButton.style.background = '#3182ce';
    
    closeButton.onclick = () => {
        shipOverlay.style.opacity = '0';
        shipContainer.style.transform = 'scale(0.8)';
        setTimeout(() => {
            if (shipOverlay.parentNode) {
                shipOverlay.parentNode.removeChild(shipOverlay);
            }
        }, 300);
    };
    
    // 組裝元素
    shipContainer.appendChild(title);
    shipContainer.appendChild(shipImage);
    shipContainer.appendChild(infoText);
    shipContainer.appendChild(closeButton);
    shipOverlay.appendChild(shipContainer);
    
    // 添加到頁面
    document.body.appendChild(shipOverlay);
    
    // 動畫顯示
    setTimeout(() => {
        shipOverlay.style.opacity = '1';
        shipContainer.style.transform = 'scale(1)';
    }, 50);
    
    // 點擊背景關閉
    shipOverlay.onclick = (e) => {
        if (e.target === shipOverlay) {
            closeButton.click();
        }
    };
    
    console.log(`🚢 船舶圖片已顯示: ${selectedShip.name} (${selectedShip.type})`);
}

// AIS狀態一致性管理函數
function ensureAISStatusConsistency(eventData) {
    if (!eventData || eventData.type !== 'rf') {
        return eventData;
    }
    
    // 如果已經有AIS狀態，不改變
    if (eventData.aisStatus) {
        console.log(`🔵 事件 ${eventData.id || 'RF事件'} 已有AIS狀態: ${eventData.aisStatus}`);
        return eventData;
    }
    
    // 嘗試從sourceSeaDot推導AIS狀態
    if (eventData.sourceSeaDot) {
        const borderColor = eventData.sourceSeaDot.borderColor;
        if (borderColor === '#ef4444' || borderColor === 'red') {
            eventData.aisStatus = '未開啟';
        } else if (borderColor === '#059669' || borderColor === 'green') {
            eventData.aisStatus = '已開啟';
        } else {
            eventData.aisStatus = '未知';
        }
        console.log(`🔵 從sourceSeaDot推導事件 ${eventData.id || 'RF事件'} AIS狀態: ${eventData.aisStatus}`);
    } else {
        // 如果沒有sourceSeaDot，嘗試從seaDotManager查找
        if (eventData.rfId && typeof window.seaDotManager !== 'undefined') {
            const dot = window.seaDotManager.getDotByRFId(eventData.rfId);
            if (dot) {
                if (dot.borderColor === '#ef4444' || dot.borderColor === 'red') {
                    eventData.aisStatus = '未開啟';
                } else if (dot.borderColor === '#059669' || dot.borderColor === 'green') {
                    eventData.aisStatus = '已開啟';
                } else {
                    eventData.aisStatus = '未知';
                }
                // 同時補充sourceSeaDot資訊
                eventData.sourceSeaDot = {
                    id: dot.id,
                    status: dot.status,
                    borderColor: dot.borderColor,
                    area: dot.area,
                    lat: dot.lat,
                    lon: dot.lon
                };
                console.log(`🔵 從seaDotManager推導事件 ${eventData.id || 'RF事件'} AIS狀態: ${eventData.aisStatus}`);
            } else {
                eventData.aisStatus = '未知';
                console.log(`🔵 無法找到對應的seaDot，設定事件 ${eventData.id || 'RF事件'} AIS狀態: ${eventData.aisStatus}`);
            }
        } else {
            eventData.aisStatus = '未知';
            console.log(`🔵 缺少必要資訊，設定事件 ${eventData.id || 'RF事件'} AIS狀態: ${eventData.aisStatus}`);
        }
    }
    
    // 保存更新到eventStorage
    if (eventData.id && eventStorage) {
        eventStorage.updateEvent(eventData.id, { 
            aisStatus: eventData.aisStatus,
            sourceSeaDot: eventData.sourceSeaDot 
        });
    }
    
    return eventData;
}
