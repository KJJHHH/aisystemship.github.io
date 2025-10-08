// ThreatAlertManager - 威脅警示管理器
(function(){
  class ThreatAlertManager {
    constructor() {
      this.alertThreshold = 70;
      this.checkInterval = 10000; // 10秒
      this.intervalId = null;
    }

    /**
     * 開始威脅監控
     */
    startMonitoring() {
      console.log('🚨 開始威脅警示監控 (每10秒檢查一次)');

      this.intervalId = setInterval(() => {
        this.checkForThreats();
      }, this.checkInterval);

      // 立即執行一次（可選）
      // this.checkForThreats();
    }

    /**
     * 停止威脅監控
     */
    stopMonitoring() {
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        console.log('🛑 停止威脅警示監控');
      }
    }

    /**
     * 檢查威脅
     */
    checkForThreats() {
      // 生成新船隻資料
      if (typeof window.vesselDataGenerator === 'undefined') {
        console.error('❌ VesselDataGenerator 未初始化');
        return;
      }

      const vesselData = window.vesselDataGenerator.generateRandomVessel();

      console.log(`🔍 檢查船隻: MMSI ${vesselData.mmsi}, 威脅分數: ${vesselData.riskScore}`);

      // 如果威脅分數 ≥70，觸發警示
      if (vesselData.riskScore >= this.alertThreshold) {
        this.triggerAlert(vesselData);
      }
    }

    /**
     * 觸發警示
     */
    triggerAlert(vesselData) {
      console.log(`🚨 威脅警示！船隻 MMSI ${vesselData.mmsi}, 威脅分數: ${vesselData.riskScore}`);

      // 1. 建立船舶事件
      const eventId = this.createVesselEvent(vesselData);

      // 2. 顯示通知
      this.showNotification(vesselData, eventId);

      // 3. 事件卡發亮動畫
      this.highlightEventCard(eventId);
    }

    /**
     * 建立船舶事件
     */
    createVesselEvent(vesselData) {
      if (typeof window.eventStorage === 'undefined') {
        console.error('❌ EventStorage 未初始化');
        return null;
      }

      if (typeof window.eventCounter === 'undefined') {
        window.eventCounter = 4; // 從 vessel-005 開始
      }

      const eventId = `vessel-${String(++window.eventCounter).padStart(3, '0')}`;

      const eventData = {
        type: 'vessel',
        mmsi: vesselData.mmsi,
        vesselName: vesselData.vesselName,
        coordinates: vesselData.coordinates,
        riskScore: vesselData.riskScore,
        aisStatus: vesselData.aisStatus,
        createTime: new Date().toLocaleTimeString('zh-TW', {hour12: false, hour: '2-digit', minute: '2-digit'}),
        status: 'investigating',
        investigationReason: vesselData.investigationReason,
        isAlertActive: true,
        alertViewed: false,
        trackPoints: this.generateSimulatedTrackPoints(vesselData)
      };

      // 儲存事件（會自動生成 alertTime）
      window.eventStorage.saveEvent(eventId, eventData);

      // 建立事件卡
      if (typeof window.createEventCard === 'function') {
        const displayInfo = {
          content: `MMSI: ${vesselData.mmsi}<br>座標: ${vesselData.coordinates}<br>威脅分數: ${vesselData.riskScore}`
        };
        window.createEventCard(eventId, 'vessel', eventData, displayInfo);
      } else {
        console.warn('⚠️ createEventCard 函數不存在');
      }

      return eventId;
    }

    /**
     * 生成模擬軌跡點（簡化版）
     */
    generateSimulatedTrackPoints(vesselData) {
      if (typeof window.eventStorage === 'undefined' ||
          typeof window.eventStorage.generateSimulatedTrackPoints !== 'function') {
        return [];
      }

      // 使用 eventStorage 的方法生成軌跡點
      return window.eventStorage.generateSimulatedTrackPoints('cargo');
    }

    /**
     * 顯示通知
     */
    showNotification(vesselData, eventId) {
      // 建立通知元素
      const notification = document.createElement('div');
      notification.className = 'threat-notification';
      notification.innerHTML = `
        <div class="notification-icon">🚨</div>
        <div class="notification-content">
          <div class="notification-title">高威脅警示</div>
          <div class="notification-text">
            船隻 ${vesselData.mmsi}<br>
            威脅分數: <span style="color: #fff; font-weight: bold;">${vesselData.riskScore}</span>
          </div>
        </div>
      `;

      // 添加點擊事件 - 點擊通知跳轉到事件
      notification.onclick = () => {
        const eventCard = document.querySelector(`[data-event-id="${eventId}"]`);
        if (eventCard) {
          eventCard.click();
        }
        notification.remove();
      };

      document.body.appendChild(notification);

      // 3秒後自動消失
      setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    /**
     * 事件卡高亮
     */
    highlightEventCard(eventId) {
      setTimeout(() => {
        const eventCard = document.querySelector(`[data-event-id="${eventId}"]`);
        if (eventCard) {
          eventCard.classList.add('alert-active');

          // 10秒後移除閃爍效果
          setTimeout(() => {
            eventCard.classList.remove('alert-active');
          }, 10000);
        }
      }, 100);
    }
  }

  // 暴露全局實例
  window.threatAlertManager = new ThreatAlertManager();
  console.log('✅ ThreatAlertManager 已初始化');
})();
