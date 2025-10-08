// AreaEventManager extracted from script.js
(function(){
  /**
   * 區域監控事件管理器
   * 負責處理區域監控事件的詳情生成、RF信號管理和事件創建
   */
  class AreaEventManager {
    /**
     * 從儲存資料生成區域監控事件詳情
     * @param {Object} eventData - 事件資料物件
     * @returns {string} HTML 字串表示的事件詳情
     */
    static getAreaEventDetailsFromStorage(eventData) {
        // 檢查是否需要動態生成可疑船隻候選資訊
        if (!eventData.suspiciousVesselCandidates && !eventData.suspiciousVesselCandidatesData) {        
            // 創建一個帶有重試機制的函數來動態建立未開啟AIS的可疑船隻候選點
            const attemptGetRFSignals = (retryCount = 0, maxRetries = 5) => {
                const rfSignalsInfo = AreaEventManager.getRFSignalsWithoutAIS(eventData);            
                if (rfSignalsInfo && rfSignalsInfo.rfSignalsWithoutAIS) {
                    // 成功獲取數據，建立可疑船隻候選清單
                    eventData.suspiciousVesselCandidates = rfSignalsInfo.rfIdsWithoutAIS;
                    
                    // 建立可疑船隻候選詳細資料(包含完整的原始座標資訊)
                    eventData.suspiciousVesselCandidatesData = rfSignalsInfo.rfSignalsWithoutAIS.map((signal, index) => {
                        return {
                            rfId: signal.rfId,
                            frequency: signal.frequency,
                            strength: signal.strength,
                            index: index,
                            aisStatus: signal.aisStatus,
                            // 保留完整的 sourceSeaDot 資訊以確保座標精度
                            sourceSeaDot: signal.sourceSeaDot
                        };
                    });
                    
                    // 更新儲存的事件資料
                    window.eventStorage.updateEvent(eventData.id, { 
                        suspiciousVesselCandidates: eventData.suspiciousVesselCandidates,
                        suspiciousVesselCandidatesData: eventData.suspiciousVesselCandidatesData 
                    });
                    
                    console.log(`✅ 已為事件 ${eventData.id} 動態生成並儲存可疑船隻候選資訊:`, {
                        suspiciousVesselCandidates: eventData.suspiciousVesselCandidates,
                        suspiciousVesselCandidatesData: eventData.suspiciousVesselCandidatesData
                    });
                    
                    // 重新更新詳情面板以顯示新數據
                    if (eventData.id === window.currentEventId) {
                        setTimeout(() => window.updateDetailsPanel(eventData.id), 100);
                    }
                } else if (retryCount < maxRetries) {
                    // 如果數據尚未準備好且還有重試次數，延遲重試
                    console.log(`🔄 SeaDot 數據尚未準備完成，${500 * (retryCount + 1)}ms 後重試 (${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => attemptGetRFSignals(retryCount + 1, maxRetries), 500 * (retryCount + 1));
                } else {
                    console.warn(`⚠️ 重試 ${maxRetries} 次後仍無法為事件 ${eventData.id} 生成可疑船隻候選資訊`);
                }
            };
            
            // 開始嘗試獲取可疑船隻候選數據
            attemptGetRFSignals();
        }

        // 使用已儲存的數據生成 HTML
        const suspiciousVesselCandidatesHtml = eventData.suspiciousVesselCandidatesData && eventData.suspiciousVesselCandidatesData.length > 0 
            ? eventData.suspiciousVesselCandidatesData
                .map((candidateData) => {
                    // 檢查是否已有儲存的可疑船隻資訊,如果沒有則生成新的
                    let suspiciousVessel = candidateData.suspiciousVessel;
                    
                    if (!suspiciousVessel) {
                        // 首次生成可疑船隻候選資訊
                        suspiciousVessel = AreaEventManager.generateSuspiciousVesselCandidate(candidateData);
                        
                        // 將生成的資訊儲存回 candidateData
                        candidateData.suspiciousVessel = suspiciousVessel;
                        
                        // 更新到 eventStorage
                        if (window.eventStorage && eventData.id) {
                            const updatedCandidatesData = eventData.suspiciousVesselCandidatesData.map(data => 
                                data.rfId === candidateData.rfId ? candidateData : data
                            );
                            window.eventStorage.updateEvent(eventData.id, { 
                                suspiciousVesselCandidatesData: updatedCandidatesData 
                            });
                            console.log(`💾 已儲存可疑船隻資訊 (RF: ${candidateData.rfId}, MMSI: ${suspiciousVessel?.vesselMmsi})`);
                        }
                    }
                    
                    return {
                        candidateData,
                        suspiciousVessel
                    };
                })
                // 按照威脅指數由大到小排序
                .sort((a, b) => {
                    const threatScoreA = a.suspiciousVessel?.threatScore || 0;
                    const threatScoreB = b.suspiciousVessel?.threatScore || 0;
                    return threatScoreB - threatScoreA;
                })
                // 只顯示威脅指數最高的前三個可疑船隻
                .slice(0, 3)
                .map(({ candidateData, suspiciousVessel }) => {
                
                // 可疑船隻候選HTML
                const suspiciousVesselHtml = suspiciousVessel ? `
                    <div class="vessel-info-card" style="
                        background: rgba(59, 130, 246, 0.08);
                        border: 1px solid rgba(59, 130, 246, 0.2);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 8px;
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span style="
                                color: #e2e8f0;
                                font-size: 13px;
                                font-weight: 600;
                            ">
                                類型: ${suspiciousVessel.vesselType}
                            </span>
                            <span style="
                                background: ${(() => {
                                    const score = suspiciousVessel.threatScore;
                                    if (score < 60) {
                                        return 'linear-gradient(135deg, #10b981, #059669)'; // 綠色
                                    } else if (score >= 60 && score <= 80) {
                                        return 'linear-gradient(135deg, #f59e0b, #d97706)'; // 黃色
                                    } else {
                                        return 'linear-gradient(135deg, #ef4444, #dc2626)'; // 紅色
                                    }
                                })()};
                                color: white;
                                padding: 4px 10px;
                                border-radius: 12px;
                                font-size: 11px;
                                font-weight: bold;
                            ">
                                威脅指數: ${suspiciousVessel.threatScore}
                            </span>
                        </div>
                        <div style="
                            color: #b8c5d1;
                            font-size: 12px;
                            font-weight: 500;
                        ">
                            座標: ${suspiciousVessel.lat.toFixed(3)}°N, ${suspiciousVessel.lon.toFixed(3)}°E
                        </div>
                    </div>
                ` : `
                    <div class="candidate-item" style="text-align: center; color: #6b7280;">
                        🔍 搜尋附近可疑船隻中...
                    </div>
                `;

                return `
                    <div class="evidence-item">
                        <div class="evidence-title">MMSI:   ${suspiciousVessel ? suspiciousVessel.vesselMmsi : '� 搜尋中...'}</div>
                        <div style="margin-top: 8px;">
                            ${suspiciousVesselHtml}
                        </div>
                        <div style="margin-top: 8px; display: flex; justify-content: flex-end;">
                            <button class="create-vessel-btn" onclick="createVesselEventFromArea('${candidateData.rfId}')" 
                                    style="background: #135edfff; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 10px; font-weight: bold; cursor: pointer; transition: all 0.3s ease;">
                                建立船舶追蹤事件
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
                    <strong>中心座標：</strong>${eventData.centerCoordinates || '未設定'}<br>
                    <strong>監控範圍：</strong>${eventData.monitorRange || '未設定'}<br>
                    <strong>監控時間：</strong>${eventData.monitorTimeRange}<br>
                </div>
            </div>

            <div class="evidence-section">
                <div class="section-title">可疑船隻列表</div>
                ${suspiciousVesselCandidatesHtml}
            </div>

            <!-- <div class="action-section">
                <div class="section-title">⚡ 可用操作</div>
                <div class="action-grid">
                    <div class="action-btn" onclick="refreshAOI()">🔄<br>重新掃描</div>
                    <div class="action-btn" onclick="expandAOI()">📏<br>擴大 AOI</div>
                    <div class="action-btn" onclick="exportData()">📊<br>匯出資料</div>
                    <div class="action-btn" onclick="closeEvent()">✅<br>結束事件</div>
                </div>
            </div> -->
        `;
    }

    /**
     * 取得無 AIS 的 RF 信號資料 - 使用 SeaDotManager 整合
     * @param {Object} areaEvent - 區域事件資料
     * @returns {Object|null} RF信號資訊物件或null
     */
    static getRFSignalsWithoutAIS(areaEvent) {
        try {
            console.log('🔍 開始查詢無 AIS 的 RF 信號', areaEvent);
            
            if (!areaEvent || areaEvent.type !== 'area') {
                console.warn('⚠️ 無效的區域事件資料');
                return null;
            }
            
            // 檢查 seaDotManager 是否可用並等待初始化完成
            if (!window.seaDotManager) {
                console.warn('⚠️ SeaDotManager 未初始化，等待初始化完成...');
                return null;
            }
            
            // 檢查 seaDotManager 是否有 seaDots 數據
            if (!window.seaDotManager.seaDots || window.seaDotManager.seaDots.size === 0) {
                console.warn('⚠️ SeaDotManager 的數據尚未加載完成，等待數據加載...');
                return null;
            }
            
            let noAISDots = [];
            
            // 圓形區域查詢
            if (areaEvent.centerLat && areaEvent.centerLon && areaEvent.radius) {
                console.log(`📍 使用圓形區域查詢: 中心(${areaEvent.centerLat}, ${areaEvent.centerLon}), 半徑${areaEvent.radius}${areaEvent.radiusUnit || 'km'}`);
                
                const centerLat = areaEvent.centerLatDirection === 'S' ? -areaEvent.centerLat : areaEvent.centerLat;
                const centerLon = areaEvent.centerLonDirection === 'W' ? -areaEvent.centerLon : areaEvent.centerLon;
                const radiusInKm = areaEvent.radiusInKm || areaEvent.radius;
                
                // 使用 Haversine 公式計算圓形範圍內的點
                noAISDots = window.seaDotManager.getAllDots().filter(dot => {
                    if (dot.status !== "No AIS") return false;
                    
                    // 計算兩點間的距離（使用 Haversine 公式）
                    const R = 6371; // 地球半徑（公里）
                    const dLat = (dot.lat - centerLat) * Math.PI / 180;
                    const dLon = (dot.lon - centerLon) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                            Math.cos(centerLat * Math.PI / 180) * Math.cos(dot.lat * Math.PI / 180) *
                            Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distance = R * c;
                    
                    return distance <= radiusInKm;
                });
                
            } else {
                console.warn('⚠️ 缺少中心座標或半徑資訊');
                return null;
            }
            
            console.log(`🎯 找到 ${noAISDots.length} 個無 AIS 監測點:`, noAISDots);
            
            // 如果沒有找到任何點，詳細記錄調試資訊
            if (noAISDots.length === 0) {
                console.log('🔍 調試資訊: 檢查 SeaDotManager 中的所有點...');
                const allDots = window.seaDotManager.getAllDots();
                console.log(`總共有 ${allDots.length} 個監測點`);
                
                if (allDots.length > 0) {
                    const statusCounts = {};
                    allDots.forEach(dot => {
                        const status = dot.status || '未知';
                        statusCounts[status] = (statusCounts[status] || 0) + 1;
                    });
                    console.log('📊 監測點狀態分布:', statusCounts);
                    
                    // 顯示前5個點的詳細資訊
                    console.log('📍 前5個監測點詳情:');
                    allDots.slice(0, 5).forEach((dot, i) => {
                        console.log(`  ${i+1}. ID: ${dot.id}, 座標: [${dot.lat}, ${dot.lon}], 狀態: ${dot.status}`);
                    });
                }
            }
            
            // 將監測點轉換為 RF 信號資料格式
            const rfSignalsWithoutAIS = noAISDots.map((dot, index) => {
                // 生成隨機頻率和信號強度（保持現有的變化性）
                const frequency = (Math.random() * (470 - 430) + 430).toFixed(1); // 430-470 MHz
                const strength = Math.floor(Math.random() * 50 + 30); // 30-80 dBm
                
                return {
                    rfId: dot.rfId || `rf_${dot.id}_${index}`,
                    frequency: `${frequency} MHz`,
                    strength: `${strength} dBm`,
                    aisStatus: '未開啟', // 明確設定AIS狀態
                    detection_time: new Date().toLocaleString('zh-TW'),
                    // 保留完整的原始監測點資訊
                    sourceSeaDot: {
                        id: dot.id,
                        status: dot.status,
                        dotColor: window.getDotColor ? window.getDotColor(dot) : (dot.dotColor || '#ef4444'),
                        area: dot.area,
                        lat: dot.lat,
                        lon: dot.lon,
                        display: {
                            dotColor: window.getDotColor ? window.getDotColor(dot) : (dot.dotColor || '#ef4444'),
                            backgroundColor: (typeof window.getBackgroundColor === 'function' ? window.getBackgroundColor(dot) : (dot.backgroundColor || (window.getDotColor ? window.getDotColor(dot) : '#ef4444')))
                        }
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

    /**
     * 從 AreaEventDetails 中提取指定可疑船隻候選的數據
     * @param {string} rfId - RF ID
     * @returns {Object} 提取的可疑船隻數據
     */
    static extractSuspiciousVesselCandidateData(rfId) {
        console.log(`🔍 開始提取可疑船隻候選數據，RF ID: ${rfId}`);
        
        // 獲取來源區域事件的資料
        const sourceAreaEvent = window.eventStorage.getEvent(window.currentEventId);
        console.log(`📋 來源區域事件:`, sourceAreaEvent);
        
        // 優先從儲存的 suspiciousVesselCandidatesData 中提取數據
        if (sourceAreaEvent && sourceAreaEvent.suspiciousVesselCandidatesData) {
            const candidateData = sourceAreaEvent.suspiciousVesselCandidatesData.find(data => data.rfId === rfId);
            if (candidateData) {
                console.log(`✅ 從儲存數據提取的可疑船隻數據 (${rfId}):`, candidateData);
                return {
                    frequency: candidateData.frequency,
                    strength: candidateData.strength,
                    coordinates: candidateData.coordinates
                };
            } else {
                console.warn(`⚠️ 在儲存的 suspiciousVesselCandidatesData 中未找到 RF ID: ${rfId}`);
            }
        } else {
            console.warn(`⚠️ 來源區域事件缺少 suspiciousVesselCandidatesData`);
        }
        
        // 備用方法：從詳情面板中提取數據
        console.log(`🔄 嘗試從詳情面板提取數據...`);
        const detailsContent = document.getElementById('detailsContent');
        if (!detailsContent) {
            console.error(`❌ 找不到詳情面板元素`);
            return {
                frequency: '待檢測',
                strength: '待檢測',
                coordinates: '定位中'
            };
        }
        
        const evidenceItems = detailsContent.querySelectorAll('.evidence-item');
        console.log(`📊 詳情面板中有 ${evidenceItems.length} 個證據項目`);
        
        let extractedData = null;
        let foundInPanel = false;
        
        // 遍歷所有證據項目，尋找匹配的 RF ID
        evidenceItems.forEach((item, index) => {
            const titleElement = item.querySelector('.evidence-title');
            const descElement = item.querySelector('.evidence-desc');
            
            if (titleElement && titleElement.textContent.includes(rfId)) {
                console.log(`✅ 在證據項目 ${index} 中找到匹配的 RF ID: ${rfId}`);
                foundInPanel = true;
                const descText = descElement.textContent;
                console.log(`📝 證據描述文本:`, descText);
                
                extractedData = {
                    frequency: '待檢測',
                    strength: '待檢測', 
                    coordinates: '定位中'
                };
                
                // 提取頻率資訊
                const frequencyMatch = descText.match(/📡 頻率:\s*([^\|]+)/);
                if (frequencyMatch) {
                    extractedData.frequency = frequencyMatch[1].trim();
                    console.log(`📡 提取到頻率: ${extractedData.frequency}`);
                }
                
                // 提取強度資訊
                const strengthMatch = descText.match(/強度:\s*([^\n]+)/);
                if (strengthMatch) {
                    extractedData.strength = strengthMatch[1].trim();
                    console.log(`💪 提取到強度: ${extractedData.strength}`);
                }
                
                // 提取座標資訊
                const coordMatch = descText.match(/📍 座標:\s*([^\n]+)/);
                if (coordMatch) {
                    extractedData.coordinates = coordMatch[1].trim();
                    console.log(`📍 提取到座標: ${extractedData.coordinates}`);
                }
            }
        });
        
        if (!foundInPanel) {
            console.warn(`⚠️ 在詳情面板中未找到 RF ID: ${rfId}，返回預設數據`);
            extractedData = {
                frequency: '待檢測',
                strength: '待檢測',
                coordinates: '定位中'
            };
        }
        
        console.log(`📤 最終提取的可疑船隻數據 (${rfId}):`, extractedData);
        return extractedData;
    }

    /**
     * 為RF信號生成可疑船隻候選資訊
     * @param {Object} candidateData - 候選數據(包含sourceSeaDot)
     * @returns {Object|null} 可疑船隻候選資訊或null
     */
    static generateSuspiciousVesselCandidate(candidateData) {
        try {
            // 從 sourceSeaDot 直接獲取座標
            if (!candidateData.sourceSeaDot || 
                candidateData.sourceSeaDot.lat === undefined || 
                candidateData.sourceSeaDot.lon === undefined) {
                console.warn('⚠️ 缺少 sourceSeaDot 座標資訊:', candidateData);
                return null;
            }

            const rfLat = candidateData.sourceSeaDot.lat;
            const rfLon = candidateData.sourceSeaDot.lon;

            // 檢查是否有船隻數據可用
            if (!window.vesselMarkers || Object.keys(window.vesselMarkers).length === 0) {
                // 生成模擬的可疑船隻候選（在實際應用中應該從真實數據庫查詢）
                const mockVessels = [
                    {
                        mmsi: `${Math.floor(Math.random() * 900000000) + 100000000}`, // 生成九位數MMSI
                        type: ['貨船', '漁船',][Math.floor(Math.random() * 2)],
                        lat: rfLat + (Math.random() - 0.5) * 0.01, // 在RF信號附近隨機生成
                        lon: rfLon + (Math.random() - 0.5) * 0.01,
                        threatScore: Math.floor(Math.random() * 60) + 31, // 40-90的高威脅指數
                        aisStatus: 'AIS關閉'
                    }
                ];

                const candidate = mockVessels[0];
                
                // 計算距離
                const distance = this.calculateDistance(rfLat, rfLon, candidate.lat, candidate.lon);
                
                return {
                    vesselMmsi: candidate.mmsi,
                    vesselType: candidate.type,
                    distance: distance.toFixed(2),
                    threatScore: candidate.threatScore,
                    aisStatus: candidate.aisStatus,
                    // 直接使用 sourceSeaDot 的座標
                    lat: rfLat,
                    lon: rfLon
                };
            }

            // 如果有真實船隻數據，找到最近的可疑船隻
            let closestVessel = null;
            let minDistance = Infinity;

            Object.values(window.vesselMarkers).forEach(vessel => {
                if (vessel.lat && vessel.lon) {
                    const distance = this.calculateDistance(rfLat, rfLon, vessel.lat, vessel.lon);
                    if (distance < minDistance && distance < 10) { // 10km範圍內
                        minDistance = distance;
                        closestVessel = vessel;
                    }
                }
            });

            if (closestVessel) {
                return {
                    vesselMmsi: closestVessel.mmsi || closestVessel.name || '未知船隻',
                    vesselType: closestVessel.type || '不明',
                    distance: minDistance.toFixed(2),
                    threatScore: closestVessel.threatScore || Math.floor(Math.random() * 40) + 60,
                    aisStatus: closestVessel.aisStatus || 'AIS異常',
                    // 直接使用 sourceSeaDot 的座標
                    lat: rfLat,
                    lon: rfLon
                };
            }

            return null;

        } catch (error) {
            console.error('生成可疑船隻候選時發生錯誤:', error);
            return null;
        }
    }

    /**
     * 計算兩點間的距離（使用Haversine公式）
     * @param {number} lat1 - 第一點緯度
     * @param {number} lon1 - 第一點經度
     * @param {number} lat2 - 第二點緯度
     * @param {number} lon2 - 第二點經度
     * @returns {number} 距離（公里）
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // 地球半徑（公里）
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * 從區域監控建立 RF 事件（從 AreaEventDetails 提取數據）
     * @param {string} rfId - RF ID
     * @param {string|null} customCoordinates - 自定義座標（可選）
     */
    static createRFEventfromArea(rfId, customCoordinates = null) {
        // 注意：此函數需要訪問全域變數和函數，所以保留為橋接函數
        // 實際實現會在主檔案中調用此類的靜態方法
        if (typeof window.createRFEventfromArea === 'function') {
            window.createRFEventfromArea(rfId, customCoordinates);
        } else {
            console.error('createRFEventfromArea function not available');
        }
    }
}

  // expose a global instance
  window.AreaEventManager = AreaEventManager;
})();