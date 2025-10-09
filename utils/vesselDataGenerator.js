// VesselDataGenerator - 船隻資料生成器
(function(){
  class VesselDataGenerator {
    constructor() {
      this.vesselNames = [
        '海龍號', '遠洋之星', '藍鯨', '金剛', '勝利號',
        '太平洋', '海鷗號', '順風號', '長城', '和平號',
        '福星號', '龍騰', '雄鷹', '晨曦', '希望'
      ];
    }

    /**
     * 生成隨機船隻資料
     */
    generateRandomVessel() {
      const riskScore = this.generateRiskScore();
      const coordinates = this.generateSeaCoordinate();

      return {
        mmsi: this.generateMMSI(),
        vesselName: this.getRandomVesselName(),
        coordinates: coordinates.string,
        lat: coordinates.lat,
        lon: coordinates.lon,
        riskScore: riskScore,
        aisStatus: Math.random() > 0.5 ? '已開啟' : '未開啟',
        speed: Math.random() * 30,
        course: Math.floor(Math.random() * 360),
        timestamp: new Date().toISOString(),
        investigationReason: riskScore >= 70 ? this.getHighRiskReason() : '例行監控'
      };
    }

    /**
     * 生成威脅分數 (30%機率≥70)
     */
    generateRiskScore() {
      // 30% 機率生成高風險（≥70）
      if (Math.random() < 0.3) {
        return Math.floor(Math.random() * 30) + 70; // 70-100
      }
      return Math.floor(Math.random() * 70); // 0-69
    }

    /**
     * 生成隨機 MMSI
     */
    generateMMSI() {
      return '416' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    }

    /**
     * 隨機選擇船舶名稱
     */
    getRandomVesselName() {
      return this.vesselNames[Math.floor(Math.random() * this.vesselNames.length)];
    }

    /**
     * 生成海域座標
     */
    generateSeaCoordinate() {
      const lat = 10 + Math.random() * 15; // 10°N - 25°N
      const lon = 109 + Math.random() * 12; // 109°E - 121°E

      return {
        lat: lat,
        lon: lon,
        string: `${lat.toFixed(3)}°N, ${lon.toFixed(3)}°E`
      };
    }

    /**
     * 取得高風險原因
     */
    getHighRiskReason() {
      const reasons = [
        'AIS 信號異常關閉',
        '航線嚴重偏離',
        '進入禁航區域',
        '異常高速航行',
        '頻繁變更航向',
        'RF 信號異常',
        '未經授權進入管制區'
      ];
      return reasons[Math.floor(Math.random() * reasons.length)];
    }

    /**
     * 取得一般風險原因
     */
    getNormalRiskReason() {
      const reasons = [
        '例行監控',
        '定期巡查',
        '航線檢查',
        '區域巡邏',
        '常規追蹤'
      ];
      return reasons[Math.floor(Math.random() * reasons.length)];
    }

    /**
     * 根據 MMSI 生成完整船舶資料
     * @param {string} mmsi - 船舶的 MMSI 識別碼
     * @returns {Object} 包含完整船舶資訊的物件
     */
    generateVesselDataByMMSI(mmsi) {
      const riskScore = this.generateRiskScore();
      const coordinates = this.generateSeaCoordinate();
      const aisStatus = Math.random() > 0.5 ? '已開啟' : '未開啟';
      const speed = (Math.random() * 30).toFixed(1); // 航速 0-30 節
      const course = Math.floor(Math.random() * 360); // 航向 0-359 度

      // 生成船隻類型
      const vesselTypes = ['貨輪', '漁船',];
      const vesselType = vesselTypes[Math.floor(Math.random() * vesselTypes.length)];

      // 生成軌跡點數據（模擬歷史航跡）
      const trackPoints = this.generateTrackPoints(coordinates.lat, coordinates.lon, 5);

      return {
        mmsi: mmsi,
        vesselName: this.getRandomVesselName(),
        vesselType: vesselType,
        coordinates: coordinates.string,
        lat: coordinates.lat,
        lon: coordinates.lon,
        threatScore: riskScore,
        aisStatus: aisStatus,
        speed: parseFloat(speed),
        course: course,
        timestamp: new Date().toISOString(),
        trackPoints: trackPoints,
        // 如果威脅分數高，自動生成警示時間
        alertTime: riskScore >= 70 ? this.generateAlertTime() : null
      };
    }

    /**
     * 生成軌跡點（模擬船隻移動歷史）
     * @param {number} currentLat - 當前緯度
     * @param {number} currentLon - 當前經度
     * @param {number} count - 要生成的軌跡點數量
     */
    generateTrackPoints(currentLat, currentLon, count = 5) {
      const trackPoints = [];
      let lat = currentLat;
      let lon = currentLon;

      // 從當前位置往回推算歷史位置
      for (let i = count - 1; i >= 0; i--) {
        // 每個點相對於前一個點有輕微的隨機偏移
        lat += (Math.random() - 0.5) * 0.1; // 緯度偏移
        lon += (Math.random() - 0.5) * 0.1; // 經度偏移

        const timestamp = new Date(Date.now() - i * 3600000); // 每小時一個點
        trackPoints.push({
          lat: parseFloat(lat.toFixed(3)),
          lon: parseFloat(lon.toFixed(3)),
          timestamp: timestamp.toISOString(),
          speed: (Math.random() * 30).toFixed(1),
          course: Math.floor(Math.random() * 360)
        });
      }

      return trackPoints;
    }

    /**
     * 生成警示時間（當前時間 + 5分鐘）
     */
    generateAlertTime() {
      const now = new Date();
      const alertTime = new Date(now.getTime() + 5 * 60000); // 5分鐘後
      return alertTime.toLocaleTimeString('zh-TW', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }

  // 暴露全局實例
  window.vesselDataGenerator = new VesselDataGenerator();
  console.log('✅ VesselDataGenerator 已初始化');
})();
