// EventStorage extracted from script.js
(function(){
  class EventStorage {
    constructor() {
      this.events = new Map();
      this.initializeDefaultEvents();
    }

    // 初始化預設事件資料
    initializeDefaultEvents() {
      // 為 area-001 事件生成基本區域資訊（圓形區域格式）
      const centerLat = 14.3;
      const centerLon = 114.3;
      const centerLatDirection = 'N';
      const centerLonDirection = 'E';
      const radius = 250;
      const radiusUnit = 'nm';
      const radiusInKm = radius * 1.852; // 海里轉公里

      // 生成座標和範圍字串
      const centerCoordinates = `${centerLat.toFixed(3)}°${centerLatDirection}, ${centerLon.toFixed(3)}°${centerLonDirection}`;
      const monitorRange = `半徑 ${radius} 海里`;

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
        aoiName: '南海海域',
        // 新格式：圓形區域
        centerCoordinates: centerCoordinates,
        centerLat: centerLat,
        centerLon: centerLon,
        centerLatDirection: centerLatDirection,
        centerLonDirection: centerLonDirection,
        radius: radius,
        radiusUnit: radiusUnit,
        radiusInKm: radiusInKm,
        monitorRange: monitorRange,
        monitorHours: '8',
        createTime: createTimeStr,
        monitorTimeRange: `${createTimeStr} - ${endTimeStr}`,
        status: 'investigating'
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
        coordinates: window.generateSeaCoordinateForEvents ? window.generateSeaCoordinateForEvents() : {lat:24.0,lon:119.5}
      };

      this.events.set('rf-002', rfEventData);

      this.events.set('vessel-003', {
        id: 'vessel-003',
        type: 'vessel',
        mmsi: '416123456',
        coordinates: '等待初始化...', // 將通過 reinitializeVesselEvents 設定
        vesselName: '未知船舶',
        threatScore: 85,
        createTime: '12:30',
        alertTime: '12:35', // 風險分數 ≥70，自動生成警示時間（createTime + 5分鐘）
        status: 'investigating',
        aisStatus: '未開啟',
        trackPoints: this.generateSimulatedTrackPoints('cargo')
      });

      this.events.set('vessel-004', {
        id: 'vessel-004',
        type: 'vessel',
        mmsi: '416789012',
        coordinates: '等待初始化...', // 將通過 reinitializeVesselEvents 設定
        vesselName: '漁船阿勇號',
        threatScore: 58,
        createTime: '10:15',
        status: 'completed',
        aisStatus: '未開啟',
        completedTime: '12:45',
        trackPoints: this.generateSimulatedTrackPoints('fishing')
      });
    }

    // 生成警示時間（createTime + 5分鐘）
    generateAlertTime(createTime) {
      if (!createTime) return null;
      const create = new Date(`2024-01-01 ${createTime}`);
      create.setMinutes(create.getMinutes() + 5);
      return create.toLocaleTimeString('zh-TW', {hour12: false, hour: '2-digit', minute: '2-digit'});
    }

    // 儲存事件資料
    saveEvent(eventId, eventData) {
      // 自動生成警示時間（若風險分數 ≥70 且無 alertTime）
      if (eventData.riskScore >= 70 && !eventData.alertTime && eventData.createTime) {
        eventData.alertTime = this.generateAlertTime(eventData.createTime);
        console.log(`✅ 事件 ${eventId} 風險分數 ${eventData.riskScore} ≥70，自動生成警示時間: ${eventData.alertTime}`);
      }

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
        // 若更新了 riskScore，需重新評估是否需要警示時間
        if (updates.riskScore !== undefined) {
          const newRiskScore = updates.riskScore;
          const oldRiskScore = existingEvent.riskScore || 0;

          // 風險分數從 <70 變成 ≥70，且無 alertTime
          if (newRiskScore >= 70 && oldRiskScore < 70 && !existingEvent.alertTime && !updates.alertTime) {
            updates.alertTime = this.generateAlertTime(existingEvent.createTime || updates.createTime);
            console.log(`✅ 事件 ${eventId} 風險分數提升至 ${newRiskScore} ≥70，自動生成警示時間: ${updates.alertTime}`);
          }
          // 風險分數從 ≥70 變成 <70，移除 alertTime
          else if (newRiskScore < 70 && oldRiskScore >= 70) {
            updates.alertTime = null;
            console.log(`⚠️ 事件 ${eventId} 風險分數降至 ${newRiskScore} <70，移除警示時間`);
          }
        }

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
        
        // 根據 sea dot 的 status 屬性決定 AIS 狀態（不依賴顏色）
        let aisStatus = '未知';
        if (randomDot.status === 'No AIS') {
          aisStatus = '未開啟';
        } else if (randomDot.status === 'AIS') {
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
            id: (typeof getSafePointId === 'function') ? getSafePointId(randomDot) : randomDot.id,
            status: randomDot.status,
            dotColor: (typeof getDotColor === 'function') ? getDotColor(randomDot) : randomDot.dotColor,
            area: randomDot.area,
            // canonical display subobject for consumers
            display: {
              dotColor: (typeof getDotColor === 'function') ? getDotColor(randomDot) : randomDot.dotColor,
              backgroundColor: (typeof getBackgroundColor === 'function') ? (getBackgroundColor(randomDot) || randomDot.backgroundColor || ((typeof getDotColor === 'function') ? getDotColor(randomDot) : randomDot.dotColor)) : (randomDot.backgroundColor || ((typeof getDotColor === 'function') ? getDotColor(randomDot) : randomDot.dotColor))
            }
          }
        };
        
        this.events.set('rf-002', updatedEventData);
        console.log(`✅ RF 事件 rf-002 已重新初始化，使用 sea dot ${randomDot.id}，RF ID: ${randomDot.rfId}，AIS 狀態: ${aisStatus}`);
        
        // 更新事件卡顯示
        this.updateEventCardDisplay('rf-002', updatedEventData);
      }
    }

    // 重新初始化 Vessel 事件（在 SeaDotManager 可用後調用）
    reinitializeVesselEvents(eventid, coordinates) {
      if (typeof window.seaDotManager === 'undefined' || window.seaDotManager.getAllDots().length === 0) {
        console.warn('⚠️ SeaDotManager 仍不可用，跳過 Vessel 事件重新初始化');
        return;
      }

      // 重新初始化 vessel-003 事件
      const existingVesselEvent = this.events.get(eventid);
      if (!existingVesselEvent) return;

      // 從所有 sea dots 中隨機選擇一個
      const allDots = window.seaDotManager.getAllDots();
      const randomDot = allDots[Math.floor(Math.random() * allDots.length)];

      // 強制設定 vessel-003 和 vessel-004 的 AIS 狀態為「未開啟」
      let aisStatus = '未開啟';
      
      // 根據 AIS 未開啟狀態設定威脅分數
      let threatScore = existingVesselEvent.threatScore || 75;
      
      if (eventid === 'vessel-003') {
        threatScore = 85; // 保持高威脅分數
      } else if (eventid === 'vessel-004') {
        threatScore = 58; // 保持低威脅分數
      }

      // 更新事件資料
      const updatedEventData = {
        ...existingVesselEvent,
        coordinates: coordinates,
        threatScore: threatScore,
        aisStatus: aisStatus,
        sourceSeaDot: {
          id: (typeof getSafePointId === 'function') ? getSafePointId(randomDot) : randomDot.id,
          status: randomDot.status,
          dotColor: (typeof getDotColor === 'function') ? (resolvedColor || getDotColor(randomDot)) : (resolvedColor || randomDot.dotColor),
          area: randomDot.area,
          // canonical display subobject for consumers
          display: {
            dotColor: (typeof getDotColor === 'function') ? (resolvedColor || getDotColor(randomDot)) : (resolvedColor || randomDot.dotColor),
            backgroundColor: (typeof getBackgroundColor === 'function') ? (getBackgroundColor(randomDot) || randomDot.backgroundColor || resolvedColor || ((typeof getDotColor === 'function') ? getDotColor(randomDot) : randomDot.dotColor)) : (randomDot.backgroundColor || resolvedColor || ((typeof getDotColor === 'function') ? getDotColor(randomDot) : randomDot.dotColor))
          }
        }
      };

      // 對於 vessel-003，我們希望保留預設的軌跡點，不重新生成
      if (existingVesselEvent.id === eventid) {
        updatedEventData.trackPoints = existingVesselEvent.trackPoints;
        console.log(`🔄 為船舶事件 vessel-003 保留了預設的 'cargo' 軌跡點`);
      } else if (!existingVesselEvent.trackPoints || existingVesselEvent.trackPoints.length === 0) {
        updatedEventData.trackPoints = this.generateFixedTrackPoints(existingVesselEvent.id, randomDot.lat, randomDot.lon);
        console.log(`✅ 為重新初始化的船舶事件 ${existingVesselEvent.id} 生成了新的固定軌跡點`);
      } else {
        // 保留現有軌跡點
        updatedEventData.trackPoints = existingVesselEvent.trackPoints;
        console.log(`🔄 為重新初始化的船舶事件 ${existingVesselEvent.id} 保留了現有的軌跡點`);
      }

      this.events.set(eventid, updatedEventData);
      console.log(`✅ Vessel 事件 vessel-003 已重新初始化，使用 sea dot ${randomDot.id}，威脅分數: ${threatScore}，AIS 狀態: ${aisStatus}，座標: ${updatedEventData.coordinates}`);
      // 更新事件卡顯示
      this.updateEventCardDisplay(eventid, updatedEventData);
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
              監控區域：${areaEvent.aoiName || '南海海域'}<br>
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
            威脅分數: ${eventData.threatScore}<br>
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

    // 生成固定的軌跡點（用於vessel事件，只生成一次）
    generateFixedTrackPoints(eventId, endLat, endLon) {
      const totalHistoryPoints = 8; // 歷史點數量
      const totalFuturePoints = 4;  // 未來點數量
      const distance = 0.015; // 點之間的固定距離
      const currentTime = new Date();

      let trackPoints = [];
      let previousPoint = { lat: endLat, lon: endLon };

      // 生成歷史點（往過去時間推算）
      for (let i = 0; i < totalHistoryPoints; i++) {
        const angleAwayFromTarget = Math.atan2(previousPoint.lat - endLat, previousPoint.lon - endLon);
        const randomAngleOffset = (Math.random() - 0.5) * (Math.PI / 3);
        const finalAngle = angleAwayFromTarget + randomAngleOffset;

        const newLat = previousPoint.lat + distance * Math.sin(finalAngle);
        const newLon = previousPoint.lon + distance * Math.cos(finalAngle);

        // 歷史點的時間戳：從現在往前推算
        const timestamp = new Date(currentTime.getTime() - (totalHistoryPoints - i) * 45 * 60 * 1000);

        const trackPoint = {
          id: `${eventId}_history_${i}`,
          lat: newLat,
          lon: newLon,
          status: Math.random() < 0.7 ? 'AIS' : 'No AIS',
          type: 'History',
          timestamp: timestamp.toISOString(),
          speed: 8 + Math.random() * 12, // 8-20 節
          signalStrength: -45 - Math.random() * 25, // -45 to -70 dBm
          deviationFromRoute: Math.random() * 3, // 0-3 公里
          inRestrictedZone: Math.random() > 0.95, // 5% 機率
          hasTask: Math.random() > 0.6, // 40% 機率有任務
          taskType: Math.random() > 0.6 ? ['監控任務', '追蹤任務'][Math.floor(Math.random() * 2)] : null,
          taskDescription: Math.random() > 0.6 ? '執行船舶追蹤和行為分析' : null,
          vesselId: eventId  // 添加船舶ID用於關聯
        };

        // 通過統一管理器創建軌跡點
        if (window.missionTrackManager) {
          window.missionTrackManager.createTrackPoint(trackPoint);
        }

        trackPoints.unshift(trackPoint);
        previousPoint = { lat: newLat, lon: newLon };
      }

      // 添加當前點
      const currentPoint = {
        id: `${eventId}_current`,
        lat: endLat,
        lon: endLon,
        status: 'AIS',
        type: 'Current',
        timestamp: currentTime.toISOString(),
        speed: 15,
        signalStrength: -50,
        deviationFromRoute: 0,
        inRestrictedZone: false,
        hasTask: true,
        taskType: '當前監控',
        taskDescription: '正在執行實時監控任務',
        vesselId: eventId
      };

      // 通過統一管理器創建軌跡點
      if (window.missionTrackManager) {
        window.missionTrackManager.createTrackPoint(currentPoint);
      }

      trackPoints.push(currentPoint);

      // 生成未來點（往未來時間推算）
      previousPoint = { lat: endLat, lon: endLon };
      for (let i = 0; i < totalFuturePoints; i++) {
        const angleTowardsFuture = Math.random() * Math.PI * 2; // 隨機方向
        const newLat = previousPoint.lat + distance * Math.sin(angleTowardsFuture);
        const newLon = previousPoint.lon + distance * Math.cos(angleTowardsFuture);

        // 未來點的時間戳：從現在往後推算，使用 3 小時 粒度
        const timestamp = new Date(currentTime.getTime() + (i + 1) * 3 * 60 * 60 * 1000);

        // 為未來點生成多樣化的數據，確保有正常和異常訊號
        const willBeAbnormal = Math.random() < 0.3; // 30% 機率生成異常數據

        const trackPoint = {
          id: `${eventId}_future_${i}`,
          lat: newLat,
          lon: newLon,
          status: 'Predicted',
          type: 'Future',
          timestamp: timestamp.toISOString(),
          speed: willBeAbnormal ? (Math.random() > 0.5 ? 30 + Math.random() * 10 : Math.random() * 2) : (12 + Math.random() * 8), // 異常：超高速或超低速，正常：12-20節
          signalStrength: willBeAbnormal ? (-80 - Math.random() * 20) : (-55 - Math.random() * 15), // 異常：-80 to -100 dBm，正常：-55 to -70 dBm
          deviationFromRoute: willBeAbnormal ? (5 + Math.random() * 5) : (Math.random() * 2), // 異常：5-10公里偏離，正常：0-2公里
          inRestrictedZone: willBeAbnormal && Math.random() > 0.7, // 異常情況下30%機率在禁航區
          hasTask: Math.random() > 0.4, // 60% 機率有排程任務
          taskType: Math.random() > 0.4 ? ['預定追蹤', '巡查任務', '異常調查'][Math.floor(Math.random() * 3)] : null,
          taskDescription: Math.random() > 0.4 ? (willBeAbnormal ? '預計處理異常訊號事件' : '預計執行監控和追蹤任務') : null,
          vesselId: eventId
        };

        // 通過統一管理器創建軌跡點
        if (window.missionTrackManager) {
          window.missionTrackManager.createTrackPoint(trackPoint);
        }

        trackPoints.push(trackPoint);
        previousPoint = { lat: newLat, lon: newLon };
      }

      console.log(`✅ 為船舶事件 ${eventId} 生成了完整的軌跡點 (歷史:${totalHistoryPoints}, 當前:1, 未來:${totalFuturePoints})`);

      // 為軌跡點中的任務創建對應的任務卡片
      this.generateMissionCardsFromTrackPoints(trackPoints, eventId);

      return trackPoints;
    }

    // 為軌跡點中的任務生成對應的任務卡片
    generateMissionCardsFromTrackPoints(trackPoints, eventId) {
      trackPoints.forEach(point => {
        // Include Future points by default (treat as scheduled tasks) or any point that explicitly has a task
        if (point.type === 'Future' || (point.hasTask && point.taskType)) {
          // 將軌跡點任務類型映射到標準行動類型
          let actionType, missionType, actionIcon;

          switch (point.taskType) {
            case '監控任務':
            case '追蹤任務':
            case '當前監控':
              actionType = 'track';
              missionType = '持續追蹤';
              actionIcon = '🎯';
              break;
            case '預定追蹤':
              actionType = 'track';
              missionType = '持續追蹤';
              actionIcon = '🎯';
              break;
            case '巡查任務':
              actionType = 'uav';
              missionType = 'UAV 派遣';
              actionIcon = '🚁';
              break;
            case '異常調查':
              actionType = 'satellite';
              missionType = '衛星重拍';
              actionIcon = '🛰️';
              break;
            default:
              actionType = 'track';
              missionType = '持續追蹤';
              actionIcon = '🎯';
          }

          // 確定任務狀態
          let missionStatus, executionTime;
          const pointTime = new Date(point.timestamp);
          const currentTime = new Date();

          if (point.type === 'History') {
            missionStatus = '已完成';
            executionTime = pointTime;
          } else if (point.type === 'Current') {
            missionStatus = '執行任務';
            executionTime = pointTime;
          } else { // Future
            missionStatus = '派遣';
            executionTime = pointTime;
          }

          // 創建任務資料
          const missionData = {
            action: actionType,
            type: missionType,
            actionName: missionType,
            actionIcon: actionIcon,
            target: eventId.toUpperCase(),
            targetInfo: eventId.toUpperCase(),
            targetVesselId: eventId,
            status: missionStatus,
            startTime: executionTime,
            scheduledTime: point.type === 'Future' ? executionTime : null,
            completedTime: point.type === 'History' ? executionTime : null,
            description: point.taskDescription || `執行${missionType}任務`,
            progress: point.type === 'History' ? 100 :
                     point.type === 'Current' ? 75 :
                     point.type === 'Future' ? 15 : 0,
            estimatedCompletion: point.type !== 'History' ? this.formatEstimatedCompletion(executionTime) : null,
            isScheduled: point.type === 'Future',
            sourceTrackPointId: (typeof getSafePointId === 'function') ? getSafePointId(point) : point.id  // 標記來源軌跡點的穩定 id
          };

          // 通過統一管理器創建任務（會自動建立與軌跡點的連結）
          if (window.missionTrackManager) {
            const missionId = window.missionTrackManager.createMission(missionData);

            // 創建任務卡片顯示在任務列表中
            this.createMissionCard(missionId, missionData);

            console.log(`✅ 為軌跡點 ${point.id} 創建了對應的任務卡片: ${missionId} (${missionType})`);
          }
        }
      });
    }

    // 格式化預計完成時間
    formatEstimatedCompletion(executionTime) {
      const estimatedEnd = new Date(executionTime.getTime() + 2 * 60 * 60 * 1000); // 加2小時
      return estimatedEnd.toLocaleString('zh-TW').split(' ')[1]; // 只返回時間部分
    }

    // 創建任務卡片
    createMissionCard(missionId, missionData) {
      const missionTimeline = document.querySelector('.mission-list');

      if (!missionTimeline) {
        console.warn('找不到任務列表容器，無法添加軌跡點任務');
        return;
      }

      const newMission = document.createElement('div');
      newMission.className = 'mission-card';
      newMission.setAttribute('data-mission-id', missionId);

      // 狀態樣式映射
      const statusClass = missionData.status === '已完成' ? 'status-completed' :
                         missionData.status === '執行任務' ? 'status-executing' :
                         missionData.status === '派遣' ? 'status-dispatched' : 'status-scheduled';

      const progressText = missionData.status === '已完成' ? '已完成 | 任務結束' :
                          missionData.estimatedCompletion ? `進度: ${missionData.progress}% | 預計 ${missionData.estimatedCompletion} 完成` :
                          `進度: ${missionData.progress}%`;

      newMission.innerHTML = `
        <div class="mission-card-header">
          <span class="mission-type">${missionData.actionIcon} ${missionData.type}</span>
          <span class="mission-status ${statusClass}">${missionData.status}</span>
        </div>
        <div class="mission-details">
          目標: ${missionData.target}<br>
          ${missionData.scheduledTime ? '排程: ' + new Date(missionData.scheduledTime).toLocaleString('zh-TW') :
            missionData.completedTime ? '完成: ' + new Date(missionData.completedTime).toLocaleString('zh-TW') :
            '開始: ' + new Date(missionData.startTime).toLocaleString('zh-TW')}
        </div>
        <div class="mission-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${missionData.progress}%"></div>
          </div>
          <div class="progress-text">${progressText}</div>
        </div>
      `;

      // 添加點擊事件
      newMission.addEventListener('click', () => {
        if (window.highlightMissionCard) window.highlightMissionCard(missionId);
        if (window.showMissionDetails) window.showMissionDetails(missionId);
      });
      newMission.style.cursor = 'pointer';

      // 添加到任務列表
      missionTimeline.appendChild(newMission);

      // 更新任務統計
      this.updateMissionStats();
    }

    // 更新任務統計顯示
    updateMissionStats() {
      const stats = document.querySelector('.mission-stats');
      if (stats) {
        const allMissions = document.querySelectorAll('.mission-card');
        const activeMissions = document.querySelectorAll('.mission-card .status-executing, .mission-card .status-dispatched');
        const completedMissions = document.querySelectorAll('.mission-card .status-completed');

        const activeCount = activeMissions.length;
        const completedCount = completedMissions.length;
        const totalCount = allMissions.length;

        stats.textContent = `進行中: ${activeCount} | 已完成: ${completedCount} | 總計: ${totalCount}`;
      }
    }

    generateSimulatedTrackPoints(shiptype) {
      // 重要時間點（小時） - 與船舶軌跡檢視選項對齊
      const importantHours = [120, 96, 72, 48, 24, 12, 6, 3, 0]; // 從遠到近
      const currentTime = new Date();

      // 原始完整軌跡點（保持海上路徑）
      const originalTracks = {
        fishing: [
          { lat: 13.065024737368468, lon: 100.88090895915349, status: 'No AIS', type: 'History' },
          { lat: 13.000274575678905, lon: 100.63231885460398, status: 'AIS', type: 'History' },
          { lat: 12.816402143655235, lon: 100.5121559365818, status: 'AIS', type: 'History' },
          { lat: 12.571080679019152, lon: 100.50425939609092, status: 'AIS', type: 'History' },
          { lat: 12.324903411797516, lon: 100.50218669608854, status: 'AIS', type: 'History' },
          { lat: 12.079209540435095, lon: 100.53994443783212, status: 'AIS', type: 'History' },
          { lat: 11.838564979506009, lon: 100.61532618471438, status: 'AIS', type: 'History' },
          { lat: 11.595921651696361, lon: 100.6995829893499, status: 'AIS', type: 'History' },
          { lat: 11.357115194893014, lon: 100.77116570550932, status: 'AIS', type: 'History' },
          { lat: 11.113960749210412, lon: 100.83891824077482, status: 'AIS', type: 'History' },
          { lat: 10.8673633245079, lon: 100.89517763508664, status: 'AIS', type: 'History' },
          { lat: 10.624637775543771, lon: 100.95295236414975, status: 'AIS', type: 'History' },
          { lat: 10.386668619906004, lon: 101.00788406433297, status: 'AIS', type: 'History' },
          { lat: 10.153428941718284, lon: 101.08527123008167, status: 'AIS', type: 'History' },
          { lat: 9.919501284560454, lon: 101.14142595014616, status: 'AIS', type: 'History' },
          { lat: 9.686552954112068, lon: 101.249610777446, status: 'AIS', type: 'History' },
          { lat: 9.453197432694445, lon: 101.35121818466139, status: 'AIS', type: 'History' },
          { lat: 9.241517555306238, lon: 101.47854801642463, status: 'AIS', type: 'History' },
          { lat: 9.044925821306041, lon: 101.63235660176852, status: 'AIS', type: 'History' },
          { lat: 8.871288743941548, lon: 101.79989808724271, status: 'AIS', type: 'History' },
          { lat: 8.708429323113009, lon: 101.98117253242822, status: 'No AIS', type: 'History' },
          { lat: 8.280283102901367, lon: 102.31076272747136, status: 'AIS', type: 'History' },
          { lat: 7.908630578369372, lon: 102.68979130883962, status: 'AIS', type: 'History' },
          { lat: 7.699107852709557, lon: 103.1580781209581, status: 'AIS', type: 'History' },
          { lat: 7.656917520404703, lon: 103.67168887831085, status: 'AIS', type: 'History' },
          { lat: 7.670527763959799, lon: 104.18392641721015, status: 'AIS', type: 'History' },
          { lat: 7.686859486142251, lon: 104.70028382250284, status: 'AIS', type: 'History' },
          { lat: 7.700468772482115, lon: 105.21664126993089, status: 'AIS', type: 'History' },
          { lat: 7.813408916041465, lon: 105.72063906987891, status: 'AIS', type: 'History' },
          { lat: 8.031038285117381, lon: 106.19305120263223, status: 'AIS', type: 'History' },
          { lat: 8.26485976562018, lon: 106.64349063074788, status: 'AIS', type: 'History' },
          { lat: 8.55286733034221, lon: 107.07745058407386, status: 'AIS', type: 'History' },
          { lat: 8.862368303516716, lon: 107.48943789229526, status: 'AIS', type: 'History' },
          { lat: 9.171608819247808, lon: 107.91790468128688, status: 'AIS', type: 'History' },
          { lat: 9.46432529073659, lon: 108.32989200636246, status: 'AIS', type: 'History' },
          { lat: 9.753328313719159, lon: 108.76203689205124, status: 'AIS', type: 'History' },
          { lat: 9.991188185339132, lon: 109.22168277370157, status: 'AIS', type: 'History' },
          { lat: 10.277783068609828, lon: 109.64465641521295, status: 'AIS', type: 'History' },
          { lat: 10.585717713716969, lon: 110.06213688287559, status: 'AIS', type: 'History' },
          { lat: 10.91426743488117, lon: 110.46481325514617, status: 'AIS', type: 'History' },
          { lat: 11.219539201383867, lon: 110.88169816961447, status: 'AIS', type: 'History' },
          { lat: 11.583010239082498, lon: 111.25248684400674, status: 'AIS', type: 'Current' },
          { lat: 11.932573485988403, lon: 111.63151512843621, status: 'AIS', type: 'Future' },
          { lat: 12.303241453667606, lon: 111.994063924348039, status: 'AIS', type: 'Future' },
          { lat: 12.662152122618157, lon: 112.372582797518023, status: 'AIS', type: 'Future' },
          { lat: 13.021062791568709, lon: 112.751101670687994, status: 'AIS', type: 'Future' },
        ],
        cargo: [
          { lat: 13.079972, lon: 100.881889, status: 'AIS', type: 'History' },
          { lat: 12.97356780985889, lon: 100.54796015066181, status: 'AIS', type: 'History' },
          { lat: 12.627365165638585, lon: 100.5183255489848, status: 'AIS', type: 'History' },
          { lat: 12.294899757342149, lon: 100.63181824151971, status: 'AIS', type: 'History' },
          { lat: 11.959388784241828, lon: 100.73584594897854, status: 'AIS', type: 'History' },
          { lat: 11.624033620715302, lon: 100.8408536314547, status: 'AIS', type: 'History' },
          { lat: 11.290293043547429, lon: 100.95037637682013, status: 'AIS', type: 'History' },
          { lat: 10.950410139667289, lon: 101.04147669607556, status: 'AIS', type: 'History' },
          { lat: 10.61370150020552, lon: 101.14027687780214, status: 'AIS', type: 'History' },
          { lat: 10.276384320786649, lon: 101.23959290101489, status: 'AIS', type: 'History' },
          { lat: 9.945337945778036, lon: 101.35912969606814, status: 'AIS', type: 'History' },
          { lat: 9.632287811383744, lon: 101.51504149771144, status: 'AIS', type: 'History' },
          { lat: 9.316768552457347, lon: 101.66819373134327, status: 'AIS', type: 'History' },
          { lat: 9.00675534249025, lon: 101.83129364636173, status: 'AIS', type: 'History' },
          { lat: 8.708980846830958, lon: 102.01497576722561, status: 'No AIS', type: 'History' },
          { lat: 8.236609309971005, lon: 102.5366310292528, status: 'AIS', type: 'History' },
          { lat: 7.835845713410455, lon: 103.11140299233783, status: 'AIS', type: 'History' },
          { lat: 7.457628329258875, lon: 103.70157653136624, status: 'AIS', type: 'History' },
          { lat: 7.100633868023333, lon: 104.30462496420537, status: 'AIS', type: 'History' },
          { lat: 7.032230328649701, lon: 105.00267803367264, status: 'AIS', type: 'History' },
          { lat: 7.235773141144987, lon: 105.67856270607956, status: 'AIS', type: 'History' },
          { lat: 7.605449764946292, lon: 106.28065290350045, status: 'AIS', type: 'History' },
          { lat: 7.979300897444996, lon: 106.87842685916733, status: 'AIS', type: 'History' },
          { lat: 8.36958795786419, lon: 107.46668599882994, status: 'AIS', type: 'History' },
          { lat: 8.779606461892143, lon: 108.0425362884556, status: 'AIS', type: 'History' },
          { lat: 9.196068638831276, lon: 108.61429142368263, status: 'AIS', type: 'History' },
          { lat: 9.609274284007839, lon: 109.1880940674801, status: 'AIS', type: 'History' },
          { lat: 10.004053265017374, lon: 109.77607205868364, status: 'AIS', type: 'History' },
          { lat: 10.48668008138099, lon: 110.2909514532092, status: 'AIS', type: 'History' },
          { lat: 10.945439335635449, lon: 110.83386503799089, status: 'AIS', type: 'History' },
          { lat: 11.424433821583277, lon: 111.3552892345447, status: 'AIS', type: 'History' },
          { lat: 11.906593207781603, lon: 111.86725860015174, status: 'AIS', type: 'History' },
          { lat: 12.378587261222078, lon: 112.38653028623536, status: 'AIS', type: 'History' },
          { lat: 12.880028572978512, lon: 112.89285140752781, status: 'AIS', type: 'History' },
          { lat: 13.346365161153159, lon: 113.42666419107641, status: 'AIS', type: 'History' },
          { lat: 13.843548982024831, lon: 113.90005561847288, status: 'AIS', type: 'History' },
          { lat: 14.393700198895079, lon: 114.35816488660092, status: 'AIS', type: 'History' },
          { lat: 14.98008563349693, lon: 114.75870448890798, status: 'AIS', type: 'History' },
          { lat: 15.566967705180106, lon: 115.16245207707092, status: 'AIS', type: 'History' },
          { lat: 16.166689259314516, lon: 115.54148037473821, status: 'AIS', type: 'History' },
          { lat: 16.797148432659423, lon: 115.85021334874027, status: 'AIS', type: 'Current' },
          { lat: 17.430319477341907, lon: 116.15733958244417, status: 'AIS', type: 'Future' },
          { lat: 18.05449729960005, lon: 116.4930219751414, status: 'AIS', type: 'Future' },
          { lat: 18.69907628485336, lon: 116.78243874920335, status: 'AIS', type: 'Future' },
          { lat: 19.344809349959917, lon: 117.07381239505587, status: 'AIS', type: 'Future' },
        ]
      };

      const allOriginalPoints = originalTracks[shiptype] || originalTracks.cargo;
      const trackData = [];

      // 從原始軌跡點中選擇對應重要時間點的點
      // 重要時間點：[120, 96, 72, 48, 24, 12, 6, 3, 0] 小時前
      importantHours.forEach((hours, index) => {
        let selectedPoint;

        if (hours === 0) {
          // 當前點：選擇type為'Current'的點
          selectedPoint = allOriginalPoints.find(p => p.type === 'Current');
        } else {
          // 歷史點：根據時間間隔選擇點
          // 將120-0小時的範圍映射到歷史點的索引
          const historyPoints = allOriginalPoints.filter(p => p.type === 'History');
          const pointIndex = Math.floor(((120 - hours) / 120) * (historyPoints.length - 1));
          selectedPoint = historyPoints[pointIndex];
        }

        if (selectedPoint) {
          // 正確計算時間戳：當前時間減去對應的小時數
          const timestamp = new Date(currentTime.getTime() - hours * 60 * 60 * 1000);
          const willBeAbnormal = (hours === 48 || hours === 72) || Math.random() < 0.15;
          const speed = willBeAbnormal ?
            (Math.random() > 0.5 ? 28 + Math.random() * 12 : Math.random() * 3) :
            (8 + Math.random() * 15);

          const trackPoint = {
            ...selectedPoint,
            id: `${shiptype}_${hours}h_${index + 1}`,
            timestamp: timestamp.toISOString(),
            speed: speed,
            signalStrength: willBeAbnormal ? (-85 - Math.random() * 15) : (-45 - Math.random() * 35),
            deviationFromRoute: willBeAbnormal ? (6 + Math.random() * 8) : (Math.random() * 4),
            inRestrictedZone: willBeAbnormal && Math.random() > 0.8,
            hasTask: true, // 確保每個點都有任務
            course: 45 + Math.random() * 90,
            reportTime: timestamp.toLocaleTimeString('zh-TW', {hour12: false}),
            taskType: willBeAbnormal ?
              ['異常調查', '衛星重拍', '威脅評估'][Math.floor(Math.random() * 3)] :
              ['監控任務', '追蹤任務', '偵察任務'][Math.floor(Math.random() * 3)],
            taskDescription: willBeAbnormal ?
              '處理異常行為和信號異常事件' :
              '執行船舶追蹤和行為分析'
          };

          // 通過統一管理器創建軌跡點
          if (window.missionTrackManager) {
            window.missionTrackManager.createTrackPoint(trackPoint);
          }

          // 為軌跡點創建對應的派遣任務
          const missionTypes = ['UAV 派遣', '衛星重拍', '持續追蹤', '聯繫船隻'];
          const missionType = missionTypes[Math.floor(Math.random() * missionTypes.length)];
          const missionData = {
            type: missionType,
            action: missionType === 'UAV 派遣' ? 'uav' :
                   missionType === '衛星重拍' ? 'satellite' :
                   missionType === '聯繫船隻' ? 'notify' : 'track',
            target: `${shiptype} 船隻 - ${trackPoint.lat.toFixed(4)}°N ${trackPoint.lon.toFixed(4)}°E`,
            status: trackPoint.type === 'History' ? '已完成' :
                   trackPoint.type === 'Current' ? '執行任務' : '排程',
            progress: trackPoint.type === 'History' ? 100 :
                     trackPoint.type === 'Current' ? 75 : 25,
            description: `${missionType}任務 - 監控目標船隻活動`,
            estimatedCompletion: trackPoint.type !== 'History' ?
              new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString('zh-TW', {hour12: false}) : null,
            sourceTrackPointId: trackPoint.id
          };

          if (window.missionTrackManager) {
            const missionId = window.missionTrackManager.createMission(missionData);

            // 建立軌跡點與任務的雙向連結
            const managedPoint = window.missionTrackManager.trackPoints.get(trackPoint.id);
            const managedMission = window.missionTrackManager.missions.get(missionId);
            if (managedPoint && managedMission) {
              managedPoint.boundMissionId = missionId;
              managedMission.boundPointId = trackPoint.id;
            }
          }

          trackData.push(trackPoint);
        }
      });

      // 添加未來點
      const futurePoints = allOriginalPoints.filter(p => p.type === 'Future');
      futurePoints.slice(0, 3).forEach((point, index) => {
        const hours = (index + 1) * 3; // 3, 6, 9小時後
        const timestamp = new Date(currentTime.getTime() + hours * 60 * 60 * 1000);

        const futureTrackPoint = {
          ...point,
          id: `${shiptype}_future_${hours}h`,
          timestamp: timestamp.toISOString(),
          speed: 12 + Math.random() * 8,
          signalStrength: -50 - Math.random() * 25,
          deviationFromRoute: Math.random() * 3,
          inRestrictedZone: false,
          hasTask: true, // 確保每個點都有任務
          course: 45 + Math.random() * 90,
          reportTime: timestamp.toLocaleTimeString('zh-TW', {hour12: false}),
          taskType: ['監控任務', '追蹤任務', '偵察任務'][Math.floor(Math.random() * 3)],
          taskDescription: '執行船舶追蹤和行為分析'
        };

        // 通過統一管理器創建軌跡點
        if (window.missionTrackManager) {
          window.missionTrackManager.createTrackPoint(futureTrackPoint);
        }

        // 為未來軌跡點創建對應的派遣任務
        const futureMissionTypes = ['UAV 派遣', '衛星重拍', '持續追蹤', '聯繫船隻'];
        const futureMissionType = futureMissionTypes[Math.floor(Math.random() * futureMissionTypes.length)];
        const futureMissionData = {
          type: futureMissionType,
          action: futureMissionType === 'UAV 派遣' ? 'uav' :
                 futureMissionType === '衛星重拍' ? 'satellite' :
                 futureMissionType === '聯繫船隻' ? 'notify' : 'track',
          target: `${shiptype} 船隻 - ${futureTrackPoint.lat.toFixed(4)}°N ${futureTrackPoint.lon.toFixed(4)}°E`,
          status: '排程',
          progress: 0,
          description: `${futureMissionType}任務 - 預定監控目標船隻活動`,
          estimatedCompletion: new Date(timestamp.getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString('zh-TW', {hour12: false}),
          sourceTrackPointId: futureTrackPoint.id,
          scheduledTime: timestamp.toISOString()
        };

        if (window.missionTrackManager) {
          const futureMissionId = window.missionTrackManager.createMission(futureMissionData);

          // 建立軌跡點與任務的雙向連結
          const managedFuturePoint = window.missionTrackManager.trackPoints.get(futureTrackPoint.id);
          const managedFutureMission = window.missionTrackManager.missions.get(futureMissionId);
          if (managedFuturePoint && managedFutureMission) {
            managedFuturePoint.boundMissionId = futureMissionId;
            managedFutureMission.boundPointId = futureTrackPoint.id;
          }
        }

        trackData.push(futureTrackPoint);
      });

      return trackData;
    }

    // 根據船隻 MMSI 查找事件資料
    getEventByShipInfoMMSI(mmsi) {
      for (const [eventId, eventData] of this.events) {
        if (eventData.shipInfo && eventData.shipInfo.mmsi === mmsi) {
          return eventData;
        } else {
          console.log(`Event ${eventId} does not match MMSI ${mmsi}`);
        }
      }
      return null;
    }
  }

  // expose a global instance
  window.eventStorage = new EventStorage();
})();
