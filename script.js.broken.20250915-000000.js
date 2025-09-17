let currentEventId = 'area-001';
let selectedEventType = null;
let selectedAction = null;
let eventCounter = 4;
let missionCounter = 3;
let creatingEventIds = new Set(); // 追蹤正在創建中的事件ID

// 时间轴模式管理
let timelineMode = 'global'; // 'global' 或 'vessel'
let currentTrackingVessel = null; // 当前追踪的船只

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

// 統一的任務-軌跡點數據管理器
class MissionTrackPointManager {
    constructor() {
        this.missions = new Map();           // 派遣任務
        this.trackPoints = new Map();        // 軌跡點
        this.missionTrackLinks = new Map();  // 任務與軌跡點的關聯
        this.initializeDefaultData();
    }

    // 創建或更新派遣任務
    createMission(missionData) {
        const missionId = missionData.missionId || `MISSION-${++missionCounter}`;
        const mission = {
            ...missionData,
            missionId: missionId,
            timestamp: missionData.timestamp || new Date().toISOString(),
            linkedTrackPoints: []
        };

        this.missions.set(missionId, mission);
        console.log('Mission created in manager:', mission);

        // 自動關聯相近時間的軌跡點
        this.autoLinkTrackPoints(missionId);

        return missionId;
    }

    // 創建或更新軌跡點
    createTrackPoint(pointData) {
        const pointId = pointData.pointId || `TRACK-${Date.now()}-${Math.random().toString(16).substr(2, 6)}`;
        const trackPoint = {
            ...pointData,
            pointId: pointId,
            linkedMissions: []
        };

        this.trackPoints.set(pointId, trackPoint);

        // 自動關聯相近時間的派遣任務
        this.autoLinkMissions(pointId);

        return pointId;
    }

    // 自動關聯軌跡點到任務 (基於時間和位置)
    autoLinkTrackPoints(missionId) {
        const mission = this.missions.get(missionId);
        if (!mission) return;

        const missionTime = new Date(mission.timestamp);
        let linkedCount = 0;

        this.trackPoints.forEach((point, pointId) => {
            const pointTime = new Date(point.timestamp);
            const timeDiff = Math.abs(pointTime - missionTime);

            // 動態時間窗口：根據任務類型調整
            let timeWindow;
            if (mission.action === 'track') {
                timeWindow = 4 * 60 * 60 * 1000; // 持續追蹤：4小時窗口
            } else if (mission.action === 'uav' || mission.action === 'satellite') {
                timeWindow = 1 * 60 * 60 * 1000; // UAV/衛星：1小時窗口
            } else {
                timeWindow = 2 * 60 * 60 * 1000; // 默認：2小時窗口
            }

            // 時間窗口內 + 船舶ID匹配
            const vesselIdMatch = mission.targetVesselId === point.vesselId ||
                                mission.targetVesselId === 'all' ||
                                mission.targetInfo.includes(point.vesselId);

            if (timeDiff <= timeWindow && vesselIdMatch) {

                // 雙向關聯
                if (!mission.linkedTrackPoints.includes(pointId)) {
                    mission.linkedTrackPoints.push(pointId);
                }
                if (!point.linkedMissions.includes(missionId)) {
                    point.linkedMissions.push(missionId);
                }

                // 計算關聯強度分數
                const timeScore = Math.max(0, 1 - (timeDiff / timeWindow)); // 時間越近分數越高
                const taskTypeScore = point.hasTask ? 0.3 : 0; // 有任務的軌跡點分數更高
                const typeScore = point.type === 'Future' && mission.isScheduled ? 0.5 :
                                point.type === 'Current' ? 0.8 : 0.2;

                const linkScore = (timeScore * 0.5) + taskTypeScore + (typeScore * 0.2);

                // 建立關聯記錄
                this.missionTrackLinks.set(`${missionId}-${pointId}`, {
                    missionId: missionId,
                    pointId: pointId,
                    linkTime: new Date().toISOString(),
                    linkReason: 'auto_time_vessel',
                    timeDifference: timeDiff,
                    linkScore: linkScore,
                    timeWindow: timeWindow
                });

                linkedCount++;
            }
        });

        console.log(`Mission ${missionId} linked to ${linkedCount} track points`);
        return linkedCount;
    }

    // 自動關聯派遣任務到軌跡點
    autoLinkMissions(pointId) {
        const point = this.trackPoints.get(pointId);
        if (!point) return;

        const pointTime = new Date(point.timestamp);
        let linkedCount = 0;

        this.missions.forEach((mission, missionId) => {
            const missionTime = new Date(mission.timestamp);
            const timeDiff = Math.abs(pointTime - missionTime);

            // 動態時間窗口：根據任務類型調整
            let timeWindow;
            if (mission.action === 'track') {
                timeWindow = 4 * 60 * 60 * 1000; // 持續追蹤：4小時窗口
            } else if (mission.action === 'uav' || mission.action === 'satellite') {
                timeWindow = 1 * 60 * 60 * 1000; // UAV/衛星：1小時窗口
            } else {
                timeWindow = 2 * 60 * 60 * 1000; // 默認：2小時窗口
            }

            // 時間窗口內 + 船舶ID匹配
            const vesselIdMatch = mission.targetVesselId === point.vesselId ||
                                mission.targetVesselId === 'all' ||
                                (mission.targetInfo && mission.targetInfo.includes(point.vesselId));

            if (timeDiff <= timeWindow && vesselIdMatch) {

                // 雙向關聯
                if (!point.linkedMissions.includes(missionId)) {
                    point.linkedMissions.push(missionId);
                }
                if (!mission.linkedTrackPoints.includes(pointId)) {
                    mission.linkedTrackPoints.push(pointId);
                }

                // 計算關聯強度分數
                const timeScore = Math.max(0, 1 - (timeDiff / timeWindow)); // 時間越近分數越高
                const taskTypeScore = point.hasTask ? 0.3 : 0; // 有任務的軌跡點分數更高
                const typeScore = point.type === 'Future' && mission.isScheduled ? 0.5 :
                                point.type === 'Current' ? 0.8 : 0.2;

                const linkScore = (timeScore * 0.5) + taskTypeScore + (typeScore * 0.2);

                // 建立或更新關聯記錄
                const linkKey = `${missionId}-${pointId}`;
                if (!this.missionTrackLinks.has(linkKey)) {
                    this.missionTrackLinks.set(linkKey, {
                        missionId: missionId,
                        pointId: pointId,
                        linkTime: new Date().toISOString(),
                        linkReason: 'auto_time_vessel',
                        timeDifference: timeDiff,
                        linkScore: linkScore,
                        timeWindow: timeWindow
                    });
                }

                linkedCount++;
            }
        });

        console.log(`Track point ${pointId} linked to ${linkedCount} missions`);
        return linkedCount;
    }

    // 獲取任務相關的軌跡點
    getLinkedTrackPoints(missionId) {
        const mission = this.missions.get(missionId);
        if (!mission) return [];

        return mission.linkedTrackPoints.map(pointId => this.trackPoints.get(pointId)).filter(Boolean);
    }

    // 獲取軌跡點相關的任務
    getLinkedMissions(pointId) {
        const point = this.trackPoints.get(pointId);
        if (!point) return [];

        return point.linkedMissions.map(missionId => this.missions.get(missionId)).filter(Boolean);
    }

    initializeDefaultData() {
        // 預設數據初始化邏輯
        console.log('MissionTrackPointManager initialized');
    }
}

// 全域任務軌跡點管理器實例
const missionTrackManager = new MissionTrackPointManager();

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
            aoiName: '台灣附近海域',
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
            trackPoints: this.generateSimulatedTrackPoints('cargo')
        });

        this.events.set('vessel-004', {
            id: 'vessel-004',
            type: 'vessel',
            mmsi: '416789012',
            coordinates: '等待初始化...', // 將通過 reinitializeVesselEvents 設定
            vesselName: '漁船阿勇號',
            riskScore: 28,
            createTime: '10:15',
            status: 'completed',
            investigationReason: '定期巡查',
            completedTime: '12:45',
            trackPoints: this.generateSimulatedTrackPoints('fishing')
        });
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
            
            // 根據 sea dot 的 dotColor 決定 AIS 狀態
            let aisStatus = '未知';
            if (randomDot.dotColor === '#ef4444' || randomDot.dotColor === 'red') {
                aisStatus = '未開啟';
            } else if (randomDot.dotColor === '#059669' || randomDot.dotColor === 'green') {
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
                    dotColor: randomDot.dotColor,
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
            
            // 根據 sea dot 的 dotColor 決定 AIS 狀態
            let aisStatus = '未知';
            if (randomDot.dotColor === '#ef4444' || randomDot.dotColor === 'red') {
                aisStatus = '未開啟';
            } else if (randomDot.dotColor === '#059669' || randomDot.dotColor === 'green') {
                aisStatus = '已開啟';
            }

            // 根據 sea dot 的 dotColor 決定船舶的風險評估和狀態
            let riskScore = existingVesselEvent.riskScore || 85;
            let investigationReason = existingVesselEvent.investigationReason || 'AIS 異常關閉，偏離正常航道';

            // 根據 sea dot 狀態調整風險分數和調查原因
n