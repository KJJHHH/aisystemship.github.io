// 動態載入管理器類別
let AreaEventManager, /* RFEventManager, */ VesselEventManager;

AreaEventManager = window.AreaEventManager;
// RFEventManager = window.RFEventManager; // 暫時停用 RF 監控事件功能
VesselEventManager = window.VesselEventManager;

// 全域變數
let currentEventId = 'area-001'; // 預設選中 area-001 事件
let previousEventId = null; // 追蹤上一個選中的事件，用於避免重複處理
let selectedEventType = null;
let selectedAction = null;
window.eventCounter = 4;
let creatingEventIds = new Set(); // 追蹤正在創建中的事件ID

// 时间轴模式管理
let timelineMode = 'global'; // 'global' 或 'vessel'
let currentTrackingVessel = null; // 当前追踪的船只

// 用於存儲調查範圍圖層的全域變數
let investigationRangeLayer = null;

// 台灣地圖
let taiwanMap = null;

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

// 取用全域任務軌跡點管理器實例
const missionTrackManager = window.missionTrackManager;

// 取用全域事件資料儲存實例
const eventStorage = window.eventStorage;

// 取用全域歷史軌跡管理器實例
const historyTrackManager = window.historyTrackManager;

// -----------

// 顯示新增事件彈窗(index.html)
function showNewEventModal() {
    document.getElementById('newEventModal').style.display = 'flex';

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

// 選擇事件類型(index.html)
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

// -----------

// 建立事件(index.html)
function createNewEvent() {
    const eventId = `${selectedEventType.toUpperCase()}-${String(++window.eventCounter).padStart(3, '0')}`;

    // 建立事件資料結構
    let eventData = {
        type: selectedEventType,
        createTime: new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        status: 'creating'
    };

    let displayInfo = { content: '', updateData: {} };

    if (selectedEventType === 'area') {
        const aoiName = document.getElementById('aoiName').value || '未命名區域';

        // 讀取用戶輸入的中心座標和半徑
        const centerLat = parseFloat(document.getElementById('centerLat').value);
        const centerLon = parseFloat(document.getElementById('centerLon').value);
        const centerLatDirection = document.getElementById('centerLatDirection').value;
        const centerLonDirection = document.getElementById('centerLonDirection').value;
        const radius = parseFloat(document.getElementById('radius').value);
        const radiusUnit = document.getElementById('radiusUnit').value;

        let centerCoordinates, monitorRange;

        // 檢查是否有完整的座標和半徑輸入
        if (!isNaN(centerLat) && !isNaN(centerLon) && !isNaN(radius)) {
            // 驗證輸入值的合理性
            if (centerLat < 0 || centerLat > 90) {
                alert('緯度值必須在0-90之間');
                return;
            }
            if (centerLon < 0 || centerLon > 180) {
                alert('經度值必須在0-180之間');
                return;
            }
            if (radius <= 0) {
                alert('半徑必須大於0');
                return;
            }

            // 轉換為標準格式
            centerCoordinates = `${centerLat.toFixed(3)}°${centerLatDirection}, ${centerLon.toFixed(3)}°${centerLonDirection}`;
            
            // 將半徑轉換為公里（如果是海里的話）
            const radiusInKm = radiusUnit === 'nm' ? radius * 1.852 : radius;
            monitorRange = `半徑 ${radius} ${radiusUnit === 'km' ? '公里' : '海里'}`;
            
        } else if (document.getElementById('centerLat').value || document.getElementById('centerLon').value || 
                   document.getElementById('radius').value) {
            // 有部分輸入但不完整
            alert('請填寫完整的中心座標（緯度、經度）和監控半徑');
            return;
        } else {
            alert('請填寫完整的中心座標（緯度、經度）和監控半徑');
            return;
        }

        const monitorHours = document.getElementById('monitorHours').value || '24';

        // 計算監控時間範圍
        const monitorTimeRange = calculateMonitorTimeRange(eventData.createTime, monitorHours);

        eventData = {
            ...eventData,
            aoiName: aoiName,
            centerCoordinates: centerCoordinates,
            centerLat: centerLat,
            centerLon: centerLon,
            centerLatDirection: centerLatDirection,
            centerLonDirection: centerLonDirection,
            radius: radius,
            radiusUnit: radiusUnit,
            radiusInKm: radiusUnit === 'nm' ? radius * 1.852 : radius,
            monitorRange: monitorRange,
            monitorHours: monitorHours,
            monitorTimeRange: monitorTimeRange,
        };

        displayInfo.content = `監控區域: ${aoiName}<br>中心座標: ${centerCoordinates}<br>監控範圍: ${monitorRange}<br>監控時間: ${monitorTimeRange}`;
    
    // ========== 暫時停用 RF 監控事件功能 ==========
    /*
    } else if (selectedEventType === 'rf') {
        const userRfId = document.getElementById('rfId').value;
        const rfNotes = document.getElementById('rfNotes').value || '';
        const detectionTime = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });

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

            // 根據 sea dot 的狀態決定 AIS 狀態（直接使用 status 屬性，不依賴顏色）
            const targetDotColor = (typeof getDotColor === 'function') ? getDotColor(targetDot) : (targetDot.dotColor || null);
            if (targetDot.status === 'No AIS') {
                aisStatus = '未開啟';
            } else if (targetDot.status === 'AIS') {
                aisStatus = '已開啟';
            } else {
                aisStatus = '未知';
            }

            sourceSeaDot = {
                id: getSafePointId(targetDot),
                status: targetDot.status,
                dotColor: targetDotColor || getDotColor(targetDot),
                area: targetDot.area,
                lat: targetDot.lat,
                lon: targetDot.lon,
                display: {
                    dotColor: targetDotColor || getDotColor(targetDot),
                    backgroundColor: (typeof getBackgroundColor === 'function') ? getBackgroundColor(targetDot) : (targetDot.backgroundColor || targetDotColor || getDotColor(targetDot))
                }
            };

            if (userRfId && targetDot.rfId === userRfId) {
                console.log(`✅ RF 事件已從對應的 sea dot ${targetDot.id} 初始化，RF ID: ${rfId}`);
            } else {
                console.log(`✅ RF 事件已從 sea dot ${targetDot.id} 初始化，RF ID: ${rfId} (隨機選擇或用戶輸入)`);
            }
        } else {
            // 如果沒有 seaDotManager 或沒有 sea dots，使用原有的隨機生成方式
            rfId = userRfId || '未知信號';
            coordinates = '待檢測';
            frequency = '待檢測';
            strength = '待檢測';
            aisStatus = '未知';

            console.warn('⚠️ SeaDotManager 不可用，RF 事件使用預設值創建');
        }

        eventData = {
            ...eventData,
            rfId: rfId,
            detectionTime: detectionTime,
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

        displayInfo.content = `RF 信號 ID: ${rfId}<br>座標: ${eventData.coordinates}`;
    */
    // ========== RF 監控事件功能結束 ==========
    
    } else if (selectedEventType === 'vessel') {
        const mmsi = document.getElementById('vesselMMSI').value || '未知';
        
        // 使用 vesselDataGenerator 根據 MMSI 自動生成完整的船舶資料
        let vesselData;
        if (window.vesselDataGenerator) {
            vesselData = window.vesselDataGenerator.generateVesselDataByMMSI(mmsi);
            console.log(`✅ 已為 MMSI ${mmsi} 自動生成完整船舶資料:`, vesselData);
        } else {
            console.warn('⚠️ VesselDataGenerator 不可用，使用預設值');
            vesselData = {
                mmsi: mmsi,
                vesselName: '未知船舶',
                vesselType: '未知',
                coordinates: '未知',
                lat: null,
                lon: null,
                threatScore: 30,
                aisStatus: '未知',
                speed: 0,
                course: 0,
                trackPoints: []
            };
        }

        // 建立事件資料，整合自動生成的船舶資料
        eventData = {
            ...eventData,
            mmsi: vesselData.mmsi,
            coordinates: vesselData.coordinates,
            lat: vesselData.lat,
            lon: vesselData.lon,
            vesselName: vesselData.vesselName,
            vesselType: vesselData.vesselType,
            threatScore: vesselData.threatScore,
            aisStatus: vesselData.aisStatus,
            speed: vesselData.speed,
            course: vesselData.course,
            trackPoints: vesselData.trackPoints,
            timestamp: vesselData.timestamp
        };

        // 如果威脅分數 >= 70，自動生成警示時間
        if (vesselData.threatScore >= 70 && vesselData.alertTime) {
            eventData.alertTime = vesselData.alertTime;
        }

        displayInfo.content = `MMSI: ${mmsi}<br>座標: ${vesselData.coordinates}<br>威脅分數: ${vesselData.threatScore}`;
    }

    closeEventModal();

    // 使用統一的事件卡建立函數
    createEventCard(eventId, selectedEventType, eventData, displayInfo);
}

// 計算監控時間範圍的輔助函數（包含日期考量）
function calculateMonitorTimeRange(createTime, monitorHours) {
    if (!createTime || !monitorHours) return '未設定';

    try {
        const monitorHoursNum = parseInt(monitorHours);
        if (isNaN(monitorHoursNum) || monitorHoursNum <= 0) return '無效的監控時間';

        // 解析建立時間 (格式: HH:MM)
        const [hours, minutes] = createTime.split(':').map(Number);
        const startTime = new Date();
        startTime.setHours(hours, minutes, 0, 0);

        // 計算結束時間
        const endTime = new Date(startTime);
        endTime.setTime(startTime.getTime() + (monitorHoursNum * 60 * 60 * 1000));

        // 格式化時間的函數
        const formatDateTime = (date) => {
            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);

            const timeString = date.toLocaleTimeString('zh-TW', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            });

            // 檢查是否為今天、明天或昨天
            if (date.toDateString() === today.toDateString()) {
                return timeString; // 只顯示時間
            } else if (date.toDateString() === tomorrow.toDateString()) {
                return `明日 ${timeString}`;
            } else if (date.toDateString() === yesterday.toDateString()) {
                return `昨日 ${timeString}`;
            } else {
                // 顯示完整日期和時間
                const dateString = date.toLocaleDateString('zh-TW', {
                    month: '2-digit',
                    day: '2-digit'
                });
                return `${dateString} ${timeString}`;
            }
        };

        const startFormatted = formatDateTime(startTime);
        const endFormatted = formatDateTime(endTime);

        // 如果監控時間超過24小時，添加持續時間提示
        let durationHint = '';
        if (monitorHoursNum >= 24) {
            const days = Math.floor(monitorHoursNum / 24);
            const remainingHours = monitorHoursNum % 24;
            if (days > 0 && remainingHours > 0) {
                durationHint = ` (${days}天${remainingHours}小時)`;
            } else if (days > 0) {
                durationHint = ` (${days}天)`;
            }
        }

        return `${startFormatted} - ${endFormatted}${durationHint}`;
    } catch (error) {
        console.warn('計算監控時間範圍時發生錯誤:', error);
        return `${createTime} - (${monitorHours || '未設定'})`;
    }
}

// 關閉事件彈窗(index.html)
function closeEventModal() {
    document.getElementById('newEventModal').style.display = 'none';
}

/**
 * 建立新事件卡的統一函數（包含狀態更新模擬）
 * @param {string} eventId - 事件ID（大寫格式）
 * @param {string} eventType - 事件類型 ('area', 'rf', 'vessel')
 * @param {Object} eventData - 事件資料
 * @param {Object} displayInfo - 顯示資訊配置
 * @returns {HTMLElement} 新建立的事件卡元素
 */
function createEventCard(eventId, eventType, eventData, displayInfo) {
    const eventIdLowerCase = eventId.toLowerCase();

    // 將該事件ID添加到創建中的集合
    creatingEventIds.add(eventIdLowerCase);

    // 事件類型配置（包含狀態更新配置）
    const typeConfig = {
        'area': {
            className: 'type-area',
            displayName: '區域監控',
            initialStatus: '建立中',
            delay: 2000,
            finalStatusClass: 'status-investigating',
            finalStatusText: '調查中',
            storageStatus: 'investigating'
        },
        'rf': {
            className: 'type-rf',
            displayName: 'RF 監控',
            initialStatus: '獲取RF資訊中',
            delay: 1500,
            finalStatusClass: 'status-analyzed',
            finalStatusText: '已獲取RF資訊',
            storageStatus: 'analyzed'
        },
        'vessel': {
            className: 'type-vessel',
            displayName: '船舶追蹤',
            initialStatus: '風險分析中',
            delay: 3000,
            finalStatusClass: 'status-investigating',
            finalStatusText: '等待決策',
            storageStatus: 'investigating'
        }
    };

    const config = typeConfig[eventType];
    if (!config) {
        console.error(`不支援的事件類型: ${eventType}`);
        return null;
    }

    // 儲存事件資料
    eventStorage.saveEvent(eventIdLowerCase, eventData);

    // 建立新事件卡
    const eventsContainer = document.querySelector('.events-container');
    const newCard = document.createElement('div');
    newCard.className = 'event-card';
    newCard.setAttribute('data-event-id', eventIdLowerCase);
    newCard.onclick = () => selectEvent(newCard, eventIdLowerCase);

    newCard.innerHTML = `
        <div class="event-card-header">
            <span class="event-id">${eventId}</span>
            <span class="event-type-badge ${config.className}">${config.displayName}</span>
        </div>
        <div class="event-info">${displayInfo.content}</div>
        <div class="event-status">
            <div class="status-dot status-creating"></div>
            <span>${config.initialStatus}</span>
        </div>
    `;

    // 插入事件卡到容器頂部
    eventsContainer.insertBefore(newCard, eventsContainer.firstChild);

    // 立即設置該事件卡為禁用狀態
    setTimeout(() => {
        setEventCardDisabled(eventIdLowerCase, true);
    }, 10);

    // 模擬事件狀態更新
    setTimeout(() => {
        const statusDot = newCard.querySelector('.status-dot');
        const statusText = newCard.querySelector('.event-status span');

        if (statusDot && statusText) {
            statusDot.className = `status-dot ${config.finalStatusClass}`;
            statusText.textContent = config.finalStatusText;
        }

        // 特殊處理：船舶事件需要更新威脅分數顯示
        const updateData = displayInfo.updateData || {};
        if (eventType === 'vessel' && updateData.mmsi && updateData.coordinates && updateData.threatScore) {
            const riskInfo = newCard.querySelector('.event-info');
            if (riskInfo) {
                // 始終顯示 MMSI、座標和威脅分數
                riskInfo.innerHTML = `MMSI: ${updateData.mmsi}<br>座標: ${updateData.coordinates}<br>威脅分數: ${updateData.threatScore}`;
                console.log(`✅ 事件 ${eventId} 顯示完整資訊，威脅分數: ${updateData.threatScore}`);
            }
        }

        // 更新儲存的事件狀態
        const storageUpdateData = {
            status: config.storageStatus,
            ...updateData
        };

        eventStorage.updateEvent(eventIdLowerCase, storageUpdateData);

        // 模擬完成後，從創建中的集合移除該事件ID並恢復該事件卡功能
        creatingEventIds.delete(eventIdLowerCase);
        setEventCardDisabled(eventIdLowerCase, false);

        // 更新事件計數
        updateEventCounts();
        console.log('📊 事件計數已更新');
    }, config.delay);

    console.log(`✅ 事件卡 ${eventId} (${eventType}) 已建立完成`);
    return newCard;
}

// 事件卡選擇
function selectEvent(element, eventId) {
    // 如果該事件正在創建中，阻止選擇
    if (creatingEventIds.has(eventId)) {
        console.log(`事件 ${eventId} 正在創建中，無法選擇`);
        return;
    }

    // 檢查是否重複點擊同一個事件
    const isRepeatedClick = (previousEventId === eventId);

    // 移除其他卡片的 active 狀態
    document.querySelectorAll('.event-card').forEach(card => {
        card.classList.remove('active');
    });

    // 激活選中的卡片
    element.classList.add('active');
    
    // 更新事件 ID
    previousEventId = currentEventId;
    currentEventId = eventId;

    // 更新詳情面板
    updateDetailsPanel(eventId);

    // 根據事件類型調整地圖視圖（如果是重複點擊，傳遞標記）
    adjustMapViewForEvent(eventId, isRepeatedClick);

    // 根據事件類型控制底部面板和時間軸
    const storedEvent = eventStorage.getEvent(eventId);
    const missionSection = document.querySelector('.mission-section');
    const systemLayout = document.querySelector('.system-layout');

    if (storedEvent && storedEvent.type === 'vessel') {
        // 船舶事件：顯示底部面板和時間軸
        if (missionSection) missionSection.classList.remove('hidden');
        if (systemLayout) systemLayout.classList.remove('hide-bottom');
        switchToTrackingMode(eventId);
    } else if (storedEvent && storedEvent.type === 'area') {
        // 區域監控事件：隱藏整個底部面板
        if (missionSection) missionSection.classList.add('hidden');
        if (systemLayout) systemLayout.classList.add('hide-bottom');
        switchToGlobalMode();
    } else {
        // 其他類型事件：顯示底部面板但清空時間軸
        if (missionSection) missionSection.classList.remove('hidden');
        if (systemLayout) systemLayout.classList.remove('hide-bottom');
        switchToGlobalMode();
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
                    content: AreaEventManager.getAreaEventDetailsFromStorage(storedEvent)
                };
                break;
            
            // ========== 暫時停用 RF 監控事件功能 ==========
            /*
            case 'rf':
                data = {
                    title: `${eventIdUpper} 事件詳情`,
                    subtitle: `RF 監控事件`,
                    content: RFEventManager.getRFEventDetailsFromStorage(storedEvent)
                };
                break;
            */
            // ========== RF 監控事件功能結束 ==========
            
            case 'vessel':
                data = {
                    title: `${eventIdUpper} 事件詳情`,
                    subtitle: `船舶追蹤事件${storedEvent.status === 'completed' ? ' | 已結束' : ''}`,
                    content: VesselEventManager.getVesselEventDetailsFromStorage(storedEvent)
                };
                // 顯示船舶歷史軌跡
                if (window.historyTrackManager && storedEvent.trackPoints) {
                    console.log(`🔵 [script.js] 呼叫 displayHistoryTrack，事件ID: ${storedEvent.id}`);
                    window.historyTrackManager.displayHistoryTrack(storedEvent);
                }
                break;
        }
    }

    detailsTitle.textContent = data.title;
    detailsSubtitle.textContent = data.subtitle;
    detailsContent.innerHTML = data.content;
}

// -----------

// ========== 暫時停用 RF 監控事件功能 ==========
/*
// 從區域監控建立 RF 事件（onclick）
function createRFEventfromArea(rfId, customCoordinates = null) {
    const eventId = `RF-${String(++window.eventCounter).padStart(3, '0')}`;
    const eventIdLowerCase = eventId.toLowerCase();

    // 將該事件ID添加到創建中的集合
    creatingEventIds.add(eventIdLowerCase);

    // 獲取來源區域事件的資料
    const sourceAreaEvent = eventStorage.getEvent(currentEventId);

    // 從當前詳情面板中提取對應可疑船隻候選的數據
    let suspiciousVesselCandidateData = AreaEventManager.extractSuspiciousVesselCandidateData(rfId);

    // 如果有傳入自定義座標,優先使用；否則使用原有機制
    if (customCoordinates) {
        console.log(`📍 使用傳入的自定義座標: ${customCoordinates}`);
        suspiciousVesselCandidateData.coordinates = customCoordinates;
    } else {
        console.log(`📍 使用原有機制獲取的座標: ${suspiciousVesselCandidateData.coordinates}`);
    }

    // 嘗試從來源區域事件的 suspiciousVesselCandidatesData 中取得完整資訊
    let aisStatus = '未知';
    let sourceSeaDot = null;

    if (sourceAreaEvent && sourceAreaEvent.suspiciousVesselCandidatesData) {
        const candidateDetail = sourceAreaEvent.suspiciousVesselCandidatesData.find(data => data.rfId === rfId);
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
            const resolvedColor = (typeof getDotColor === 'function') ? getDotColor(dot) : (dot.dotColor || null);
            // 直接使用 status 屬性，不依賴顏色
            if (dot.status === 'No AIS') {
                aisStatus = '未開啟';
            } else if (dot.status === 'AIS') {
                aisStatus = '已開啟';
            }
            sourceSeaDot = {
                id: getSafePointId(dot) || dot.id,
                status: dot.status,
                dotColor: (typeof getDotColor === 'function') ? (resolvedColor || getDotColor(dot)) : (resolvedColor || dot.dotColor),
                area: dot.area,
                lat: dot.lat,
                lon: dot.lon,
                display: {
                    dotColor: (typeof getDotColor === 'function') ? (resolvedColor || getDotColor(dot)) : (resolvedColor || dot.dotColor),
                    backgroundColor: (typeof getBackgroundColor === 'function') ? (getBackgroundColor(dot) || dot.backgroundColor || resolvedColor || ((typeof getDotColor === 'function') ? getDotColor(dot) : dot.dotColor)) : (dot.backgroundColor || resolvedColor || ((typeof getDotColor === 'function') ? getDotColor(dot) : dot.dotColor))
                }
            };
        }
    }

    // 建立 RF 事件資料，確保AIS狀態一致
    let eventData = {
        type: 'rf',
        rfId: rfId,
        createTime: new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        detectionTime: new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' }),
        status: 'creating',
        frequency: suspiciousVesselCandidateData.frequency,
        strength: suspiciousVesselCandidateData.strength,
        coordinates: suspiciousVesselCandidateData.coordinates,
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

    // 準備顯示資訊
    const displayInfo = {
        content: `RF 信號 ID: ${rfId}<br>座標: ${eventData.coordinates}`
    };

    // 使用統一的事件卡建立函數
    createEventCard(eventId, 'rf', eventData, displayInfo);

    // 從來源區域事件中移除已建立的可疑船隻候選（如果存在）
    if (sourceAreaEvent && sourceAreaEvent.suspiciousVesselCandidates) {
        const updatedCandidates = sourceAreaEvent.suspiciousVesselCandidates.filter(candidate => candidate !== rfId);
        const updatedCandidatesData = sourceAreaEvent.suspiciousVesselCandidatesData.filter(data => data.rfId !== rfId);

        eventStorage.updateEvent(currentEventId, {
            suspiciousVesselCandidates: updatedCandidates,
            suspiciousVesselCandidatesData: updatedCandidatesData
        });

        // 更新區域事件的詳情面板
        setTimeout(() => {
            if (currentEventId === sourceAreaEvent.id) {
                updateDetailsPanel(currentEventId);
            }
        }, 2000);
    }

}
*/
// ========== RF 監控事件功能結束 ==========

// ========== 暫時停用 RF 監控事件功能 ==========
/*
function analyzeRF() {
    alert('🔍 深度分析 RF 信號...\n正在進行頻譜分析與模式比對');
}

function exportRFData() {
    alert('📊 匯出 RF 資料...\n信號資料已匯出為技術報告');
}
*/
// ========== RF 監控事件功能結束 ==========

// -----------

// ========== 暫時停用 RF 監控事件功能 ==========
/*
// TODO: 更新成從RF區域監控建立船舶追蹤事件
// TODO 生成船舶追蹤事件後將可疑列表中的對應船隻移除
// 從 RF 事件建立船舶追蹤 (onclick)
function createVesselEventFromRF() {
    const eventId = `VESSEL-${String(++window.eventCounter).padStart(3, '0')}`;
    const eventIdLowerCase = eventId.toLowerCase();

    // 將該事件ID添加到創建中的集合
    creatingEventIds.add(eventIdLowerCase);

    // 獲取當前 RF 事件的資料
    const currentRFEvent = eventStorage.getEvent(currentEventId);
    if (!currentRFEvent || currentRFEvent.type !== 'rf') {
        console.error('無法從非 RF 事件建立船舶追蹤');
        return;
    }

    // 從當前 RF 事件提取數據來建立船舶追蹤
    const currentTime = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const mmsi = `416${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

    let eventData = {
        id: eventId,
        type: 'vessel',
        mmsi: mmsi,
        coordinates: currentRFEvent.coordinates,
        vesselName: '未知船舶',
        threatScore: Math.floor(Math.random() * 16) + 70, // 70-85
        createTime: currentTime,
        status: 'investigating',
        investigationReason: 'RF 信號異常，疑似 AIS 關閉或偽造',
        sourceRFEvent: currentRFEvent.id,
        frequency: currentRFEvent.frequency,
        signalStrength: currentRFEvent.signalStrength,
        trackPoints: null // 稍後生成固定軌跡點
    };

    // TODO 從 RF 事件生成船舶調查事件時的軌跡點生成機制
    // 為vessel event生成固定的track points
    // try {
    //     const coords = parsePointCoordinates(currentRFEvent.coordinates);
    //     if (coords) {
    //         eventData.trackPoints = eventStorage.generateFixedTrackPoints(eventData.id, coords.lat, coords.lon);
    //         console.log(`✅ 為新建船舶事件 ${eventId} 生成了固定的軌跡點`);
    //     }
    // } catch (error) {
    //     console.warn(`⚠️ 為船舶事件 ${eventId} 生成軌跡點時發生錯誤:`, error);
    // }

    // 如果 RF 事件有來源區域事件，繼承關聯資訊
    if (currentRFEvent.sourceAreaEvent) {
        eventData.sourceAreaEvent = currentRFEvent.sourceAreaEvent;
        eventData.aoiName = currentRFEvent.aoiName;
    }

    // 儲存船舶追蹤事件資料到 eventStorage
    eventStorage.saveEvent(eventId.toLowerCase(), eventData);

    // 準備顯示資訊
    const displayInfo = {
        content: `MMSI: ${eventData.mmsi}<br>座標: ${currentRFEvent.coordinates}<br>威脅分數: 分析中`,
        updateData: {
            mmsi: eventData.mmsi,
            coordinates: eventData.coordinates,
            threatScore: eventData.threatScore
        }
    };

    // 使用統一的事件卡建立函數
    createEventCard(eventId, 'vessel', eventData, displayInfo);
    console.log(`船舶追蹤事件 ${eventId} 已從 RF 事件 ${currentRFEvent.id} 建立完成`);
}
*/
// ========== RF 監控事件功能結束 ==========

// 從區域監控建立船舶追蹤事件 (onclick)
async function createVesselEventFromArea(rfId) {
    console.log(`🚢 開始建立船舶追蹤事件，RF ID: ${rfId}`);
    
    const eventId = `VESSEL-${String(++window.eventCounter).padStart(3, '0')}`;
    const eventIdLowerCase = eventId.toLowerCase();

    // 將該事件ID添加到創建中的集合
    creatingEventIds.add(eventIdLowerCase);

    // 獲取當前區域監控事件的資料
    const currentAreaEvent = eventStorage.getEvent(currentEventId);
    if (!currentAreaEvent || currentAreaEvent.type !== 'area') {
        console.error('❌ 無法從非區域監控事件建立船舶追蹤');
        creatingEventIds.delete(eventIdLowerCase);
        return;
    }

    console.log(`📋 來源區域事件:`, currentAreaEvent);

    // 從區域事件中提取指定可疑船隻候選的數據
    let suspiciousVesselData = null;
    let vesselCandidate = null;
    
    if (currentAreaEvent.suspiciousVesselCandidatesData) {
        suspiciousVesselData = currentAreaEvent.suspiciousVesselCandidatesData.find(data => data.rfId === rfId);
        console.log(`🔍 找到的可疑船隻基礎資料:`, suspiciousVesselData);
        
        if (suspiciousVesselData) {
            // 使用已儲存的可疑船隻資訊(包含固定的 MMSI 和威脅分數)
            if (suspiciousVesselData.suspiciousVessel) {
                vesselCandidate = suspiciousVesselData.suspiciousVessel;
                console.log(`✅ 使用已儲存的可疑船隻候選資訊 (MMSI: ${vesselCandidate.vesselMmsi}, 威脅分數: ${vesselCandidate.threatScore})`);
            } else {
                console.warn(`⚠️ 未找到已儲存的可疑船隻資訊,重新生成 (MMSI: ${vesselCandidate?.vesselMmsi})`);
            }
            console.log(`🎯 最終使用的可疑船隻候選資訊:`, vesselCandidate);
        }
    }

    if (!suspiciousVesselData) {
        console.error(`❌ 無法找到 RF ID ${rfId} 對應的可疑船隻資料`);
        console.error(`📊 當前區域事件的 suspiciousVesselCandidatesData:`, currentAreaEvent.suspiciousVesselCandidatesData);
        creatingEventIds.delete(eventIdLowerCase);
        return;
    }

    // 從當前區域事件提取數據來建立船舶追蹤
    const currentTime = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // 使用可疑船隻的 MMSI 或生成新的
    const mmsi = vesselCandidate?.vesselMmsi || `416${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    
    // 使用可疑船隻的威脅分數
    const threatScore = vesselCandidate?.threatScore || Math.floor(Math.random() * 16) + 70;

    // 從 seaDotManager 獲取額外的 RF 信號資訊（如果可用）
    let seaDotInfo = null;
    if (typeof window.seaDotManager !== 'undefined') {
        seaDotInfo = window.seaDotManager.getDotByRFId(rfId);
        console.log(`🛰️ SeaDot 資訊:`, seaDotInfo);
    }

    // 直接從 sourceSeaDot 獲取原始精確座標
    if (!suspiciousVesselData.sourceSeaDot || 
        suspiciousVesselData.sourceSeaDot.lat === undefined || 
        suspiciousVesselData.sourceSeaDot.lon === undefined) {
        console.error(`❌ 缺少 sourceSeaDot 座標資訊`);
        creatingEventIds.delete(eventIdLowerCase);
        return;
    }
    
    const lat = suspiciousVesselData.sourceSeaDot.lat;
    const lon = suspiciousVesselData.sourceSeaDot.lon;
    const preciseCoordinates = `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`;
    console.log(`📍 使用原始精確座標: lat=${lat}, lon=${lon} -> ${preciseCoordinates}`);

    // 建立完整的船舶事件資料，整合所有可用資訊
    let eventData = {
        id: eventId,
        type: 'vessel',
        mmsi: mmsi,
        coordinates: preciseCoordinates,
        vesselName: vesselCandidate?.vesselType || '未知船舶',
        vesselType: vesselCandidate?.vesselType || '不明',
        threatScore: threatScore,
        createTime: currentTime,
        status: 'investigating',
        sourceAreaEvent: currentAreaEvent.id,
        aoiName: currentAreaEvent.aoiName,
        rfId: rfId,
        
        // === RF 信號資訊 ===
        frequency: suspiciousVesselData.frequency || seaDotInfo?.frequency || '檢測中',
        signalStrength: suspiciousVesselData.strength || seaDotInfo?.signalStrength || '檢測中',
        
        // 從 seaDotInfo 補充更多 RF 信號細節（如果可用）
        timestamp_utc: seaDotInfo?.timestamp_utc || new Date().toISOString(),
        latitude_deg: seaDotInfo?.lat || suspiciousVesselData.coordinates.match(/(\d+\.\d+)°N/)?.[1] || '檢測中',
        longitude_deg: seaDotInfo?.lon || suspiciousVesselData.coordinates.match(/(\d+\.\d+)°E/)?.[1] || '檢測中',
        accuracy_level: seaDotInfo?.accuracy_level || '標準',
        pulses_duration_ns: seaDotInfo?.pulses_duration_ns || Math.floor(Math.random() * 100) + 50,
        pulses_repetition_frequency_hz: seaDotInfo?.pulses_repetition_frequency_hz || Math.floor(Math.random() * 1000) + 500,
        waveform: seaDotInfo?.waveform || '正弦波',
        
        // === AIS 狀態 ===
        aisStatus: vesselCandidate?.aisStatus || suspiciousVesselData.aisStatus || '未開啟',
        
        // === 可疑船隻資訊 ===
        distance: vesselCandidate?.distance,
        threatScore: vesselCandidate?.threatScore,
        
        // 保存完整的來源資料以供追溯
        _sourceData: {
            suspiciousVesselData: suspiciousVesselData,
            vesselCandidate: vesselCandidate,
            seaDotInfo: seaDotInfo
        },
        
        trackPoints: null // 待生成
    };

    console.log(`📦 建立的船舶事件完整資料:`, eventData);

    // === 生成船舶歷史軌跡點 ===
    try {
        if (window.trackPointGenerator) {
            // 使用統一的軌跡生成器
            const vessel = {
                mmsi: vesselCandidate?.mmsi || eventData.mmsi,
                vesselType: vesselCandidate?.vesselType || eventData.vesselType || '不明',
                lat: vesselCandidate?.lat || lat,  // 使用前面定義的 lat 變數
                lon: vesselCandidate?.lon || lon   // 使用前面定義的 lon 變數
            };

            console.log(`🔧 準備生成軌跡點，vessel 資料:`, vessel);

            // 使用 mock 資料（開發模式）
            eventData.trackPoints = await window.trackPointGenerator.generateTrackPoints(vessel, {
                source: 'mock',
                eventId: eventId
            });

            console.log(`✅ 為船舶事件 ${eventId} 生成了軌跡 (${eventData.trackPoints.length} 個點)`);
        } else {
            console.warn(`⚠️ trackPointGenerator 不可用，無法生成軌跡點`);
            eventData.trackPoints = null;
        }
    } catch (error) {
        console.error(`❌ 生成軌跡點失敗:`, error);
        eventData.trackPoints = null;
    }

    // 儲存船舶追蹤事件資料到 eventStorage
    eventStorage.saveEvent(eventId.toLowerCase(), eventData);
    console.log(`💾 船舶事件已儲存到 eventStorage`);

    // 準備顯示資訊（始終顯示威脅分數）
    const displayInfo = {
        content: `MMSI: ${eventData.mmsi}<br>座標: ${eventData.coordinates}<br>威脅分數: 分析中`,
        updateData: {
            mmsi: eventData.mmsi,
            coordinates: eventData.coordinates,
            threatScore: eventData.threatScore,
            aisStatus: eventData.aisStatus
        }
    };
    
    console.log(`📋 事件卡顯示 - MMSI: ${eventData.mmsi}, 威脅分數: 分析中 → ${eventData.threatScore}`);

    // 使用統一的事件卡建立函數
    createEventCard(eventId, 'vessel', eventData, displayInfo);
    
    // 將地圖上的 RF 信號點標記為正在追蹤（黃色）
    if (window.seaDotManager && typeof window.seaDotManager.markRFSignalAsTracked === 'function') {
        const marked = window.seaDotManager.markRFSignalAsTracked(rfId);
        if (marked) {
            console.log(`🟡 已將地圖上的 RF 信號 ${rfId} 標記為正在追蹤（黃色）`);
        }
    }
    
    // 從來源區域事件中移除已建立船舶追蹤的可疑船隻候選
    if (currentAreaEvent.suspiciousVesselCandidates) {
        const updatedCandidates = currentAreaEvent.suspiciousVesselCandidates.filter(candidate => candidate !== rfId);
        const updatedCandidatesData = currentAreaEvent.suspiciousVesselCandidatesData.filter(data => data.rfId !== rfId);

        eventStorage.updateEvent(currentEventId, {
            suspiciousVesselCandidates: updatedCandidates,
            suspiciousVesselCandidatesData: updatedCandidatesData
        });

        console.log(`🗑️ 已從區域事件移除可疑船隻 ${rfId}`);

        // 更新區域事件的詳情面板
        setTimeout(() => {
            if (currentEventId === currentAreaEvent.id) {
                updateDetailsPanel(currentEventId);
                console.log(`🔄 已更新區域事件詳情面板`);
            }
        }, 2000);
    }

    console.log(`✅ 船舶追蹤事件 ${eventId} 已從區域監控事件 ${currentAreaEvent.id} 的可疑船隻 ${rfId} 建立完成`);
    console.log(`📊 事件摘要 - MMSI: ${mmsi}, 威脅分數: ${threatScore}, AIS: ${eventData.aisStatus}`);

    // 自動跳轉到新建立的船舶事件
    setTimeout(() => {
        const newEventCard = document.querySelector(`[data-event-id="${eventIdLowerCase}"]`) ||
                            Array.from(document.querySelectorAll('.event-card')).find(card =>
                                card.getAttribute('onclick')?.includes(eventIdLowerCase)
                            );

        if (newEventCard) {
            console.log(`🎯 自動跳轉到新建立的船舶事件: ${eventId}`);
            selectEvent(newEventCard, eventIdLowerCase);
        } else {
            console.warn(`⚠️ 找不到新建立的事件卡: ${eventId}`);
        }
    }, 3500); // 等待事件卡建立完成（3秒狀態更新 + 0.5秒緩衝）
}

/**
 * 從 RF 信號點直接建立船舶追蹤事件
 * @param {string} rfId - RF 信號 ID
 * @param {string} coordinates - 座標字串 (格式: "24.123°N, 121.456°E")
 */
function createVesselEventFromRFSignal(rfId, coordinates) {
    console.log(`🚢 [新功能] 從 RF 信號直接建立船舶追蹤事件`);
    console.log(`📡 RF ID: ${rfId}`);
    console.log(`📍 座標: ${coordinates}`);
    
    // 驗證 rfId
    if (!rfId || rfId === 'undefined' || rfId === 'null' || rfId.trim() === '') {
        console.error('❌ RF ID 無效:', rfId);
        alert('RF 信號 ID 無效，無法建立事件');
        return;
    }
    
    // 生成新的船舶事件 ID
    const eventId = `VESSEL-${String(++window.eventCounter).padStart(3, '0')}`;
    const eventIdLowerCase = eventId.toLowerCase();
    
    // 將該事件ID添加到創建中的集合
    creatingEventIds.add(eventIdLowerCase);
    
    // 解析座標
    const coordMatch = coordinates.match(/([\d.]+)°N,\s*([\d.]+)°E/);
    if (!coordMatch) {
        console.error('❌ 無法解析座標格式');
        creatingEventIds.delete(eventIdLowerCase);
        alert('座標格式錯誤，無法建立事件');
        return;
    }
    
    const lat = parseFloat(coordMatch[1]);
    const lon = parseFloat(coordMatch[2]);
    
    // 從 seaDotManager 獲取 RF 信號詳細資訊
    let seaDotInfo = null;
    let aisStatus = '未開啟'; // 預設值
    
    if (typeof window.seaDotManager !== 'undefined') {
        seaDotInfo = window.seaDotManager.getDotByRFId(rfId);
        console.log(`🛰️ SeaDot 資訊:`, seaDotInfo);
        
        // 從多個可能的來源提取 AIS 狀態
        if (seaDotInfo) {
            // 優先順序：display.status > trackPointData.status > status > 從其他屬性推斷
            const displayStatus = seaDotInfo.display?.status;
            const trackPointStatus = seaDotInfo.trackPointData?.status;
            const directStatus = seaDotInfo.status;
            
            const rawStatus = displayStatus || trackPointStatus || directStatus;
            
            console.log(`🔍 [AIS 狀態偵測] 原始狀態值:`, {
                displayStatus,
                trackPointStatus,
                directStatus,
                rawStatus
            });
            
            if (rawStatus) {
                // 更完整的狀態映射邏輯
                const normalizedStatus = String(rawStatus).toLowerCase();
                
                if (normalizedStatus === 'no ais' || normalizedStatus === '未開啟') {
                    aisStatus = '未開啟';
                } else if (normalizedStatus === 'ais' || normalizedStatus === '已開啟') {
                    aisStatus = '已開啟';
                } else if (normalizedStatus === 'unknown' || normalizedStatus === '未知') {
                    aisStatus = '未知';
                } else {
                    // 對於其他未知狀態，嘗試判斷
                    console.warn(`⚠️ 未知的 AIS 狀態: "${rawStatus}"，使用預設值`);
                    aisStatus = '未開啟';
                }
                
                console.log(`📡 AIS 狀態來自 SeaDot.${displayStatus ? 'display.status' : trackPointStatus ? 'trackPointData.status' : 'status'}: "${rawStatus}" → "${aisStatus}"`);
            } else {
                // 如果沒有 status，嘗試從其他屬性推斷
                console.log(`⚠️ SeaDot 沒有明確的 status 屬性，使用預設值: ${aisStatus}`);
            }
            
            // 同步更新 seaDotInfo 的 status（確保一致性）
            if (!seaDotInfo.status && aisStatus) {
                const mappedStatus = aisStatus === '已開啟' ? 'AIS' : aisStatus === '未開啟' ? 'No AIS' : 'unknown';
                seaDotInfo.status = mappedStatus;
                console.log(`✅ 已將 SeaDot 的 status 設定為: ${mappedStatus}`);
            }
        } else {
            console.log(`⚠️ 找不到 RF ID ${rfId} 對應的 SeaDot，使用預設 AIS 狀態: ${aisStatus}`);
        }
    } else {
        console.log(`⚠️ SeaDotManager 不可用，使用預設 AIS 狀態: ${aisStatus}`);
    }
    
    // === 模擬生成船舶身份資訊 ===
    const vesselTypes = ['貨輪', '漁船'];
    const vesselType = vesselTypes[Math.floor(Math.random() * vesselTypes.length)];
    
    // 生成 MMSI (Maritime Mobile Service Identity)
    // 台灣船舶 MMSI 以 416 開頭
    const mmsi = `416${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
    
    // 生成威脅分數 (70-85 為可疑範圍)
    const threatScore = Math.floor(Math.random() * 16) + 70;
    
    // 注意：aisStatus 已在上方從 seaDotInfo 提取並設定，此處直接使用
    console.log(`📡 最終使用的 AIS 狀態: ${aisStatus}${seaDotInfo ? ' (來自 SeaDot)' : ' (預設值)'}`);
    
    // 模擬船舶名稱
    const vesselNamePrefix = ['海洋', '太平洋', '東海', '福爾摩沙', '台灣'];
    const vesselNameSuffix = ['號', '輪', '星號', '之星'];
    const vesselName = `${vesselNamePrefix[Math.floor(Math.random() * vesselNamePrefix.length)]}${vesselNameSuffix[Math.floor(Math.random() * vesselNameSuffix.length)]}`;
    
    // 取得當前時間
    const currentTime = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
    
    // 建立完整的船舶事件資料
    const eventData = {
        id: eventId,
        type: 'vessel',
        mmsi: mmsi,
        coordinates: coordinates,
        vesselName: vesselName,
        vesselType: vesselType,
        threatScore: threatScore,
        createTime: currentTime,
        status: 'investigating',
        investigationReason: ``,
        sourceAreaEvent: null, // 直接從 RF 信號建立，無來源區域事件
        aoiName: null,
        rfId: rfId,
        
        // === RF 信號資訊 ===
        frequency: seaDotInfo?.frequency || `${(400 + Math.random() * 100).toFixed(2)} MHz`,
        signalStrength: seaDotInfo?.signalStrength || `${(-80 + Math.random() * 20).toFixed(1)} dBm`,
        timestamp_utc: seaDotInfo?.timestamp_utc || new Date().toISOString(),
        latitude_deg: seaDotInfo?.lat || lat,
        longitude_deg: seaDotInfo?.lon || lon,
        accuracy_level: seaDotInfo?.accuracy_level || '標準',
        pulses_duration_ns: seaDotInfo?.pulses_duration_ns || Math.floor(Math.random() * 100) + 50,
        pulses_repetition_frequency_hz: seaDotInfo?.pulses_repetition_frequency_hz || Math.floor(Math.random() * 1000) + 500,
        waveform: seaDotInfo?.waveform || '正弦波',
        
        // === AIS 狀態 ===
        aisStatus: aisStatus,
        
        // === 模擬船舶資訊 ===
        distance: `${(Math.random() * 50 + 10).toFixed(1)} km`, // 10-60 km
        
        // 保存完整的來源資料以供追溯
        _sourceData: {
            rfSignalDirect: true,
            seaDotInfo: seaDotInfo,
            generatedVesselInfo: {
                vesselName: vesselName,
                vesselType: vesselType,
                mmsi: mmsi,
                threatScore: threatScore,
                aisStatus: aisStatus
            }
        },
        
        trackPoints: null // 稍後可生成軌跡點
    };
    
    console.log(`📦 建立的船舶事件完整資料:`, eventData);
    
    // 儲存船舶追蹤事件資料到 eventStorage
    eventStorage.saveEvent(eventId.toLowerCase(), eventData);
    console.log(`💾 船舶事件已儲存到 eventStorage`);
    
    // 準備顯示資訊（始終顯示威脅分數）
    const displayInfo = {
        content: `MMSI: ${eventData.mmsi}<br>座標: ${eventData.coordinates}<br>威脅分數: ${eventData.threatScore}`,
        updateData: {
            mmsi: eventData.mmsi,
            coordinates: eventData.coordinates,
            threatScore: eventData.threatScore,
            aisStatus: aisStatus
        }
    };
    
    console.log(`📋 事件卡顯示 - MMSI: ${eventData.mmsi}, 座標: ${eventData.coordinates}, 威脅分數: ${eventData.threatScore}`);
    
    // 使用統一的事件卡建立函數
    createEventCard(eventId, 'vessel', eventData, displayInfo);
    
    // 將地圖上的 RF 信號點標記為正在追蹤（黃色）
    if (window.seaDotManager && typeof window.seaDotManager.markRFSignalAsTracked === 'function') {
        const marked = window.seaDotManager.markRFSignalAsTracked(rfId);
        if (marked) {
            console.log(`🟡 已將地圖上的 RF 信號 ${rfId} 標記為正在追蹤（黃色）`);
        }
    }
    
    // 關閉所有打開的彈窗
    if (taiwanMap) {
        taiwanMap.closePopup();
        console.log(`✅ 已關閉 RF 信號點彈窗`);
    }
    
    // 更新該 RF 信號點的彈窗內容（移除建立按鈕）
    if (window.seaDotManager && typeof window.seaDotManager.updateRFSignalPopup === 'function') {
        window.seaDotManager.updateRFSignalPopup(rfId);
        console.log(`✅ 已更新 RF 信號 ${rfId} 的彈窗內容`);
    }
        
    console.log(`✅ 船舶追蹤事件 ${eventId} 已從 RF 信號 ${rfId} 建立完成`);
    console.log(`📊 事件摘要 - MMSI: ${mmsi}, 船名: ${vesselName}, 威脅分數: ${threatScore}, AIS: ${aisStatus}`);
    
    // 移除創建中標記
    creatingEventIds.delete(eventIdLowerCase);
}

// -----------

// 全域橋樑函數：跳轉到歷史軌跡點 (onclick)
function jumpToHistoryPoint(hoursBack) {
    console.log(`🔵 [script.js] jumpToHistoryPoint 被呼叫, hoursBack: ${hoursBack}`);

    // 檢查 VesselEventManager 是否存在
    if (typeof VesselEventManager === 'undefined') {
        console.error('❌ VesselEventManager 未定義');
        return;
    }

    // 使用重構後的 VesselEventManager 類別方法
    VesselEventManager.jumpToHistoryPoint(hoursBack);
}

// 選擇行動 -> Confirm Button (onclick)
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

// 切換時間選擇器顯示(onchange)
function toggleTimeSelector() {
    const scheduledPicker = document.getElementById('scheduledTimePicker');
    const scheduledRadio = document.querySelector('input[name="executeTime"][value="scheduled"]');

    if (scheduledRadio && scheduledRadio.checked) {
        scheduledPicker.style.display = 'block';
        // 設置默認時間為 3 小時後（符合最小時間粒度要求）
        const defaultTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
        document.getElementById('scheduledDateTime').value = defaultTime.toISOString().slice(0, 16);
    } else {
        scheduledPicker.style.display = 'none';
    }
}

// 拒絕行動 (onclick)
function rejectAction() {
    return 'reject';
}

// 結束船舶事件
function completeVesselEvent(eventId) {
    console.log(`📋 開始結束事件: ${eventId}`);

    const eventData = window.eventStorage.getEvent(eventId);

    if (!eventData) {
        console.error(`❌ 找不到事件: ${eventId}`);
        alert('找不到該事件');
        return;
    }

    if (eventData.status === 'completed') {
        alert('該事件已經結束');
        return;
    }

    // 顯示確認對話框
    const confirmClose = confirm(`確定要結束事件 ${eventId.toUpperCase()} 嗎？\n\n結束後將無法繼續追蹤此船舶。`);

    if (!confirmClose) {
        console.log('❌ 用戶取消結束事件');
        return;
    }

    // 更新事件狀態
    const completedTime = new Date().toISOString();
    window.eventStorage.updateEvent(eventId, {
        status: 'completed',
        completedTime: completedTime
    });

    // 更新事件卡樣式
    const eventCard = document.querySelector(`[data-event-id="${eventId}"]`) ||
                      Array.from(document.querySelectorAll('.event-card')).find(card =>
                          card.getAttribute('onclick')?.includes(eventId)
                      );

    if (eventCard) {
        eventCard.classList.add('completed');

        const statusDot = eventCard.querySelector('.status-dot');
        const statusText = eventCard.querySelector('.event-status span');

        if (statusDot) statusDot.className = 'status-dot status-completed';
        if (statusText) statusText.textContent = '已結束';
    }

    // 清除地圖上的歷史軌跡
    if (window.historyTrackManager) {
        window.historyTrackManager.clearHistoryTrack();
    }

    // 更新詳情面板顯示已結束狀態
    updateDetailsPanel(eventId);

    // 更新 Tab 計數
    updateEventCounts();

    // 顯示成功訊息
    const completedTimeStr = new Date(completedTime).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    alert(`✅ 事件 ${eventId.toUpperCase()} 已成功結束\n\n結束時間: ${completedTimeStr}`);

    console.log(`✅ 事件 ${eventId} 已標記為完成，完成時間: ${completedTimeStr}`);
}

// Tab 切換功能
function switchEventTab(tab) {
    console.log(`🔄 切換到 ${tab} Tab`);

    // 更新 Tab 按鈕狀態
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // 過濾事件顯示
    filterEventsByStatus(tab);

    // 更新容器的 data-view 屬性
    const eventsContainer = document.querySelector('.events-container');
    if (eventsContainer) {
        eventsContainer.dataset.view = tab;
    }
}

// 過濾事件顯示
function filterEventsByStatus(tab) {
    const eventsContainer = document.querySelector('.events-container');
    const allCards = eventsContainer.querySelectorAll('.event-card');

    allCards.forEach(card => {
        const eventId = card.dataset.eventId ||
                       card.getAttribute('onclick')?.match(/'([^']+)'/)?.[1];

        if (!eventId) {
            card.style.display = 'block';
            return;
        }

        const eventData = window.eventStorage.getEvent(eventId);

        if (tab === 'active') {
            // 顯示進行中的事件（非 completed 狀態）
            card.style.display = (eventData?.status !== 'completed') ? 'block' : 'none';
        } else if (tab === 'completed') {
            // 顯示已結束的事件
            card.style.display = (eventData?.status === 'completed') ? 'block' : 'none';
        }
    });
}

// 更新事件計數
function updateEventCounts() {
    const activeCountEl = document.getElementById('activeCount');
    const completedCountEl = document.getElementById('completedCount');

    if (!window.eventStorage || !window.eventStorage.events) {
        if (activeCountEl) activeCountEl.textContent = '0';
        if (completedCountEl) completedCountEl.textContent = '0';
        return;
    }

    const allEvents = Array.from(window.eventStorage.events.values());
    const activeCount = allEvents.filter(e => e.status !== 'completed').length;
    const completedCount = allEvents.filter(e => e.status === 'completed').length;

    if (activeCountEl) activeCountEl.textContent = activeCount;
    if (completedCountEl) completedCountEl.textContent = completedCount;

    console.log(`📊 事件計數更新 - 進行中: ${activeCount}, 已結束: ${completedCount}`);
}

// TODO 整理 executeAction 內部相關 function 程式碼
// 執行行動 (onclick)
function executeAction() {
    console.log('executeAction called, selectedAction:', selectedAction);

    if (!selectedAction) {
        alert('請先選擇一個行動選項！');
        return;
    }

    // 特殊處理：結束事件
    if (selectedAction === 'close') {
        completeVesselEvent(currentEventId);
        return;
    }

    // 獲取時間選擇
    const executeTimeRadios = document.querySelectorAll('input[name="executeTime"]');
    let executeTime = new Date().toISOString(); // 默認立即執行
    let isScheduled = false;

    console.log('Found executeTime radios:', executeTimeRadios.length);

    executeTimeRadios.forEach(radio => {
        if (radio.checked) {
            console.log('Checked radio value:', radio.value);
            if (radio.value === 'scheduled') {
                const scheduledDateTime = document.getElementById('scheduledDateTime');
                if (scheduledDateTime && scheduledDateTime.value) {
                    const selectedTime = new Date(scheduledDateTime.value);
                    const minTime = new Date(Date.now() + 5 * 60000); // 5分鐘後

                    if (selectedTime < minTime) {
                        alert('排程時間必須在未來至少5分鐘！');
                        return;
                    }

                    executeTime = selectedTime.toISOString();
                    isScheduled = true;
                } else {
                    alert('請選擇排程時間！');
                    return;
                }
            }
        }
    });

    // 獲取目標信息
    const targetInfo = getTargetInfo();
    console.log('Target info:', targetInfo);

    // 檢查missionTrackManager是否存在
    if (typeof missionTrackManager === 'undefined') {
        console.error('missionTrackManager is undefined!');
        alert('系統錯誤：任務管理器未初始化');
        return;
    }

    // Helper: snap a Date to nearest 3-hour block
    function snapTo3Hours(date) {
        const d = new Date(date);
        const ms = 3 * 60 * 60 * 1000;
        const snapped = new Date(Math.round(d.getTime() / ms) * ms);
        return snapped;
    }

    // Helper: find closest current track point for a vessel (prefer type 'Current', fallback to latest 'History')
    function findClosestCurrentPointForVessel(vesselId) {
        try {
            const event = eventStorage.getEvent(vesselId);
            if (!event || !event.trackPoints) return null;
            // prefer type === 'Current'
            const current = event.trackPoints.find(p => p.type === 'Current');
            if (current) return current;
            // else return latest history by timestamp
            const history = event.trackPoints.filter(p => p.type === 'History');
            if (history.length === 0) return null;
            history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            return history[0];
        } catch (err) { console.warn('findClosestCurrentPointForVessel error', err); return null; }
    }

    // Helper: find a future point in vessel's trackPoints that matches scheduledTime (snapped to 3 hours)
    function findFuturePointForVesselByTime(vesselId, scheduledDate) {
        try {
            const event = eventStorage.getEvent(vesselId);
            if (!event || !event.trackPoints) return null;
            const snapped = snapTo3Hours(scheduledDate).getTime();
            // find future point whose snapped time equals
            for (const p of event.trackPoints) {
                if (p.type === 'Future') {
                    const pt = snapTo3Hours(new Date(p.timestamp)).getTime();
                    if (pt === snapped) return p;
                }
            }
            // fallback: nearest future by absolute time diff
            const futures = event.trackPoints.filter(p => p.type === 'Future');
            if (futures.length === 0) return null;
            futures.sort((a, b) => Math.abs(new Date(a.timestamp) - scheduledDate) - Math.abs(new Date(b.timestamp) - scheduledDate));
            return futures[0];
        } catch (err) { console.warn('findFuturePointForVesselByTime error', err); return null; }
    }

    // 使用統一管理器創建派遣任務，並根據是否為立即/排程自動綁定軌跡點（優先處理 vessel-003 / vessel-004）
    let boundTrackPoint = null;
    const missionPayload = {
        action: selectedAction,
        actionName: actionNames[selectedAction],
        actionIcon: actionIcons[selectedAction],
        targetInfo: targetInfo,
        targetVesselId: currentTrackingVessel || 'all',
        status: isScheduled ? 'scheduled' : 'dispatched',
        timestamp: executeTime,
        isScheduled: isScheduled,
        executeTime: executeTime
    };

    // Only prioritize predefined vessel events (vessel-003, vessel-004)
    const preferredVessels = ['vessel-003', 'vessel-004'];
    const vesselIdToUse = currentTrackingVessel || (preferredVessels.includes(currentEventId) ? currentEventId : null);

    if (!isScheduled) {
        // Immediate: bind to current track point
        if (vesselIdToUse) boundTrackPoint = findClosestCurrentPointForVessel(vesselIdToUse);
    } else {
        // Scheduled: snap to 3-hour and bind to future point matching that time
        const scheduledDate = snapTo3Hours(new Date(executeTime));
        missionPayload.timestamp = scheduledDate.toISOString();
        missionPayload.executeTime = scheduledDate.toISOString();
        if (vesselIdToUse) boundTrackPoint = findFuturePointForVesselByTime(vesselIdToUse, scheduledDate);
    }

    // If we determined a boundTrackPoint, pass its stable id into the mission payload so
    // the mission manager can auto-reuse or link correctly.
    if (boundTrackPoint) {
        missionPayload.sourceTrackPointId = getSafePointId(boundTrackPoint);
    }

    const missionId = missionTrackManager.createMission(missionPayload);

    // If we found a suitable track point, create a persistent link: add missionId to track point and pointId to mission
    if (boundTrackPoint) {
        // ensure the track point is registered in manager
        const pointId = getSafePointId(boundTrackPoint) || null;
        try {
            // If the manager already has this point (by pointId), use it; otherwise, create it
            let managerPointId = pointId && missionTrackManager.trackPoints.has(pointId) ? pointId : null;
            // If the point already exists in manager, ensure it's not owned by another mission
            if (managerPointId) {
                const existingPoint = missionTrackManager.trackPoints.get(managerPointId);
                if (existingPoint && existingPoint.boundMissionId && existingPoint.boundMissionId !== missionId) {
                    console.warn(`Explicit bind skipped: track point ${managerPointId} already bound to another mission.`);
                } else {
                    // safe to bind one-to-one
                    const mission = missionTrackManager.missions.get(missionId);
                    if (mission) mission.boundPointId = managerPointId;
                    const mp = missionTrackManager.trackPoints.get(managerPointId);
                    if (mp) mp.boundMissionId = missionId;
                    missionTrackManager.missionTrackLinks.set(`${missionId}-${managerPointId}`, { missionId, pointId: managerPointId, linkTime: new Date().toISOString(), linkReason: 'explicit_bind' });
                    console.log('Mission bound to track point:', missionId, managerPointId);
                }
            } else {
                // create a new track point in manager and bind it (newly created point has no existing boundMissionId)
                managerPointId = missionTrackManager.createTrackPoint(boundTrackPoint);
                const mission = missionTrackManager.missions.get(missionId);
                if (mission) mission.boundPointId = managerPointId;
                const mp = missionTrackManager.trackPoints.get(managerPointId);
                if (mp) mp.boundMissionId = missionId;
                missionTrackManager.missionTrackLinks.set(`${missionId}-${managerPointId}`, { missionId, pointId: managerPointId, linkTime: new Date().toISOString(), linkReason: 'explicit_bind' });
                console.log('Mission bound to track point (new):', missionId, managerPointId);
            }
        } catch (err) { console.warn('Error binding mission to track point', err); }
    }

    console.log('Created mission with ID:', missionId);

    // 創建新任務卡
    const missionTimeline = document.querySelector('.mission-list');
    console.log('Mission timeline element found:', !!missionTimeline);

    if (!missionTimeline) {
        console.error('Mission timeline element not found!');
        alert('錯誤：找不到任務列表容器');
        return;
    }

    const newMission = document.createElement('div');
    newMission.className = 'mission-card';
    newMission.setAttribute('data-mission-id', missionId);

    const executeTimeFormatted = new Date(executeTime).toLocaleString('zh-TW');
    const statusText = isScheduled ? '排程' : '派遣';
    const statusClass = isScheduled ? 'status-scheduled' : 'status-dispatched';

    console.log('Creating mission card with:', {
        missionId,
        selectedAction,
        targetInfo,
        executeTimeFormatted,
        statusText,
        statusClass
    });

    newMission.innerHTML = `
        <div class="mission-card-header">
            <span class="mission-type">${actionIcons[selectedAction]} ${actionNames[selectedAction]}</span>
            <span class="mission-status ${statusClass}">${statusText}</span>
        </div>
        <div class="mission-details">
            目標: ${targetInfo}<br>
            ${isScheduled ? '預定執行' : '排程'}: ${executeTimeFormatted}
        </div>
        <div class="mission-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%;"></div>
            </div>
            <div class="progress-text">${isScheduled ? '等待排程時間' : '等待執行'}</div>
        </div>
    `;

    missionTimeline.insertBefore(newMission, missionTimeline.firstChild);
    console.log('Mission card inserted into timeline');

    // 验证任务卡是否成功添加
    const insertedCard = document.querySelector(`[data-mission-id="${missionId}"]`);
    console.log('Mission card found after insertion:', !!insertedCard);

    // 为任务卡添加点击事件
    newMission.addEventListener('click', () => {
        highlightMissionCard(missionId);
        showMissionDetails(missionId);
    });
    newMission.style.cursor = 'pointer';

    // 顯示船舶圖片
    showShipPicture();

    // 更新任務統計
    const stats = document.querySelector('.mission-stats');
    const currentActive = parseInt(stats.textContent.match(/進行中: (\d+)/)[1]) + 1;
    const currentTotal = parseInt(stats.textContent.match(/總計: (\d+)/)[1]) + 1;
    stats.textContent = `進行中: ${currentActive} | 已完成: 1 | 總計: ${currentTotal}`;

    // 新增：更新右侧时间轴
    const actionIcon = selectedAction === 'satellite' ? '🛰️' : selectedAction === 'uav' ? '🚁' : selectedAction === 'track' ? '🎯' : '📞';
    const timelineStatus = isScheduled ? '排程' : '派遣';
    addTimelineEvent(timelineStatus, `${actionIcon} ${targetInfo}`, `${actionNames[selectedAction]}${isScheduled ? ' (預定執行)' : ''}`, missionId);

    // 設置任務執行時間
    const executionDelay = isScheduled ?
        Math.max(0, new Date(executeTime) - new Date()) :
        3000; // 立即執行任務延遲3秒

    // 模擬任務進度
    setTimeout(() => {
        const statusBadge = newMission.querySelector('.mission-status');
        const progressFill = newMission.querySelector('.progress-fill');
        const progressText = newMission.querySelector('.progress-text');

        if (!statusBadge) return; // 任務卡可能已被移除

        // 開始執行任務
        statusBadge.className = 'mission-status status-arrived';
        statusBadge.textContent = '抵達';

        setTimeout(() => {
            if (!statusBadge.parentElement) return; // 檢查元素是否還存在
            statusBadge.className = 'mission-status status-executing';
            statusBadge.textContent = '執行任務';
        }, 2000);

        let progress = 0;
        const interval = setInterval(() => {
            if (!progressFill || !progressText) {
                clearInterval(interval);
                return;
            }

            progress += Math.random() * 20;
            if (progress > 100) progress = 100;

            progressFill.style.width = progress + '%';
            progressText.textContent = `進度: ${Math.round(progress)}%`;

            if (progress >= 100) {
                clearInterval(interval);
                if (statusBadge && statusBadge.parentElement) {
                    statusBadge.className = 'mission-status status-completed';
                    statusBadge.textContent = '完成';
                    progressText.textContent = '已完成';

                    // 更新任務狀態到統一管理器
                    const mission = missionTrackManager.missions.get(missionId);
                    if (mission) {
                        mission.status = 'completed';
                        mission.completedTime = new Date().toISOString();
                    }

                    // 更新統計
                    const newStats = document.querySelector('.mission-stats');
                    if (newStats) {
                        const activeCount = Math.max(0, parseInt(newStats.textContent.match(/進行中: (\d+)/)[1]) - 1);
                        const completedCount = parseInt(newStats.textContent.match(/已完成: (\d+)/)[1]) + 1;
                        const totalCount = parseInt(newStats.textContent.match(/總計: (\d+)/)[1]);
                        newStats.textContent = `進行中: ${activeCount} | 已完成: ${completedCount} | 總計: ${totalCount}`;
                    }
                }
            }
        }, 1000);
    }, executionDelay);

    // 重置選項
    selectedAction = null;

    // 清除所有選中狀態
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.classList.remove('selected');
    });

    // 尋找並關閉可能的模態框
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        if (modal.style.display === 'block' || modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });

    // 特定模態框ID的關閉
    const confirmationModal = document.getElementById('confirmationModal');
    if (confirmationModal) {
        confirmationModal.style.display = 'none';
    }

    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
}

// -----------

// 根據事件調整地圖視圖
function adjustMapViewForEvent(eventId, isRepeatedClick = false) {
    console.log("adjusting map view for event:", eventId, "isRepeatedClick:", isRepeatedClick);
    if (!taiwanMap) return;

    // 獲取當前事件資料
    const storedEvent = eventStorage.getEvent(eventId);
    if (!storedEvent) return;

    // 如果是重複點擊同一個區域事件，檢查監控範圍是否還存在
    if (isRepeatedClick && storedEvent.type === 'area') {
        // 檢查監控範圍是否已經被清除（例如按了重置按鈕）
        const rangeStillExists = investigationRangeLayer && 
                                taiwanMap.hasLayer(investigationRangeLayer);
        
        if (rangeStillExists) {
            console.log(`🔄 重複點擊區域事件 ${eventId}，保持現有顯示狀態`);
            
            // 只調整地圖視圖，不重新處理信號點
            if (storedEvent.centerLat && storedEvent.centerLon && storedEvent.radius) {
                let centerLat = storedEvent.centerLat;
                let centerLon = storedEvent.centerLon;
                
                // 根據方向調整座標
                if (storedEvent.centerLatDirection === 'S') {
                    centerLat = -centerLat;
                }
                if (storedEvent.centerLonDirection === 'W') {
                    centerLon = -centerLon;
                }

                const radiusInKm = storedEvent.radiusInKm || storedEvent.radius;
                let zoomLevel = 6;
                
                // 計算縮放等級
                if (radiusInKm < 10) zoomLevel = 10;
                else if (radiusInKm < 25) zoomLevel = 9;
                else if (radiusInKm < 50) zoomLevel = 8;
                else if (radiusInKm < 100) zoomLevel = 7;
                else zoomLevel = 6;

                // 平滑調整地圖視圖
                taiwanMap.setView([centerLat, centerLon], zoomLevel, {
                    animate: true,
                    duration: 1.5,
                    easeLinearity: 0.25
                });
            }
            return; // 提前返回，不執行後續的信號點處理
        } else {
            console.log(`🔄 重複點擊區域事件 ${eventId}，但監控範圍已被清除，將重新繪製`);
            // 監控範圍已被清除，需要重新繪製，繼續執行下面的邏輯
        }
    }

    // 清除先前的調查範圍顯示
    clearInvestigationRange();

    // 如果是船舶事件且是重複點擊同一個船舶，不清除現有軌跡
    if (storedEvent.type === 'vessel' &&
        historyTrackManager && historyTrackManager.currentTrackingVesselId === eventId &&
        historyTrackManager.historyTrackAnimation) {
        console.log(`🔄 重複點擊船舶事件 ${eventId}，保留現有歷史軌跡動畫`);
        // 使用統一的聚焦函數
        focusMapToEventCoordinates(storedEvent, eventId, 'vessel');
        return; // 提前返回，不繼續執行後面的清除邏輯
    }

    // 清除先前的歷史軌跡動畫（只在非重複點擊時清除）
    if (historyTrackManager && historyTrackManager.historyTrackAnimation) {
        if (historyTrackManager.historyTrackAnimation.timeout) {
            clearTimeout(historyTrackManager.historyTrackAnimation.timeout);
        }
        if (historyTrackManager.historyTrackAnimation.layers) {
            historyTrackManager.historyTrackAnimation.layers.forEach(layer => taiwanMap.removeLayer(layer));
        }
        historyTrackManager.historyTrackAnimation = null;
        historyTrackManager.currentTrackingVesselId = null;
        console.log('🛑 已停止並清除舊的歷史軌跡動畫。');
    }
    if (!storedEvent) return;

    // 檢查圓形區域格式
    if (storedEvent.type === 'area' && storedEvent.centerLat && storedEvent.centerLon && storedEvent.radius) {
        // 區域監控事件：先畫出調查範圍，再放大地圖

        // 恢復信號點數據但不顯示在地圖上
        restoreHiddenSignalPointsWithoutDisplay();

        // 清除任何現有的歷史軌跡
        if (historyTrackManager) {
            historyTrackManager.clearHistoryTrack();
        }

        try {
            let centerLat, centerLon, zoomLevel = 6;

            // 圓形區域處理
            centerLat = storedEvent.centerLat;
            centerLon = storedEvent.centerLon;
            
            // 根據方向調整座標（如果是南緯或西經，需要變成負數）
            if (storedEvent.centerLatDirection === 'S') {
                centerLat = -centerLat;
            }
            if (storedEvent.centerLonDirection === 'W') {
                centerLon = -centerLon;
            }

            const radiusInKm = storedEvent.radiusInKm || storedEvent.radius;

            // 定義高亮異常信號的函數，帶重試機制
            const highlightAbnormalSignals = (retryCount = 0, maxRetries = 5) => {
                if (window.seaDotManager && 
                    typeof window.seaDotManager.highlightAbnormalRFSignalsInArea === 'function' &&
                    window.seaDotManager.getAllDots && 
                    window.seaDotManager.getAllDots().length > 0) {
                    // SeaDotManager 已載入且有數據
                    const highlightedCount = window.seaDotManager.highlightAbnormalRFSignalsInArea(storedEvent);
                    if (highlightedCount > 0) {
                        console.log(`🔴 已將 ${highlightedCount} 個區域內的異常RF信號點標記為紅色`);
                        return highlightedCount;
                    }
                    return 0;
                } else if (retryCount < maxRetries) {
                    // SeaDotManager 尚未完全載入，延遲重試
                    console.log(`⏳ 等待 SeaDotManager 載入數據... (${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => {
                        const count = highlightAbnormalSignals(retryCount + 1, maxRetries);
                        if (count > 0) {
                            // 重試成功後更新提示訊息
                            setTimeout(() => {
                                showMapAdjustmentMessage(`地圖已聚焦至${storedEvent.aoiName || '監控區域'}`);
                            }, 600);
                        }
                    }, 200); // 每次重試間隔 200ms
                    return -1; // 表示正在重試
                } else {
                    console.warn('⚠️ SeaDotManager 載入超時，無法高亮異常信號');
                    return 0;
                }
            };

            // 短暫延遲後放大到該區域
            setTimeout(() => {
                // 計算適當的縮放等級（根據半徑大小）
                if (radiusInKm < 10) zoomLevel = 10;
                else if (radiusInKm < 25) zoomLevel = 9;
                else if (radiusInKm < 50) zoomLevel = 8;
                else if (radiusInKm < 100) zoomLevel = 7;
                else zoomLevel = 6;

                if (taiwanMap) {
                    // 步驟 1: 先高亮顯示區域內的異常RF信號（未開啟AIS）
                    let highlightMessageShown = false;
                    const highlightedCount = highlightAbnormalSignals();
                    
                    if (highlightedCount > 0) {
                        highlightMessageShown = true;
                    }
                    // highlightedCount === -1 表示正在重試，不需要立即顯示訊息

                    // 步驟 2: 再創建圓形調查範圍 - 單圈設計
                    
                    // 監控範圍圓圈
                    const monitoringCircle = L.circle([centerLat, centerLon], {
                        color: '#4caf50',          // 綠色邊框
                        fillColor: '#81c784',     // 淺綠色填充
                        fillOpacity: 0.15,        // 淺透明填充
                        weight: 3,                // 邊框粗細
                        opacity: 0.9,             // 邊框透明度
                        dashArray: '12, 8',       // 虛線樣式
                        radius: radiusInKm * 1000, // 半徑（米）
                        className: 'monitoring-range-circle' // CSS類名，用於動畫
                    });

                    // 中心標記點 - 使用固定的圓形標記（避免跳動）
                    const centerMarker = L.circleMarker([centerLat, centerLon], {
                        color: '#1b5e20',         // 深綠色邊框
                        fillColor: '#2e7d32',     // 深綠色填充
                        fillOpacity: 0.9,         // 較高填充度
                        weight: 2,                // 邊框粗細
                        opacity: 1.0,             // 完全不透明
                        radius: 5,                // 標記點大小
                        interactive: false        // 不響應滑鼠事件，保持固定位置
                    });

                    // 創建圖層組以便統一管理（不要先單獨添加到地圖）
                    const layerGroup = L.layerGroup([monitoringCircle, centerMarker]);
                    
                    // 將圖層組添加到地圖
                    layerGroup.addTo(taiwanMap);
                    
                    // 儲存到全域變數以便後續清除
                    investigationRangeLayer = layerGroup;

                    // 添加動態效果的CSS樣式（如果還沒有的話）
                    if (!document.getElementById('monitoring-range-styles')) {
                        const style = document.createElement('style');
                        style.id = 'monitoring-range-styles';
                        style.textContent = `
                            @keyframes subtle-glow {
                                0% { filter: drop-shadow(0 0 3px rgba(76, 175, 80, 0.4)); }
                                50% { filter: drop-shadow(0 0 10px rgba(76, 175, 80, 0.7)); }
                                100% { filter: drop-shadow(0 0 3px rgba(76, 175, 80, 0.4)); }
                            }
                            
                            .monitoring-range-circle {
                                animation: subtle-glow 3s ease-in-out infinite;
                            }
                        `;
                        document.head.appendChild(style);
                    }

                    const areaName = storedEvent.aoiName || eventId.toUpperCase();
                    const radiusText = storedEvent.radiusUnit === 'nm' ? 
                        `${storedEvent.radius}海里` : `${storedEvent.radius}公里`;
                    console.log(`📍 已繪製調查範圍：${areaName} (中心: ${centerLat.toFixed(3)}°, ${centerLon.toFixed(3)}°, 半徑: ${radiusText})`);

                    // 顯示提示訊息
                    if (highlightMessageShown) {
                        // 如果有異常信號被高亮，顯示包含異常信號數量的訊息
                        const highlightedCount = window.seaDotManager.getAllDots().filter(dot => dot.isHighlighted).length;
                        setTimeout(() => {
                            showMapAdjustmentMessage(`地圖已聚焦至${storedEvent.aoiName || '監控區域'}`);
                        }, 600);
                    } else {
                        // 如果沒有異常信號，顯示普通的聚焦訊息
                        setTimeout(() => {
                            showMapAdjustmentMessage(`地圖已聚焦至${storedEvent.aoiName || '監控區域'}`);
                        }, 100);
                    }
                }

                // 平滑地調整地圖視圖到目標區域
                taiwanMap.setView([centerLat, centerLon], zoomLevel, {
                    animate: true,
                    duration: 1.5,
                    easeLinearity: 0.25
                });

                console.log(`🎯 地圖已調整至 ${storedEvent.aoiName || eventId.toUpperCase()} 區域 (中心: ${centerLat.toFixed(3)}, ${centerLon.toFixed(3)}, 縮放: ${zoomLevel})`);
            }, 100);

        } catch (error) {
            console.warn(`⚠️ 無法解析事件 ${eventId} 的座標範圍:`, error);
        }
    
    // ========== 暫時停用 RF 監控事件功能 ==========
    /*
    } else if (storedEvent.type === 'rf' && storedEvent.coordinates) {
        // 恢復顯示信號點
        restoreHiddenSignalPoints();

        // 清除任何現有的歷史軌跡
        if (historyTrackManager) {
            historyTrackManager.clearHistoryTrack();
        }

        // 使用統一的聚焦函數
        focusMapToEventCoordinates(storedEvent, eventId, 'rf');
    */
    // ========== RF 監控事件功能結束 ==========
    
    } else if (storedEvent.type === 'vessel') {
        // 船舶事件：找到 'Current' 點並定位，然後顯示軌跡

        // 顯示歷史軌跡
        if (historyTrackManager) {
            historyTrackManager.displayHistoryTrack(storedEvent);
        } else {
            console.warn('⚠️ historyTrackManager 尚未初始化，無法顯示歷史軌跡');
        }

        // 清除非軌跡點的 SeaDots
        clearNonTrackPoints();

        // 找到 'Current' 點來定位地圖
        const currentPoint = storedEvent.trackPoints?.find(p => p.type === 'Current');

        let targetCoords;
        if (currentPoint) {
            targetCoords = { lat: currentPoint.lat, lon: currentPoint.lon };
            console.log(`🎯 找到 'Current' 點，將地圖定位至: (${targetCoords.lat.toFixed(3)}, ${targetCoords.lon.toFixed(3)})`);
        } else {
            // 如果找不到 'Current' 點，作為備用方案，使用 coordinates 屬性
            try {
                targetCoords = parsePointCoordinates(storedEvent.coordinates);
                console.warn(`⚠️ 在 ${eventId} 的軌跡中找不到 'Current' 點，使用備用座標定位`);
            } catch (error) {
                console.error(`❌ 無法為 ${eventId} 找到任何有效座標進行定位`);
                return;
            }
        }

        if (targetCoords) {
            // 為 Current 點創建臨時事件物件或使用原始事件資料
            const eventForFocus = currentPoint ?
                { coordinates: `${targetCoords.lat.toFixed(3)}°N, ${targetCoords.lon.toFixed(3)}°E` } :
                storedEvent;

            // 使用統一的聚焦函數
            focusMapToEventCoordinates(eventForFocus, eventId, 'vessel');
        }
    }
}

// 清除調查範圍顯示和異常信號點高亮
function clearInvestigationRange() {
    // 清除綠色監控範圍顯示
    if (investigationRangeLayer && taiwanMap) {
        try {
            // 如果是圖層組，先嘗試清除組內的每個圖層
            if (investigationRangeLayer.eachLayer) {
                investigationRangeLayer.eachLayer(function(layer) {
                    if (taiwanMap.hasLayer(layer)) {
                        taiwanMap.removeLayer(layer);
                    }
                });
            }
            
            // 移除圖層組本身
            if (taiwanMap.hasLayer(investigationRangeLayer)) {
                taiwanMap.removeLayer(investigationRangeLayer);
            }
            
            investigationRangeLayer = null;
            console.log('🗑️ 已清除綠色監控範圍顯示');
        } catch (error) {
            console.error('❌ 清除監控範圍時發生錯誤:', error);
            // 強制重置
            investigationRangeLayer = null;
        }
    }
    
    // 恢復紅色異常信號點的原始顏色和顯示狀態
    if (window.seaDotManager && typeof window.seaDotManager.restoreOriginalColors === 'function') {
        const result = window.seaDotManager.restoreOriginalColors();
        if (result && (result.restoredCount > 0 || result.shownCount > 0)) {
            console.log(`🔵 已恢復 ${result.restoredCount} 個異常信號點的原始顏色，顯示 ${result.shownCount} 個隱藏的信號點`);
        }
    }
}

/**
 * 聚焦地圖到指定事件的座標位置
 * @param {Object} eventData - 事件資料物件
 * @param {string} eventId - 事件ID
 * @param {string} eventType - 事件類型 ('vessel', 'rf', 'area')
 */
function focusMapToEventCoordinates(eventData, eventId, eventType) {
    if (!taiwanMap || !eventData || !eventData.coordinates) {
        console.warn(`⚠️ 無法聚焦地圖: 缺少必要參數`);
        return false;
    }

    // 事件類型配置
    const typeConfig = {
        'vessel': {
            displayName: '船舶',
            zoomLevel: 7,
            animationOptions: {
                animate: true,
                duration: 1.5,
                easeLinearity: 0.25
            }
        },
        'rf': {
            displayName: 'RF信號',
            zoomLevel: 7,
            animationOptions: {
                animate: true,
                duration: 1.5,
                easeLinearity: 0.25
            }
        },
    };

    const config = typeConfig[eventType];
    if (!config) {
        console.warn(`⚠️ 不支援的事件類型: ${eventType}`);
        return false;
    }

    try {
        const coords = parsePointCoordinates(eventData.coordinates);
        if (coords) {
            // 設定地圖視圖
            taiwanMap.setView([coords.lat, coords.lon], config.zoomLevel, config.animationOptions);

            // 顯示地圖調整訊息
            showMapAdjustmentMessage(`地圖已聚焦至${config.displayName}位置`);

            // 記錄日誌
            console.log(`🎯 地圖已調整至${config.displayName} ${eventId.toUpperCase()} 位置 (${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)})`);

            return true;
        } else {
            throw new Error('座標解析失敗');
        }
    } catch (error) {
        console.warn(`⚠️ 無法解析${eventType}事件 ${eventId} 的座標:`, error);
        return false;
    }
}

/**
 * 恢復被 clearNonTrackPoints 隱藏的所有信號點
 * 這個功能會重新顯示之前被清除的RF信號點和其他非歷史軌跡點
 */
function restoreHiddenSignalPoints() {
    console.log('🔄 開始恢復被隱藏的信號點...');

    let restoredCount = 0;

    try {
        // 檢查是否有被隱藏的點
        if (!hiddenSignalPoints.isCleared) {
            console.log('ℹ️ 沒有找到被隱藏的信號點');
            return {
                restored: 0,
                success: true,
                message: '沒有被隱藏的點需要恢復'
            };
        }

        // 獲取有效的地圖實例
        const mapInstance = getValidMapInstance();
        if (!mapInstance) {
            console.warn('⚠️ 未找到有效的地圖實例，無法執行恢復操作');
            return {
                restored: 0,
                success: false,
                error: '地圖未初始化'
            };
        }

        // 1. 恢復 SeaDotManager 管理的信號點
        if (hiddenSignalPoints.seaDots.size > 0) {
            console.log('📍 恢復 SeaDotManager 中的信號點...');

            // 確保 SeaDotManager 存在
            if (!window.seaDotManager) {
                console.warn('⚠️ SeaDotManager 不存在，無法恢復信號點');
            } else {
                hiddenSignalPoints.seaDots.forEach((dotData, dotId) => {
                    try {
                        // 恢復點到 SeaDotManager
                        window.seaDotManager.seaDots.set(dotId, dotData);

                        // 如果點之前在地圖上，重新創建並添加到地圖
                        if (dotData.wasOnMap) {
                            // 重新創建標記
                            const newMarker = window.seaDotManager.createMarker(dotData);
                            dotData.marker = newMarker;

                            // 添加到地圖
                            if (newMarker && mapInstance) {
                                newMarker.addTo(mapInstance);
                                restoredCount++;
                                console.log(`恢復信號點: ${dotId}`);
                            }
                        }
                    } catch (error) {
                        console.warn(`恢復信號點 ${dotId} 時發生錯誤:`, error);
                    }
                });

                console.log(`✅ 已恢復 ${hiddenSignalPoints.seaDots.size} 個 SeaDotManager 管理的信號點`);
            }
        }

        // 2. 恢復船舶標記
        if (Object.keys(hiddenSignalPoints.vesselMarkers).length > 0) {
            console.log('🚢 恢復船舶標記...');

            Object.keys(hiddenSignalPoints.vesselMarkers).forEach(vesselId => {
                const hiddenVesselData = hiddenSignalPoints.vesselMarkers[vesselId];

                // 恢復到 window.vesselMarkers
                if (window.vesselMarkers) {
                    window.vesselMarkers[vesselId] = hiddenVesselData;

                    // 如果有標記且之前在地圖上，重新添加
                    if (hiddenVesselData.marker && hiddenVesselData.wasOnMap) {
                        try {
                            hiddenVesselData.marker.addTo(mapInstance);
                            restoredCount++;
                            console.log(`恢復船舶標記: ${vesselId}`);
                        } catch (error) {
                            console.warn(`恢復船舶標記 ${vesselId} 時發生錯誤:`, error);
                        }
                    }
                }
            });

            console.log(`✅ 已恢復 ${Object.keys(hiddenSignalPoints.vesselMarkers).length} 個船舶標記`);
        }

        // 3. 恢復調查範圍標記
        if (hiddenSignalPoints.investigationRange) {
            console.log('📐 恢復調查範圍標記...');

            try {
                window.investigationRangeLayer = hiddenSignalPoints.investigationRange;
                if (hiddenSignalPoints.investigationRange.addTo) {
                    hiddenSignalPoints.investigationRange.addTo(mapInstance);
                    restoredCount++;
                }
            } catch (error) {
                console.warn('恢復調查範圍標記時發生錯誤:', error);
            }
        }

        // 清除隱藏狀態
        hiddenSignalPoints = {
            seaDots: new Map(),
            vesselMarkers: {},
            investigationRange: null,
            temporaryMarkers: [],
            clearTime: null,
            isCleared: false
        };

        console.log(`🎉 恢復完成！總共恢復 ${restoredCount} 個信號點`);

        return {
            restored: restoredCount,
            success: true
        };

    } catch (error) {
        console.error('❌ 恢復信號點時發生錯誤:', error);
        return {
            restored: restoredCount,
            success: false,
            error: error.message
        };
    }
}

/**
 * 恢復被隱藏的信號點數據但不添加到地圖上
 * 這個功能會恢復之前被清除的RF信號點和其他非歷史軌跡點的數據，但不會將它們顯示在地圖上
 * 適用於需要保留數據但不立即顯示的場景
 */
function restoreHiddenSignalPointsWithoutDisplay() {
    console.log('🔄 開始恢復被隱藏的信號點數據（不顯示）...');

    let restoredCount = 0;

    try {
        // 檢查是否有被隱藏的點
        if (!hiddenSignalPoints.isCleared) {
            console.log('ℹ️ 沒有找到被隱藏的信號點');
            return {
                restored: 0,
                success: true,
                message: '沒有被隱藏的點需要恢復'
            };
        }

        // 1. 恢復 SeaDotManager 管理的信號點數據（不添加到地圖）
        if (hiddenSignalPoints.seaDots.size > 0) {
            console.log('📍 恢復 SeaDotManager 中的信號點數據...');

            // 確保 SeaDotManager 存在
            if (!window.seaDotManager) {
                console.warn('⚠️ SeaDotManager 不存在，無法恢復信號點');
            } else {
                hiddenSignalPoints.seaDots.forEach((dotData, dotId) => {
                    try {
                        // 只恢復點到 SeaDotManager，不添加到地圖
                        window.seaDotManager.seaDots.set(dotId, dotData);
                        restoredCount++;
                        console.log(`恢復信號點數據: ${dotId}`);
                    } catch (error) {
                        console.warn(`恢復信號點數據 ${dotId} 時發生錯誤:`, error);
                    }
                });

                console.log(`✅ 已恢復 ${hiddenSignalPoints.seaDots.size} 個 SeaDotManager 管理的信號點數據`);
            }
        }

        // 2. 恢復船舶標記數據（不添加到地圖）
        if (Object.keys(hiddenSignalPoints.vesselMarkers).length > 0) {
            console.log('🚢 恢復船舶標記數據...');

            Object.keys(hiddenSignalPoints.vesselMarkers).forEach(vesselId => {
                const hiddenVesselData = hiddenSignalPoints.vesselMarkers[vesselId];

                // 只恢復到 window.vesselMarkers，不添加到地圖
                if (window.vesselMarkers) {
                    window.vesselMarkers[vesselId] = hiddenVesselData;
                    restoredCount++;
                    console.log(`恢復船舶標記數據: ${vesselId}`);
                }
            });

            console.log(`✅ 已恢復 ${Object.keys(hiddenSignalPoints.vesselMarkers).length} 個船舶標記數據`);
        }

        // 3. 恢復調查範圍標記數據（不添加到地圖）
        if (hiddenSignalPoints.investigationRange) {
            console.log('📐 恢復調查範圍標記數據...');

            try {
                // 只恢復數據引用，不添加到地圖
                window.investigationRangeLayer = hiddenSignalPoints.investigationRange;
                restoredCount++;
                console.log('恢復調查範圍標記數據完成');
            } catch (error) {
                console.warn('恢復調查範圍標記數據時發生錯誤:', error);
            }
        }

        // 清除隱藏狀態
        hiddenSignalPoints = {
            seaDots: new Map(),
            vesselMarkers: {},
            investigationRange: null,
            temporaryMarkers: [],
            clearTime: null,
            isCleared: false
        };

        console.log(`🎉 數據恢復完成！總共恢復 ${restoredCount} 個信號點的數據（未顯示在地圖上）`);

        return {
            restored: restoredCount,
            success: true,
            message: '數據已恢復但未顯示在地圖上'
        };

    } catch (error) {
        console.error('❌ 恢復信號點數據時發生錯誤:', error);
        return {
            restored: restoredCount,
            success: false,
            error: error.message
        };
    }
}

// 顯示地圖調整訊息的函數
function showMapAdjustmentMessage(message, duration = 1500) {
    // 建立訊息元素
    const messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.style.cssText = `
        position: absolute;
        top: 20px;
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

/**
 * 清除地圖上除歷史軌跡點外的所有信號點
 * 此功能會保留歷史軌跡點(History type)，移除其他所有類型的點
 * 包括：RF信號點、當前位置點、未來預測點、普通監測點等
 */
function clearNonTrackPoints() {
    console.log('🧹 開始清除地圖上除歷史軌跡點外的所有信號點...');

    let removedCount = 0;
    let preservedHistoryCount = 0;

    try {
        // 獲取有效的地圖實例
        const mapInstance = getValidMapInstance();
        if (!mapInstance) {
            console.warn('⚠️ 未找到有效的地圖實例，無法執行清除操作');
            return {
                removed: 0,
                preserved: 0,
                success: false,
                error: '地圖未初始化'
            };
        }

        // 獲取需要保留的歷史軌跡圖層
        const historyLayersToPreserve = new Set();
        if (historyTrackManager && historyTrackManager.currentHistoryLayers && Array.isArray(historyTrackManager.currentHistoryLayers)) {
            historyTrackManager.currentHistoryLayers.forEach(layer => {
                historyLayersToPreserve.add(layer);
            });
            console.log(`🗺️ 標記 ${historyTrackManager.currentHistoryLayers.length} 個歷史軌跡圖層為保留項目`);
            preservedHistoryCount += historyTrackManager.currentHistoryLayers.length;
        }

        // 1. 清除 SeaDotManager 管理的所有RF信號點和監測點
        if (window.seaDotManager && typeof window.seaDotManager.seaDots !== 'undefined') {
            console.log('📍 清除 SeaDotManager 中的信號點...');

            // 遍歷所有 SeaDotManager 管理的點，並儲存它們
            const allDots = Array.from(window.seaDotManager.seaDots.values());
            allDots.forEach(dotData => {
                // 儲存被清除的點資料
                hiddenSignalPoints.seaDots.set(dotData.id, {
                    ...dotData,
                    wasOnMap: dotData.marker && mapInstance.hasLayer(dotData.marker)
                });

                // SeaDotManager 管理的都不是歷史軌跡點，全部清除
                if (dotData.marker && mapInstance.hasLayer(dotData.marker)) {
                    mapInstance.removeLayer(dotData.marker);
                    removedCount++;
                }
            });

            // 清空 SeaDotManager 的數據
            window.seaDotManager.seaDots.clear();
            window.seaDotManager.dotIdCounter = 1;
            console.log(`✅ 已清除並儲存 ${allDots.length} 個 SeaDotManager 管理的信號點`);
        }

        // 2. 清除所有非保留的地圖圖層（更徹底的清除）
        console.log('🔍 檢查地圖上的所有圖層...');
        const layersToRemove = [];
        
        mapInstance.eachLayer(function(layer) {
            // 跳過基礎地圖瓦片層
            if (layer instanceof L.TileLayer) {
                return;
            }
            
            // 跳過調查範圍層
            if (layer === investigationRangeLayer) {
                return;
            }
            
            // 跳過歷史軌跡圖層
            if (historyLayersToPreserve.has(layer)) {
                return;
            }
            
            // 其他所有圖層都標記為待移除
            layersToRemove.push(layer);
        });

        // 批量移除非保留圖層
        layersToRemove.forEach(layer => {
            try {
                mapInstance.removeLayer(layer);
                removedCount++;
                console.log('移除非保留圖層:', layer);
            } catch (error) {
                console.warn('移除圖層時發生錯誤:', error);
            }
        });

        // 3. 處理獨立船舶標記（保持原有邏輯作為額外保險）
        if (window.vesselMarkers && typeof window.vesselMarkers === 'object') {
            console.log('🚢 處理獨立船舶標記...');

            Object.keys(window.vesselMarkers).forEach(vesselId => {
                const vesselData = window.vesselMarkers[vesselId];

                // 只移除主要船舶標記（非歷史軌跡類型）
                if (vesselData.marker && mapInstance.hasLayer(vesselData.marker)) {
                    // 檢查是否是歷史軌跡標記
                    if (!vesselData.isHistoryMarker && !vesselData.isTrackMarker && !historyLayersToPreserve.has(vesselData.marker)) {
                        mapInstance.removeLayer(vesselData.marker);
                        console.log(`移除獨立船舶標記: ${vesselId}`);
                    } else {
                        console.log(`保留船舶軌跡標記: ${vesselId}`);
                    }
                }

                // 完全跳過軌跡點的處理（已在步驟2中處理）
                if (vesselData.trackPoints && Array.isArray(vesselData.trackPoints)) {
                    console.log(`保留船舶 ${vesselId} 的 ${vesselData.trackPoints.length} 個軌跡點`);
                }
            });
        }

        console.log(`🎉 清除完成！總共移除 ${removedCount} 個非歷史軌跡點，保留 ${preservedHistoryCount} 個歷史軌跡點`);

        // 更新隱藏狀態
        if (removedCount > 0) {
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

// -----------

// 禁用/啟用特定事件卡的視覺狀態
function setEventCardDisabled(eventId, disabled) {
    const eventCards = document.querySelectorAll('.event-card');
    eventCards.forEach(card => {
        // 檢查事件卡是否對應指定的事件ID
        const cardEventId = eventStorage.getEventIdFromCard(card);
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

// -----------

// 顯示地圖載入指示器
function showMapLoadingIndicator() {
    const mapContainer = document.querySelector('#taiwanMap');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1a1a1a; color: #66e7ff; font-size: 16px;">
                <div style="text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 10px;">🗺️</div>
                    <div>地圖載入中...</div>
                </div>
            </div>
        `;
    }
}

// 隱藏地圖載入指示器
function hideMapLoadingIndicator() {
    // 載入指示器會在地圖初始化時自動被替換
    console.log('🔄 地圖載入指示器已隱藏');
}

// 地圖初始化函數
function initializeTaiwanMap() {
    try {
        // 顯示載入指示器
        showMapLoadingIndicator();

        // 台灣中心座標
        const taiwanCenter = [23.8, 121.0];

        // 建立地圖
        taiwanMap = L.map('taiwanMap', {
            center: taiwanCenter,
            zoom: 7,
            minZoom: 3,//6
            maxZoom: 18,
            zoomControl: true,
            // 優化觸控和拖拽行為
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            boxZoom: true,
            keyboard: true,
            dragging: true,
            // 設定拖拽慣性
            inertia: true,
            inertiaDeceleration: 3000,
            inertiaMaxSpeed: 1500
        });

        // 立即加入海圖圖層（暗色主題，適合海事用途）
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(taiwanMap);

        console.log('✅ 地圖基礎初始化完成');

        // 隱藏載入指示器
        hideMapLoadingIndicator();

        // 延遲添加網格和海域點，避免阻塞地圖顯示
        setTimeout(() => {
            initializeMapFeatures();
        }, 100);
        // 延遲添加網格和海域點，避免阻塞地圖顯示
        setTimeout(() => {
            initializeMapFeatures();
        }, 100);

    } catch (error) {
        console.error('❌ 地圖初始化失敗:', error);
        hideMapLoadingIndicator();
    }
}

// 初始化地圖的輔助功能（網格、事件監聽器、海域點等）
function initializeMapFeatures() {
    if (!taiwanMap) {
        console.warn('⚠️ 地圖未初始化，無法添加輔助功能');
        return;
    }

    console.log('🔧 正在添加地圖輔助功能...');

    try {
        // 動態偏移量計算函數
        function calculateDynamicOffset(baseOffset, minOffset = null) {
            const currentZoom = taiwanMap.getZoom();
            const baseZoom = 7; // 基礎縮放等級（地圖初始化時的縮放等級）

            // 如果沒有指定最小偏移量，則使用基礎偏移量的5%作為最小值
            if (minOffset === null) {
                minOffset = Math.abs(baseOffset) * 0.05;
                if (baseOffset < 0) minOffset = -minOffset; // 保持符號一致
            }

            // 計算縮放比例因子：縮放等級越高，因子越小
            const zoomFactor = Math.pow(0.5, Math.max(0, currentZoom - baseZoom));
            const dynamicOffset = baseOffset >= 0
                ? Math.max(minOffset, baseOffset * zoomFactor)
                : Math.min(minOffset, baseOffset * zoomFactor); // 處理負偏移量

            return dynamicOffset;
        }

        // 添加經緯度參考線（自定義實現）
        function addLatLngGrid() {
            // 確保先完全清理舊的網格
            if (window.gridGroup) {
                try {
                    taiwanMap.removeLayer(window.gridGroup);
                    window.gridGroup = null;
                } catch (e) {
                    console.warn('清理舊網格時出現錯誤:', e);
                }
            }

            const bounds = taiwanMap.getBounds();
            const gridLines = [];

            // 繪製經線（垂直線）
            for (let lng = Math.floor(bounds.getWest()); lng <= Math.ceil(bounds.getEast()); lng += 1) {
                const line = L.polyline([
                    [bounds.getSouth(), lng],
                    [bounds.getNorth(), lng]
                ], {
                    color: '#ffffff',
                    weight: 1,
                    opacity: 0.4,
                    dashArray: '2, 4'
                });
                gridLines.push(line);

                // 計算經度標籤的動態偏移量
                const longitudeOffset = calculateDynamicOffset(0.4, 0.02);

                // 添加經度標籤（置下，使用動態偏移量）
                const label = L.marker([bounds.getSouth() + longitudeOffset, lng], {
                    icon: L.divIcon({
                        html: `<div style="color: white; font-size: 12px; font-weight: bold;">${lng}°E</div>`,
                        className: 'grid-label',
                        iconSize: [40, 20],
                        iconAnchor: [20, 0]  // 下對齊：錨點設為上邊緣
                    })
                });
                gridLines.push(label);
            }

            // 繪製緯線（水平線）
            for (let lat = Math.floor(bounds.getSouth()); lat <= Math.ceil(bounds.getNorth()); lat += 1) {
                const line = L.polyline([
                    [lat, bounds.getWest()],
                    [lat, bounds.getEast()]
                ], {
                    color: '#ffffff',
                    weight: 1,
                    opacity: 0.4,
                    dashArray: '2, 4'
                });
                gridLines.push(line);

                // 計算緯度標籤的動態偏移量
                const latitudeOffset = calculateDynamicOffset(-0.05, -0.0025);

                // 添加緯度標籤（置右，使用動態偏移量）
                const label = L.marker([lat, bounds.getEast() + latitudeOffset], {
                    icon: L.divIcon({
                        html: `<div style="color: white; font-size: 12px; font-weight: bold;">${lat}°N</div>`,
                        className: 'grid-label',
                        iconSize: [40, 20],
                        iconAnchor: [40, 10]  // 右對齊：錨點設為右邊緣
                    })
                });
                gridLines.push(label);
            }

            // 將網格線添加到地圖
            const gridGroup = L.layerGroup(gridLines);
            gridGroup.addTo(taiwanMap);

            // 存儲網格組以便後續更新
            window.gridGroup = gridGroup;

            console.log(`🗺️ 網格已更新，包含 ${gridLines.length} 個元素`);
        }

        // 添加防抖機制防止頻繁更新網格
        let gridUpdateTimeout = null;

        // 地圖移動時更新網格（使用防抖）
        taiwanMap.on('moveend zoomend', function () {
            // 清除之前的延時更新
            if (gridUpdateTimeout) {
                clearTimeout(gridUpdateTimeout);
            }

            // 延遲更新網格，避免頻繁觸發
            gridUpdateTimeout = setTimeout(() => {
                try {
                    addLatLngGrid();
                } catch (error) {
                    console.warn('更新網格時發生錯誤:', error);
                }
                gridUpdateTimeout = null;
            }, 100);
        });

        // 添加地圖事件監聽器來確保指針樣式正確
        taiwanMap.getContainer().style.cursor = 'grab';

        taiwanMap.on('mousedown', function () {
            taiwanMap.getContainer().style.cursor = 'grabbing';
        });

        taiwanMap.on('mouseup', function () {
            taiwanMap.getContainer().style.cursor = 'grab';
        });

        // === SeaDot 動態縮放事件監聽器 ===
        taiwanMap.on('zoomend', function () {
            const currentZoom = taiwanMap.getZoom();
            console.log(`🔍 地圖縮放變化: ${currentZoom}, 正在更新 SeaDot 大小...`);

            // 更新所有 SeaDot 的大小
            if (window.seaDotManager) {
                window.seaDotManager.updateAllSeaDotSizes(taiwanMap);
            }
        });

        // 初始添加網格（延遲以避免阻塞）
        setTimeout(addLatLngGrid, 200);

        console.log('🔧 地圖輔助功能初始化完成');

        // 分批生成海域監測點，避免一次性生成造成延遲
        setTimeout(() => {
            addRandomSeaDots();
        }, 300);

        // 嘗試建立全域 seaDotManager（如果 SeaDotManager 已抽出並可用）
        if (window.__attachSeaDotManager) {
            const attached = window.__attachSeaDotManager();
            if (!attached) {
                console.log('SeaDotManager 尚未可用，稍後可重試 attach');
            }
        }

    } catch (error) {
        console.error('❌ 地圖輔助功能初始化失敗:', error);
    }
}

// 優化的海域監測點生成函數（分批處理）
function addRandomSeaDots() {
    if (!taiwanMap) return;

    console.log('🔵 開始分批生成海域監測點...');

    // 確保全域 seaDotManager 已建立
    if (typeof window.seaDotManager === 'undefined') {
        if (typeof window.__attachSeaDotManager === 'function') {
            const ok = window.__attachSeaDotManager();
            if (!ok) {
                console.log('等待 SeaDotManager 可用，稍後重試生成 SeaDots...');
                setTimeout(addRandomSeaDots, 200);
                return;
            }
        } else {
            console.log('SeaDotManager 尚未定義，稍後重試生成 SeaDots...');
            setTimeout(addRandomSeaDots, 200);
            return;
        }
    }

    // 定義海域範圍（台灣周圍海域 + 南海區域）
    const seaAreas = [
        // 台灣海峽西側
        { latMin: 22.0, latMax: 25.5, lonMin: 119.0, lonMax: 119.8, name: '台灣海峽西側' },
        // 東部海域
        { latMin: 22.0, latMax: 25.5, lonMin: 121.5, lonMax: 122.5, name: '台灣東部海域' },
        // 南部海域
        { latMin: 21.5, latMax: 22.5, lonMin: 120.0, lonMax: 121.5, name: '台灣南部海域' },
        // 巴士海峽
        { latMin: 20.5, latMax: 22.0, lonMin: 120.5, lonMax: 121.8, name: '巴士海峽' },
        // 台灣海峽中央
        { latMin: 23.5, latMax: 24.5, lonMin: 119.2, lonMax: 119.9, name: '台灣海峽中央' },

        // === 南海區域 ===
        // 南海北部（海南島以南）
        { latMin: 16.0, latMax: 20.0, lonMin: 108.0, lonMax: 114.0, name: '南海北部海域' },
        // 西沙群島周邊
        { latMin: 15.5, latMax: 17.5, lonMin: 111.0, lonMax: 113.0, name: '西沙群島海域' },
        // 中沙群島周邊
        { latMin: 13.5, latMax: 16.0, lonMin: 113.5, lonMax: 115.5, name: '中沙群島海域' },
        // 南沙群島北部
        { latMin: 7.0, latMax: 12.0, lonMin: 109.0, lonMax: 116.0, name: '南沙群島北部海域' },
        // 南沙群島南部
        { latMin: 4.0, latMax: 8.0, lonMin: 111.0, lonMax: 114.0, name: '南沙群島南部海域' },
        // 南海中央海盆
        { latMin: 10.0, latMax: 18.0, lonMin: 114.0, lonMax: 118.0, name: '南海中央海盆' },
        // 南海東北部（菲律賓以西）
        { latMin: 14.0, latMax: 20.0, lonMin: 116.0, lonMax: 120.0, name: '南海東北部海域' },
        // 南海東南部
        { latMin: 6.0, latMax: 12.0, lonMin: 116.0, lonMax: 119.0, name: '南海東南部海域' }
    ];

    // 定義台灣本島的大致範圍（避免在陸地上放置圓點）
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

    // 生成隨機海域座標
    function generateSeaCoordinate() {
        const maxAttempts = 10; // 減少嘗試次數
        let attempts = 0;

        while (attempts < maxAttempts) {
            const seaArea = seaAreas[Math.floor(Math.random() * seaAreas.length)];
            const lat = seaArea.latMin + Math.random() * (seaArea.latMax - seaArea.latMin);
            const lon = seaArea.lonMin + Math.random() * (seaArea.lonMax - seaArea.lonMin);

            if (!isOnLand(lat, lon)) {
                return { lat, lon, area: seaArea.name };
            }
            attempts++;
        }

        return { lat: 24.0, lon: 119.5, area: '台灣海峽' };
    }

    const dotCount = 300; // 固定數量，避免隨機延遲

    // 預先計算狀態分配（保持 AIS 狀態的多樣性，但統一使用淺藍色顯示）
    const aisStatusCount = Math.floor(dotCount * 0.5);
    const noAisStatusCount = dotCount - aisStatusCount;

    const statusList = [];
    for (let i = 0; i < aisStatusCount; i++) {
        statusList.push('AIS'); // AIS 開啟狀態
    }
    for (let i = 0; i < noAisStatusCount; i++) {
        statusList.push('No AIS'); // AIS 未開啟狀態
    }

    // 隨機打亂狀態順序
    for (let i = statusList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [statusList[i], statusList[j]] = [statusList[j], statusList[i]];
    }

    // 一次性生成所有海域監測點
    console.log(`🔵 開始生成 ${dotCount} 個海域監測點...`);

    for (let i = 0; i < dotCount; i++) {
        const coord = generateSeaCoordinate();
        const dotId = `SD-${String(i + 1).padStart(3, '0')}`;
        const status = statusList[i]; // 使用狀態列表而非顏色

        // 創建完整的點數據對象
        const samplePoint = {
            pointId: dotId,
            id: dotId,
            lat: coord.lat,
            lon: coord.lon,
            timestamp: new Date().toISOString(),
            type: 'Normal',
            display: {
                backgroundColor: '#1eb0f9ff', // 統一使用淺藍色
                dotColor: '#1eb0f9ff',        // 統一使用淺藍色
                borderRadius: '50%',
                status: status
            }
        };

        // 使用 createSeaDotFromPoint 方法並添加到地圖
        const marker = window.seaDotManager.createSeaDotFromPoint(samplePoint);
        if (marker) {
            marker.addTo(taiwanMap);
        }
    }

    console.log('✅ 所有海域監測點生成完成');
    console.log(`📊 監測點分配: ${aisStatusCount} 個 AIS 開啟狀態 (${(aisStatusCount / dotCount * 100).toFixed(1)}%), ${noAisStatusCount} 個 AIS 未開啟狀態 (${(noAisStatusCount / dotCount * 100).toFixed(1)}%)，所有監測點均顯示為淺藍色`);

    // 在 sea dots 生成完成後，重新初始化 RF 和 Vessel 事件
    if (window.eventStorage && typeof window.eventStorage.reinitializeRFEvents === 'function') {
        window.eventStorage.reinitializeRFEvents();
    }
    if (window.eventStorage && typeof window.eventStorage.reinitializeVesselEvents === 'function') {
        window.eventStorage.reinitializeVesselEvents('vessel-003', '16.797148°N, 115.850213°E');
        window.eventStorage.reinitializeVesselEvents('vessel-004', '11.583010°N, 111.252487°E');
        
        // 在重新初始化後，額外更新事件卡顯示（延遲以確保 DOM 已更新）
        setTimeout(() => {
            updateDefaultVesselEventCards();
        }, 500);
    }

    // 初始化事件計數
    setTimeout(() => {
        updateEventCounts();
    }, 800);
}

// 更新預設船舶事件卡的顯示內容
function updateDefaultVesselEventCards() {
    console.log('🔄 開始更新預設船舶事件卡顯示...');
    
    if (!window.eventStorage) {
        console.warn('⚠️ eventStorage 未初始化，無法更新事件卡');
        return;
    }
    
    // 更新 vessel-003 事件卡
    const vessel003Data = eventStorage.getEvent('vessel-003');
    if (vessel003Data) {
        console.log('📦 vessel-003 資料:', vessel003Data);
        const vessel003Card = document.querySelector('[onclick*="vessel-003"]');
        if (vessel003Card) {
            const eventInfo = vessel003Card.querySelector('.event-info');
            if (eventInfo) {
                eventInfo.innerHTML = `
                    MMSI: ${vessel003Data.mmsi || '未知'}<br>
                    座標: ${vessel003Data.coordinates}<br>
                    威脅分數: ${vessel003Data.threatScore}
                `;
                console.log('✅ 已更新 vessel-003 事件卡顯示');
            } else {
                console.warn('⚠️ 找不到 vessel-003 事件卡的 .event-info 元素');
            }
        } else {
            console.warn('⚠️ 找不到 vessel-003 事件卡');
        }
    } else {
        console.warn('⚠️ 找不到 vessel-003 事件資料');
    }

    // 更新 vessel-004 事件卡
    const vessel004Data = eventStorage.getEvent('vessel-004');
    if (vessel004Data) {
        console.log('📦 vessel-004 資料:', vessel004Data);
        const vessel004Card = document.querySelector('[onclick*="vessel-004"]');
        if (vessel004Card) {
            const eventInfo = vessel004Card.querySelector('.event-info');
            if (eventInfo) {
                eventInfo.innerHTML = `
                    MMSI: ${vessel004Data.mmsi || '未知'}<br>
                    座標: ${vessel004Data.coordinates}<br>
                    威脅分數: ${vessel004Data.threatScore}
                `;
                console.log('✅ 已更新 vessel-004 事件卡顯示');
            } else {
                console.warn('⚠️ 找不到 vessel-004 事件卡的 .event-info 元素');
            }
        } else {
            console.warn('⚠️ 找不到 vessel-004 事件卡');
        }
    } else {
        console.warn('⚠️ 找不到 vessel-004 事件資料');
    }
}

// 清理範例任務卡片
function clearExampleMissions() {
    const missionTimeline = document.querySelector('.mission-list');
    if (missionTimeline) {
        // 清除所有現有的任務卡片
        missionTimeline.innerHTML = '';
        console.log('✅ 已清理任務列表中的範例任務卡片');
    }
}

// 為已存在的船舶事件生成任務卡片
function generateMissionsForExistingVessels() {
    console.log('🚀 開始為已存在的船舶事件生成任務卡片...');

    // 獲取所有船舶事件
    const allEvents = eventStorage.getAllEvents();
    allEvents.forEach(eventData => {
        if (eventData.type === 'vessel' && eventData.trackPoints && eventData.trackPoints.length > 0) {
            console.log(`📍 為船舶事件 ${eventData.id} 生成任務卡片...`);

            // 為該船舶的軌跡點生成任務卡片
            eventStorage.generateMissionCardsFromTrackPoints(eventData.trackPoints, eventData.id);
        }
    });

    console.log('✅ 已完成為所有船舶事件生成任務卡片');
}

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    // 立即初始化地圖，不等待其他依賴
    console.log('🚀 開始地圖初始化...');
    initializeTaiwanMap();

    // 等待 eventStorage 初始化完成
    function waitForEventStorage(callback, maxRetries = 10, currentRetry = 0) {
        if (window.eventStorage && typeof window.eventStorage.reinitializeAreaEvents === 'function') {
            callback();
        } else if (currentRetry < maxRetries) {
            console.log(`⏳ 等待 eventStorage 初始化... (${currentRetry + 1}/${maxRetries})`);
            setTimeout(() => waitForEventStorage(callback, maxRetries, currentRetry + 1), 100);
        } else {
            console.warn('⚠️ eventStorage 初始化超時，跳過相關初始化');
            callback();
        }
    }

    // 其他初始化可以並行進行
    waitForEventStorage(() => {
        // ✅ 最先重新初始化區域事件的監控時間
        if (window.eventStorage && typeof window.eventStorage.reinitializeAreaEvents === 'function') {
            window.eventStorage.reinitializeAreaEvents();
        }

        // 清理任務列表中的範例任務卡片，準備生成真實任務
        clearExampleMissions();

        // 延遲為已存在的船舶事件生成任務卡片（等待軌跡點生成完成）
        setTimeout(() => {
            generateMissionsForExistingVessels();
        }, 500); // 減少延遲時間

        // 不再預設選中任何事件，讓使用者手動選擇

        // 模擬實時任務進度更新
        setInterval(() => {
            const progressBars = document.querySelectorAll('.mission-card .progress-fill');
            progressBars.forEach(bar => {
                const currentWidth = parseFloat(bar.style.width) || 0;
                if (currentWidth < 100 && (bar.closest('.mission-card').querySelector('.mission-status').textContent === '執行任務' || bar.closest('.mission-card').querySelector('.mission-status').textContent === '抵達')) {
                    const newWidth = Math.min(100, currentWidth + Math.random() * 5);
                    bar.style.width = newWidth + '%';

                    const progressText = bar.parentElement.nextElementSibling;
                    progressText.textContent = `進度: ${Math.round(newWidth)}%`;
                }
            });
        }, 5000);

        // 模擬實時狀態更新
        setInterval(() => {
            const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
            const overlayInfo = document.querySelector('.overlay-info');
            if (overlayInfo && overlayInfo.textContent.includes('最後更新')) {
                const currentText = overlayInfo.innerHTML;
                overlayInfo.innerHTML = currentText.replace(/最後更新: \d{2}:\d{2}:\d{2}/, `最後更新: ${timestamp}`);
            }
        }, 30000);

        // 初始化時間軸為空白狀態
        console.log('🕰️ 初始化時間軸為空白狀態...');
        restoreGlobalTimeline();

        // 初始化威脅警示系統
        if (window.threatAlertManager) {
            window.threatAlertManager.startMonitoring();
            console.log('✅ 威脅警示系統已啟動');
        } else {
            console.warn('⚠️ ThreatAlertManager 未初始化');
        }
    }); // 結束 waitForEventStorage 回調
}); // 結束 DOMContentLoaded 事件處理器

// 縮放重置功能
function resetMapZoom() {
    if (taiwanMap) {
        // 清除調查範圍顯示
        clearInvestigationRange();
        
        // 清除歷史軌跡
        if (window.historyTrackManager && typeof window.historyTrackManager.clearHistoryTrack === 'function') {
            window.historyTrackManager.clearHistoryTrack();
            console.log('🗑️ 已清除歷史軌跡');
        }
        
        // 恢復被隱藏的 RF 信號點
        if (typeof restoreHiddenSignalPoints === 'function') {
            const result = restoreHiddenSignalPoints();
            if (result && result.restored > 0) {
                console.log(`✅ 已恢復 ${result.restored} 個 RF 信號點`);
            }
        }

        // 重置事件選擇狀態，確保下次點擊事件卡時會重新渲染
        previousEventId = null;

        // 回復到預設的台灣中心座標和縮放層級
        const defaultCenter = [23.8, 121.0];
        const defaultZoom = 7;

        // 平滑動畫回復到預設視圖
        taiwanMap.setView(defaultCenter, defaultZoom, {
            animate: true,
            duration: 1.5,
            easeLinearity: 0.25
        });

        console.log('🎯 地圖已重置回預設模式');

        // 顯示地圖調整訊息
        showMapAdjustmentMessage('地圖已重置回預設模式');
    }
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

// 切换到船只追踪模式
function switchToTrackingMode(vesselId) {
    timelineMode = 'vessel';
    currentTrackingVessel = vesselId;

    // 改变布局
    const missionSection = document.querySelector('.mission-section');
    if (missionSection) {
        missionSection.classList.add('tracking-mode');
    }

    // 更新時間軸標題和添加返回按鈕
    const timelineHeader = document.querySelector('.mission-right .mission-header');
    if (timelineHeader) {
        timelineHeader.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div class="mission-title">🚢 ${vesselId.toUpperCase()} 軌跡歷史</div>
                <button onclick="switchToGlobalMode()" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">返回</button>
            </div>
            <div class="mission-filter">歷史軌跡 | 任務記錄</div>
        `;
    }

    // 生成船只轨迹时间轴
    generateVesselTimeline(vesselId);
}

// 切换回全局模式
function switchToGlobalMode() {
    timelineMode = 'global';
    currentTrackingVessel = null;

    // 恢复布局
    const missionSection = document.querySelector('.mission-section');
    if (missionSection) {
        missionSection.classList.remove('tracking-mode');
    }

    // 恢复时间轴标题
    const timelineHeader = document.querySelector('.mission-right .mission-header');
    if (timelineHeader) {
        timelineHeader.innerHTML = `
            <div class="mission-title">🕰️ 时间轴</div>
            <div class="mission-filter">今日 | 本週 | 所有</div>
        `;
    }

    // 恢复原有时间轴
    restoreGlobalTimeline();
}

// 生成船只轨迹时间轴
function generateVesselTimeline(vesselId) {
    const eventData = eventStorage.getEvent(vesselId);
    if (!eventData || !eventData.trackPoints) {
        console.warn('沒有找到船隻軌跡資料');
        return;
    }

    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;

    // 清空现有时间轴
    timelineContainer.innerHTML = '<div class="timeline-line"></div>';

    const currentTime = new Date();
    const sevenDaysAgo = new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sevenDaysLater = new Date(currentTime.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 過濾七天內的軌跡點，然後按時間排序
    const sortedPoints = [...eventData.trackPoints]
        .filter(point => {
            const pointTime = new Date(point.timestamp);
            return pointTime >= sevenDaysAgo && pointTime <= sevenDaysLater;
        })
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    sortedPoints.forEach((point, index) => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';

        const pointTime = new Date(point.timestamp);
        const isPast = pointTime < currentTime;

        // 格式化時間顯示
        const time = pointTime.toLocaleTimeString('zh-TW', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });

        // 根據是否有任務和時間狀態顯示不同內容
        const hasTask = point.hasTask || false;
        let taskInfo, taskStatus, dotClass;

        if (hasTask) {
            if (isPast) {
                taskInfo = point.taskInfo || '執行任務';
                taskStatus = '已完成';
                dotClass = 'timeline-dot-completed';
            } else {
                taskInfo = point.taskInfo || '執行任務';
                taskStatus = '已排程';
                dotClass = 'timeline-dot-scheduled';
            }
        } else {
            taskInfo = '正常航行';
            taskStatus = isPast ? '已通過' : '預計通過';
            dotClass = 'timeline-dot';
        }

        timelineItem.innerHTML = `
            <div class="timeline-time">${time}</div>
            <div class="${dotClass}"></div>
            <div class="timeline-content">
                <div class="timeline-title">📍 ${point.lat.toFixed(3)}°N, ${point.lon.toFixed(3)}°E</div>
                <div class="timeline-desc">${taskInfo}</div>
            </div>
        `;

        // 添加點擊事件
        timelineItem.style.cursor = 'pointer';
        timelineItem.addEventListener('click', () => {
            showTrackPointDetails(point, taskStatus, getVesselIdString(point));
        });

        timelineContainer.appendChild(timelineItem);
    });
}

// 顯示軌跡點詳細資訊
function showTrackPointDetails(point, taskStatus, vesselId) {
    // 創建彈出視窗
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.id = 'trackPointModal';

    // defensive: ensure point exists and derive a safe vessel id string
    const safePoint = point || {};
    const pointTime = new Date(safePoint.timestamp);
    const formattedTime = isNaN(pointTime.getTime()) ? '未知時間' : pointTime.toLocaleString('zh-TW');
    const hasTask = safePoint.hasTask || false;
    const vesselIdStr = (vesselId || getVesselIdString(safePoint) || 'UNKNOWN').toString().toUpperCase();

    // 首先檢查是否有相關的派遣任務（移到外面以便全局訪問）
    const linkedMissions = hasTask ? missionTrackManager.getLinkedMissions(getSafePointId(point)) : [];

    // 處理任務資訊變數（用於備用顯示）
    let taskType = '', taskDescription = '';
    let fallbackTaskStatus = '';
    if (hasTask && linkedMissions.length === 0) {
        // 沒有相關派遣任務時，使用隨機邏輯
        const random = Math.random();
        if (random > 0.8) {
            taskType = '衛星重拍';
            taskDescription = '獲取該位置的最新衛星影像';
        } else if (random > 0.6) {
            taskType = 'UAV派遣';
            taskDescription = '派遣無人機進行近距離偵察';
        } else if (random > 0.4) {
            taskType = '聯繫船隻';
            taskDescription = '嘗試與船隻建立通訊聯繫';
        } else {
            taskType = '持續追蹤';
            taskDescription = '執行船隻位置監控和行為分析';
        }
        fallbackTaskStatus = Math.random() > 0.7 ? '已完成' : '執行中';
    }

    modal.innerHTML = `
        <div class="modal-content mission-details-content">
            <div class="modal-header">
                <div class="modal-title">🚢 ${vesselIdStr} 軌跡點詳情</div>
                <button class="close-btn" onclick="closeTrackPointModal()">&times;</button>
            </div>

            ${linkedMissions.length > 0 ? `
                <div class="mission-basic-info">
                    <div class="mission-overview">
                        <div class="mission-status">
                            <span class="status-label">狀態：</span>
                            <span class="mission-status-badge ${linkedMissions[0].status === 'completed' ? 'status-completed' : linkedMissions[0].status === 'scheduled' ? 'status-scheduled' : 'status-dispatched'}">${linkedMissions[0].status}</span>
                        </div>

                        <div class="mission-target">
                            <span class="target-label">目標：</span>
                            <span class="target-value">${linkedMissions[0].target || 'N/A'}</span>
                        </div>

                        <div class="mission-progress">
                            <span class="progress-label">進度：</span>
                            <div class="progress-bar-container">
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${linkedMissions[0].progress || 0}%"></div>
                                </div>
                                <span class="progress-percentage">${linkedMissions[0].progress || 0}%</span>
                            </div>
                        </div>
                    </div>

                    <div class="mission-timing">
                        <div class="time-info">
                            <div class="time-item">
                                <span class="time-label">⏰ 建立時間：</span>
                                <span class="time-value">${linkedMissions[0].startTime ? new Date(linkedMissions[0].startTime).toLocaleString('zh-TW') : 'N/A'}</span>
                            </div>

                            ${linkedMissions[0].scheduledTime ? `
                                <div class="time-item">
                                    <span class="time-label">📅 預定執行：</span>
                                    <span class="time-value scheduled-time">${new Date(linkedMissions[0].scheduledTime).toLocaleString('zh-TW')}</span>
                                </div>
                            ` : ''}

                            <div class="time-item">
                                <span class="time-label">⏳ 預計完成：</span>
                                <span class="time-value">${linkedMissions[0].estimatedCompletion || '計算中'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mission-description">
                    <h4>📋 任務描述</h4>
                    <div class="description-content">
                        ${linkedMissions[0].description || '標準' + linkedMissions[0].type + '任務，監控目標' + (linkedMissions[0].target || '') + '的活動狀況。'}
                    </div>
                </div>
            ` : ''}

            <div class="track-point-details">
                <div class="location-info">
                    <h4>📍 位置資訊</h4>
                    <div class="detail-row">
                        <span>座標:</span>
                        <span>${point.lat.toFixed(6)}°N, ${point.lon.toFixed(6)}°E</span>
                    </div>
                    <div class="detail-row">
                        <span>時間:</span>
                        <span>${formattedTime}</span>
                    </div>
                    <div class="detail-row">
                        <span>航行狀態:</span>
                        <span>${hasTask ? '執行任務中' : '正常航行'}</span>
                    </div>
                    <div class="detail-row">
                        <span>🇹🇼 距台灣:</span>
                        <span>${calculateDistanceToTaiwan(point.lat, point.lon).toFixed(1)}km</span>
                    </div>
                    ${point.threatLevel ? `
                    <div class="detail-row">
                        <span>⚠️ 威脅等級:</span>
                        <span>${point.threatLevel.symbol} ${point.threatLevel.name}</span>
                    </div>
                    ` : ''}
                </div>

                ${point.speed ? `
                <div class="vessel-status-info">
                    <h4>🚢 船舶狀態</h4>
                    <div class="detail-row">
                        <span>航行速度:</span>
                        <span>${point.speed.toFixed(1)} 節</span>
                    </div>
                    ${point.course ? `
                    <div class="detail-row">
                        <span>航向:</span>
                        <span>${point.course.toFixed(0)}°</span>
                    </div>
                    ` : ''}
                    ${point.signalStrength ? `
                    <div class="detail-row">
                        <span>信號強度:</span>
                        <span>${point.signalStrength.toFixed(1)} dBm</span>
                    </div>
                    ` : ''}
                    ${point.deviationFromRoute ? `
                    <div class="detail-row">
                        <span>偏離航線:</span>
                        <span>${point.deviationFromRoute.toFixed(1)}km</span>
                    </div>
                    ` : ''}
                </div>
                ` : ''}

                ${!linkedMissions.length && hasTask ? `
                    <div class="task-info-section">
                        <h4>📋 任務資訊</h4>
                        <div class="task-detail-row">
                            <span>任務類型:</span>
                            <span>${taskType || '監控任務'}</span>
                        </div>
                        <div class="task-detail-row">
                            <span>狀態:</span>
                            <span class="task-status-${(fallbackTaskStatus || taskStatus) === '已完成' ? 'completed' : 'scheduled'}">${fallbackTaskStatus || taskStatus || '執行中'}</span>
                        </div>
                        <div class="task-detail-row">
                            <span>說明:</span>
                            <span>${taskDescription || '執行船舶追蹤和行為分析'}</span>
                        </div>
                    </div>
                ` : ''}

                ${!hasTask ? '<div class="no-task-info">📍 此位置點無特殊任務</div>' : ''}
            </div>

            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeTrackPointModal()">關閉</button>
                ${linkedMissions.length > 0 ? `<button class="btn btn-primary" onclick="showMissionDetails('${linkedMissions[0].missionId}')">查看任務詳情</button>` : ''}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// 關閉軌跡點詳情彈窗
function closeTrackPointModal() {
    const modal = document.getElementById('trackPointModal');
    if (modal) {
        modal.remove();
    }
}

// ==================== 時間軸多時間點功能 ====================

// 解析時間字串為 Date 物件（假設今天）
function parseTimeString(timeStr) {
    const today = new Date().toISOString().split('T')[0];
    return new Date(`${today} ${timeStr}`);
}

// 取得事件標題
function getEventTitle(event) {
    switch(event.type) {
        case 'vessel': return `🚢 ${event.id.toUpperCase()}`;
        case 'rf': return `📡 ${event.rfId || event.id.toUpperCase()}`;
        case 'area': return `🗺️ ${event.aoiName || event.id.toUpperCase()}`;
        default: return event.id.toUpperCase();
    }
}

// ==================== 時間軸多時間點功能結束 ====================

// 恢复全局时间轴（清空時間軸，因為預設不顯示）
function restoreGlobalTimeline() {
    const timelineContainer = document.querySelector('.timeline-container');
    if (!timelineContainer) return;

    // 清空時間軸，顯示提示訊息
    timelineContainer.innerHTML = `
        <div class="timeline-line"></div>
        <div class="timeline-item" style="position: absolute; left: 50%; transform: translateX(-50%); text-align: center; color: #64748b; font-size: 13px; white-space: nowrap;">
            點擊船舶事件以查看任務時間軸
        </div>
    `;
}

// 新增：添加时间轴事件（時間軸現在只在點擊船舶時顯示，此函數暫時保留但不執行渲染）
function addTimelineEvent(status, title, description, missionId) {
    // 時間軸已改為只顯示船舶任務，此函數保留以避免其他地方調用時出錯
    // 如果當前是船舶模式，由 generateVesselTimeline 處理顯示
    console.log('addTimelineEvent 已棄用，時間軸現由 generateVesselTimeline 管理');
}

// 获取当前选中事件的目标信息
function getTargetInfo() {
    const currentEvent = eventStorage.getEvent(currentEventId);
    if (!currentEvent) return 'N/A';

    switch (currentEvent.type) {
        case 'vessel':
            // 船舶事件：使用MMSI
            return currentEvent.mmsi || 'MMSI-N/A';
        
        // ========== 暫時停用 RF 監控事件功能 ==========
        /*
        case 'rf':
            // RF事件：使用RF ID
            return currentEvent.rfId || 'RF-N/A';
        */
        // ========== RF 監控事件功能結束 ==========
        
        case 'area':
            // 区域事件：使用区域名称
            return currentEvent.aoiName || '区域-N/A';
        default:
            return currentEventId.toUpperCase();
    }
}

// 高亮任务卡并同步高亮时间轴
function highlightMissionCard(missionId) {
    // 清除所有高亮
    document.querySelectorAll('.mission-card').forEach(card => {
        card.classList.remove('highlighted');
    });
    document.querySelectorAll('.timeline-item').forEach(item => {
        item.classList.remove('highlighted');
    });

    // 高亮选中的任务卡
    const missionCard = document.querySelector(`[data-mission-id="${missionId}"]`);
    if (missionCard) {
        missionCard.classList.add('highlighted');
        // 滚动到视野内
        missionCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // 高亮对应时间轴项
    const timelineItem = document.querySelector(`.timeline-item[data-mission-id="${missionId}"]`);
    if (timelineItem) {
        timelineItem.classList.add('highlighted');
        // 滚动到视野内
        timelineItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

// 顯示已完成任務 (歷史軌跡點) - 包含威脅評估
function showCompletedTasksForPoint(point, vesselId) {
    const completedTasks = getCompletedTasksForPoint(point, vesselId);
    const vesselEvent = eventStorage.getEvent(vesselId);
    const vesselHistory = vesselEvent && vesselEvent.trackPoints ? vesselEvent.trackPoints : [];

    if (typeof showTaskModalWithThreat === 'function') {
        showTaskModalWithThreat(point, vesselId, completedTasks, '已完成任務', 'completed', vesselHistory);
    } else {
        showTaskModal(point, vesselId, completedTasks, '已完成任務', 'completed');
    }
}

// 顯示已排程任務 (未來軌跡點) - 包含威脅評估
function showScheduledTasksForPoint(point, vesselId) {
    const scheduledTasks = getScheduledTasksForPoint(point, vesselId);
    const vesselEvent = eventStorage.getEvent(vesselId);
    const vesselHistory = vesselEvent && vesselEvent.trackPoints ? vesselEvent.trackPoints : [];

    if (typeof showTaskModalWithThreat === 'function') {
        showTaskModalWithThreat(point, vesselId, scheduledTasks, '已排程任務', 'scheduled', vesselHistory);
    } else {
        showTaskModal(point, vesselId, scheduledTasks, '已排程任務', 'scheduled');
    }
}

// 統一的任務模態框顯示（包含AIS訊號狀態）
function showTaskModal(point, vesselId, tasks, taskTypeTitle, taskStatus) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.id = 'trackPointTaskModal';

    const pointTime = new Date(point.timestamp);
    const formattedTime = pointTime.toLocaleString('zh-TW');

    // 檢查AIS訊號狀態
    const isAbnormal = checkSignalAbnormality(point);
    const aisStatus = isAbnormal ? '異常' : '正常';
    const aisStatusClass = isAbnormal ? 'ais-abnormal' : 'ais-normal';

    const tasksHtml = tasks.length > 0
        ? tasks.map(task => `
            <div class="task-item ${taskStatus}">
                <div class="task-header">
                    <span class="task-icon">${task.icon}</span>
                    <span class="task-type">${task.type}</span>
                    <span class="task-status-badge status-${taskStatus}">${taskStatus === 'completed' ? '已完成' : '已排程'}</span>
                </div>
                <div class="task-description">${task.description}</div>
                <div class="task-time">${taskStatus === 'completed' ? '完成時間' : '預計執行'}: ${task.time}</div>
            </div>
        `).join('')
        : `<div class="no-tasks">此軌跡點${taskStatus === 'completed' ? '尚無已完成' : '暫無已排程'}任務</div>`;

    modal.innerHTML = `
        <div class="modal-content task-modal">
            <div class="modal-header">
                <div class="modal-title">🚢 ${vesselId.toUpperCase()} - ${taskTypeTitle}</div>
                <button class="close-btn" onclick="closeTaskModal()">&times;</button>
            </div>

            <div class="point-info">
                <div class="point-location">📍 ${point.lat.toFixed(6)}°N, ${point.lon.toFixed(6)}°E</div>
                <div class="point-time">🕐 ${formattedTime}</div>
                <div class="ais-status">
                    <span class="ais-label">📡 AIS訊號狀態:</span>
                    <span class="ais-value ${aisStatusClass}">${aisStatus}</span>
                </div>
                ${isAbnormal ? `
                    <div class="signal-details">
                        <div class="signal-item">速度: ${point.speed ? point.speed.toFixed(1) : 'N/A'} 節</div>
                        <div class="signal-item">信號強度: ${point.signalStrength ? point.signalStrength.toFixed(1) : 'N/A'} dBm</div>
                        <div class="signal-item">航線偏離: ${point.deviationFromRoute ? point.deviationFromRoute.toFixed(1) : 'N/A'} 公里</div>
                    </div>
                ` : ''}
            </div>

            <div class="tasks-container">
                <h4>${taskTypeTitle}</h4>
                ${tasksHtml}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// 關閉任務模態框
function closeTaskModal() {
    const modal = document.getElementById('trackPointTaskModal');
    if (modal) {
        modal.remove();
    }
}

// 檢查訊號異常狀態（全局函數版本）
function checkSignalAbnormality(trackPointData) {
    // 1. 檢查是否有異常的速度變化
    if (trackPointData.speed && (trackPointData.speed > 25 || trackPointData.speed < 0.5)) {
        return true;
    }

    // 2. 檢查是否偏離航線過遠
    if (trackPointData.deviationFromRoute && trackPointData.deviationFromRoute > 5) {
        return true;
    }

    // 3. 檢查AIS信號強度
    if (trackPointData.signalStrength && trackPointData.signalStrength < -80) {
        return true;
    }

    // 4. 檢查是否在禁航區域
    if (trackPointData.inRestrictedZone) {
        return true;
    }

    return false;
}

// 獲取軌跡點的已完成任務
function getCompletedTasksForPoint(point, vesselId) {
    const tasks = [];

    if (point.hasTask) {
        // 檢查是否有相關的派遣任務
        const linkedMissions = missionTrackManager.getLinkedMissions(getSafePointId(point));

        if (linkedMissions.length > 0) {
            // 顯示相關派遣任務的資訊
            linkedMissions.forEach(mission => {
                if (mission.status === '已完成') {
                    // 將派遣任務類型映射到四個固定選項
                    let taskIcon, taskType, taskDescription;

                    switch (mission.type) {
                        case 'UAV 派遣':
                            taskIcon = '🚁';
                            taskType = 'UAV派遣';
                            taskDescription = `已完成無人機監控 - 目標: ${mission.target}`;
                            break;
                        case '衛星重拍':
                            taskIcon = '🛰️';
                            taskType = '衛星重拍';
                            taskDescription = `已獲取衛星影像 - 目標: ${mission.target}`;
                            break;
                        case '持續追蹤':
                            taskIcon = '🎯';
                            taskType = '持續追蹤';
                            taskDescription = `已完成船隻監控 - 目標: ${mission.target}`;
                            break;
                        case '聯繫船隻':
                            taskIcon = '📞';
                            taskType = '聯繫船隻';
                            taskDescription = `已完成通訊嘗試 - 目標: ${mission.target}`;
                            break;
                        default:
                            taskIcon = '🎯';
                            taskType = '持續追蹤';
                            taskDescription = `已完成${mission.type} - 目標: ${mission.target}`;
                    }

                    tasks.push({
                        icon: taskIcon,
                        type: taskType,
                        description: taskDescription,
                        time: mission.completedTime ? new Date(mission.completedTime).toLocaleString('zh-TW') : new Date(mission.startTime).toLocaleString('zh-TW'),
                        missionId: mission.missionId
                    });
                }
            });
        }

        // 如果沒有相關派遣任務，則使用原有邏輯
        if (tasks.length === 0) {
            tasks.push({
                icon: '🎯',
                type: '持續追蹤',
                description: '已完成船隻位置監控和行為分析',
                time: new Date(point.timestamp).toLocaleString('zh-TW')
            });

            if (Math.random() > 0.7) {
                tasks.push({
                    icon: '🛰️',
                    type: '衛星重拍',
                    description: '已獲取該位置的最新衛星影像',
                    time: new Date(point.timestamp + 30 * 60 * 1000).toLocaleString('zh-TW')
                });
            }
        }
    }

    return tasks;
}

// 獲取軌跡點的已排程任務
function getScheduledTasksForPoint(point, vesselId) {
    const tasks = [];

    if (point.hasTask) {
        // 檢查是否有相關的派遣任務
        const linkedMissions = missionTrackManager.getLinkedMissions(getSafePointId(point));

        if (linkedMissions.length > 0) {
            // 顯示相關派遣任務的資訊
            linkedMissions.forEach(mission => {
                if (mission.status === '派遣' || mission.status === '執行任務') {
                    // 將派遣任務類型映射到四個固定選項
                    let taskIcon, taskType, taskDescription;

                    switch (mission.type) {
                        case 'UAV 派遣':
                            taskIcon = '🚁';
                            taskType = 'UAV派遣';
                            taskDescription = `預定無人機監控 - 目標: ${mission.target}`;
                            break;
                        case '衛星重拍':
                            taskIcon = '🛰️';
                            taskType = '衛星重拍';
                            taskDescription = `預定獲取衛星影像 - 目標: ${mission.target}`;
                            break;
                        case '持續追蹤':
                            taskIcon = '🎯';
                            taskType = '持續追蹤';
                            taskDescription = `預定監控船隻 - 目標: ${mission.target}`;
                            break;
                        case '聯繫船隻':
                            taskIcon = '📞';
                            taskType = '聯繫船隻';
                            taskDescription = `預定與船隻通訊 - 目標: ${mission.target}`;
                            break;
                        default:
                            taskIcon = '🎯';
                            taskType = '持續追蹤';
                            taskDescription = `預定執行${mission.type} - 目標: ${mission.target}`;
                    }

                    const statusText = mission.status === '派遣' ? '已排程' : '執行中';
                    tasks.push({
                        icon: taskIcon,
                        type: taskType,
                        description: `${statusText}: ${taskDescription}`,
                        time: mission.scheduledTime ? new Date(mission.scheduledTime).toLocaleString('zh-TW') : new Date(mission.startTime).toLocaleString('zh-TW'),
                        missionId: mission.missionId
                    });
                }
            });
        }

        // 如果沒有相關派遣任務，則使用原有邏輯
        if (tasks.length === 0) {
            tasks.push({
                icon: '🎯',
                type: '預定追蹤',
                description: '將在船隻抵達此位置時進行監控',
                time: new Date(point.timestamp).toLocaleString('zh-TW')
            });

            if (Math.random() > 0.6) {
                tasks.push({
                    icon: '🚁',
                    type: 'UAV派遣',
                    description: '派遣無人機進行近距離偵察',
                    time: new Date(point.timestamp + 60 * 60 * 1000).toLocaleString('zh-TW')
                });
            }
        }
    }

    return tasks;
}
// 顯示派遣任務詳情（包含相關軌跡點資訊）
function showMissionDetails(missionId) {
    console.log('Showing mission details for:', missionId);

    // 從統一管理器獲取任務資訊和相關軌跡點
    const mission = missionTrackManager.missions.get(missionId);
    const linkedTrackPoints = missionTrackManager.getLinkedTrackPoints(missionId);

    console.log('Mission data:', mission);
    console.log('Linked track points:', linkedTrackPoints);

    if (!mission) {
        console.warn('Mission not found:', missionId);
        alert('任務資訊不存在');
        return;
    }

    // 創建任務詳情模態框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.id = 'missionDetailsModal';

    const formattedStartTime = new Date(mission.startTime).toLocaleString('zh-TW');
    const formattedScheduledTime = mission.scheduledTime ? new Date(mission.scheduledTime).toLocaleString('zh-TW') : null;

    // 判斷任務狀態和顯示顏色
    const statusClass = mission.status === '已完成' ? 'status-completed' :
        mission.status === '執行任務' ? 'status-executing' :
            mission.status === '派遣' ? 'status-dispatched' : 'status-scheduled';

    // 生成相關軌跡點的HTML
    const trackPointsHtml = linkedTrackPoints.length > 0
        ? linkedTrackPoints.map(point => {
            const pointTime = new Date(point.timestamp).toLocaleString('zh-TW');
            const pointType = point.type === 'History' ? '歷史' : point.type === 'Future' ? '預測' : '當前';
            const threatLevel = point.threatLevel ? `${point.threatLevel.symbol} ${point.threatLevel.name}` : '未評估';
            const distance = point.lat && point.lon ? calculateDistanceToTaiwan(point.lat, point.lon).toFixed(1) : 'N/A';

            return `
                <div class="linked-track-point" onclick="highlightTrackPoint('${point.pointId}')">
                    <div class="track-point-header">
                        <span class="track-point-type">${pointType}點</span>
                        <span class="track-point-time">${pointTime}</span>
                    </div>
                    <div class="track-point-location">
                        📍 ${point.lat ? point.lat.toFixed(6) : 'N/A'}°N, ${point.lon ? point.lon.toFixed(6) : 'N/A'}°E
                    </div>
                    <div class="track-point-threat">
                        ⚠️ 威脅等級: ${threatLevel} | 🇹🇼 距台灣: ${distance}km
                    </div>
                </div>
            `;
        }).join('')
        : '<div class="no-track-points">此任務暫無關聯的軌跡點</div>';

    modal.innerHTML = `
        <div class="modal-content mission-details-content">
            <div class="modal-header">
                <div class="modal-title">🚢 ${mission.type} - ${missionId}</div>
                <button class="close-btn" onclick="closeMissionDetailsModal()">&times;</button>
            </div>

            <div class="mission-basic-info">
                <div class="mission-overview">
                    <div class="mission-status">
                        <span class="status-label">狀態：</span>
                        <span class="mission-status-badge ${statusClass}">${mission.status}</span>
                    </div>

                    <div class="mission-target">
                        <span class="target-label">目標：</span>
                        <span class="target-value">${mission.target || 'N/A'}</span>
                    </div>

                    <div class="mission-progress">
                        <span class="progress-label">進度：</span>
                        <div class="progress-bar-container">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${mission.progress || 0}%"></div>
                            </div>
                            <span class="progress-percentage">${mission.progress || 0}%</span>
                        </div>
                    </div>
                </div>

                <div class="mission-timing">
                    <div class="time-info">
                        <div class="time-item">
                            <span class="time-label">⏰ 建立時間：</span>
                            <span class="time-value">${formattedStartTime}</span>
                        </div>

                        ${formattedScheduledTime ? `
                            <div class="time-item">
                                <span class="time-label">📅 預定執行：</span>
                                <span class="time-value scheduled-time">${formattedScheduledTime}</span>
                            </div>
                        ` : ''}

                        <div class="time-item">
                            <span class="time-label">⏳ 預計完成：</span>
                            <span class="time-value">${mission.estimatedCompletion || '計算中'}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mission-description">
                <h4>📋 任務描述</h4>
                <div class="description-content">
                    ${mission.description || '標準' + mission.type + '任務，監控目標' + (mission.target || '') + '的活動狀況。'}
                </div>
            </div>

            ${mission.type === '衛星重拍' && linkedTrackPoints.length > 0 && linkedTrackPoints.some(point => point.type !== 'Future') ? `
            <div class="satellite-image-section">
                <h4>🛰️ 衛星影像</h4>
                <div class="satellite-image-container">
                    <img src="images/image1.png"
                         alt="衛星影像"
                         style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #e5e7eb;" />
                </div>
            </div>
            ` : ''}

            <div class="linked-track-points-section">
                <h4>🎯 相關軌跡點 (${linkedTrackPoints.length})</h4>
                <div class="track-points-container">
                    ${trackPointsHtml}
                </div>
            </div>

            <div class="mission-actions">
                <button class="btn btn-secondary" onclick="closeMissionDetailsModal()">關閉</button>
                ${mission.status !== '已完成' ? '<button class="btn btn-primary" onclick="updateMissionStatus(\'' + missionId + '\')">更新狀態</button>' : ''}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

// 關閉任務詳情模態框
function closeMissionDetailsModal() {
    const modal = document.getElementById('missionDetailsModal');
    if (modal) {
        modal.remove();
    }
}

// 高亮軌跡點（當從任務詳情點擊軌跡點時）
function highlightTrackPoint(pointId) {
    console.log('Highlighting track point:', pointId);

    // 在地圖上高亮對應的軌跡點
    if (window.taiwanMap && window.vesselMarkers) {
        Object.keys(vesselMarkers).forEach(vesselId => {
            const vesselData = vesselMarkers[vesselId];
            if (vesselData.trackPoints) {
                vesselData.trackPoints.forEach(point => {
                    if (point.pointId === pointId && point.marker) {
                        // 暫時放大標記以示高亮
                        const originalIcon = point.marker.getIcon();
                        point.marker.setIcon(L.divIcon({
                            ...originalIcon.options,
                            html: originalIcon.options.html.replace('font-size: 16px', 'font-size: 24px'),
                            className: originalIcon.options.className + ' highlighted-track-point'
                        }));

                        // 3秒後恢復原狀
                        setTimeout(() => {
                            if (point.marker) {
                                point.marker.setIcon(originalIcon);
                            }
                        }, 3000);

                        // 地圖移動到該點
                        taiwanMap.setView([point.lat, point.lon], Math.max(taiwanMap.getZoom(), 10));
                    }
                });
            }
        });
    }
}

// 更新任務狀態
function updateMissionStatus(missionId) {
    const mission = missionTrackManager.missions.get(missionId);
    if (mission) {
        // 簡單的狀態循環邏輯
        const statusCycle = ['派遣', '執行任務', '已完成'];
        const currentIndex = statusCycle.indexOf(mission.status);
        const nextIndex = (currentIndex + 1) % statusCycle.length;

        mission.status = statusCycle[nextIndex];
        mission.progress = mission.status === '已完成' ? 100 :
            mission.status === '執行任務' ? Math.min(90, (mission.progress || 0) + 30) :
                mission.progress || 15;

        console.log(`Updated mission ${missionId} status to: ${mission.status}, progress: ${mission.progress}%`);

        // 刷新任務詳情顯示
        closeMissionDetailsModal();
        showMissionDetails(missionId);

        // 更新任務卡片顯示
        updateMissionCardDisplay(missionId, mission);
    }
}

// 更新任務卡片顯示
function updateMissionCardDisplay(missionId, mission) {
    const missionCard = document.querySelector(`[data-mission-id="${missionId}"]`);
    if (missionCard) {
        const statusBadge = missionCard.querySelector('.mission-status');
        const progressFill = missionCard.querySelector('.progress-fill');
        const progressText = missionCard.querySelector('.progress-text');

        if (statusBadge) {
            statusBadge.textContent = mission.status;
            statusBadge.className = `mission-status ${mission.status === '已完成' ? 'status-completed' :
                mission.status === '執行任務' ? 'status-executing' :
                    mission.status === '派遣' ? 'status-dispatched' : 'status-scheduled'}`;
        }

        if (progressFill) {
            progressFill.style.width = `${mission.progress}%`;
        }

        if (progressText) {
            progressText.textContent = mission.status === '已完成' ? '已完成 | 任務結束' :
                `進度: ${mission.progress}% | ${mission.estimatedCompletion || '計算中'}`;
        }
    }
}

// === 決策建議收合展開功能 ===
function toggleDecisionRecommendation() {
    const content = document.getElementById('decision-recommendation-content');
    const icon = document.getElementById('decision-collapse-icon');

    if (!content || !icon) {
        console.warn('決策建議收合元素未找到');
        return;
    }

    if (content.classList.contains('collapsed')) {
        // 展開
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        icon.textContent = '▲';
    } else {
        // 收合
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        icon.textContent = '▼';
    }
}

// 保障性：在 DOMContentLoaded 時再次嘗試 attach（避免載入順序造成的 race）
document.addEventListener('DOMContentLoaded', () => {
    if (window.__attachSeaDotManager && !window.seaDotManager) {
        const ok = window.__attachSeaDotManager();
        if (ok) console.log('SeaDotManager attached on DOMContentLoaded fallback');
    }
});

// === 清除地圖上除歷史軌跡點外的所有信號點功能 ===

// 全域變數用於儲存被清除的信號點資料
let hiddenSignalPoints = {
    seaDots: new Map(),           // 儲存被清除的 SeaDotManager 點
    vesselMarkers: {},            // 儲存被清除的船舶標記
    investigationRange: null,     // 儲存被清除的調查範圍
    temporaryMarkers: [],         // 儲存被清除的臨時標記
    clearTime: null,              // 清除時間戳
    isCleared: false              // 是否有被清除的點
};

/**
 * 安全檢查地圖實例並獲取有效的地圖對象
 * @returns {Object|null} 有效的地圖實例或null
 */
function getValidMapInstance() {
    // 首先檢查全局的 taiwanMap 變量
    if (typeof taiwanMap !== 'undefined' && taiwanMap && typeof taiwanMap.hasLayer === 'function') {
        return taiwanMap;
    }
    // 檢查 window.taiwanMap
    if (window.taiwanMap && typeof window.taiwanMap.hasLayer === 'function') {
        return window.taiwanMap;
    }
    // 都沒有找到有效的地圖實例
    return null;
}