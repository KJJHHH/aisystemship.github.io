// RFEventManager extracted from script.js
(function(){
  /**
   * RF監控事件管理器
   * 負責處理RF監控事件的詳情生成、船隻資訊管理和船舶事件創建
   */
  class RFEventManager {
    /**
     * 從儲存資料生成 RF 監控事件詳情
     * @param {Object} eventData - 事件資料物件
     * @returns {string} HTML 字串表示的事件詳情
     */
    static getRFEventDetailsFromStorage(eventData) {
        // 使用AIS狀態一致性管理函數確保狀態正確
        eventData = RFEventManager.ensureAISStatusConsistency(eventData);
        
        // 生成船隻信息內容
        let shipInfoSection = '';
        if (eventData.aisStatus === '已開啟') {
            // AIS開啟 - 顯示該船的簡單信息
            const shipInfo = RFEventManager.generateShipInfo(eventData);
            eventData.shipInfo = shipInfo; // 儲存生成的船隻資訊
            shipInfoSection = `
            <div class="evidence-section">
                <div class="section-title">🚢 船隻資訊</div>
                <div class="ship-info-card ais-enabled">
                    <div class="ship-header">
                        <span class="ship-type">${shipInfo.type}</span>
                        <span class="ship-status status-ais">AIS已開啟</span>
                    </div>
                    <div class="ship-image-container">
                        <img src="${shipInfo.image}" alt="${shipInfo.type}" class="ship-image" />
                    </div>
                    <div class="ship-details">
                        <div class="detail-row"><span>MMSI:</span><span>${shipInfo.mmsi}</span></div>
                        <div class="detail-row"><span>船長:</span><span>${shipInfo.length}公尺</span></div>
                        <div class="detail-row"><span>船寬:</span><span>${shipInfo.beam}公尺</span></div>
                        <div class="detail-row"><span>航速:</span><span>${shipInfo.speed}節</span></div>
                        <div class="detail-row"><span>航向:</span><span>${shipInfo.course}°</span></div>
                    </div>
                </div>
            </div>`;
        } else {
            // AIS未開啟 - 顯示可疑船隻候選列表
            const candidates = RFEventManager.generateSuspiciousCandidates(eventData);
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
                    <button class="investigate-btn-small" onclick="createVesselEventFromRF()">
                        建立船舶調查
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
        
            <div class="evidence-section">
                <div class="section-title">📊 RF 監控資訊</div>
                
                <div class="evidence-item">
                    <div class="evidence-title">信號特徵</div>
                    <div class="evidence-desc">
                        📡 頻率: ${eventData.frequency || '檢測中'}<br>
                        📊 強度: ${eventData.strength || '檢測中'}<br>
                        🔍 調變: GMSK<br>
                    </div>
                </div>
            </div>

            ${shipInfoSection}
        `;            
    }

    /**
     * 生成船隻資訊（AIS開啟時使用）
     * @param {Object} eventData - 事件資料物件
     * @returns {Object} 生成的船隻資訊物件
     */
    static generateShipInfo(eventData) {
        const shipTypes = ['貨輪', '漁船'];
        const shipNamePrefixes = ['MV', 'SS', 'MT', 'FV'];
        const shipNameSuffixes = ['Navigator', 'Explorer', 'Pioneer', 'Guardian', 'Voyager', 'Mariner', 'Ocean Star', 'Sea Wind'];
        const destinations = ['高雄港', '基隆港', '台中港', '花蓮港', '台南港', '馬公港', '金門港'];
        
        // 根據eventData生成一致的船隻資訊
        const rfId = eventData.rfId || 'SIG-DEFAULT';
        const seed = rfId.split('-')[1] || '000';
        const numSeed = parseInt(seed.replace(/[^0-9]/g, ''), 16) || 123;
        
        const selectedShipType = shipTypes[numSeed % shipTypes.length];
        
        // 根據船舶類型獲取對應的圖片路徑
        const getShipImage = (shipType) => {
            return `images/${shipType}.jpg`;
        };
        
        return {
            name: `${shipNamePrefixes[numSeed % shipNamePrefixes.length]} ${seed} ${shipNameSuffixes[numSeed % shipNameSuffixes.length]}`,
            mmsi: `416${(numSeed % 1000000).toString().padStart(6, '0')}`,
            type: selectedShipType,
            image: getShipImage(selectedShipType),
            length: 80 + (numSeed % 270),
            beam: 12 + (numSeed % 35),
            destination: destinations[numSeed % destinations.length],
            speed: 8 + (numSeed % 15),
            course: numSeed % 360
        };
    }

    /**
     * 生成可疑船隻候選列表（AIS未開啟時使用）
     * @param {Object} eventData - 事件資料物件
     * @returns {Array} 可疑船隻候選陣列
     */
    static generateSuspiciousCandidates(eventData) {
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

    /**
     * 從 RF 事件建立船舶追蹤
     * @param {Object} rfEventData - RF事件資料（可選，如果沒有提供則使用當前事件）
     * @returns {string|null} 建立的船舶事件ID或null（如果失敗）
     */
    static createVesselEventFromRF(rfEventData = null) {
        // 這個函數需要訪問全域變數，將作為橋接函數
        if (typeof window.createVesselEventFromRF === 'function') {
            return window.createVesselEventFromRF();
        } else {
            console.error('createVesselEventFromRF function not available');
            return null;
        }
    }

    /**
     * 確保 AIS 狀態一致性
     * @param {Object} eventData - 事件資料物件
     * @returns {Object} 更新後的事件資料物件
     */
    static ensureAISStatusConsistency(eventData) {
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
            const resolvedColor = (typeof window.getDotColor === 'function') ? window.getDotColor(eventData.sourceSeaDot) : (eventData.sourceSeaDot && eventData.sourceSeaDot.dotColor) || null;
            if (resolvedColor === '#ef4444' || resolvedColor === 'red') {
                eventData.aisStatus = '未開啟';
            } else if (resolvedColor === '#059669' || resolvedColor === 'green') {
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
                    const resolvedColor = (typeof window.getDotColor === 'function') ? window.getDotColor(dot) : (dot && dot.dotColor) || null;
                    if (resolvedColor === '#ef4444' || resolvedColor === 'red') {
                        eventData.aisStatus = '未開啟';
                    } else if (resolvedColor === '#059669' || resolvedColor === 'green') {
                        eventData.aisStatus = '已開啟';
                    } else {
                        eventData.aisStatus = '未知';
                    }
                    // 同時補充sourceSeaDot資訊
                    eventData.sourceSeaDot = {
                        id: window.getSafePointId ? window.getSafePointId(dot) : dot.id,
                        status: dot.status,
                        dotColor: window.getDotColor ? window.getDotColor(dot) : (dot.dotColor || '#ef4444'),
                        area: dot.area,
                        lat: dot.lat,
                        lon: dot.lon,
                        display: {
                            dotColor: window.getDotColor ? window.getDotColor(dot) : (dot.dotColor || '#ef4444'),
                            backgroundColor: (typeof window.getBackgroundColor === 'function') ? window.getBackgroundColor(dot) : (dot.backgroundColor || (window.getDotColor ? window.getDotColor(dot) : '#ef4444'))
                        }
                    };
                    console.log(`🔵 從seaDotManager推導事件 ${eventData.id || 'RF事件'} AIS狀態: ${eventData.aisStatus}`);
                } else {
                    // 如果找不到對應的dot，設為未知
                    eventData.aisStatus = '未知';
                    console.log(`🔵 未找到對應的seaDot，設置事件 ${eventData.id || 'RF事件'} AIS狀態為: 未知`);
                }
            } else {
                // 如果無法查找，設為未知
                eventData.aisStatus = '未知';
                console.log(`🔵 無法查找seaDot，設置事件 ${eventData.id || 'RF事件'} AIS狀態為: 未知`);
            }
        }
        
        // 將AIS狀態更新到儲存中
        if (eventData.id && window.eventStorage) {
            window.eventStorage.updateEvent(eventData.id, { 
                aisStatus: eventData.aisStatus,
                sourceSeaDot: eventData.sourceSeaDot 
            });
        }
        
        return eventData;
    }
}

  // expose a global instance
  window.RFEventManager = RFEventManager;
})();